import { Connection, Model } from "mongoose";
import { Address } from "viem";
import { IPriceData, getPriceHistorySchema } from "../db/schemas/token-price.schema";
import { ModelType } from "../db/types";
import { AppLogger } from "../logging/logger";
import { chunks } from "../utils/dbUtils";

export class PriceHistoryRepository extends AppLogger {
  private readonly connection: Connection;

  constructor(connection: Connection) {
    super(`price-actions-logger`);
    this.connection = connection;
  }

  public addMany = async (assetAddress: Address, priceHistoryData: IPriceData[]) => {
    if (priceHistoryData.length === 0) {
      this.logger.error("[VaultHistoryRepository] [add] No vault history to add");
      throw new Error("No vault history to add");
    }

    const model = this.getModel(assetAddress);
    for (const chunk of chunks(priceHistoryData, 100)) {
      try {
        const result = await model.insertMany<IPriceData>(chunk);
        this.logger.debug(`[PriceInfoRepository] [add] Inserted ${result?.length} vault history`);
      } catch (error) {
        this.logger.error(
          `[PriceInfoRepository] [add] Error inserting price history for : [${assetAddress}] -> ${error}`,
        );
      }
    }
  };

  public addOne = async (assetAddress: Address, priceHistoryData: IPriceData) => {
    if (!priceHistoryData) {
      this.logger.error("[VaultHistoryRepository] [addOne] No vault history to add");
      throw new Error("No vault history to add");
    }

    try {
      const model = this.getModel(assetAddress);
      await model.create<IPriceData>(priceHistoryData);
      this.logger.debug(`[PriceInfoRepository] [addOne] Inserted price history ${assetAddress}`);
    } catch (error) {
      this.logger.error(
        `[PriceInfoRepository] [addOne] Error inserting price history for : [${assetAddress}] -> ${error}`,
      );
      throw new Error(`Error inserting vault history for ${assetAddress}`);
    }
  };

  public get = async (assetAddress: Address, timestamp: number): Promise<IPriceData | null> => {
    try {
      const model = this.getModel(assetAddress);
      return await model.findOne({ timestamp: timestamp });
    } catch (error) {
      this.logger.error(`[PriceInfoRepository] [get] Error getting price history for : [${assetAddress}] - [${error}]`);
      throw new Error(`Error getting vault history for ${assetAddress}`);
    }
  };

  public getLatest = async (assetAddress: Address): Promise<IPriceData | null> => {
    try {
      const model = this.getModel(assetAddress);
      return model.findOne().sort({ timestamp: -1 }).limit(1).exec();
    } catch (error) {
      this.logger.error(`[PriceInfoRepository] [get] Error getting price history for : [${assetAddress}] - [${error}]`);
      throw new Error(`Error getting vault history for ${assetAddress}`);
    }
  };

  public getByRange = async (
    assetAddress: Address,
    startTimestamp: number,
    endTimestamp: number,
  ): Promise<IPriceData[]> => {
    try {
      const model = this.getModel(assetAddress);

      return await model.find({
        timestamp: {
          $gte: startTimestamp,
          $lte: endTimestamp,
        },
      });
    } catch (error) {
      this.logger.error(`[PriceInfoRepository] [get] Error getting price history for : [${assetAddress}] - [${error}]`);
      throw new Error(`Error getting vault history for ${assetAddress}`);
    }
  };

  private getModel = (assetAddress: string): Model<IPriceData> => {
    const type = this.getVaultHistoryModelName(assetAddress);
    if (this.connection.modelNames().includes(type)) {
      return this.connection.model(type);
    }
    return this.connection.model(type, getPriceHistorySchema(type));
  };

  private getVaultHistoryModelName = (assetAddress: string): string => {
    return `${ModelType.priceHistoryInfo}_${assetAddress}`;
  };

  public getConnection = () => this.connection;
}
