import Axios, { AxiosRequestConfig } from "axios";

import { extractError } from "./extractError";

export const DEFAULT_TIMEOUT = 30 * 1000;

export const GET = async <T = unknown, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<T> => {
  try {
    const response = await Axios.get<T>(url, {
      timeout: DEFAULT_TIMEOUT,
      ...config,
    });

    return response.data;
  } catch (error: unknown) {
    throw new Error(extractError(error));
  }
};

export const POST = async <T = unknown, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<T> => {
  try {
    const response = await Axios.post<T>(url, data, {
      timeout: DEFAULT_TIMEOUT,
      ...config,
    });

    return response.data;
  } catch (error: unknown) {
    throw new Error(extractError(error));
  }
};
