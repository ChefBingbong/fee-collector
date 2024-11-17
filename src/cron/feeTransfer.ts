import { erc20Abi, getAddress } from "viem";
import { berachainTestnetbArtio as bera } from "viem/chains";
import { GAS_PRICE_THRESHOLD } from "../config/constants";
import { BaseAssetManager, WhitelistTokenMap } from "../cron/BasePriceService/BasePriceService";
import { OperationType, RouterOperationBuilder, UserOp } from "../encoder/encoder";
import { OogaTokenPriceResponse } from "../model/assetManager";
import { Addresses } from "../provider/addresses";
import { PROTOCOL_SIGNER } from "../provider/client";
import { chunks, formatAddress } from "../utils/dbUtils";
import { extractError } from "../utils/extractError";
import { JobExecutor } from "./cronLock";

export class FeeTransfer extends BaseAssetManager {
  private routerOpBuilder: RouterOperationBuilder;

  constructor({ schedule, debug = false }) {
    super({ jobId: "fee-transfer", schedule, debug });
    this.routerOpBuilder = new RouterOperationBuilder();
  }

  public executeCronTask = async (): Promise<void> => {
    if (this.isServiceRunning) {
      throw new Error("No vault history to add");
    }

    this.isServiceRunning = true;
    this.job.createSchedule(this.schedule, async () => {
      await JobExecutor.addToQueue(`feeTransfer-${Date.now()}`, async () => {
        this.logger.info(`[FeeTransferService] started router transfer service - timestamp [${Date.now()}]`);
        try {
          const whitelistedTokens = await this.getWhitelistedTokens();
          const tokenPriceData = await this.getTokenPrices();

          for (const tokenPriceChunk of chunks(tokenPriceData, 50)) {
            await this.tryTransferFees(tokenPriceChunk, whitelistedTokens);
          }
        } catch (error) {
          this.logger.error(`[FeeTransferService]: error ${extractError(error)}`);
          if (error instanceof Error) this.logger.error(error.stack);
        }
        this.logger.info(`[FeeTransferService] finished router transfer service - timestamp [${Date.now()}]\n`);
      });
    });
  };

  private tryTransferFees = async (assetPricesData: OogaTokenPriceResponse[], whitelistedTokens: WhitelistTokenMap) => {
    const client = this.getClient();
    const walletClient = this.getWalletClient();
    const gasPrice = await client.getGasPrice();

    if (gasPrice > GAS_PRICE_THRESHOLD) {
      this.logger.info(
        `[FeeTransferService] [getFeeCollectBalances] No assets found with suffient balance to swap - timestamp [${Date.now()}]`,
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
            args: [PROTOCOL_SIGNER.address], // REPLACE WITH Ooga Router in prod
          },
        ]),
      })
      .catch((error) => {
        this.logger.info(
          `[FeeTransferService] [getFeeCollectBalances] error occured while fetching router balances [${Date.now()}]`,
        );
        throw error;
      });

    const filteredBalanceresults = balanceResults
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

    if (filteredBalanceresults.length === 0) {
      this.logger.info(
        `[FeeTransferService] [getFeeCollectBalances] No assets found with suffient balance to transfer - timestamp [${Date.now()}]`,
      );
      return;
    }

    // const assetsForTransfer = [] as Address[];
    // const assetPices = [] as bigint[];

    // filteredBalanceresults.forEach((assetBalance) => {
    //   assetsForTransfer.push(formatAddress(assetBalance.address));
    //   assetPices.push(100n);
    // });

    // const callType = OperationType.ROUTER_TRANSFER_FROM;
    // const callArgs = [assetsForTransfer, assetPices, Addresses.FeeCollector] as const;

    // this.routerOpBuilder.addUserOperation(callType, callArgs, Addresses.OogaRouter);
    this.logger.info(
      `[FeeTransferService] [transferFeeAssets] preparing to send ${filteredBalanceresults.length} txs - timestamp [${Date.now()}]`,
    );

    try {
      filteredBalanceresults.forEach((meta: { address: `0x${string}`; balance: bigint }) => {
        const callType = OperationType.TRANSFER;
        const args = [Addresses.FeeCollector, meta.balance];
        this.routerOpBuilder.addUserOperation(callType, args as any, meta.address);
      });

      await Promise.all(
        this.routerOpBuilder.userOps.map(async (txConfig: UserOp) => {
          const gasE = await client.estimateGas({ account: PROTOCOL_SIGNER, ...txConfig });
          const rest = { chain: bera, gas: gasE, gasPrice, kzg: undefined };

          const meta = await client.prepareTransactionRequest({ ...txConfig, ...rest });
          const hash = await walletClient.sendTransaction({ ...meta, kzg: undefined });
          const transactionReceipt = await client.waitForTransactionReceipt({ hash });

          this.logger.info(
            `[FeeTransferService] [transferFeeAssets] transfered ${whitelistedTokens.get(formatAddress(txConfig.to))?.symbol} to feeCollector - tx ${transactionReceipt.blockHash} ]`,
          );
        }),
      );
    } catch (error) {
      console.log(error);
      this.logger.error(`msg: ${extractError(error)}`);
    }
  };
}
