import { Address, Hex, erc20Abi, getAddress, maxUint256, zeroAddress } from "viem";
import { berachainTestnetbArtio } from "viem/chains";
import { connection } from "../../app";
import appConfig from "../../config/config";
import { GAS_PRICE_THRESHOLD } from "../../config/constants";
import { IPriceData } from "../../db/schemas/token-price.schema";
import { OperationType, RouterOperationBuilder, encodeOperation } from "../../encoder/encoder";
import { OogaSwapTxResponse, OogaTokenPriceResponse } from "../../model/assetManager";
import { Addresses } from "../../provider/addresses";
import { PROTOCOL_SIGNER } from "../../provider/client";
import { PriceHistoryRepository } from "../../repository/priceHistory";
import { TIMESTAMPS, chunks, formatAddress, getTimestamp } from "../../utils/dbUtils";
import { extractError } from "../../utils/extractError";
import { tryNTimes } from "../../utils/tryNTimes";
import { BaseAssetManager } from "../base/BasePriceService";
import { JobExecutor } from "../base/cronLock";

export class FeeCollector extends BaseAssetManager {
  private priceHistoryRepository: PriceHistoryRepository;
  private routerOpBuilder: RouterOperationBuilder;

  constructor({ schedule, debug = false }) {
    super({ jobId: "fee-collector", schedule, debug });
    this.routerOpBuilder = new RouterOperationBuilder();
    this.priceHistoryRepository = new PriceHistoryRepository(connection);
  }

  public executeCronTask = async (): Promise<void> => {
    if (this.isServiceRunning) {
      throw new Error("No vault history to add");
    }

    this.isServiceRunning = true;
    this.job.createSchedule(this.schedule, async () => {
      await JobExecutor.addToQueue(`feeTransfer-${Date.now()}`, async () => {
        this.logger.info(`[FeeCollectorService] started fee collector service - timestamp [${Date.now()}]`);
        try {
          this.routerOpBuilder.clear();
          const tokenPriceData = await this.getTokenPrices();

          for (const tokenPriceChunk of chunks(tokenPriceData, 50)) {
            await this.checkForOptimalFeeCollection(tokenPriceChunk);
          }
        } catch (error) {
          this.logger.error(`[FeeCollectorService]: error ${extractError(error)}`);
          if (error instanceof Error) this.logger.error(error.stack);
        }
        this.logger.info(`[FeeCollectorService] finished fee collector service - timestamp [${Date.now()}]\n`);
      });
    });
  };

  private checkForOptimalFeeCollection = async (assetPricesData: OogaTokenPriceResponse[]) => {
    const client = this.getClient();
    const walletClient = this.getWalletClient();

    const gasPrice = await client.getGasPrice();
    const isUpTrend = await this.isAssetTrendingUp(formatAddress(Addresses.OogaToken));

    if (gasPrice > GAS_PRICE_THRESHOLD || !isUpTrend) {
      this.logger.info(
        `[FeeCollectorService] [getFeeCollectBalances] No assets found with suffient balance to swap - timestamp [${Date.now()}]`,
      );
      return;
    }

    const balanceResults = await client
      .multicall({
        allowFailure: true,
        // @ts-ignore
        contracts: assetPricesData.flatMap((asset) => [
          {
            abi: erc20Abi,
            address: getAddress(asset.address),
            functionName: "balanceOf",
            args: [Addresses.FeeCollector],
          },
        ]),
      })
      .catch((error) => {
        this.logger.info(
          `[FeeCollectorService] [getFeeCollectBalances] No assets found with suffient balance to swap - timestamp [${Date.now()}]`,
        );
        throw error;
      });

    const feeAssetsWithBalance = balanceResults
      .map((result, index) => {
        if (result.status === "success") {
          return {
            address: assetPricesData[index].address,
            balance: result.result ? BigInt(result.result) : 0n,
          };
        }
        return {
          address: assetPricesData[index].address,
          balance: 0n,
        };
      })
      .filter((v) => v.balance !== 0n);

    if (feeAssetsWithBalance.length === 0) {
      this.logger.info(
        `[FeeCollectorService] [getFeeCollectBalances] No assets found with suffient balance to swap - timestamp [${Date.now()}]`,
      );
      return;
    }

    const assetsToSwapProms = feeAssetsWithBalance.map(async (asset) => {
      const address = formatAddress(asset.address);
      const isUpTrend = await this.isAssetTrendingUp(address);

      if (isUpTrend) {
        return this.getOogaSwapTx({
          tokenIn: asset.address,
          tokenOut: Addresses.OogaToken,
          to: Addresses.OogaRouter,
          slippage: 0.2,
          amount: asset.balance,
        });
      }
      return null;
    });

    const swapTransactionResults = await Promise.allSettled(assetsToSwapProms);

    const swapTransactionData: OogaSwapTxResponse[] = swapTransactionResults
      .filter((response) => response.status === "fulfilled")
      .map((response) => (response.status === "fulfilled" ? response.value : null))
      .filter((value) => value !== null && value.status === "Success");

    if (swapTransactionData.length === 0) {
      this.logger.info(
        `[FeeCollectorService] [getFeeCollectBalances] No assets found with suffient balance to swap - timestamp [${Date.now()}]`,
      );
      return;
    }

    const allowanceResults = await client
      .multicall({
        allowFailure: true,
        // @ts-ignore
        contracts: swapTransactionData.flatMap((txData) => [
          {
            abi: erc20Abi,
            address: getAddress(txData.tokens[0].address),
            functionName: "allowance",
            args: [Addresses.FeeCollector, Addresses.OogaRouterOld],
          },
        ]),
      })
      .catch((error) => {
        this.logger.info(
          `[FeeTransferService] [getFeeCollectBalances] error occured while fetching router balances [${Date.now()}]`,
        );
        throw error;
      });

    const swapAssetsWithAllowance = allowanceResults.map((result, index) => {
      if (result.status === "success") {
        return {
          address: swapTransactionData[index].tokens[0].address,
          data: swapTransactionData[index].routerParams,
          allowance: result.result ? BigInt(result.result) : 0n,
        };
      }
      return {
        address: swapTransactionData[index].tokens[0].address,
        data: swapTransactionData[index].routerParams,
        allowance: null,
      };
    });

    if (swapAssetsWithAllowance.length === 0) {
      this.logger.info(
        `[FeeCollectorService] [getFeeCollectBalances] No assets found with suffient balance to swap - timestamp [${Date.now()}]`,
      );
      return;
    }

    swapAssetsWithAllowance.forEach((meta) => {
      if (meta.allowance !== maxUint256) {
        this.routerOpBuilder.addUserOperation(
          OperationType.APPROVE,
          [Addresses.OogaRouterOld, maxUint256],
          meta.address,
        );
      }
    });
    swapTransactionData.forEach((meta) => {
      const tmp = meta.routerParams.swapTokenInfo;
      const tokenInfo = {
        ...meta.routerParams.swapTokenInfo,
        inputAmount: BigInt(tmp.inputAmount),
        outputMin: BigInt(tmp.outputMin),
        outputQuote: BigInt(tmp.outputQuote),
      };
      this.routerOpBuilder.addUserOperation(
        OperationType.SWAP,
        [tokenInfo, meta.routerParams.pathDefinition, meta.routerParams.executor, meta.routerParams.referralCode],
        Addresses.OogaRouterOld,
      );
    });

    this.logger.info(
      `[FeeTransferService] [transferFeeAssets] preparing to move ${swapTransactionData.length} assets to the feeCollector contract`,
    );

    try {
      const feeCollectorSwapArgs = [this.routerOpBuilder.userOps, appConfig.protocolSigner, zeroAddress];
      const { encodedSelector, encodedInput } = encodeOperation(OperationType.EXEC, feeCollectorSwapArgs as any);
      const encodedOperation = encodedSelector.concat(encodedInput.substring(2)) as Hex;

      await tryNTimes(
        async () => {
          const txConfig = { to: Addresses.FeeCollector, value: 0n, data: encodedOperation };
          const gasEstimate = await client.estimateGas({ ...txConfig, account: PROTOCOL_SIGNER });

          const tradeMeta = await client.prepareTransactionRequest({
            ...txConfig,
            chain: berachainTestnetbArtio,
            gas: gasEstimate,
            gasPrice,
            kzg: undefined,
          });

          const hash = await walletClient.sendTransaction({ ...tradeMeta, kzg: undefined });
          const recieipt = await client.waitForTransactionReceipt({ hash });

          this.logger.info(
            `[FeeCollectorService] [getFeeCollectBalances] No assets found with suffient balance to swap - timestamp [${recieipt.transactionHash}]`,
          );
        },
        3,
        1000,
      );
    } catch (error) {
      this.logger.error(`msg: ${extractError(error)}`);
    }
  };

  private calculateTrendAndVolatility(data: IPriceData[], threshold: number) {
    const mean = data.reduce((sum, val) => sum + val.priceUsd, 0) / data.length;
    const squaredDiffs = data.map((val) => (val.priceUsd - mean) ** 2);
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / data.length;
    return Boolean(Math.sqrt(variance) > threshold);
  }

  private calculateLinearRegression = (data: IPriceData[], period: number) => {
    const n = Math.min(data.length, period);
    const x = Array.from({ length: n }, (_, i) => i);
    const y = data.slice(data.length - n);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b.priceUsd, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i].priceUsd, 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  };

  private isAssetTrendingUp = async (asset: Address) => {
    const end = getTimestamp(TIMESTAMPS.TwelveHr, Date.now());
    const currP = (await this.priceHistoryRepository.getLatest(asset)).priceUsd;
    const prices = await this.priceHistoryRepository.getByRange(asset, end, Date.now());

    const isVolatile = this.calculateTrendAndVolatility(prices, 2);
    const slope = this.calculateLinearRegression(prices, 12);
    const simpleMovingAverage = this.calculateSimpleMovingAverage(prices, 12);
    const ExpMovingAverage = this.calculateAssetExponentialMovingAverage(prices, 12);
    const relativeStrengthIndex = this.calculateRelativeStrengthIndex(prices, 12);

    const rsi = relativeStrengthIndex[relativeStrengthIndex.length - 1];
    const sma = simpleMovingAverage[simpleMovingAverage.length - 1];
    const ema = ExpMovingAverage[ExpMovingAverage.length - 1];

    if (rsi < 30 && slope > 0 && currP > ema && currP > sma && !isVolatile) {
      this.logger.info("[FeeCollectorService] RSI is oversold, LG is bullish, price above EMA and SMA.");
    }
    return Boolean(!(rsi < 30 && slope > 0 && currP > ema && currP > sma && !isVolatile));
  };

  public calculateSimpleMovingAverage(prices: IPriceData[], p: number): number[] {
    const period = Math.min(prices.length, p);
    const simpleMovingAverage: number[] = [];

    for (let i = 0; i <= prices.length - period; i++) {
      const slice = prices.slice(i, i + period);
      const sum = slice.reduce((a, { priceUsd }) => a + priceUsd, 0);
      simpleMovingAverage.push(sum / period);
    }
    return simpleMovingAverage;
  }

  public calculateRelativeStrengthIndex = (priceData: IPriceData[], p: number) => {
    const period = Math.min(priceData.length, p);
    const rsiValues: number[] = [];

    for (let i = period; i < priceData.length; i++) {
      const window = priceData.slice(i - period, i);
      const gains = [];
      const losses = [];

      for (let j = 1; j < window.length; j++) {
        const change = window[j].priceUsd - window[j - 1].priceUsd;
        if (change > 0) {
          gains.push(change);
        } else {
          losses.push(-change);
        }
      }
      const averageGain = gains.reduce((acc, gain) => acc + gain, 0) / period;
      const averageLoss = losses.reduce((acc, loss) => acc + loss, 0) / period;

      const rs = averageGain / averageLoss;
      const rsi = 100 / (1 + rs);
      rsiValues.push(100 - rsi);
    }
    return rsiValues;
  };

  private calculateAssetExponentialMovingAverage = (priceData: IPriceData[], p: number) => {
    const emaValues: number[] = [];
    const period = Math.min(priceData.length, p);
    const smoothingFactor = 2 / (period + 1);
    const initialSMA = priceData.slice(0, period).reduce((acc, price) => acc + price.priceUsd, 0) / period;

    let previousEMA = initialSMA;
    emaValues.push(initialSMA);

    for (let i = period; i < priceData.length; i++) {
      const currentPrice = priceData[i].priceUsd;
      const currentEMA = (currentPrice - previousEMA) * smoothingFactor + previousEMA;
      emaValues.push(currentEMA);
      previousEMA = currentEMA;
    }
    return emaValues;
  };
}
