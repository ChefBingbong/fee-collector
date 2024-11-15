import BigNumber from "bignumber.js";
import { Address } from "viem";
import { connection } from "..";
import { BaseAssetManager, OogaAddress } from "../cron/BasePriceService/BasePriceService";
import { BaseScheduler } from "../cron/BaseScheduler";
import { IPriceData } from "../db/schemas/token-price.schema";
import { PriceHistoryRepository } from "../repository/priceHistory";
import { TIMESTAMPS, getTimestamp } from "../utils/dbUtils";
import { extractError } from "../utils/extractError";

export class FeeCollector extends BaseAssetManager {
	public job: BaseScheduler;
	public schedule: string;
	protected debug: boolean;
	private priceHistoryRepository: PriceHistoryRepository;
	public readonly gasPriceThreshold: BigNumber;

	constructor({ jobId, schedule, debug }: any) {
		super({ jobId, schedule, debug });
		this.schedule = schedule;
		this.debug = debug;
		this.gasPriceThreshold = new BigNumber(new BigNumber(7).shiftedBy(9));
		this.job = new BaseScheduler({ jobId, schedule, process });
		this.priceHistoryRepository = new PriceHistoryRepository(connection);
	}

	public executeCronTask = async (): Promise<void> => {
		this.job.createSchedule(this.schedule, async () => {
			try {
				await this.checkForOptimalFeeCollection();
			} catch (error) {
				const errMsg = extractError(error);
				this.logger.error(`msg: ${errMsg}`);
			}
		});
	};

	private checkForOptimalFeeCollection = async () => {
		const client = this.getClient();
		const gasPrice = await client.getGasPrice();

		const whitelistedTokens = await this.getWhitelistedTokens();
		const assets = (await this.getTokenPrices()).map((p) => p.address.toLowerCase());
		const oogaPriceData = await this.priceHistoryRepository.getLatest(OogaAddress.toLowerCase() as Address);

		if (oogaPriceData.priceChange12Hr < 0 || new BigNumber(Number(gasPrice)) > this.gasPriceThreshold) return;

		assets.forEach(async (asset: string) => {
			const now = Date.now();
			const twelveHrTimestamp = getTimestamp(TIMESTAMPS.TwelveHr, now);
			const prices12hr = await this.priceHistoryRepository.getByRange(asset as Address, twelveHrTimestamp, now);
			const isAssetVolatile = this.isVolatile(prices12hr, 2, whitelistedTokens.get(asset as Address).symbol);

			this.logger.info(`ooga price change 12hr ${prices12hr[0].priceChange12Hr}, gasPrice ${gasPrice}`);
		});
	};

	private calculatePercentageChanges(prices: IPriceData[]): number[] {
		const changes: number[] = [];
		for (let i = 1; i < prices.length; i++) {
			const percentageChange = ((prices[i].priceUsd - prices[i - 1].priceUsd) / prices[i - 1].priceUsd) * 100;
			changes.push(percentageChange);
		}
		return changes;
	}

	private calculateStandardDeviation(values: number[]): number {
		const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
		// biome-ignore lint/style/useExponentiationOperator: <explanation>
		const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
		return Math.sqrt(variance);
	}

	private isVolatile(prices: IPriceData[], threshold: number, asset: string): boolean {
		const changes = this.calculatePercentageChanges(prices);
		const volatility = this.calculateStandardDeviation(changes);
		// this.logger.info(`asset: ${asset} volatility: ${volatility}`);
		return volatility > threshold;
	}

	private calculateSlippage(expectedPrice: number, executionPrice: number): number {
		return ((executionPrice - expectedPrice) / expectedPrice) * 100;
	}
}
