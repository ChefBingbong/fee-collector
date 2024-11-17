import { Connection } from "mongoose";
import { AllCronJobs, Schedulers, SchedulersMap } from "./cron/types";
import { getConnection } from "./db/mongoClient";
import { AppLogger } from "./logging/logger";
import { RedisClient } from "./redis/redis";

export let redisClient: RedisClient;
export let connection: Connection;

export class AppInitializer extends AppLogger {
  public jobs = {} as SchedulersMap;
  private process: NodeJS.Process = process;

  constructor(jobIds: Schedulers[]) {
    super("main-app");

    jobIds.forEach((jobId) => {
      this.jobs[jobId] = AllCronJobs[jobId];
    });
  }

  public async initApp(): Promise<void> {
    if (!connection) {
      connection = await getConnection();
      this.logger.info(`[MainApp] connected to Mongo... Starting Service\n`);
    }

    this.process.on("unhandledRejection", this.handleRejection);
    this.process.on("uncaughtException", this.handleException);
    this.process.on("SIGINT", this.handleExit);
    this.process.on("SIGTERM", this.handleExit);

    Object.values(this.jobs).forEach(async (job) => job.executeCronTask());

    this.logger.info("[MainApp] Service Initialisation completed");
  }

  private handleExit = (): void => {
    this.logger.info(`[MainApp]Stopping common-init closing server...`);
    this.process.exit();
  };

  private handleException = (err: Error): void => {
    this.logger.error(`[MainApp] Unhandled error in common-init: ${err.message}`);
    this.process.exit(-2);
  };

  private handleRejection = (err: Error): void => {
    this.logger.error(`[MainApp] Unhandled error in common-init: ${err.message}`);
    this.process.exit(-1);
  };
}
