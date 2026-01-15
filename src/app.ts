import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "./util/logger.js";
import { requestId } from "./middleware/requestId.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { apiKeyAuth } from "./middleware/apiKeyAuth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import cookieParser from "cookie-parser";
import { portalRouter } from "./routes/portal.js";
import { stripeRouter } from "./routes/stripe.js";
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
app.use(cookieParser());
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],

        // Allow Redoc CDN + our local /redoc-init.js + allow blob workers
        "script-src": ["'self'", "https://cdn.redoc.ly", "blob:"],

        // Workers for Redoc (Safari fix)
        "worker-src": ["'self'", "blob:"],

        // Some browsers still consult child-src for workers
        "child-src": ["'self'", "blob:"],

        // CSS (Swagger uses inline style blocks sometimes)
        "style-src": ["'self'", "https:", "'unsafe-inline'"],

        // Redoc fonts/icons
        "font-src": ["'self'", "https:", "data:"],

        // Images
        "img-src": ["'self'", "data:"],

        // XHR/fetch (Redoc fetching /openapi.yaml is same-origin)
        "connect-src": ["'self'"]
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
app.use("/v1/portal", portalRouter);
app.use("/v1/stripe", stripeRouter);
  // ✅ Explicit 404 JSON (prevents "Cannot GET /" surprises)
  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  app.use(errorHandler);
  return app;
}