import { AppInitializer } from "./app";
import { Schedulers } from "./cron/types";

export const service = new AppInitializer(Object.values(Schedulers));

async function main() {
  await service.initApp();
}

main();

const closeGracefully = (signal: NodeJS.Signals) => {
  console.error(`*^!@4=> Received signal to terminate: ${signal}`);
  process.exit(1);
};

process.on("SIGINT", closeGracefully);
process.on("SIGTERM", closeGracefully);
