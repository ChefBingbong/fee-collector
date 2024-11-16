import type { AbiParametersToPrimitiveTypes } from "abitype";
import { type Address, type Hex, encodeAbiParameters, parseAbiItem, toFunctionSelector } from "viem";

export type UserOp = { to: Address; value: bigint | null; data?: Hex };
export type Call = { target: Address; callData: Hex };

export type ABIType = typeof ABI_PARAMETER;
export type OperationUsed = keyof typeof ABI_PARAMETER;
export type ABIParametersType<TOperationType extends OperationUsed> = AbiParametersToPrimitiveTypes<
	ABIType[TOperationType]["inputs"]
>;

export enum OperationType {
	ROUTER_TRANSFER_FROM = "ROUTER_TRANSFER_FROM",
	EXEC = "EXEC",
}

export const ABI_PARAMETER = {
	[OperationType.ROUTER_TRANSFER_FROM]: parseAbiItem(
		"function transferRouterFunds(address[] calldata tokens, uint256[] calldata amounts, address dest)",
	),
	[OperationType.EXEC]: parseAbiItem([
		"function multicall(Call[] calldata calls)",
		"struct Call { address target; bytes callData; }",
	]),
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
		const userOperation = { to: contract, value, data: operationCalldata };
		this.userOps.push(userOperation);
	}

	addMulticallOperation(calls: Call[], contract: Address, value = 0n): void {
		const encodedSelector = toFunctionSelector(ABI_PARAMETER[OperationType.EXEC]);
		const encodedInput = encodeAbiParameters(ABI_PARAMETER[OperationType.EXEC].inputs, [[...calls]]);

		const operationCalldata = encodedSelector.concat(encodedInput.substring(2)) as Hex;

		const userOperation = { to: contract, value, data: operationCalldata };
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
