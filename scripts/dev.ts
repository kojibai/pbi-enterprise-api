import { runMigrations } from "../src/db/migrations.js";
import { makeApp } from "../src/app.js";
import { config } from "../src/config.js";
import { logger } from "../src/util/logger.js";

async function main(): Promise<void> {
  await runMigrations();

  const app = makeApp();
  app.listen(config.port, () => {
    logger.info({ port: config.port }, "PBI Enterprise API (dev) listening");
  });
}

main().catch((err: unknown) => {
  logger.error({ err }, "Dev server failed to start");
  process.exit(1);
});