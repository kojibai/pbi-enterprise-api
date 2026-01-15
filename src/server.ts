import { makeApp } from "./app.js";
import { config } from "./config.js";
import { runMigrations } from "./db/migrations.js";
import { logger } from "./util/logger.js";

await runMigrations();

const app = makeApp();
app.listen(config.port, () => {
  logger.info({ port: config.port }, "PBI Enterprise API listening");
});