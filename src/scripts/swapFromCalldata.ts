import {
	http,
	type Address,
	createWalletClient,
	encodeFunctionData,
	erc20Abi,
	maxUint256,
	publicActions,
	zeroAddress,
} from "viem"; // Main library used to interface with the blockchain
import { berachainTestnetbArtio } from "viem/chains";
import { obRouterAbi } from "../abi/ObRouter";
import appConfig from "../config/config";
import { PROTOCOL_SIGNER } from "../provider/client";

// Ensure no sensitive information is hardcoded
const PRIVATE_KEY = appConfig.protocolSigner as Address;
const account = PROTOCOL_SIGNER;
console.log("Caller:", account.address);

const client = createWalletClient({
	chain: berachainTestnetbArtio,
	transport: http(),
	account,
}).extend(publicActions);

// Bartio token addresses
const NATIVE_TOKEN: Address = zeroAddress; // Default address for Bera native token
const HONEY: Address = "0x0E4aaF1351de4c0264C5c7056Ef3777b41BD8e03"; // Honey token address
const SWAP_ROUTER_ADDRESS: Address = "0xfa909B88A135f357c114e69230F583A38c611f42"; // Swap Router contract address (Uniswap/Sushiswap)

const swapParams = {
	tokenIn: NATIVE_TOKEN, // Address of the token swapping from (BERA)
	tokenOut: HONEY, // Address of the token swapping to (HONEY)
	amount: 1000000000000000000n, // Amount of tokenIn to swap
	to: account.address, // Address to send tokenOut to (optional and defaults to `from`)
	slippage: 0.02, // Range from 0 to 1 to allow for price slippage
};

type SwapParams = typeof swapParams;

const ERC20_ABI = [
	"function allowance(address owner, address spender) view returns (uint256)",
	"function approve(address spender, uint256 amount) external returns (bool)",
	"function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)",
];

// Allowance check using Viem
const getAllowance = async (token: Address, from: Address, spender: Address): Promise<bigint> => {
	if (token === zeroAddress) return maxUint256;
	const data = encodeFunctionData({
		abi: erc20Abi,
		functionName: "allowance",
		args: [from, spender],
	});

	const result = await client.call({
		to: token,
		data,
		// chain: berachainTestnetbArtio,
	});
	// console.log(BigInt(result.data));
	return BigInt(result.data);
};

// Approve function using Viem
const approveAllowance = async (token: Address, amount: bigint, spender: Address) => {
	const data = encodeFunctionData({
		abi: erc20Abi,
		functionName: "approve",
		args: [spender, amount],
	});
	// @ts-ignore
	const tx = await client.sendTransaction({
		to: token,
		data,
		// chain: berachainTestnetbArtio,
	});

	const rcpt = await client.waitForTransactionReceipt({ hash: tx });
	console.log("Approval complete", rcpt.transactionHash, rcpt.status);
};

// Swap function - Sending the swap transaction to the swap router
const swap = async (swapParams: SwapParams) => {
	// Prepare calldata for the swap function of the swap router (e.g., Uniswap/Sushiswap)
	// For example, using `swapExactTokensForTokens` function of a typical DEX
	const swapData = encodeFunctionData({
		abi: obRouterAbi,
		functionName: "swap",
		args: [
			{
				inputToken: swapParams.tokenIn, // amountIn
				inputAmount: swapParams.amount, // amountOutMin (to be adjusted for slippage, but using `amount` for simplicity)
				outputToken: swapParams.tokenOut, // path (the token pair for swapping)
				outputQuote: 17347358643973517312n,
				outputMin: 17000411471094046965n,
				outputReceiver: "0x95f4c475857C9ca1e87755f0ebC135Baca86EBF3",
			},
			"0x0E4aaF1351de4c0264C5c7056Ef3777b41BD8e03000301ffff0201E72b29b62309F18f8759E6E26aD807B549C61bbA7507c1dc16935B82698e4C63f2746A2fCf994dF8017507c1dc16935B82698e4C63f2746A2fCf994dF801ffff01ea9EA96F0389d70ABc54C9729A8a0CF557D3C71901E72b29b62309F18f8759E6E26aD807B549C61bbA01E1F167CDE04d5d0F8d096957b3A23a700561897601ffff014499cfB0Be1BdC5b6180F6928C3583b6343a5F7800E72b29b62309F18f8759E6E26aD807B549C61bbA012577D24a26f8FA19c1058a8b0106E2c7303454a401ffff01a433ce3AdDA60E78700Be96aD27Be255a8D6f29d00E72b29b62309F18f8759E6E26aD807B549C61bbA",
			"0xE72b29b62309F18f8759E6E26aD807B549C61bbA",
			2,
		],
	});
	// @ts-ignore
	const tx = await client.sendTransaction({
		to: SWAP_ROUTER_ADDRESS,
		data: swapData,
		// chain: berachainTestnetbArtio,
	});

	const rcpt = await client.waitForTransactionReceipt({ hash: tx });
	console.log("Swap complete", rcpt.transactionHash, rcpt.status);
};

async function main() {
	const spender = SWAP_ROUTER_ADDRESS; // Spender is the swap router contract address

	// Check allowance
	const allowance = await getAllowance(swapParams.tokenIn, account.address, spender);
	console.log("Allowance", allowance);

	// Approve if necessary
	if (allowance < swapParams.amount) {
		await approveAllowance(swapParams.tokenIn, swapParams.amount - allowance, spender); // Only approve amount remaining
	}

	// Swap
	await swap(swapParams);
}

main();
