import type { AbiParametersToPrimitiveTypes } from "abitype";
import { type Address, type Hex, Kzg, encodeAbiParameters, parseAbiItem, toFunctionSelector } from "viem";
import { ChainId } from "../provider/chains";

export type UserOp = { to: Address; value: bigint | null; data?: Hex; chainId: number; kzg: Kzg };
export type ABIType = typeof ABI_PARAMETER;
export type OperationUsed = keyof typeof ABI_PARAMETER;
export type ABIParametersType<TOperationType extends OperationUsed> = AbiParametersToPrimitiveTypes<ABIType[TOperationType]["inputs"]>;

export enum OperationType {
	ROUTER_TRANSFER_FROM = "ROUTER_TRANSFER_FROM",
}

export const ABI_PARAMETER = {
	[OperationType.ROUTER_TRANSFER_FROM]: parseAbiItem(
		"function transferRouterFunds(address[] calldata tokens, uint256[] calldata amounts, address dest)",
	),
};

export class RouterOperationBuilder {
	userOps: UserOp[];

	constructor() {
		this.userOps = [];
	}

	addUserOperation<TOperationType extends OperationUsed>(
		type: TOperationType,
		parameters: ABIParametersType<TOperationType>,
		contract: Address,
		value = 0n,
	): void {
		const { encodedSelector, encodedInput } = encodeOperation(type, parameters);
		const operationCalldata = encodedSelector.concat(encodedInput.substring(2)) as Hex;
		const userOperation = { to: contract, value, chainId: ChainId.BERA_TESTNET, kzg: undefined, data: operationCalldata };
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
