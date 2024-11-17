// Address is assumed to be a string type representing Ethereum addresses.
import { Address } from "viem";

export interface Token {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
}

export interface Pool {
  poolAddress: Address;
  poolType: string;
  poolName: string;
  liquiditySource: string;
  poolFee: number;
  tokenFrom: number;
  tokenTo: number;
  share: number;
  assumedAmountIn: string;
  assumedAmountOut: string;
}

export interface Tx {
  to: Address;
  data: string;
  value: string;
}

export interface SwapTokenInfo {
  inputToken: Address;
  inputAmount: string;
  outputToken: Address;
  outputQuote: string;
  outputMin: string;
  outputReceiver: Address;
}

export type RouterParams = {
  swapTokenInfo: SwapTokenInfo;
  pathDefinition: Address;
  executor: Address;
  referralCode: number;
  value: string;
};

export interface OogaSwapTxResponse {
  status: string;
  tokenFrom: number;
  tokenTo: number;
  price: number;
  priceImpact: number;
  tokens: Token[];
  amountIn: string;
  amountOutFee: string;
  assumedAmountOut: string;
  route: Pool[];
  tx: Tx;
  routerAddr: Address;
  routerParams: RouterParams;
}

export type OogaTokenPriceResponse = {
  address: Address;
  price: number;
};

export interface OogaWhitelistedToken {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  tokenURI: string;
}

export type SwapParams = {
  tokenIn: Address; // The token to swap from (address of the token)
  tokenOut: Address; // The token to swap to (address of the token)
  amount: bigint; // The amount of tokenIn to swap (represented as a bigint)
  to: Address; // The recipient address for tokenOut (optional)
  slippage: number; // The acceptable slippage (value between 0 and 1)
};
