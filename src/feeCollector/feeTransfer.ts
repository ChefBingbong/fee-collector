import BigNumber from "bignumber.js";
import { Address, erc20Abi, getAddress } from "viem";
import { connection } from "..";
import { BaseAssetManager } from "../cron/BasePriceService/BasePriceService";
import { BaseScheduler } from "../cron/BaseScheduler";
import { OperationType, RouterOperationBuilder } from "../encoder/encoder";
import { PriceHistoryRepository } from "../repository/priceHistory";
import { extractError } from "../utils/extractError";

export class FeeTransfer extends BaseAssetManager {
	public job: BaseScheduler;
	public schedule: string;
	protected debug: boolean;
	private priceHistoryRepository: PriceHistoryRepository;
	private routerOpBuilder: RouterOperationBuilder;

	public readonly gasPriceThreshold: BigNumber;

	constructor({ jobId, schedule, debug }: any) {
		super({ jobId, schedule, debug });
		this.schedule = schedule;
		this.debug = debug;
		this.gasPriceThreshold = new BigNumber(new BigNumber(7).shiftedBy(9));
		this.job = new BaseScheduler({ jobId, schedule, process });
		this.routerOpBuilder = new RouterOperationBuilder();
		this.priceHistoryRepository = new PriceHistoryRepository(connection);
	}

	public executeCronTask = async (): Promise<void> => {
		this.job.createSchedule(this.schedule, async () => {
			try {
				await this.tryTransferFees();
			} catch (error) {
				const errMsg = extractError(error);
				this.logger.error(`msg: ${errMsg}`);
			}
		});
	};

	private tryTransferFees = async () => {
		const client = this.getClient();
		const gasPrice = await client.getGasPrice();
		const assets = (await this.getTokenPrices()).map((p) => p.address.toLowerCase());

		const whitelistedTokens = await this.getWhitelistedTokens();
		const assetsForTransfer = [] as Address[];
		const assetPices = [] as bigint[];
		let i = 0;

		if (new BigNumber(Number(gasPrice)) > this.gasPriceThreshold) {
			this.logger.info(`[TransferService] Gas price is to high ${gasPrice}`);
			return;
		}

		const results = await client.multicall({
			allowFailure: true,
			// @ts-ignore
			contracts: assets.flatMap((asset: string) => [
				{
					abi: erc20Abi,
					address: getAddress(asset),
					functionName: "balanceOf",
					args: ["0xfa909B88A135f357c114e69230F583A38c611f42"],
				},
			]),
		});

		if (results.length === 0) {
			this.logger.error(`[TransferService] [tryTransferFees] No success`);
			throw new Error(`No results found for adapter addresses`);
		}

		for (const r of results) {
			if (r.status === "success") {
				const assetDecimals = whitelistedTokens.get(assets[i].toLowerCase() as Address).decimals;
				const priceData = await this.priceHistoryRepository.getLatest(assets[i].toLowerCase() as Address);
				const assetUsdValue = (BigInt(r.result) / 10n ** BigInt(assetDecimals)) * BigInt(Math.round(priceData.priceUsd * 2));

				if (assetUsdValue > 0n) {
					assetsForTransfer.push(assets[i].toLowerCase() as Address);
					assetPices.push(r.result as bigint);
				}
			}
			i += 1;
		}
		// console.log(assetsForTransfer);
		if (assetsForTransfer.length === 0) {
			try {
				const callType = OperationType.ROUTER_TRANSFER_FROM;
				const callArgs = [assetsForTransfer, assetPices, "0xF6eDCa3C79b4A3DFA82418e278a81604083b999D"] as const;
				const walletClient = this.getWalletClient();

				this.routerOpBuilder.addUserOperation(callType, callArgs, "0xfa909B88A135f357c114e69230F583A38c611f42");
				//@ts-ignore
				const hash = await walletClient.sendTransaction({ ...this.routerOpBuilder.userOps[0] });
				const recieipt = await client.waitForTransactionReceipt({ hash });
				this.logger.info(`[TransferService]transaction successufl ${recieipt.transactionHash}`);
			} catch (error) {
				console.log(error);
				const errMsg = extractError(error);
				this.logger.error(`msg: ${errMsg}`);
			}
		}
	};
}
