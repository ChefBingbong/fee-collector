// import { Address, PublicClient, erc20Abi, zeroAddress } from "viem";
// import { obRouterAbi } from "./abi/ObRouter";
// import appConfig from "./config/config";
// import { BaseScheduler } from "./cron/BaseScheduler";
// import { ChainId } from "./provider/chains";
// import { getPublicClient } from "./provider/client";

// export type PriceResponse = {
//   address: string;
//   price: number;
// };

// const PUBLIC_API_URL = "https://bartio.api.oogabooga.io";
// const whitelistedTokens = [
//   "0xd6D83aF58a19Cd14eF3CF6fe848C9A4d21e5727c",
//   "0x0E4aaF1351de4c0264C5c7056Ef3777b41BD8e03",
//   "0x7507c1dc16935B82698e4C63f2746A2fCf994dF8",
// ];
// // 1 watch events to gather new fee tokens
// // every interval select random fee tokens and check their current bal compared to last
// export class FeesCollector {
//   //   public logger: Logger;
//   public job: BaseScheduler;
//   public schedule: string;
//   protected debug: boolean;

//   constructor({ jobId, schedule, debug }: any) {
//     this.schedule = schedule;
//     this.debug = debug;

//     //   this.logger = new AppLogger(jobId, debug).logger;
//     this.job = new BaseScheduler({ jobId, schedule, process });
//   }

//   public async executeCronTask(args: any) {
//     // this.job.createSchedule(this.schedule, async () => {
//     //   try {
//     //     // await this.watchRouterSwaps();
//     //     // await JobExecutor.addToQueue(`${this.job.jobId}`, async () => {
//     //     //   // const tokenPrices = await this.getTokenPrices();
//     //     //   // console.log(tokenPrices);
//     //     //   await this.watchRouterSwaps();
//     //     // });
//     //   } catch (error) {
//     //     console.error(`message: ${extractError(error)}, fn: executeCronTask`);
//     //   }
//     // });
//     await this.watchRouterSwaps();
//   }

//   public getClient(chainId: ChainId): PublicClient {
//     const provider = getPublicClient({ chainId });
//     return provider;
//   }

//   public buildErrorMessage(error: any, network: ChainId) {
//     let message = error;
//     if (error instanceof Error) message = error.message;
//     console.error(`Error fetching ${network} Balances for ${this.job.jobId}: ${message}`);
//   }

//   public getTokenPrices = async (): Promise<PriceResponse[]> => {
//     const response = await fetch(`${PUBLIC_API_URL}/v1/prices?currency=USD`, {
//       headers: { Authorization: `Bearer ${appConfig.apiKey}` },
//     });
//     const result = (await response.json()) as PriceResponse[];
//     return result;
//   };

//   public watchRouterSwaps = async (): Promise<void> => {
//     const publicClient = this.getClient(ChainId.BERA_TESTNET);
//     const unwatch = publicClient.watchContractEvent({
//       address: "0xF6eDCa3C79b4A3DFA82418e278a81604083b999D",
//       abi: obRouterAbi,
//       eventName: "Swap",
//       args: {
//         outputToken: whitelistedTokens as Address[],
//       },
//       onLogs: async (logs) => {
//         const outputToken = logs[0].args.outputToken;
//         const block = logs[0].blockNumber;
//         const amountOut = logs[0].args.amountOut;

//         if (outputToken === zeroAddress) return;
//         const balBefore = await publicClient.readContract({
//           address: outputToken,
//           functionName: "balanceOf",
//           abi: erc20Abi,
//           args: ["0xF6eDCa3C79b4A3DFA82418e278a81604083b999D"],
//           blockNumber: block,
//         });
//         console.log(balBefore, amountOut);
//       },
//     });
//     // unwatch();
//   };
// }

// const collector = new FeesCollector({ jobId: "fc", schedule: "*/12 * * * * *", debug: false });
// collector.executeCronTask({});
import { getConnection } from "./db/mongoClient";
import { ModelType } from "./db/types";
import { RedisClient } from "./redis/redis";

export let redisClient: RedisClient;

export const commonInit = async (): Promise<void> => {
  // if (!redisClient) {
  //   redisClient = await RedisClient.initialize();
  // }
  const connection = await getConnection();
  const model = await connection.model(ModelType.priceHistoryInfo);
  const msg = await model.create({
    tokenAddress: "0x",
    tokenSymbol: "x",
    priceUsd: 1,
    timestamp: Date.now(),
  });
  await msg.save();
  // initialise active subscribers on api start
  process
    .on("SIGINT", (reason) => {
      console.error(`SIGINT. ${reason}`);
      process.exit();
    })
    .on("SIGTERM", (reason) => {
      console.error(`SIGTERM. ${reason}`);
      process.exit();
    })
    .on("unhandledRejection", (reason) => {
      console.error(`Unhandled Rejection at Promise. Reason: ${reason}`);
      process.exit(-1);
    })
    .on("uncaughtException", (reason) => {
      console.error(`Uncaught Exception Rejection at Promise. Reason: ${reason}`);
      process.exit(-2);
    });
};

commonInit();
