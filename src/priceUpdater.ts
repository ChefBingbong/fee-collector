import { Address } from "viem";
import { connection } from ".";
import { BaseAssetManager, PriceResponse, TokenInfo } from "./cron/BasePriceService/BasePriceService";
import { BaseScheduler } from "./cron/BaseScheduler";
import { JobExecutor } from "./cron/cronLock";
import { IPriceData } from "./db/schemas/token-price.schema";
import { PriceHistoryRepository } from "./repository/priceHistory";
import { TIMESTAMPS, getTimestamp } from "./utils/dbUtils";
import { extractError } from "./utils/extractError";

export class PriceUpdater extends BaseAssetManager {
	public job: BaseScheduler;
	public schedule: string;
	protected debug: boolean;
	public whitelistedTokens: Map<Address, TokenInfo>;
	private priceHistoryRepository: PriceHistoryRepository;
	private isServiceRunning: boolean;

	constructor({ jobId, schedule, debug }: any) {
		super({ jobId, schedule, debug });
		this.schedule = schedule;
		this.debug = debug;
		this.isServiceRunning = false;

		this.job = new BaseScheduler({ jobId, schedule, process });
		this.priceHistoryRepository = new PriceHistoryRepository(connection);
	}

	public executeCronTask = async (): Promise<void> => {
		if (this.isServiceRunning) {
			throw new Error("No vault history to add");
		}

		this.whitelistedTokens = await this.getWhitelistedTokens();
		this.isServiceRunning = true;

		this.job.createSchedule(this.schedule, async () => {
			const taskId = `${this.job.jobId}-${Date.now()}`;
			await JobExecutor.addToQueue(taskId, async () => {
				try {
					const prices = await this.getTokenPrices();
					await this.updatePriceHistoryData(prices);
				} catch (error) {
					const errMsg = extractError(error);
					this.logger.error(`msg: ${errMsg}`);
				}
			});
		});
	};

	async updatePriceHistoryData(assetPricesData: PriceResponse[]): Promise<void> {
		const now = Date.now();
		const twelveHrTimestamp = getTimestamp(TIMESTAMPS.TwelveHr, now);
		const twentyFourHrTimestamp = getTimestamp(TIMESTAMPS.TwentyFourHr, now);

		assetPricesData.forEach((priceData: PriceResponse) => {
			const tokenAddress = priceData.address.toLowerCase() as Address;
			const priceHistoryProms: Promise<IPriceData[]>[] = [
				this.priceHistoryRepository.getByRange(tokenAddress, twelveHrTimestamp, now),
				this.priceHistoryRepository.getByRange(tokenAddress, twentyFourHrTimestamp, now),
			];

			Promise.all(priceHistoryProms)
				.then(([twelveHrData, twentyFourHrData]) => {
					const priceChange12Hr = this.getPriceChange(twelveHrData);
					const priceChange24Hr = this.getPriceChange(twentyFourHrData);
					const tokenSymbol = this.whitelistedTokens.get(tokenAddress)?.symbol ?? "NULL";

					this.priceHistoryRepository.addOne(tokenAddress, {
						tokenSymbol,
						tokenAddress,
						priceUsd: priceData.price,
						priceChange12Hr,
						priceChange24Hr,
						timestamp: now,
					});
				})
				.catch((error) => {
					const errorMessage = extractError(error);
					this.logger.error(`message: ${errorMessage}, fn: updatePriceHistoryData`);
				});
		});
	}

	private getPriceChange = (priceData: IPriceData[]) => {
		if (priceData.length === 0) return 0;
		const firstPrice = priceData[0].priceUsd;
		const lastPrice = priceData[priceData.length - 1].priceUsd;

		return ((lastPrice - firstPrice) / firstPrice) * 100;
	};
}
