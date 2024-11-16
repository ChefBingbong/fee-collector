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
  MONGO_URI: z.string({ required_error: "URL required for Mongo DB" }),
  MONGO_VAULT_DATABASE: z.string({ required_error: "Database name required for Mongo DB" }).default("vault"),
  MONGO_AUTH_SOURCE: z.string({ required_error: "Auth source required for Mongo DB" }).nonempty(),
  MONGO_TLS: z.boolean().default(true),
});

const envVars = {
  NODE_ENV: process.env.NODE_ENV,
  LOG_LEVEL: process.env.LOG_LEVEL,
  API_KEY: process.env.API_KEY,
  PROTOCOL_SIGNER: process.env.PROTOCOL_SIGNER,
  MONGO_URI: process.env.MONGO_URI,
  MONGO_VAULT_DATABASE: process.env.MONGO_VAULT_DATABASE,
  MONGO_AUTH_SOURCE: process.env.MONGO_AUTH_SOURCE,
  MONGO_TLS: process.env.MONGO_TLS === "true",
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
  mongoUri: string;
  mongoVaultDatabase: string | undefined;
  mongoAuthSource: string;
  mongoTls: boolean | true;
};

const appConfig: EnvConfig = {
  env: envVars.NODE_ENV,
  logLevel: envVars.LOG_LEVEL,
  apiKey: envVars.API_KEY,
  protocolSigner: envVars.PROTOCOL_SIGNER,
  mongoUri: envVars.MONGO_URI || "mongodb://localhost:27017",
  mongoVaultDatabase: envVars.MONGO_VAULT_DATABASE,
  mongoAuthSource: envVars.MONGO_AUTH_SOURCE || "admin",
  mongoTls: envVars.MONGO_TLS,
};

export default appConfig;
