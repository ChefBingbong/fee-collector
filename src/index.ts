import { Connection } from "mongoose";
import { getConnection } from "./db/mongoClient";
import { PriceUpdater } from "./priceUpdater/priceUpdater";
import { RedisClient } from "./redis/redis";

export let redisClient: RedisClient;
export let connection: Connection;

export const commonInit = async (): Promise<void> => {
	if (!connection) {
		connection = await getConnection();
	}

	const priceMonitor = new PriceUpdater({ jobId: "price-updater", schedule: "*/2 * * * *", debug: false });
	// const feeCollectionrMonitor = new FeeTransfer({ jobId: "fee-transfer", schedule: "*/59 * * * *", debug: false });
	// const feeTransferMonitor = new FeeTransfer({ jobId: "fee-transfer", schedule: "*/5 * * * *", debug: false });

	await priceMonitor.executeCronTask();
	// await feeCollectionrMonitor.executeCronTask();
	// await feeTransferMonitor.executeCronTask();

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
