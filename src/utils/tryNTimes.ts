import { sleep } from "./dbUtils";
import { extractError } from "./extractError";

export const tryNTimes = async <T>(
  fnCall: (attempt: number, retries: number) => Promise<T>,
  retries: number,
  timeout: number = 1 * 1000, // in ms
): Promise<T> => {
  if (retries === 0 || typeof retries !== "number" || isNaN(retries)) {
    throw new Error(`Invalid retry amount '${retries}'.`);
  }

  let returnError: Error | undefined;
  const errorMessages = new Set();
  for (let i = 0; retries === -1 || i < retries; i++) {
    try {
      return await fnCall(i, retries);
    } catch (error: unknown) {
      // console.error(extractError(error));
      // Fix error message.
      const errorMessage = extractError(error);
      errorMessages.add(errorMessage);
      returnError = new Error(`'${error}'.`) || returnError;

      if (i < retries - 1 || retries === -1) {
        await sleep(timeout);
      }
    }
  }

  if (returnError) {
    returnError.message = Array.from(errorMessages).join(", ");
  } else {
    returnError = new Error(Array.from(errorMessages).join(", "));
  }

  throw returnError;
};
