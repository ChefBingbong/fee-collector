import mongoose, { Schema } from "mongoose";
import { Address } from "viem";

export interface IPriceData {
  tokenAddress: Address;
  tokenSymbol: string;
  priceUsd: number;
  priceChange24Hr: number;
  priceChange12Hr: number;
  timestamp: number;
}
export const getPriceHistorySchema = (
  collectionName: string,
): Schema<
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
      priceChange24Hr: {
        type: Number,
        required: true,
      },
      priceChange12Hr: {
        type: Number,
        required: true,
      },
      timestamp: {
        type: Number,
        required: true,
      },
    },
    {
      collection: collectionName,
    },
  );
  schema.index({ timestamp: 1 }, { unique: true });
  return schema;
};
