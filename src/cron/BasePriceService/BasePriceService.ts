import { Address } from "viem";
import appConfig from "../../config/config";
import { AppLogger } from "../../logging/logger";
import { GET } from "../../utils/network";
import { BaseScheduler } from "../BaseScheduler";

export type PriceResponse = {
	address: Address;
	price: number;
};

export interface TokenInfo {
	address: Address;
	name: string;
	symbol: string;
	decimals: number;
	tokenURI: string;
}

const config = {
	headers: { Authorization: `Bearer ${appConfig.apiKey}` },
};

export const OogaAddress = "0x55812Bd8683EC95374E42ECfbbc5fb965B3D009a";
export abstract class BaseAssetManager extends AppLogger {
	public readonly api: string;
	public job: BaseScheduler;
	public schedule: string;
	protected debug: boolean;
	public whitelistedTokens: Map<Address, TokenInfo>;

	abstract executeCronTask(): Promise<void>;

	constructor({ jobId, schedule, debug }: any) {
		super("asset-manageeer-log");
		this.schedule = schedule;
		this.debug = debug;
		this.api = "https://bartio.api.oogabooga.io";
		this.job = new BaseScheduler({ jobId, schedule, process });
	}

	public getTokenPrices = async (): Promise<PriceResponse[]> => {
		const result = await GET<PriceResponse[], any>(`${this.api}/v1/prices?currency=USD`, config);
		const OogaPrice = result.find((r) => r.address.toLowerCase() === OogaAddress.toLowerCase());
		return [...result.slice(0, 5), OogaPrice];
	};

	public getWhitelistedTokens = async (): Promise<Map<Address, TokenInfo>> => {
		const result = await GET<TokenInfo[], any>(`${this.api}/v1/tokens`, config);

		return result.reduce((map: Map<Address, TokenInfo>, token: TokenInfo) => {
			return map.set(token.address.toLowerCase() as Address, token);
		}, new Map<Address, TokenInfo>());
	};
}
