import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "./util/logger.js";
import { requestId } from "./middleware/requestId.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { apiKeyAuth } from "./middleware/apiKeyAuth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";
import { pbiRouter } from "./routes/pbi.js";
import { billingRouter } from "./routes/billing.js";
import { adminRouter } from "./routes/admin.js";
import { publicRouter } from "./routes/public.js";


export function makeApp() {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(requestId);
  app.use(rateLimit);

  app.use(helmet());
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/", healthRouter);

  // Authenticated v1 API
  app.use("/v1", apiKeyAuth);
  app.use("/v1/pbi", pbiRouter);
  app.use("/v1/billing", billingRouter);
  app.use("/v1/admin", adminRouter);
  app.use("/", publicRouter);

  app.use(errorHandler);
  return app;
}