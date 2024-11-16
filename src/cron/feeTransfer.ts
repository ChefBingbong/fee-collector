import { Address, erc20Abi, getAddress } from "viem";
import { connection } from "..";
import { GAS_PRICE_THRESHOLD } from "../config/constants";
import { BaseAssetManager, WhitelistTokenMap } from "../cron/BasePriceService/BasePriceService";
import { OperationType, RouterOperationBuilder } from "../encoder/encoder";
import { OogaTokenPriceResponse } from "../model/assetManager";
import { Addresses } from "../provider/addresses";
import { PriceHistoryRepository } from "../repository/priceHistory";
import { chunks, formatAddress } from "../utils/dbUtils";
import { extractError } from "../utils/extractError";

export class FeeTransfer extends BaseAssetManager {
	private isServiceRunning: boolean;
	private priceHistoryRepository: PriceHistoryRepository;
	private routerOpBuilder: RouterOperationBuilder;

	constructor({ jobId, schedule, debug }: any) {
		super({ jobId, schedule, debug });
		this.routerOpBuilder = new RouterOperationBuilder();
		this.priceHistoryRepository = new PriceHistoryRepository(connection);
	}

	public executeCronTask = async (): Promise<void> => {
		if (this.isServiceRunning) {
			throw new Error("No vault history to add");
		}

		this.isServiceRunning = true;
		this.job.createSchedule(this.schedule, async () => {
			try {
				this.logger.info(`${this.job.jobId} task statred\n`);

				const whitelistedTokens = await this.getWhitelistedTokens();
				const tokenPriceData = await this.getTokenPrices();

				for (const tokenPriceChunk of chunks(tokenPriceData, 50)) {
					await this.tryTransferFees(tokenPriceChunk, whitelistedTokens);
				}
				this.logger.info(`${this.job.jobId} task finished\n`);
			} catch (error) {
				const errMsg = extractError(error);
				this.logger.error(`msg: ${errMsg}`);
			}
		});
	};

	private tryTransferFees = async (
		assetPricesData: OogaTokenPriceResponse[],
		whitelistedTokens: WhitelistTokenMap,
	) => {
		const client = this.getClient();
		const walletClient = this.getWalletClient();
		const gasPrice = await client.getGasPrice();

		if (gasPrice > GAS_PRICE_THRESHOLD) {
			this.logger.info(`[TransferService] Gas price is to high ${gasPrice}`);
			return;
		}

		const balanceResults = await client.multicall({
			allowFailure: true,
			// @ts-ignore
			contracts: assetPricesData.flatMap((asset) => [
				{
					abi: erc20Abi,
					address: getAddress(asset.address),
					functionName: "balanceOf",
					args: [Addresses.OogaRouter],
				},
			]),
		});

		const filteredBalanceresults = balanceResults.filter((balanceResult) => {
			return balanceResult.status === "success" || balanceResult.result === 0n;
		});

		if (filteredBalanceresults.length === 0) {
			this.logger.error(`[TransferService] [tryTransferFees] No success`);
		}

		let currentIndex = 0;
		const assetsForTransfer = [] as Address[];
		const assetPices = [] as bigint[];

		for (const assetbalance of filteredBalanceresults) {
			const assetAddress = formatAddress(assetPricesData[currentIndex].address);
			const assetDecimals = whitelistedTokens.get(assetAddress)?.decimals;

			if (!assetDecimals) continue;

			const priceData = await this.priceHistoryRepository.getLatest(assetAddress);
			const formattedBalance = BigInt(assetbalance.result) / 10n ** BigInt(assetDecimals);
			const assetUsdValue = formattedBalance * BigInt(Math.round(priceData.priceUsd * 2));

			currentIndex = currentIndex + 1;
			if (assetUsdValue > 100n) {
				assetsForTransfer.push(assetAddress);
				assetPices.push(assetbalance.result as bigint);
			}
		}

		if (assetsForTransfer.length > 0 && assetPices.length > 0) {
			this.logger.info(
				`[TransferService] moving ${assetsForTransfer.length} assets from therouter to the FeeCollector contract`,
			);

			const callArgs = [assetsForTransfer, assetPices, Addresses.FeeCollector] as const;
			this.routerOpBuilder.addUserOperation(OperationType.ROUTER_TRANSFER_FROM, callArgs, Addresses.OogaRouter);

			try {
				const hash = await walletClient.sendTransaction({ ...(this.routerOpBuilder.userOps[0] as any) });
				const recieipt = await client.waitForTransactionReceipt({ hash });

				this.logger.info(`[TransferService] transaction successufl ${recieipt.transactionHash}`);
			} catch (error) {
				this.logger.error(`msg: ${extractError(error)}`);
			}
		}
	};
}
