import { Address, PublicClient, WalletClient } from "viem";
import { Schedules } from "../config/constants";
import { OogaSwapTxResponse, OogaTokenPriceResponse, OogaWhitelistedToken, SwapParams } from "../model/assetManager";
import { BaseScheduler } from "./base/BaseScheduler";
import { FeeCollector } from "./feeCollector/feeCollector";
import { PriceUpdater } from "./priceUpdater/priceUpdater";
import { FeeTransfer } from "./routerTransfer/feeTransfer";

export type WhitelistTokenMap = Map<Address, OogaWhitelistedToken>;

export interface AssetManager {
	job: BaseScheduler;
	schedule: string;
	executeCronTask(): Promise<void>;
	getWhitelistedTokens: () => Promise<WhitelistTokenMap>;
	getOogaSwapTx: (payload: SwapParams) => Promise<OogaSwapTxResponse>;
	getTokenPrices: () => Promise<OogaTokenPriceResponse[]>;
	getClient: () => PublicClient;
	getWalletClient: () => WalletClient;
}

export enum Schedulers {
	PriceUpdaterScheduler = "PriceUpdaterScheduler",
	RouterTransferScheduler = "RouterTransferScheduler",
	FeeCollectorScheduler = "LotteryRoundResultsScheduler",
}

export type SchedulerKeys = FeeCollector | FeeTransfer | PriceUpdater;

export type SchedulersMap = { [key in Schedulers]: AssetManager };

export const AllCronJobs: SchedulersMap = {
	[Schedulers.PriceUpdaterScheduler]: new PriceUpdater({
		schedule: Schedules.PriceUpdater,
	}),
	[Schedulers.RouterTransferScheduler]: new FeeTransfer({
		schedule: Schedules.FeeTransfer,
	}),
	[Schedulers.FeeCollectorScheduler]: new FeeCollector({
		schedule: Schedules.FeeCollector,
	}),
};
