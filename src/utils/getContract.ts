// import { createPublicClient, erc20Abi, getContract, http, publicActions, PublicClient, WalletClient, type Address } from "viem";
// import { getPublicClient, getWalletClient } from "../provider/client";
// import { ChainId } from "../provider/chains";
// import { obRouterAbi } from "../abi/ObRouter";
// import { mainnet } from "viem/chains";

// const publicClient = createPublicClient({
//   chain: mainnet,
//   transport: http(),
// }).extend(publicActions);
// export const getSmartWalletFactory = (chainId: ChainId) => {
//   const client = getPublicClient({ chainId }) as PublicClient;
//   const signer = getWalletClient({ chainId });

//   const address = '0xf6edca3c79b4a3dfa82418e278a81604083b999d'
//   const c =  getContract({ address, client: publicClient, abi: obRouterAbi as typeof obRouterAbi }) ;
//   c.
// };

// export const getSmartWallet = (chainId: ChainId, address: Address) => {
//   const client = getViemClient({ chainId });
//   return getContract({ address, client, abi: walletAbi });
// };

// export const getErc20Contract = (chainId: ChainId, address: Address) => {
//   const client = getViemClient({ chainId });
//   return getContract({ address, client, abi: erc20Abi });
// };
