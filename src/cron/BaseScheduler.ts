import { ScheduledTask, schedule } from "node-cron";

interface BaseSchedulerOpions {
  jobId: string;
  schedule: string;
  process: NodeJS.Process;
}
export class BaseScheduler {
  public readonly jobId: string;
  public schedule: string;
  public cronJob: ScheduledTask | undefined;
  public process: NodeJS.Process;

  constructor({ jobId, schedule, process }: BaseSchedulerOpions) {
    this.jobId = jobId;
    this.process = process;
    this.schedule = schedule;
  }

  public createSchedule(interval: string, callback: () => Promise<void>) {
    this.schedule = interval;
    this.cronJob = schedule(interval, async () => callback());
  }

  public stopCronJob = (): void => {
    if (this.cronJob) this.cronJob.stop();
  };

  public startCronJob = (): void => {
    if (this.cronJob) this.cronJob.start();
  };

  public handleExit = (): void => {
    this.stopCronJob();
    console.log(`Stopping ${this.jobId} cron job and closing server...`);
    this.process.exit(0);
  };

  public handleError = (err: Error): void => {
    this.stopCronJob();
    console.error(`Unhandled error: ${err.message}`);
    this.process.exit(1);
  };

  public initialize = (): void => {
    this.process.on("unhandledRejection", this.handleError);
    this.process.on("uncaughtException", this.handleError);
    this.process.on("SIGINT", this.handleExit);
    this.process.on("SIGTERM", this.handleExit);
  };
}
