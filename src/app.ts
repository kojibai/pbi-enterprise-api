import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "./util/logger.js";
import { requestId } from "./middleware/requestId.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { apiKeyAuth } from "./middleware/apiKeyAuth.js";
import { errorHandler } from "./middleware/errorHandler.js";

import { publicRouter } from "./routes/public.js";
import { healthRouter } from "./routes/health.js";
import { pbiRouter } from "./routes/pbi.js";
import { billingRouter } from "./routes/billing.js";
import { adminRouter } from "./routes/admin.js";

export function makeApp() {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(requestId);
  app.use(rateLimit);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // Keep your existing strictness but allow Redoc CDN
        "script-src": ["'self'", "https://cdn.redoc.ly"],
        "style-src": ["'self'", "https:", "'unsafe-inline'"],
        "img-src": ["'self'", "data:"]
      }
    }
  })
);
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "1mb" }));

  // ✅ Public routes FIRST (/, /docs, /openapi.yaml, /favicon, etc.)
  app.use("/", publicRouter);

  // ✅ Health public
  app.use("/", healthRouter);

  // ✅ Protected API
  app.use("/v1", apiKeyAuth);
  app.use("/v1/pbi", pbiRouter);
  app.use("/v1/billing", billingRouter);
  app.use("/v1/admin", adminRouter);

  // ✅ Explicit 404 JSON (prevents "Cannot GET /" surprises)
  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  app.use(errorHandler);
  return app;
}