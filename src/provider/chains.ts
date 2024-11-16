import { berachainTestnetbArtio } from "viem/chains";

export const CHAINS = [berachainTestnetbArtio];

export enum ChainId {
  BERA_TESTNET = 80084,
}
export const PUBLIC_NODES = {
  [ChainId.BERA_TESTNET]: "https://bartio.rpc.berachain.com/",
} as any;
