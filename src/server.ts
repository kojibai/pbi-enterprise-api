import { makeApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./util/logger.js";
import { startWebhookDeliveryWorker } from "./webhooks/worker.js";

const app = makeApp();

app.listen(config.port, () => {
  logger.info({ port: config.port }, "PBI Enterprise API listening");
});

const worker = startWebhookDeliveryWorker();

process.on("SIGTERM", () => {
  worker.stop();
});

process.on("SIGINT", () => {
  worker.stop();
});
