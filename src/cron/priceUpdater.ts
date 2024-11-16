import { connection } from "..";
import { BaseAssetManager, WhitelistTokenMap } from "../cron/BasePriceService/BasePriceService";
import { IPriceData } from "../db/schemas/token-price.schema";
import { OogaTokenPriceResponse } from "../model/assetManager";
import { PriceHistoryRepository } from "../repository/priceHistory";
import { TIMESTAMPS, chunks, formatAddress, getTimestamp } from "../utils/dbUtils";
import { extractError } from "../utils/extractError";

export class PriceUpdater extends BaseAssetManager {
  private priceHistoryRepository: PriceHistoryRepository;
  private isServiceRunning: boolean;

  constructor({ jobId, schedule, debug }: any) {
    super({ jobId, schedule, debug });
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

        const whitelistedTokens = await this.getWhitelistedTokens();
        const tokenPriceData = await this.getTokenPrices();

        for (const tokenPriceChunk of chunks(tokenPriceData, 50)) {
          await this.updatePriceHistoryData(tokenPriceChunk, whitelistedTokens);
        }
        this.logger.info(`${this.job.jobId} task ended\n`);
      } catch (error) {
        this.logger.error(`msg: ${extractError(error)}`);
      }
    });
  };

  public stopCurrentTask = () => {
    if (!this.isServiceRunning) throw new Error("No vault history to add");
    this.job.stopCronJob();
    this.isServiceRunning = false;
  };

  async updatePriceHistoryData(
    assetPricesData: OogaTokenPriceResponse[],
    whitelistedTokens: WhitelistTokenMap,
  ): Promise<void> {
    const now = Date.now();
    const twelveHrTimestamp = getTimestamp(TIMESTAMPS.TwelveHr, now);
    const twentyFourHrTimestamp = getTimestamp(TIMESTAMPS.TwentyFourHr, now);

    assetPricesData.forEach((priceData: OogaTokenPriceResponse) => {
      const tokenAddress = formatAddress(priceData.address);

      const priceHistoryProms: Promise<IPriceData[]>[] = [
        this.priceHistoryRepository.getByRange(tokenAddress, twelveHrTimestamp, now),
        this.priceHistoryRepository.getByRange(tokenAddress, twentyFourHrTimestamp, now),
      ];

      Promise.all(priceHistoryProms)
        .then(([twelveHrData, twentyFourHrData]) => {
          const tokenSymbol = whitelistedTokens.get(tokenAddress).symbol;
          const priceChange12Hr = this.getPriceChange(twelveHrData);
          const priceChange24Hr = this.getPriceChange(twentyFourHrData);

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
