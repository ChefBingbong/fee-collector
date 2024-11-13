import { config } from "dotenv";
import * as z from "zod";
import { extractError } from "../utils/extractError";

const env = process.env.NODE_ENV || "development";
const path = env !== "production" ? ".env" : `.env.${env}`;
config({ path });
config({ path: ".env" });

const envsSchema = z.object({
  NODE_ENV: z.enum(["production", "development", "test"]),
  LOG_LEVEL: z.string().default("INFO"),
  API_KEY: z.string({
    required_error: "Ooga Booga Routing api key required",
  }),
  PROTOCOL_SIGNER: z.string({
    required_error: "Ooga Booga signer required",
  }),
});

const envVars = {
  NODE_ENV: process.env.NODE_ENV,
  LOG_LEVEL: process.env.LOG_LEVEL,
  API_KEY: process.env.API_KEY,
  PROTOCOL_SIGNER: process.env.PROTOCOL_SIGNER,
};

try {
  if (envVars.NODE_ENV === "development") {
    const validatedEnvs = envsSchema.parse(envVars);
    console.log(validatedEnvs);
  }
} catch (error) {
  const parsedError = extractError(error);
  console.error(`Error validating environment variables: ${parsedError}`);
  process.exit(1);
}

type EnvConfig = {
  env: string;
  logLevel: string;
  apiKey: string;
  protocolSigner: string;
};

const appConfig: EnvConfig = {
  env: envVars.NODE_ENV,
  logLevel: envVars.LOG_LEVEL,
  apiKey: envVars.API_KEY,
  protocolSigner: envVars.PROTOCOL_SIGNER,
};

export default appConfig;
