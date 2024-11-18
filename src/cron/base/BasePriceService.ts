import qs from "querystring";
import appConfig from "../../config/config";
import { OOGA_API_URL } from "../../config/constants";
import { AppLogger } from "../../logging/logger";
import { OogaSwapTxResponse, OogaTokenPriceResponse, OogaWhitelistedToken, SwapParams } from "../../model/assetManager";
import { ChainId } from "../../provider/chains";
import { getPublicClient, getWalletClient } from "../../provider/client";
import { formatAddress } from "../../utils/dbUtils";
import { extractError } from "../../utils/extractError";
import { GET } from "../../utils/network";
import { AssetManager, WhitelistTokenMap } from "../types";
import { BaseScheduler } from "./BaseScheduler";
export abstract class BaseAssetManager extends AppLogger implements AssetManager {
	public job: BaseScheduler;
	public schedule: string;
	protected isServiceRunning: boolean;

	constructor({ jobId, schedule }: any) {
		super(`${jobId}-log`);
		this.schedule = schedule;
		this.job = new BaseScheduler({ jobId, schedule, process });
	}

	abstract executeCronTask(): Promise<void>;

	public stopCurrentTask = (): void => {
		if (!this.isServiceRunning) {
			throw new Error("No vault history to add");
		}
		this.job.stopCronJob();
		this.isServiceRunning = false;
	};

	public getTokenPrices = async (): Promise<OogaTokenPriceResponse[]> => {
		try {
			const result = await GET<OogaTokenPriceResponse[], any>(
				`${OOGA_API_URL}/v1/prices?${this.stringifyParams({ currency: "USD" })}`,
				{
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${appConfig.apiKey}`,
					},
				},
			);
			return result.slice(0, 100);
		} catch (error) {
			const errorMessage = extractError(error);
			this.logger.error(`message: ${errorMessage}`);
		}
	};

	public getWhitelistedTokens = async (): Promise<WhitelistTokenMap> => {
		try {
			const result = await GET<OogaWhitelistedToken[], any>(`${OOGA_API_URL}/v1/tokens`, {
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${appConfig.apiKey}`,
				},
			});

			return result.reduce((map: WhitelistTokenMap, token: OogaWhitelistedToken) => {
				return map.set(formatAddress(token.address), token);
			}, new Map());
		} catch (error) {
			const errorMessage = extractError(error);
			this.logger.error(`message: ${errorMessage}`);
		}
	};

	public getOogaSwapTx = async (payload: SwapParams): Promise<OogaSwapTxResponse> => {
		try {
			const result = await GET<OogaSwapTxResponse, any>(`${OOGA_API_URL}/v1/swap?${this.stringifyParams({ ...payload })}`, {
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${appConfig.apiKey}`,
				},
			});
			return result;
		} catch (error) {
			const errorMessage = extractError(error);
			this.logger.error(`message: ${errorMessage}`);
		}
	};

	public getClient = () => {
		const client = getPublicClient({ chainId: ChainId.BERA_TESTNET });
		return client;
	};

	public getWalletClient() {
		const client = getWalletClient({ chainId: ChainId.BERA_TESTNET });
		return client;
	}

	protected stringifyParams = (params: any) => {
		return qs.stringify({ ...params });
	};
}
