import { PublicClient } from "viem";
import { redisClient as redis } from ".";
import appConfig from "./config/config";
import { BaseScheduler } from "./cron/BaseScheduler";
import { ChainId } from "./provider/chains";
import { getPublicClient } from "./provider/client";
import { extractError } from "./utils/extractError";

export type PriceResponse = {
  address: string;
  price: number;
};

const PUBLIC_API_URL = "https://bartio.api.oogabooga.io";
const whitelistedTokens = [
  "0xd6D83aF58a19Cd14eF3CF6fe848C9A4d21e5727c",
  "0x0E4aaF1351de4c0264C5c7056Ef3777b41BD8e03",
  "0x7507c1dc16935B82698e4C63f2746A2fCf994dF8",
];

const GAS_PRICE_THRESHOLD = 10 * 1e9; // e.g., 10 Gwei as the threshold (change as needed)
const POLL_INTERVAL = "*/1 * * * *"; // 1 minute (time interval for polling gas price)
const TRANSFER_THRESHOLD = 10 * 1e9; // Threshold for when you consider gas price low enough for transfers (10 Gwei)

// 1 watch events to gather new fee tokens
// every interval select random fee tokens and check their current bal compared to last
export class FeesCollector {
  //   public logger: Logger;
  public job: BaseScheduler;
  public schedule: string;
  protected debug: boolean;
  private paused: boolean;

  constructor({ jobId, schedule, debug }: any) {
    this.schedule = schedule;
    this.debug = debug;
    this.paused = false;

    //   this.logger = new AppLogger(jobId, debug).logger;
    this.job = new BaseScheduler({ jobId, schedule, process });
  }

  public async executeCronTask(args: any) {
    this.job.createSchedule(this.schedule, async () => {
      try {
        const prices = await this.getTokenPrices();
        await this.retrievePriceDataWithMetadata(prices);
      } catch (error) {
        console.error(`message: ${extractError(error)}, fn: executeCronTask`);
      }
    });
  }

  public getTokenPrices = async (): Promise<PriceResponse[]> => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/prices?currency=USD`, {
      headers: { Authorization: `Bearer ${appConfig.apiKey}` },
    });
    const result = (await response.json()) as PriceResponse[];
    return result.slice(0, 5);
  };

  async storePriceDataWithMetadata(price: PriceResponse[]): Promise<void> {
    const timestamp = Date.now(); // Current timestamp (milliseconds)
    const redisClient = redis.getClient();
    const keyPrefix = `price:`;

    // Using pipeline to execute both ZADD and MSET commands together
    const pipeline = redisClient.pipeline();

    // Add metadata (e.g., additional information) to simple key-value store
    for (const priceData of price) {
      pipeline.zadd(`${keyPrefix}${priceData.address}`, timestamp, priceData.price);
      console.log(`Stored price for ${priceData.address} at ${new Date(timestamp).toISOString()}: ${priceData.price}`);
    }

    // Execute the pipeline
    await pipeline.exec();
    // console.log(`Stored price for ${asset} at ${new Date(timestamp).toISOString()}: ${price}`);
  }

  async retrievePriceDataWithMetadata(price: PriceResponse[]): Promise<void> {
    const keyPrefix = `price:`;
    const redisClient = redis.getClient();

    // Using pipeline to retrieve both price data and metadata in a single operation
    const pipeline = redisClient.pipeline();

    // Retrieve price data from the sorted set (using a time window, for example, the last 1 hour)
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000; // 1 hour ago
    for (const priceData of price) {
      pipeline.zrangebyscore(`${keyPrefix}${priceData.address}`, oneHourAgo, now);
    }
    // Retrieve metadata (e.g., token name, description)

    // Execute the pipeline
    const p = await pipeline.exec();

    console.log("Price Data:", p);
    console.log("Metadata:", p);
    // const x = p.flat()
    const x = p.map((prices: any[]) => {
      if (prices[1].length < 2) {
        console.log("Not enough data to calculate trend");
        return 0; // Not enough data for trend calculation
      }

      const firstPrice = parseFloat(prices[1][0]); // First price in the window
      const lastPrice = parseFloat(prices[1][prices.length - 1]); // Last price in the window

      const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;
      return priceChange;
    });
    console.log(x);
  }

  public getClient(chainId: ChainId): PublicClient {
    const provider = getPublicClient({ chainId });
    return provider;
  }

  public buildErrorMessage(error: any, network: ChainId) {
    let message = error;
    if (error instanceof Error) message = error.message;
    console.error(`Error fetching ${network} Balances for ${this.job.jobId}: ${message}`);
  }
}

const collector = new FeesCollector({ jobId: "fc", schedule: POLL_INTERVAL, debug: false });
collector.executeCronTask({});
