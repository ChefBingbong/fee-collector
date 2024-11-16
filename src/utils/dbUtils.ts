import { Address } from "viem";

export const formatAddress = (address: string | Address) => {
	return address.toLowerCase() as Address;
};
export const equalsIgnoreCase = (a: string, b: string) => {
	return a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const hasRequiredFields = (field: any[]): boolean => {
	return field.filter((f) => !isBlank(f)).length === 0;
};

export const isBlank = (f: string): boolean => {
	return f === undefined || f === null || f === "" || f === "" || f === " ";
};

export const isEmpty = (f: {}): boolean => {
	return Object.keys(f).length === 0 || f === undefined || f === null;
};

export const hasRequiredFieldsInObject = (object: {}): boolean => {
	for (const key of Object.keys(object)) {
		if (isBlank(object[key])) {
			console.error(`[hasRequiredFieldsInObject] Missing required field: ${key}, value: ${object[key]}`);
			return false;
		}
	}
	return true;
};

export const chunks = <T>(array: Array<T>, chunkSize: number): Array<T>[] => {
	const chunks: Array<T>[] = [];
	for (let i = 0; i < array.length; i += chunkSize) {
		chunks.push(array.slice(i, i + chunkSize));
	}
	return chunks;
};

export const getFlooredTimeStamp = (timestamp: number, nthDayFromToday: number): number => {
	if (!timestamp) {
		console.error(`[getFlooredTimeStamp] Invalid timestamp: ${timestamp}`);
		throw new Error(`Invalid timestamp: ${timestamp}`);
	}
	const date = new Date(timestamp);
	date.setDate(date.getDate() - nthDayFromToday);
	date.setHours(0, 0, 0, 0);
	return date.getTime() / 1000;
};

export enum TIMESTAMPS {
	TwelveHr = 12 * 60 * 60 * 1000, // 12 hours in ms
	TwentyFourHr = 24 * 60 * 60 * 1000, // 24 hours in ms
}

export function getTimestamp(type: TIMESTAMPS, currentDateMs: number): number {
	return currentDateMs - type;
}
