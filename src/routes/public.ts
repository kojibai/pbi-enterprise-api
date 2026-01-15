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
            <a class="btn" href="/redoc">Redoc</a>
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

// ---- Redoc (TOP-LEVEL route, NOT inside /docs)
publicRouter.get("/redoc", (_req, res) => {
  res.type("text/html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>PBI Enterprise API · Redoc</title>
  <link rel="icon" href="data:;base64,iVBORw0KGgo=" />
  <style>
    body{
      margin:0;
      background:
        radial-gradient(1200px 800px at 20% 10%, rgba(120,255,231,.10), transparent 55%),
        radial-gradient(900px 700px at 80% 20%, rgba(140,155,255,.08), transparent 60%),
        linear-gradient(180deg,#05070e,#070b18);
      color: #eaf3ff;
    }
    .topbar{
      position:sticky; top:0; z-index:10;
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      background: rgba(0,0,0,.35);
      border-bottom: 1px solid rgba(255,255,255,.10);
      padding: 10px 14px;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      color: rgba(234,243,255,.92);
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap: 10px;
    }
    .brand{display:flex;align-items:center;gap:10px;font-weight:600;letter-spacing:.2px;font-size:13px;white-space:nowrap;}
    .dot{width:10px;height:10px;border-radius:999px;background:rgba(120,255,231,.85);
      box-shadow:0 0 0 3px rgba(120,255,231,.12),0 0 18px rgba(120,255,231,.25);}
    .links{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;}
    .links a{
      color: rgba(234,243,255,.92);
      text-decoration:none;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.06);
      padding: 8px 10px;
      border-radius: 12px;
    }
    .links a:hover{ background: rgba(255,255,255,.08); }
    #redoc{ min-height: calc(100vh - 52px); }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="brand"><span class="dot"></span> PBI Enterprise API · Redoc</div>
    <div class="links">
      <a href="/">Home</a>
      <a href="/docs">Swagger</a>
      <a href="/openapi.yaml">OpenAPI</a>
    </div>
  </div>

  <div id="redoc"></div>

  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  <script src="/redoc-init.js"></script>
</body>
</html>`);
});

publicRouter.get("/redoc-init.js", (_req, res) => {
  res.type("application/javascript").send(`
    Redoc.init("/openapi.yaml", {
      hideHostname: true,
      expandResponses: "200,201",
      theme: {
        colors: {
          primary: { main: "#78ffe7" },
          text: {
            primary: "#ffffff",
            secondary: "rgba(255,255,255,.78)"
          },
          border: { dark: "rgba(255,255,255,.14)", light: "rgba(255,255,255,.10)" },
          http: { get: "#78ffe7", post: "#9aaaff", put: "#ffd38a", delete: "#ff8aa0" },
          responses: { success: "#78ffe7", error: "#ff8aa0" }
        },
        typography: {
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
          headings: {
            fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
            fontWeight: "700",
            color: "#ffffff"
          },
          links: { color: "#78ffe7" },
          code: {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
            color: "#ffffff",
            backgroundColor: "rgba(255,255,255,.06)"
          }
        },
        sidebar: {
          backgroundColor: "rgba(0,0,0,.32)",
          textColor: "#ffffff",
          activeTextColor: "#78ffe7",
          groupItems: { textTransform: "none" }
        },
        rightPanel: {
          backgroundColor: "#05070e",
          textColor: "#ffffff"
        }
      }
    }, document.getElementById("redoc"));
  `);
});

// ---- Swagger UI (correct mounting + typed-safe)
publicRouter.use("/docs", (req, res, next) => {
  const loaded = loadSpec();
  if (!loaded) {
    res.status(404).json({ error: "openapi_not_found" });
    return;
  }

  // swaggerUi.serve is an array of handlers in typings; run them in order
  const serveHandlers = swaggerUi.serve;
  const serve = Array.isArray(serveHandlers) ? serveHandlers : [serveHandlers];

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
  /* =========================
     GLOBAL DARK BASE
  ========================== */
  html, body { background: #05070e !important; }
  .swagger-ui { color: rgba(255,255,255,.92) !important; }
  .swagger-ui * { color: rgba(255,255,255,.92) !important; }

  /* Readable secondary text */
  .swagger-ui .info p,
  .swagger-ui .info li,
  .swagger-ui .opblock-description-wrapper p,
  .swagger-ui .markdown p,
  .swagger-ui .markdown li,
  .swagger-ui .parameter__name,
  .swagger-ui .parameter__type,
  .swagger-ui .opblock-summary-description,
  .swagger-ui .response-col_status,
  .swagger-ui .response-col_description {
    color: rgba(255,255,255,.82) !important;
  }

  /* =========================
     TOPBAR + CONTAINERS
  ========================== */
  .swagger-ui .topbar {
    background: rgba(0,0,0,.35) !important;
    border-bottom: 1px solid rgba(255,255,255,.12) !important;
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }

  .swagger-ui .scheme-container {
    background: rgba(255,255,255,.06) !important;
    border: 1px solid rgba(255,255,255,.12) !important;
    border-radius: 16px !important;
    box-shadow: 0 10px 28px rgba(0,0,0,.35) !important;
  }

  /* =========================
     OPERATION BLOCKS
  ========================== */
  .swagger-ui .opblock {
    background: rgba(255,255,255,.05) !important;
    border: 1px solid rgba(255,255,255,.12) !important;
    box-shadow: 0 12px 30px rgba(0,0,0,.35) !important;
  }
  .swagger-ui .opblock-summary {
    background: rgba(0,0,0,.22) !important;
    border-bottom: 1px solid rgba(255,255,255,.10) !important;
  }

  .swagger-ui .info .title,
  .swagger-ui .info h1,
  .swagger-ui .info h2,
  .swagger-ui .info h3,
  .swagger-ui .opblock-tag,
  .swagger-ui .opblock-summary-path {
    color: #ffffff !important;
  }

  /* =========================
     INPUTS / SELECTS
  ========================== */
  .swagger-ui input[type="text"],
  .swagger-ui input[type="password"],
  .swagger-ui input[type="search"],
  .swagger-ui textarea,
  .swagger-ui select {
    background: rgba(0,0,0,.30) !important;
    border: 1px solid rgba(255,255,255,.16) !important;
    color: #ffffff !important;
    border-radius: 12px !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.06) !important;
  }
  .swagger-ui input::placeholder,
  .swagger-ui textarea::placeholder {
    color: rgba(255,255,255,.55) !important;
  }

  /* =========================
     CODE BLOCKS
  ========================== */
  .swagger-ui .highlight-code,
  .swagger-ui pre,
  .swagger-ui code {
    background: rgba(0,0,0,.32) !important;
    color: #ffffff !important;
    border: 1px solid rgba(255,255,255,.10) !important;
    border-radius: 12px !important;
  }

  /* =========================
     BUTTONS
  ========================== */
  .swagger-ui .btn {
    border-radius: 12px !important;
    border: 1px solid rgba(255,255,255,.16) !important;
    background: rgba(255,255,255,.06) !important;
    color: #ffffff !important;
  }
  .swagger-ui .btn:hover {
    background: rgba(255,255,255,.08) !important;
  }

  /* =========================
     HTTP METHOD BADGES
  ========================== */
  .swagger-ui .opblock-summary-method { color: #05070e !important; }
  .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #9aaaff !important; }
  .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #78ffe7 !important; }
  .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #ffd38a !important; }
  .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #ff8aa0 !important; }

  /* =========================
     LINKS
  ========================== */
  .swagger-ui a { color: #78ffe7 !important; }

  /* =========================================================
     HARD GUARANTEE:
     Nothing "active/selected" turns white. Active = teal glass.
  ========================================================== */

  /* Tabs (generic) */
  .swagger-ui .tab li,
  .swagger-ui .tab li button {
    background: rgba(255,255,255,.06) !important;
    border: 1px solid rgba(255,255,255,.14) !important;
    border-radius: 12px !important;
    color: rgba(255,255,255,.92) !important;
  }
  .swagger-ui .tab li.active,
  .swagger-ui .tab li.active button {
    background: rgba(120,255,231,.18) !important;
    border-color: rgba(120,255,231,.38) !important;
    box-shadow: 0 0 0 4px rgba(120,255,231,.10) !important;
    color: #ffffff !important;
  }
  .swagger-ui .tab li.active *,
  .swagger-ui .tab li.active button * {
    color: #ffffff !important;
  }

  /* Response code chips (THIS is your screenshot: 200 / 401 / 403) */
  .swagger-ui .responses-table .response-col_status .response {
    background: rgba(255,255,255,.06) !important;
    border: 1px solid rgba(255,255,255,.14) !important;
    border-radius: 12px !important;
    color: rgba(255,255,255,.92) !important;
  }
  .swagger-ui .responses-table .response-col_status .response.active,
  .swagger-ui .responses-table .response-col_status .response.selected {
    background: rgba(120,255,231,.18) !important;
    border-color: rgba(120,255,231,.38) !important;
    box-shadow: 0 0 0 4px rgba(120,255,231,.10) !important;
    color: #ffffff !important;
  }
  .swagger-ui .responses-table .response-col_status .response.active *,
  .swagger-ui .responses-table .response-col_status .response.selected * {
    color: #ffffff !important;
  }

  /* Authorize modal (avoid any white panels) */
  .swagger-ui .modal-ux {
    background: rgba(10,12,20,.95) !important;
    border: 1px solid rgba(255,255,255,.12) !important;
    border-radius: 18px !important;
  }
  .swagger-ui .modal-ux * { color: rgba(255,255,255,.92) !important; }

  /* Generic “active/selected” button-like states */
  .swagger-ui button.active,
  .swagger-ui .btn.active,
  .swagger-ui .selected,
  .swagger-ui .is-active {
    background: rgba(120,255,231,.18) !important;
    border-color: rgba(120,255,231,.38) !important;
    color: #ffffff !important;
  }
  .swagger-ui button.active *,
  .swagger-ui .btn.active *,
  .swagger-ui .selected *,
  .swagger-ui .is-active * {
    color: #ffffff !important;
  }
`
    });

    setup(req, res, next);
  };

  runServe();
});