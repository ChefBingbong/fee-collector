import mongoose, { Schema } from "mongoose";
import { Address } from "viem";
import { ModelType } from "../types";

export interface IPriceData {
  tokenAddress: Address;
  tokenSymbol: string;
  priceUsd: number;
  timestamp: number;
}
export const getPriceHistorySchema = (): Schema<
  IPriceData,
  mongoose.Model<IPriceData, any, any, any, any>,
  {},
  {},
  {},
  {},
  mongoose.DefaultSchemaOptions,
  IPriceData
> => {
  const schema = new Schema<IPriceData>(
    {
      tokenAddress: {
        type: String,
        required: true,
      },
      tokenSymbol: {
        type: String,
        required: true,
      },
      priceUsd: {
        type: Number,
        required: true,
      },
    },
    {
      collection: ModelType.priceHistoryInfo,
    },
  );
  schema.index({ timestamp: 1 }, { unique: true });
  return schema;
};
