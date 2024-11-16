import mongoose, { Connection, ConnectOptions, Model } from "mongoose";
import appConfig from "../config/config";
import { ModelType } from "./types";

let connection: Connection | null = null;

export const getConnection = async (): Promise<Connection> => {
  if (connection === null) {
    const uri = appConfig.mongoUri;
    const options: ConnectOptions = {
      bufferCommands: false,
      autoIndex: true,
      autoCreate: false,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000,
      tls: appConfig.mongoTls,
      authSource: appConfig.mongoAuthSource,
    };
    mongoose.set("strictQuery", true);
    connection = await mongoose.createConnection(uri, options).asPromise();
  }

  return connection;
};

export const getModel = async (type: ModelType): Promise<Model<any>> => {
  connection = await getConnection();

  return connection.model(type);
};
