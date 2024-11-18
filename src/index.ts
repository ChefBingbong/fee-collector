import { Connection } from "mongoose";
import { Schedules } from "./config/constants";
import { FeeCollector } from "./cron/feeCollector/feeCollector";
import { PriceUpdater } from "./cron/priceUpdater/priceUpdater";
import { FeeTransfer } from "./cron/routerTransfer/feeTransfer";
import { getConnection } from "./db/mongoClient";
import { RedisClient } from "./redis/redis";

export let redisClient: RedisClient;
export let connection: Connection;

export const commonInit = async (): Promise<void> => {
	if (!connection) connection = await getConnection();

	console.info(`[MainService] [serviceStartUp] starting ooga-booga router fee transfer service - timestamp [${Date.now()}]\n`);

	const priceMonitor = new PriceUpdater({ schedule: Schedules.PriceUpdater });
	const feeTransferMonitor = new FeeTransfer({ schedule: Schedules.FeeTransfer });
	const feeCollectorMonitor = new FeeCollector({ schedule: Schedules.FeeCollector });

	console.info(
		`[MainService] [booting Workers] starting price monitor, feeTransfer monitor and feeCollection monitor workers - timestamp [${Date.now()}]\n`,
	);

	await priceMonitor.executeCronTask();
	await feeCollectorMonitor.executeCronTask();
	await feeTransferMonitor.executeCronTask();

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
