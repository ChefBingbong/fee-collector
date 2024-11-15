import { PublicClient } from "viem";
import { redisClient } from ".";
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
const POLL_INTERVAL = "*/20 * * * * *"; // 1 minute (time interval for polling gas price)
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
				const gasPrice = await this.getCurrentGasPrice();

				if (gasPrice > GAS_PRICE_THRESHOLD) this.paused = true;
				else this.paused = false;
			} catch (error) {
				console.error(`message: ${extractError(error)}, fn: executeCronTask`);
			}
		});
	}

	async storePriceData(asset: string, price: number): Promise<void> {
		const timestamp = Date.now(); // Get the current timestamp (milliseconds)

		// Add the price to the sorted set (timestamp as score, price as value)
		await redisClient.getClient().zadd(`price:${asset}`, timestamp, price.toString());
		console.log(`Stored price for ${asset} at ${new Date(timestamp).toISOString()}: ${price}`);
	}

	public getCurrentGasPrice = async (): Promise<number> => {
		const client = this.getClient(ChainId.BERA_TESTNET);
		const gasPrice = await client.getGasPrice();
		console.log(`Current Gas Price: ${gasPrice} Wei`);
		return Number(gasPrice);
	};

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
