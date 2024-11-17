# Pancake Notification Scheduler

## Overview

Pancake Notification Scheduler

The scheduler will fire notifications for users subscribed to the pancakeswap web3 notificvations. there are several different notification types that exist
1) NativeBalanceChecker
2) TokenPriceScheduler
3) FarmsAprUpdatesScheduler
4) PredictionsScheduler
5) LotteriesScheduler
6) UserLPPositionsUpdateScheduler
7) WhitelistFarmsScheduler

In the case of the `PredictionsScheduler` and `LotteriesScheduler` there are multiple notifications that are sent to the users. Both of these jobs have a notification for 
onboarding new users to try these pancakeswap services, aswell as a notfication for notifying players who are actively enaged in a round on the results and outcome of that round.

## Description

Each `notification scheduler` exists as a `cron shcedule` that runs on specified intervals. Each time a job schedule runs, the users data from the last schedule is checked against the 
users data during the runtime of the current schedule. If the users data has changed by a predefined manginitude in between schedules a notification is sent to that user.

There is an built in `timestamp service` that makes sure a sufficent amount of time has passed before sending the a user the same notification in too little of a timeframe. this is done to prevent spam
in the users notification inbox on the PancakeSwap Frontend. 

We use `redis` to cache and store user information on each job schedule for checking in future schedules.

## Adding New Notification Schedulers

To create a new notification scheduler simpley create a file in `src/cron`. The scheduler itself must be a class that implements methods defined by the global `SharedCronTask` Class. those methods being 
the `init()` and `mainFunction()` methods. Any other methods should be private and should server as nothing else other than helper functions that the `mainFunction()` uses to aggregate and check user data.

### Example
```ts
newNotificationScheduler.ts

import { SharedCronTask } from "./sharedCronTask";

class NewNotificationScheduler extends SharedCronTask {
  constructor(jobId: string, schedule: string, supportedChains: ChainId[]) {
    super(jobId, schedule, supportedChains);
  }

  public async init(chainId: ChainId) {
    const subscribers = await this.getFormattedSubscribers();
    await this.executeCronTask(chainId, subscribers); // executes mainFunction
  }

  // this method is called in SharedCrontTask
  protected async mainFunction(network: ChainId, users: Address[]) {

   // implement your logic to check and send notifications
  }
}

```

at the bottom of your schedulerFile simply mae an instance of your scheduler can export it. Each scheduler requires 3 things to be initialized.

1) `jobId: string` the name or unique id of the new scheduler
2) `schedule: string` the node scron expression which dictates how often and when the scheduler runs
3) `supportedChains: number[]` an array of chainIds, that the scheduler will run on

All schedulers are initialized and started, by calling the schedulers `init()` function in the main `index.ts` file within the `AppInitializer` Class. However to make sure that `AppInitializer` is aware of 
you new schedule you must update the `ALLCronTasks` mapping in `src/cron/index.ts`

```ts

// index.ts
import { NewNotificationScheduler } from "./NewNotificationScheduler"

export const AllCronJobs: CronJobsMap = {
  NativeBalanceChecker: nativeBalanceChecker,
  PriceCheckTask: priceCheckTask,
  FarmsAPRCheckTask: farmsAprCheck,
  LotteryFetchNewPlayersTask: lotteryNotifyCheck,
  LotteryNotifyPlayersOnLotteryEndTask: lotteryUpdateCheck,
  PredictionOnBoardJob: predictionNotifyNewUsersCheck,
  PredictionWinnerJobCake: predictionCakeWinnerCheck,
  PredictionWinnerJobBnb: predictionBnbWinnerCheck,
  UserPositionsNotifyTask: userPositionNotifyCheck,
  WhitelistFarmsNotifyTask: whiteListFarmsCheck,
  GlobalTaskUtils: globalTasksJob,

  // add new notification schulers here
  NewNotificationScheduler: newnotificationScheduler
};

```

once your new scheduler is added here. when the service stats by running `yarn start` your new scheduler will work as expected by should fire as expected by the `schedule` you set.

## Advanced

### Batching Schedules
if you feel your job is running too slow you can add an optional `loadBalancerBatcher` into your schedulers `init()` method. the purpose of this batcher is to break up either your `activeSubscribers` or `supportedChains` 
array into smaller chunks and exute your job with those chunks instead of the entire array. altough by design its expected to use `activeSubscribers` or `supportedChains` for batching, note that any array of data that you job
needs and uses can be batched. to implement batching simple initalise a new batch instanxce as follows

```ts
newNotificationScheduler.ts

import { SharedCronTask } from "./sharedCronTask";

class NewNotificationScheduler extends SharedCronTask {
  constructor(jobId: string, schedule: string, supportedChains: ChainId[]) {
    super(jobId, schedule, supportedChains);
  }

  public async init(chainId: ChainId) {
    const subscribers = await this.getFormattedSubscribers();
    await this.executeCronTask(chainId, subscribers);

    // create new batchers
    loadBalancer.initializeInstance<ChainId>(`${this.job.jobName-${uniqueid}}`, supportedChains, 2); // execute in batches of 2 chains per run
    loadBalancer.initializeInstance<Address>(`${this.job.jobName-{uniqueid}}`, subscribers, 50); // execute in batches of 50 subscribers per run
  }

  ....
  ....
}

Once initialised the `SharedCronTask` class will take care of the `setting` and `getting` of the `current` and `next` batch groups from your original data

```

### Dynamic Cron schedules

If you dont now before hand when you schedule shoulod be set to run then the inherent native of the `AppInitializer` class allows you you to dynaically update the schedule of you job by executing specific logic in you Schedulers `mainFunction()` method. For example lets say in order to know when to run your scheduler you are required to do some sort of calculation to get a timestamp or data. If this is the case you should do this calculation at the end of your schedulers `mainFunction()` after the main logic finishes. You can then use this calculation to automatically stop the current scheduler and create a new one following by initting it in the `AppInitializer` class by callin a specific method.

#### Example

Nore that if you wish to do this. the calculation that you do in order to return the time at which to next run your scheduler should be a `unixTimstamp` (in seconds not milliseconds).
```ts
  NewNotificationScheduler.ts

  import { redisClient, service } from "../app";

  protected async mainFunction(network: ChainId, users: Address[], provider: PublicClient) {

      your main logic
      ...
      ...
      ...


      // stop the current job instance
      this.job.cronJob.stop();

      // get the new schedule as unixtimestamp
      const newUnixTimestamp = await this.customMethodToGetNewTimestamp()

      // do the calculation to get cron expression for next schedule
      const newSchedule = await this.calculateNewCronSchedule(
          newUnixTimestamp,
          30, // seconds buffer added to newUnixTimestamp
          0 // mnutes buffer added to newUnixTimestamp
      );

      // create a new instance of the current job passing on the new schedule as the cron expression
      const newJobInstance = new NewNotificationScheduler(`lotteries-result-cron`, newSchedule, [
        ChainId.BSC,
      ]);

      // call static this method from AppInitializer
      service.initBnbChainJobs([newJobInstance]);
      }


      private customMethodToGetNewTimestamp() {

         // logic to calculate new schedule timestamp
      }
```

once you cann `service.initBnbChainJobs([newJobInstance]);` the old scheduler will be overwritten woth this new one and it will continue to preform as usual using the new cron schedule as the default


## Deployment

Verify that `.env` has the correct information as outlined in `.env.example`

```
yarn start:dev // main script
```

## Logging

Logs would be generated at `logs/scheduler-YYYY-MM-DD.log` and would be sent to Datadog daily.

Example of the log for success cases:

```
2023-12-11T16:43:40.444Z | info  | balance-check-cronTask | balance-check-cronTask for 42161 chain - started
2023-12-11T16:43:41.548Z | info  | balance-check-cronTask | balance-check-cronTask for 42161 chain - finished 

2023-12-11T16:43:41.549Z | info  | balance-check-cronTask | balance-check-cronTask for 1 chain - started
2023-12-11T16:43:42.564Z | info  | balance-check-cronTask | balance-check-cronTask for 1 chain - finished 
```

[![Check out this video](assets/images/thumbnail.jpg)]([https://www.youtube.com/watch?v=dQw4w9WgXcQ](https://www.veed.io/view/4bc6ac5a-7e73-4e2b-a089-6058c61f51d2?panel=share))


[![Check out this video](assets/images/thumbnail.jpg)]([https://www.youtube.com/watch?v=dQw4w9WgXcQ](https://www.veed.io/view/4bc6ac5a-7e73-4e2b-a089-6058c61f51d2?panel=share))
