import { makeApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./util/logger.js";

const app = makeApp();

app.listen(config.port, () => {
  logger.info({ port: config.port }, "PBI Enterprise API listening");
});