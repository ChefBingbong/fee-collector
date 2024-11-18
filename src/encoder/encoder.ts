import type { AbiParametersToPrimitiveTypes } from "abitype";
import { type Address, type Hex, encodeAbiParameters, parseAbiItem, toFunctionSelector } from "viem";

export type UserOp = { to: Address; amount: bigint | null; data: Hex };
export type Call = { target: Address; callData: Hex };

export type ABIType = typeof ABI_PARAMETER;
export type OperationUsed = keyof typeof ABI_PARAMETER;
export type ABIParametersType<TOperationType extends OperationUsed> = AbiParametersToPrimitiveTypes<ABIType[TOperationType]["inputs"]>;

export enum OperationType {
	ROUTER_TRANSFER_FROM = "ROUTER_TRANSFER_FROM",
	EXEC = "EXEC",
	SWAP = "SWAP",
	APPROVE = "APPROVE",
	TRANSFER_FROM = "TRANSFER_FROM",
	TRANSFER = "TRANSFER",
}

export const ABI_PARAMETER = {
	[OperationType.ROUTER_TRANSFER_FROM]: parseAbiItem(
		"function transferRouterFunds(address[] calldata tokens, uint256[] calldata amounts, address dest)",
	),
	[OperationType.TRANSFER]: parseAbiItem("function transfer(address to, uint256 amount)"),
	[OperationType.TRANSFER_FROM]: parseAbiItem("function transferFrom(address from, address to, uint256 amount)"),
	[OperationType.APPROVE]: parseAbiItem("function approve(address spender, uint256 amount)"),
	[OperationType.EXEC]: parseAbiItem([
		"function exec(UserOperation[] calldata userOps, bytes calldata _signature, address from)",
		"struct UserOperation {address to; uint256 amount; bytes data; }",
	]),
	[OperationType.SWAP]: parseAbiItem([
		"function swap(swapTokenInfo memory tokenInfo, bytes calldata pathDefinition, address executor, uint32 referralCode)",
		"struct swapTokenInfo { address inputToken; uint256 inputAmount; address outputToken; uint256 outputQuote; uint256 outputMin; address outputReceiver; }",
	]),
};

export class RouterOperationBuilder {
	userOps: UserOp[];

	constructor() {
		this.userOps = [];
	}

	clear = () => (this.userOps = []);

	addUserOperation<TOperationType extends OperationUsed>(
		type: TOperationType,
		parameters: ABIParametersType<TOperationType>,
		contract: Address,
		value = 0n,
	): void {
		const { encodedSelector, encodedInput } = encodeOperation(type, parameters);
		const operationCalldata = encodedSelector.concat(encodedInput.substring(2)) as Hex;
		const userOperation = { to: contract, amount: value, data: operationCalldata };
		this.userOps.push(userOperation);
	}
}

export type Operation = {
	encodedInput: Hex;
	encodedSelector: Hex;
};

export function encodeOperation<TOperationType extends OperationUsed>(
	type: TOperationType,
	parameters: ABIParametersType<TOperationType>,
): Operation {
	const operationAbiItem = ABI_PARAMETER[type];
	const encodedSelector = toFunctionSelector(operationAbiItem);
	const encodedInput = encodeAbiParameters(operationAbiItem.inputs, parameters as never);

	return { encodedSelector, encodedInput };
}
