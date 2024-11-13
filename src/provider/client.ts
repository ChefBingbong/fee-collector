import {
  http,
  Address,
  Chain,
  Client,
  PublicClient,
  WalletClient,
  createPublicClient,
  createWalletClient,
  fallback,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import appConfig from "../config/config";
import { CHAINS, ChainId, PUBLIC_NODES } from "./chains";

export type viemAddress = `0x${string}`;

export const PROTOCOL_SIGNER = privateKeyToAccount(appConfig.protocolSigner as Address);

const createClients = <TClient extends Client>(chains: Chain[]) => {
  return (type: "Wallet" | "Public"): Record<ChainId, TClient> => {
    return chains.reduce(
      (prev, cur) => {
        const clientConfig = {
          chain: cur,
          transport: fallback(
            (PUBLIC_NODES[cur.id] as string[]).map((url) =>
              http(url, {
                timeout: 15_000,
              }),
            ),
            {
              rank: false,
            },
          ),
          batch: {
            multicall: {
              batchSize: 154 * 200,
              wait: 16,
            },
          },
        };
        const client =
          type === "Wallet"
            ? createWalletClient({ ...clientConfig, account: PROTOCOL_SIGNER })
            : createPublicClient(clientConfig);
        return {
          ...prev,
          [cur.id]: client,
        };
      },
      {} as Record<ChainId, TClient>,
    );
  };
};

const publicClients: Record<ChainId, PublicClient> = createClients(CHAINS)("Public");
const walletClients: Record<ChainId, WalletClient> = createClients(CHAINS)("Wallet");

export const getPublicClient = ({ chainId }: { chainId: ChainId }): PublicClient => {
  return publicClients[chainId];
};

export const getWalletClient = ({ chainId }: { chainId: ChainId }): WalletClient => {
  return walletClients[chainId];
};
