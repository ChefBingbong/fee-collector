import BigNumber from "bignumber.js";
import { Address } from "viem";
import { connection } from "..";
import { BaseAssetManager, OogaAddress } from "../cron/BasePriceService/BasePriceService";
import { BaseScheduler } from "../cron/BaseScheduler";
import { IPriceData } from "../db/schemas/token-price.schema";
import { RouterOperationBuilder } from "../encoder/encoder";
import { PriceHistoryRepository } from "../repository/priceHistory";
import { TIMESTAMPS, getTimestamp } from "../utils/dbUtils";
import { extractError } from "../utils/extractError";

export class FeeCollector extends BaseAssetManager {
	public job: BaseScheduler;
	public schedule: string;
	protected debug: boolean;
	private priceHistoryRepository: PriceHistoryRepository;
	private routerOpBuilder: RouterOperationBuilder;
	public readonly gasPriceThreshold: BigNumber;

	constructor({ jobId, schedule, debug }: any) {
		super({ jobId, schedule, debug });
		this.schedule = schedule;
		this.debug = debug;
		this.gasPriceThreshold = new BigNumber(new BigNumber(7).shiftedBy(9));

		this.job = new BaseScheduler({ jobId, schedule, process });
		this.routerOpBuilder = new RouterOperationBuilder();
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

		const now = Date.now();
		const twelveHrTimestamp = getTimestamp(TIMESTAMPS.TwelveHr, now);
		const oogaPriceData12hr = await this.priceHistoryRepository.getByRange(OogaAddress.toLowerCase() as Address, twelveHrTimestamp, now);
		const currentOogaTrend = this.getPriceChange(oogaPriceData12hr);

		if (currentOogaTrend < 0 || new BigNumber(Number(gasPrice)) > this.gasPriceThreshold) return;

		const assetsToSwap = [];
		assets.forEach(async (asset: string) => {
			const prices12hr = await this.priceHistoryRepository.getByRange(asset as Address, twelveHrTimestamp, now);
			const currentTrend = this.getPriceChange(prices12hr);
			const isAssetVolatile = this.isVolatile(prices12hr, 2, whitelistedTokens.get(asset as Address).symbol);

			if (currentTrend < 0 && !isAssetVolatile) assetsToSwap.push(asset);
			this.logger.info(`ooga price change 12hr ${prices12hr[0].priceChange12Hr}, gasPrice ${gasPrice} current trend ${currentTrend}`);
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
		const variance = values.reduce((acc, val) => acc + (val - mean) ** 2, 0) / values.length;
		return Math.sqrt(variance);
	}

	private isVolatile(prices: IPriceData[], threshold: number, asset: string): boolean {
		const changes = this.calculatePercentageChanges(prices);
		const volatility = this.calculateStandardDeviation(changes);
		return volatility > threshold;
	}

	private getPriceChange = (priceData: IPriceData[]) => {
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
