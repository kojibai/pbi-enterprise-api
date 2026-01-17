import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import { demoRouter } from "./routes/demo.js";
import { logger } from "./util/logger.js";
import { requestId } from "./middleware/requestId.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { apiKeyAuth } from "./middleware/apiKeyAuth.js";
import { errorHandler } from "./middleware/errorHandler.js";

import { publicRouter } from "./routes/public.js";
import { healthRouter } from "./routes/health.js";
import { portalRouter } from "./routes/portal.js";
import { stripeRouter } from "./routes/stripe.js";

import { pbiRouter } from "./routes/pbi.js";
import { billingRouter } from "./routes/billing.js";
import { adminRouter } from "./routes/admin.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// dist/src/server.js -> go up two levels to project root
const publicDir = path.resolve(__dirname, "../../public");



export function makeApp() {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(requestId);
  app.use(rateLimit);

  // Cookies for portal sessions
  app.use(cookieParser());

app.use(express.static(path.join(process.cwd(), "public")));
app.use(express.static(publicDir));

  // Helmet + CSP (supports Redoc on mobile via blob workers)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],

          // Redoc CDN + blob workers
          "script-src": ["'self'", "https://cdn.redoc.ly", "blob:"],
          "worker-src": ["'self'", "blob:"],
          "child-src": ["'self'", "blob:"],

          // Swagger uses inline styles
          "style-src": ["'self'", "https:", "'unsafe-inline'"],

          // Fonts/images
          "font-src": ["'self'", "https:", "data:"],
          "img-src": ["'self'", "data:"],

          // API calls (portal->api is cross-origin; include portal origin)
          // NOTE: connect-src controls browser fetch/XHR from pages served by THIS origin.
          // Keeping 'self' is fine since portal is a different origin; this CSP mainly affects /docs + /redoc here.
          "connect-src": ["'self'"]
        }
      }
    })
  );

  // CORS for portal (credentials required for cookies)
// CORS
const allowedOrigins = new Set<string>([
  "https://pbi.kojib.com",
  "https://tool.kojib.com",
  "https://demo.kojib.com",
  "http://localhost:3000",
  "http://localhost:5173",

  
]);

const corsOptions: cors.CorsOptions = {
  
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-to-server / curl
    if (allowedOrigins.has(origin)) return cb(null, origin); // echo the origin (not boolean)
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["authorization", "content-type"],
  optionsSuccessStatus: 204,
  maxAge: 86400
};

// Handle preflight explicitly (before auth routes)
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        return cb(null, allowedOrigins.has(origin));
      },
      credentials: true
    })
  );

  app.use(express.json({ limit: "1mb" }));

  // Public UI/docs + health
  app.use("/", publicRouter);
  app.use("/", healthRouter);
// Public demo proxy
app.use("/demo", demoRouter);
  // ✅ Portal + Stripe must be PUBLIC (no API key)
  app.use("/v1/portal", portalRouter);
  app.use("/v1/stripe", stripeRouter);

  // ✅ Only machine endpoints require API key
  app.use("/v1/pbi", apiKeyAuth, pbiRouter);
  app.use("/v1/billing", apiKeyAuth, billingRouter);
  app.use("/v1/admin", apiKeyAuth, adminRouter);

  // Explicit 404
  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  app.use(errorHandler);
  return app;
}