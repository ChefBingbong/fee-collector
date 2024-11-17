import BigNumber from "bignumber.js";

export const OOGA_API_URL = "https://bartio.api.oogabooga.io";
export const GAS_PRICE_THRESHOLD = BigInt(new BigNumber(new BigNumber(7).shiftedBy(9)).toNumber());

export enum Schedules {
  PriceUpdater = '"*/4 * * * *"',
  FeeTransfer = '"*/30 * * * * *"',
  FeeCollector = '"*/1 * * * *"',
}
