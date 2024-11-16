import qs from "querystring";
import { Address, PublicClient, WalletClient } from "viem";
import appConfig from "../../config/config";
import { OOGA_API_URL } from "../../config/constants";
import { AppLogger } from "../../logging/logger";
import { OogaSwapTxResponse, OogaTokenPriceResponse, OogaWhitelistedToken, SwapParams } from "../../model/assetManager";
import { ChainId } from "../../provider/chains";
import { getPublicClient, getWalletClient } from "../../provider/client";
import { formatAddress } from "../../utils/dbUtils";
import { extractError } from "../../utils/extractError";
import { GET } from "../../utils/network";
import { BaseScheduler } from "../BaseScheduler";

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

export abstract class BaseAssetManager extends AppLogger implements AssetManager {
	public job: BaseScheduler;
	public schedule: string;

	constructor({ jobId, schedule }: any) {
		super(`${jobId}-log`);
		this.schedule = schedule;
		this.job = new BaseScheduler({ jobId, schedule, process });
	}

	abstract executeCronTask(): Promise<void>;

	protected getTokenPrices = async (): Promise<OogaTokenPriceResponse[]> => {
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
			return result;
		} catch (error) {
			const errorMessage = extractError(error);
			this.logger.error(`message: ${errorMessage}`);
		}
	};

	protected getWhitelistedTokens = async (): Promise<WhitelistTokenMap> => {
		try {
			const result = await GET<OogaWhitelistedToken[], any>(`${OOGA_API_URL}/v1/tokens`, {
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${appConfig.apiKey}`,
				},
			});

			return result.reduce((map: Map<WhitelistTokenMap>, token: OogaWhitelistedToken) => {
				return map.set(formatAddress(token.address), token);
			}, new Map());
		} catch (error) {
			const errorMessage = extractError(error);
			this.logger.error(`message: ${errorMessage}`);
		}
	};

	protected getOogaSwapTx = async (payload: SwapParams): Promise<OogaSwapTxResponse> => {
		try {
			const result = await GET<OogaSwapTxResponse, any>(
				`${OOGA_API_URL}/v1/swap?${this.stringifyParams(payload)}`,
				{
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${appConfig.apiKey}`,
					},
				},
			);
			return result;
		} catch (error) {
			const errorMessage = extractError(error);
			this.logger.error(`message: ${errorMessage}`);
		}
	};

	protected getClient = () => {
		const client = getPublicClient({ chainId: ChainId.BERA_TESTNET });
		return client;
	};

	protected getWalletClient() {
		const client = getWalletClient({ chainId: ChainId.BERA_TESTNET });
		return client;
	}

	protected stringifyParams = (params: any) => {
		return qs.stringify({ ...params });
	};
}
