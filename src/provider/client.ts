import { http, Address, Chain, PublicClient, WalletClient, createPublicClient, createWalletClient, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { berachainTestnetbArtio } from "viem/chains";
import appConfig from "../config/config";
import { CHAINS, ChainId } from "./chains";

export type viemAddress = `0x${string}`;

export const PROTOCOL_SIGNER = privateKeyToAccount(appConfig.protocolSigner as Address);

const createClients = <TClient extends PublicClient | WalletClient>(chains: Chain[]) => {
	return (type: "Wallet" | "Public"): Record<ChainId, TClient> => {
		return chains.reduce(
			(prev, cur) => {
				const clientConfig = {
					chain: berachainTestnetbArtio,
					transport: http(),
				};
				const client =
					type === "Wallet"
						? createWalletClient({ ...clientConfig, account: PROTOCOL_SIGNER }).extend(publicActions)
						: createPublicClient({ ...clientConfig, cacheTime: 4000 });
				return {
					...prev,
					[cur.id]: client,
				};
			},
			{} as Record<ChainId, TClient>,
		);
	};
};

const publicClients: Record<ChainId, PublicClient> = createClients<PublicClient>(CHAINS)("Public");
const walletClients: Record<ChainId, WalletClient> = createClients<WalletClient>(CHAINS)("Wallet");

export const getPublicClient = ({ chainId }: { chainId: ChainId }) => {
	return publicClients[chainId];
};

export const getWalletClient = ({ chainId }: { chainId: ChainId }) => {
	return walletClients[chainId];
};
