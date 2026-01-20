import { makeApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./util/logger.js";
import { startWebhookDeliveryWorker } from "./webhooks/worker.js";
import { closePool } from "./db/pool.js";
// If you have migrations and want them on boot, uncomment these:
// import { runMigrations } from "./db/migrate.js";

async function main(): Promise<void> {
  // If you want migrations on boot (recommended for launch), uncomment:
  // try {
  //   await runMigrations();
  // } catch (err) {
  //   logger.error({ err }, "migrations_failed");
  //   process.exit(1);
  // }

  const app = makeApp();

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, "PBI Enterprise API listening");
  });

  // Allow disabling the worker in dev/test or in certain deployments.
  const workerEnabled = process.env.PBI_WEBHOOK_WORKER_ENABLED !== "0";
  const worker = workerEnabled ? startWebhookDeliveryWorker() : null;

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, "shutdown_start");

    try {
      if (worker) worker.stop();
    } catch (err) {
      logger.warn({ err }, "shutdown_worker_stop_failed");
    }

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    try {
      await closePool();
    } catch (err) {
      logger.warn({ err }, "shutdown_pool_close_failed");
    }

    logger.info({ signal }, "shutdown_complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

void main();
