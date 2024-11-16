import { Address, erc20Abi, getAddress, zeroAddress } from "viem";
import { connection } from "..";
import { GAS_PRICE_THRESHOLD } from "../config/constants";
import { IPriceData } from "../db/schemas/token-price.schema";
import { Call, RouterOperationBuilder } from "../encoder/encoder";
import { OogaSwapTxResponse, OogaTokenPriceResponse } from "../model/assetManager";
import { Addresses } from "../provider/addresses";
import { PriceHistoryRepository } from "../repository/priceHistory";
import { TIMESTAMPS, chunks, formatAddress, getTimestamp } from "../utils/dbUtils";
import { extractError } from "../utils/extractError";
import { BaseAssetManager } from "./BasePriceService/BasePriceService";

export class FeeCollector extends BaseAssetManager {
	private isServiceRunning: boolean;
	private priceHistoryRepository: PriceHistoryRepository;
	private routerOpBuilder: RouterOperationBuilder;

	constructor({ jobId, schedule, debug }: any) {
		super({ jobId, schedule, debug });
		this.routerOpBuilder = new RouterOperationBuilder();
		this.priceHistoryRepository = new PriceHistoryRepository(connection);
	}

	public executeCronTask = async (): Promise<void> => {
		if (this.isServiceRunning) {
			throw new Error("No vault history to add");
		}

		this.isServiceRunning = true;
		this.job.createSchedule(this.schedule, async () => {
			try {
				this.logger.info(`${this.job.jobId} task statred\n`);

				const tokenPriceData = await this.getTokenPrices();

				for (const tokenPriceChunk of chunks(tokenPriceData, 50)) {
					await this.checkForOptimalFeeCollection(tokenPriceChunk);
				}
				this.logger.info(`${this.job.jobId} task finished\n`);
			} catch (error) {
				const errMsg = extractError(error);
				this.logger.error(`msg: ${errMsg}`);
			}
		});
	};

	private checkForOptimalFeeCollection = async (assetPricesData: OogaTokenPriceResponse[]) => {
		const client = this.getClient();
		const walletClient = this.getWalletClient();
		const gasPrice = await client.getGasPrice();

		const now = Date.now();
		const end = getTimestamp(TIMESTAMPS.TwelveHr, now);

		const oogaPrices = await this.priceHistoryRepository.getByRange(Addresses.OogaAddress, end, now);
		const currentOogaTrend = this.calculateAveragedPriceChange(oogaPrices);

		if (gasPrice > GAS_PRICE_THRESHOLD || currentOogaTrend < 0) {
			this.logger.info(`[TransferService] Gas price is to high ${gasPrice}`);
			return;
		}

		const balanceResults = await client.multicall({
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
		});

		const feeAssetsWithBalance: { address: Address; balance: bigint }[] = [];
		const assetsToSwapProms: Promise<OogaSwapTxResponse>[] = [];

		assetPricesData.forEach((asset: OogaTokenPriceResponse, i: number) => {
			if (balanceResults[i].status === "success" && typeof balanceResults[i].result === "bigint") {
				feeAssetsWithBalance.push({ address: formatAddress(asset.address), balance: balanceResults[i].result });
			}
		});

		if (feeAssetsWithBalance.length === 0) {
			this.logger.error(`[TransferService] [tryTransferFees] No success`);
		}

		feeAssetsWithBalance.forEach(async (asset) => {
			const prices12hr = await this.priceHistoryRepository.getByRange(asset.address, end, now);
			const { averageChange, isVolatile } = this.calculateTrendAndVolatility(prices12hr, 2);

			if (averageChange < 0 && !isVolatile) {
				assetsToSwapProms.push(
					this.getOogaSwapTx({
						tokenIn: asset.address,
						tokenOut: Addresses.OogaAddress,
						to: zeroAddress,
						slippage: 0.1,
						amount: asset.balance,
					}),
				);
			}
		});

		const swapTransactionData = (await Promise.allSettled(assetsToSwapProms))
			.filter((response) => response.status === "fulfilled")
			.map((response) => (response.status === "fulfilled" ? response.value : null))
			.filter((value) => value !== null || value.priceImpact > 5);

		if (swapTransactionData.length > 0) {
			const calls = swapTransactionData.map((meta) => ({ target: meta.tx.to, callData: meta.tx.data }));
			this.routerOpBuilder.addMulticallOperation(calls as Call[], zeroAddress);

			try {
				const hash = await walletClient.sendTransaction({ ...(this.routerOpBuilder.userOps[0] as any) });
				const recieipt = await client.waitForTransactionReceipt({ hash });

				this.logger.info(`[TransferService]transaction successufl ${recieipt.transactionHash}`);
			} catch (error) {
				this.logger.error(`msg: ${extractError(error)}`);
			}
		}
	};

	private calculateTrendAndVolatility(
		prices: IPriceData[],
		threshold: number,
	): { isVolatile: boolean; averageChange: number } {
		let totalChange = 0;
		for (let i = 1; i < prices.length; i++) {
			const previousPrice = prices[i - 1].priceUsd;
			const currentPrice = prices[i].priceUsd;
			totalChange += ((currentPrice - previousPrice) / previousPrice) * 100;
		}

		const priceChanges = prices.map((assetPrice, i) => {
			const denominator = prices[i - 1].priceUsd;
			const numerator = prices[i].priceUsd - prices[i - 1].priceUsd;
			return (numerator / denominator) * 100;
		});

		const mean = priceChanges.reduce((acc, val) => acc + val, 0) / priceChanges.length;
		const variance = priceChanges.reduce((acc, val) => acc + (val - mean) ** 2, 0) / priceChanges.length;

		const isVolatile = Boolean(Math.sqrt(variance) > threshold);
		const averageChange = totalChange / (prices.length - 1) / 100;

		return { isVolatile, averageChange };
	}

	private calculateAveragedPriceChange = (priceData: IPriceData[]) => {
		if (priceData.length < 2) return 0;
		let totalChange = 0;

		for (let i = 1; i < priceData.length; i++) {
			const previousPrice = priceData[i - 1].priceUsd;
			const currentPrice = priceData[i].priceUsd;
			const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;
			totalChange += priceChange;
		}
		const averageChange = totalChange / (priceData.length - 1);
		return averageChange / 100;
	};
}
