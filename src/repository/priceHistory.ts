import { Connection, Model } from "mongoose";
import { IPriceData, getPriceHistorySchema } from "../db/schemas/token-price.schema";
import { ModelType } from "../db/types";
import { AppLogger } from "../logging/logger";
import { chunks } from "../utils/dbUtils";

export class PriceHistoryRepository extends AppLogger {
	public readonly collectionId: string;
	private readonly connection: Connection;
	private readonly model: Model<IPriceData>;

	constructor(id: string, connection: Connection) {
		super(`${id}-logger`);
		this.collectionId = id;
		this.connection = connection;
		this.model = connection.model<IPriceData>(ModelType.priceHistoryInfo, getPriceHistorySchema());
	}

	public addMany = async (priceHistoryData: IPriceData[]) => {
		if (priceHistoryData.length === 0) {
			this.logger.error("[VaultHistoryRepository] [add] No vault history to add");
			throw new Error("No vault history to add");
		}

		for (const chunk of chunks(priceHistoryData, 100)) {
			try {
				const result = await this.model.insertMany<IPriceData>(chunk);
				this.logger.info(`[PriceInfoRepository] [add] Inserted ${result?.length} vault history`);
			} catch (error) {
				this.logger.error(`[PriceInfoRepository] [add] Error inserting price history for : [${this.collectionId}] -> ${error}`);
			}
		}
	};

	public addOne = async (priceHistoryData: IPriceData) => {
		if (!priceHistoryData) {
			this.logger.error("[VaultHistoryRepository] [addOne] No vault history to add");
			throw new Error("No vault history to add");
		}

		try {
			await this.model.create<IPriceData>(priceHistoryData);
			this.logger.info(`[PriceInfoRepository] [addOne] Inserted vault history`);
		} catch (error) {
			this.logger.error(`[PriceInfoRepository] [addOne] Error inserting vault history for : [${this.collectionId}] -> ${error}`);
			throw new Error(`Error inserting vault history for ${this.collectionId}`);
		}
	};

	public get = async (timestamp: number): Promise<IPriceData | null> => {
		try {
			return await this.model.findOne({ timestamp: timestamp });
		} catch (error) {
			this.logger.error(`[PriceInfoRepository] [get] Error getting vault history for : [${this.collectionId}] - [${error}]`);
			throw new Error(`Error getting vault history for ${this.collectionId}`);
		}
	};

	public getByRange = async (startTimestamp: number, endTimestamp: number): Promise<IPriceData[]> => {
		try {
			return await this.model.find({
				timestamp: {
					$gte: startTimestamp,
					$lte: endTimestamp,
				},
			});
		} catch (error) {
			this.logger.error(`[PriceInfoRepository] [get] Error getting vault history for : [${this.collectionId}] - [${error}]`);
			throw new Error(`Error getting vault history for ${this.collectionId}`);
		}
	};

	public getConnection = () => this.connection;
}
