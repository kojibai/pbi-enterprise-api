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

// ---- ReDoc (TOP-LEVEL route, NOT inside /docs)
publicRouter.get("/redoc", (_req, res) => {
  res.type("text/html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <title>PBI Enterprise API · Reference</title>
  <link rel="icon" href="data:;base64,iVBORw0KGgo=" />

  <style>
    :root{
      --bg0:#05070e;
      --bg1:#070b18;

      --ink:rgba(234,243,255,.92);
      --muted:rgba(234,243,255,.72);
      --muted2:rgba(234,243,255,.56);

      --line:rgba(255,255,255,.10);
      --line2:rgba(255,255,255,.16);

      --glass:rgba(255,255,255,.06);
      --glass2:rgba(255,255,255,.09);
      --blackGlass:rgba(0,0,0,.30);

      --accent:#78ffe7;
      --accent2:#8c9bff;

      --shadow: 0 14px 40px rgba(0,0,0,.35);
      --radius: 16px;

      --ui: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }

    html, body { height: 100%; }
    body{
      margin:0;
      font-family: var(--ui);
      color: var(--ink);
      background:
        radial-gradient(1200px 800px at 18% 10%, rgba(120,255,231,.10), transparent 55%),
        radial-gradient(900px 700px at 82% 18%, rgba(140,155,255,.09), transparent 60%),
        linear-gradient(180deg,var(--bg0),var(--bg1));
    }

    /* Accessible skip link */
    .skip{
      position:absolute;
      left:-9999px; top:auto;
      width:1px; height:1px;
      overflow:hidden;
    }
    .skip:focus{
      left:12px; top:12px;
      width:auto; height:auto;
      padding:10px 12px;
      border-radius: 12px;
      background: rgba(0,0,0,.6);
      border: 1px solid var(--line2);
      color: var(--ink);
      z-index: 9999;
      outline: none;
    }

    /* Sticky topbar */
    .pbi-topbar{
      position: sticky;
      top: 0;
      z-index: 1000;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,.30));
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 1px 0 rgba(255,255,255,.06);
    }

    /* Safe areas */
    @supports (padding: env(safe-area-inset-top)) {
      .pbi-topbar-inner{
        padding-top: calc(10px + env(safe-area-inset-top));
        padding-bottom: 10px;
      }
    }

    .pbi-topbar-inner{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 12px;
      padding: 10px 14px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .brand{
      display:flex;
      align-items:center;
      gap: 12px;
      min-width: 220px;
    }
    .mark{
      width: 12px;
      height: 12px;
      border-radius: 999px;
      background: rgba(120,255,231,.90);
      box-shadow:
        0 0 0 4px rgba(120,255,231,.12),
        0 0 22px rgba(120,255,231,.22);
      flex: 0 0 auto;
    }
    .brand-text{
      display:flex;
      flex-direction:column;
      line-height: 1.05;
      gap: 3px;
    }
    .brand-title{
      font-size: 13px;
      font-weight: 650;
      letter-spacing: .2px;
      color: var(--ink);
      white-space: nowrap;
    }
    .brand-sub{
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
    }

    .nav{
      display:flex;
      align-items:center;
      justify-content:flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }

    .btn{
      display:inline-flex;
      align-items:center;
      gap: 8px;
      padding: 9px 11px;
      border-radius: 12px;
      border: 1px solid var(--line2);
      background: rgba(255,255,255,.06);
      color: var(--ink);
      text-decoration:none;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: .15px;
      transition: transform .12s ease, background .12s ease, border-color .12s ease;
      user-select:none;
    }
    .btn:hover{
      background: rgba(255,255,255,.09);
      border-color: rgba(255,255,255,.20);
      transform: translateY(-1px);
    }
    .btn:active{ transform: translateY(0px); }
    .btn:focus-visible{
      outline: 2px solid rgba(120,255,231,.55);
      outline-offset: 2px;
    }
    .btn.primary{
      border-color: rgba(120,255,231,.30);
      background: linear-gradient(180deg, rgba(120,255,231,.14), rgba(255,255,255,.06));
    }

    /* ReDoc container */
    #redoc{
      min-height: calc(100vh - 64px);
    }

    /* Loading shell (removed after Redoc.init callback) */
    .boot{
      display:flex;
      align-items:center;
      justify-content:center;
      padding: 40px 14px 60px;
    }
    .boot-card{
      width: min(860px, 100%);
      border-radius: var(--radius);
      border: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.04));
      box-shadow: var(--shadow);
      padding: 18px 18px 16px;
    }
    .boot-title{
      font-size: 14px;
      font-weight: 700;
      letter-spacing: .2px;
      margin: 0 0 8px 0;
    }
    .boot-sub{
      font-size: 12px;
      color: var(--muted);
      margin: 0;
      line-height: 1.5;
    }
    .boot-sub code{
      font-family: var(--mono);
      font-size: 12px;
      padding: 2px 6px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(0,0,0,.22);
      color: rgba(234,243,255,.88);
    }

    @media (max-width: 720px){
      .brand{ min-width: 0; }
      .brand-sub{ display:none; }
      .btn{ padding: 9px 10px; }
    }
  </style>
</head>
<body>
  <a class="skip" href="#redoc">Skip to API docs</a>

  <header class="pbi-topbar" role="banner">
    <div class="pbi-topbar-inner">
      <div class="brand" aria-label="PBI Enterprise API">
        <span class="mark" aria-hidden="true"></span>
        <div class="brand-text">
          <div class="brand-title">PBI Enterprise API</div>
          <div class="brand-sub">Reference · ReDoc</div>
        </div>
      </div>

      <nav class="nav" aria-label="Documentation links">
        <a class="btn" href="/">Home</a>
        <a class="btn" href="/docs">Swagger</a>
        <a class="btn primary" href="/openapi.yaml">OpenAPI</a>
      </nav>
    </div>
  </header>

  <main id="redoc" role="main">
    <div class="boot" id="pbi-boot">
      <div class="boot-card">
        <div class="boot-title">Loading API Reference…</div>
        <p class="boot-sub">
          If this takes more than a few seconds, verify that <code>/openapi.yaml</code> is reachable.
        </p>
      </div>
    </div>
  </main>

  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  <script src="/redoc-init.js"></script>
</body>
</html>`);
});
publicRouter.get("/redoc-init.js", (_req, res) => {
  res.type("application/javascript").send(`(function () {
  "use strict";

  var SPEC_URL = "/openapi.yaml";
  var mount = document.getElementById("redoc");
  var boot = document.getElementById("pbi-boot");

  /** @param {unknown} err */
  function showError(err) {
    var msg =
      typeof err === "object" && err !== null && "message" in err
        ? String(/** @type {{ message?: unknown }} */ (err).message)
        : String(err);

    if (boot) {
      boot.innerHTML =
        '<div class="boot-card">' +
        '<div class="boot-title">Failed to load API Reference</div>' +
        '<p class="boot-sub">Check that <code>/openapi.yaml</code> is reachable and valid. Error: ' +
        msg +
        "</p></div>";
    } else {
      // Fallback if boot shell isn't present
      try { console.error("[redoc] init failed:", err); } catch (_) {}
    }
  }

  function removeBoot() {
    if (boot && boot.parentNode) boot.parentNode.removeChild(boot);
  }

  /** @param {number} tries */
  function waitForRedoc(tries) {
    var w = /** @type {Window & { Redoc?: { init: Function } }} */ (window);
    if (w.Redoc && typeof w.Redoc.init === "function") return init();
    if (tries > 200) return showError("Redoc.init not available");
    setTimeout(function () { waitForRedoc(tries + 1); }, 25);
  }

  function init() {
    var w = /** @type {Window & { Redoc?: { init: Function } }} */ (window);
    if (!mount) return showError("Missing #redoc mount element");

    var options = {
      // Prevent sticky header from covering deep links
      scrollYOffset: ".topbar, .pbi-topbar",

      // ReDoc options
      hideHostname: true,
      expandResponses: "200,201",
      sanitize: true,
      disableSearch: false,
      sortRequiredPropsFirst: true,
      jsonSamplesExpandLevel: "2",
      schemasExpansionLevel: "0",
      nativeScrollbars: true,

      theme: {
        colors: {
          primary: { main: "#78ffe7" },
          text: {
            primary: "rgba(234,243,255,.92)",
            secondary: "rgba(234,243,255,.70)"
          },
          border: {
            dark: "rgba(255,255,255,.14)",
            light: "rgba(255,255,255,.10)"
          },
          http: {
            get: "#78ffe7",
            post: "#9aaaff",
            put: "#ffd38a",
            delete: "#ff8aa0"
          },
          responses: { success: "#78ffe7", error: "#ff8aa0" }
        },

        typography: {
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
          fontSize: "14px",
          lineHeight: "1.65em",
          fontWeightRegular: "420",
          headings: {
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
            fontWeight: "720",
            color: "rgba(234,243,255,.96)"
          },
          links: { color: "#78ffe7" },
          code: {
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            color: "rgba(234,243,255,.92)",
            backgroundColor: "rgba(0,0,0,.24)"
          }
        },

        sidebar: {
          width: "310px",
          backgroundColor: "rgba(0,0,0,.32)",
          textColor: "rgba(234,243,255,.86)",
          activeTextColor: "#78ffe7",
          groupItems: { textTransform: "none" },
          level1Items: { textTransform: "none" }
        },

        rightPanel: {
          backgroundColor: "#05070e",
          textColor: "rgba(234,243,255,.92)"
        }
      }
    };

    try {
      w.Redoc.init(SPEC_URL, options, mount, function (err) {
        if (err) return showError(err);
        removeBoot();
      });
    } catch (e) {
      showError(e);
    }
  }

  waitForRedoc(0);
})();`);
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