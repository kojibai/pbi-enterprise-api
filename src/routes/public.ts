import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";

export const publicRouter = Router();
// ---- Silence common automatic browser requests (prevents console 404 noise)
const NOISE_PATHS = [
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/apple-touch-icon-precomposed.png",
  "/site.webmanifest",
  "/manifest.webmanifest",
  "/manifest.json",
  "/robots.txt"
] as const;

for (const p of NOISE_PATHS) {
  publicRouter.get(p, (_req, res) => res.status(204).end());
}
function loadSpec(): { yamlText: string; spec: object } {
  const p = path.join(process.cwd(), "openapi.yaml");
  const yamlText = fs.readFileSync(p, "utf8");
  const spec = YAML.parse(yamlText) as object;
  return { yamlText, spec };
}
publicRouter.get("/favicon.ico", (_req, res) => {
  // 204 = No Content (clean, no console error)
  res.status(204).end();
});

publicRouter.get("/openapi.yaml", (_req, res) => {
  const { yamlText } = loadSpec();
  res.type("text/yaml").send(yamlText);
});

// ✅ This is the important part:
// - swaggerUi.serve must be mounted at /docs
// - swaggerUi.setup must also be at /docs
publicRouter.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(loadSpec().spec, {
    customSiteTitle: "PBI Enterprise API Docs",
    swaggerOptions: {
      persistAuthorization: true
    },
    customCss: `
      body { background: #05070e; }
      .swagger-ui .topbar { background: rgba(255,255,255,.06); border-bottom: 1px solid rgba(255,255,255,.12); }
      .swagger-ui .topbar a { color: #eaf3ff !important; }
      .swagger-ui, .swagger-ui .info p, .swagger-ui .info li, .swagger-ui .opblock-description-wrapper p {
        color: rgba(234,243,255,.86);
      }
      .swagger-ui .scheme-container { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.10); }
      .swagger-ui .opblock { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.10); }
      .swagger-ui .opblock-summary { background: rgba(0,0,0,.22); }
      .swagger-ui .btn { border-radius: 12px; }
    `
  })
);