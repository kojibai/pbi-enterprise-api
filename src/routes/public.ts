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

// ---- Homepage (frosted Atlantean glass)
publicRouter.get("/", (_req, res) => {
  res.type("text/html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>PBI Enterprise API</title>
  <link rel="icon" href="data:;base64,iVBORw0KGgo=" />
  <style>
    :root{
      --bg0:#05070e; --bg1:#070b18;
      --ink:#eaf3ff; --muted:rgba(234,243,255,.72);
      --line:rgba(255,255,255,.10); --line2:rgba(255,255,255,.16);
      --r:18px; --r2:26px;
      --shadow:0 18px 50px rgba(0,0,0,.55);
      --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    *{box-sizing:border-box}
    body{
      margin:0; font-family:var(--sans); color:var(--ink);
      min-height:100vh;
      background:
        radial-gradient(1200px 800px at 20% 10%, rgba(120,255,231,.12), transparent 55%),
        radial-gradient(900px 700px at 80% 20%, rgba(140,155,255,.10), transparent 60%),
        radial-gradient(1100px 900px at 60% 90%, rgba(255,190,120,.08), transparent 55%),
        linear-gradient(180deg,var(--bg0),var(--bg1));
    }
    .wrap{max-width:980px;margin:0 auto;padding:28px 16px 44px;}
    .hero{
      position:relative;
      border-radius:var(--r2);
      padding:22px 22px 18px;
      background:linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.04));
      border:1px solid var(--line);
      box-shadow:var(--shadow);
      overflow:hidden;
    }
    .hero:before{
      content:"";
      position:absolute;
      inset:-2px;
      background:
        radial-gradient(600px 260px at 18% 0%, rgba(120,255,231,.18), transparent 60%),
        radial-gradient(560px 240px at 86% 20%, rgba(130,170,255,.16), transparent 60%);
      filter:blur(14px);
      opacity:.9;
      pointer-events:none;
    }
    .row{
      position:relative;
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:16px;
    }
    h1{margin:0;font-size:22px;letter-spacing:.2px}
    p{margin:8px 0 0;color:var(--muted);line-height:1.35;font-size:13px}
    .badge{
      display:inline-flex;
      align-items:center;
      gap:10px;
      padding:10px 12px;
      border-radius:999px;
      border:1px solid var(--line2);
      background:rgba(0,0,0,.22);
      backdrop-filter:blur(14px);
      -webkit-backdrop-filter:blur(14px);
      font-size:12px;
      white-space:nowrap;
    }
    .dot{
      width:10px;height:10px;border-radius:999px;
      background:rgba(120,255,231,.85);
      box-shadow:0 0 0 3px rgba(120,255,231,.12), 0 0 18px rgba(120,255,231,.25);
    }
    .grid{margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px;}
    @media(max-width:760px){.grid{grid-template-columns:1fr}}
    .card{
      border-radius:var(--r);
      padding:16px;
      background:rgba(255,255,255,.06);
      border:1px solid var(--line);
      box-shadow:0 10px 28px rgba(0,0,0,.35);
    }
    .k{font-size:12px;color:rgba(234,243,255,.78);margin-bottom:10px}
    .links{display:flex;gap:10px;flex-wrap:wrap}
    a.btn{
      text-decoration:none;
      color:var(--ink);
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:10px 14px;
      border-radius:14px;
      border:1px solid rgba(255,255,255,.16);
      background:rgba(255,255,255,.06);
      backdrop-filter:blur(14px);
      -webkit-backdrop-filter:blur(14px);
    }
    a.btn:hover{background:rgba(255,255,255,.08)}
    .mono{
      font-family:var(--mono);
      font-size:12px;
      color:rgba(234,243,255,.86);
      white-space:pre-wrap;
      word-break:break-word;
    }
    .hr{
      height:1px;
      background:linear-gradient(90deg, transparent, rgba(120,255,231,.30), rgba(150,170,255,.20), transparent);
      opacity:.9;
      margin:12px 0;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div class="row">
        <div>
          <h1>PBI Enterprise API</h1>
          <p>Presence-Bound Identity verification + receipts + metering. Bind a live presence ceremony to an action/artifact hash.</p>
        </div>
        <div class="badge"><span class="dot"></span><span>Krystal Gate · Online</span></div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="k">Docs</div>
          <div class="links">
            <a class="btn" href="/docs">Swagger UI</a>
            <a class="btn" href="/openapi.yaml">OpenAPI YAML</a>
            <a class="btn" href="/health">Health</a>
          </div>
          <div class="hr"></div>
          <div class="mono">Auth: Authorization: Bearer &lt;API_KEY&gt;
POST /v1/pbi/challenge
POST /v1/pbi/verify
GET  /v1/billing/usage
GET  /v1/billing/invoices</div>
        </div>

        <div class="card">
          <div class="k">What this proves</div>
          <div class="mono">Not “who” (no accounts).
A binding receipt that:
• a user was present (UP+UV via WebAuthn)
• for this exact challenge
• within expiry
• non-replayable
• auditable (receipt hash)</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`);
});

// ---- OpenAPI loader (safe)
function loadSpec(): { yamlText: string; spec: object } | null {
  const p = path.join(process.cwd(), "openapi.yaml");
  if (!fs.existsSync(p)) return null;
  const yamlText = fs.readFileSync(p, "utf8");
  const spec = YAML.parse(yamlText) as object;
  return { yamlText, spec };
}

// ---- OpenAPI YAML
publicRouter.get("/openapi.yaml", (_req, res) => {
  const loaded = loadSpec();
  if (!loaded) {
    res.status(404).json({ error: "openapi_not_found" });
    return;
  }
  res.type("text/yaml").send(loaded.yamlText);
});

// ---- Swagger UI (correct mounting + typed)
publicRouter.use("/docs", (req, res, next) => {
  const loaded = loadSpec();
  if (!loaded) {
    res.status(404).json({ error: "openapi_not_found" });
    return;
  }

  // Mount swagger-ui static assets under /docs/*
  const serveHandlers = swaggerUi.serve;
  const serve = Array.isArray(serveHandlers) ? serveHandlers : [serveHandlers];

  // Run the serve handlers first, then the setup handler
  let i = 0;
  const runServe = (): void => {
    const h = serve[i];
    i += 1;
    if (!h) return runSetup();
    h(req, res, (err?: unknown) => {
      if (err) return next(err as never);
      runServe();
    });
  };

  const runSetup = (): void => {
    const setup = swaggerUi.setup(loaded.spec, {
      customSiteTitle: "PBI Enterprise API Docs",
      swaggerOptions: { persistAuthorization: true },
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
    });

    setup(req, res, next);
  };

  runServe();
});