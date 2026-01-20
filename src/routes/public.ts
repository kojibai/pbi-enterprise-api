import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";

export const publicRouter = Router();

// ---- Silence common automatic browser requests (prevents console 404 noise)
const NOISE_PATHS = [
  "/apple-touch-icon.png",
  "/apple-touch-icon-precomposed.png",
  "/site.webmanifest",
  "/manifest.webmanifest",
  "/manifest.json",
  "/robots.txt"
] as const;
publicRouter.get("/favicon.ico", (_req, res) => {
  // If you created public/favicon.ico, use that instead.
  res.redirect(302, "/kojib.png");
});



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
  <link rel="icon" type="image/png" href="/kojib.png" />

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
            <a class="btn" href="/docs">Interactive</a>
            <a class="btn" href="/health">Health</a>
          </div>
          <div class="hr"></div>
          <div class="mono">Auth: Authorization: Bearer &lt;API_KEY&gt;
POST /v1/pbi/challenge
POST /v1/pbi/verify
GET  /v1/pbi/challenges/&lt;challengeId&gt;
GET  /v1/pbi/challenges/&lt;challengeId&gt;/receipt
GET  /v1/pbi/receipts/&lt;receiptId&gt;
POST /v1/pbi/receipts/verify
GET  /v1/pbi/receipts
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
publicRouter.get("/redoc", (_req, res) => {
  res.type("text/html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <title>PBI Enterprise API · Reference</title>
  <link rel="icon" type="image/png" href="/kojib.png" />


  <style>
    :root{
      --bg0:#05070e;
      --bg1:#070b18;

      --ink: rgba(234,243,255,.94);
      --muted: rgba(234,243,255,.76);
      --muted2: rgba(234,243,255,.60);

      --line: rgba(255,255,255,.12);
      --line2: rgba(255,255,255,.18);

      --glass: rgba(255,255,255,.06);
      --glass2: rgba(255,255,255,.09);
      --panel: rgba(0,0,0,.34);
      --panel2: rgba(0,0,0,.46);

      --accent:#78ffe7;
      --accent2:#9aaaff;
      --warn:#ffd38a;
      --danger:#ff8aa0;

      --shadow: 0 18px 55px rgba(0,0,0,.45);
      --shadow2: 0 26px 90px rgba(0,0,0,.55);

      --r: 16px;
      --r2: 22px;

      --ui: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }

    *{ box-sizing:border-box; }
    html, body { height: 100%; width:100%; max-width:100%; overflow-x:hidden; }
    body{
      margin:0;
      font-family: var(--ui);
      color: var(--ink);
      background:
        radial-gradient(1200px 800px at 18% 10%, rgba(120,255,231,.10), transparent 55%),
        radial-gradient(900px 700px at 82% 18%, rgba(140,155,255,.09), transparent 60%),
        radial-gradient(1100px 900px at 60% 92%, rgba(255,190,120,.06), transparent 55%),
        linear-gradient(180deg,var(--bg0),var(--bg1));
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: geometricPrecision;
    }

    a { color: inherit; text-decoration: none; }
    a:hover { text-decoration: none; }
    a:focus-visible{
      outline: 2px solid rgba(120,255,231,.55);
      outline-offset: 3px;
      border-radius: 12px;
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
      background: rgba(0,0,0,.70);
      border: 1px solid var(--line2);
      color: var(--ink);
      z-index: 9999;
      outline: none;
    }

    /* Topbar */
    .pbi-topbar{
      position: sticky;
      top: 0;
      z-index: 1000;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(0,0,0,.68), rgba(0,0,0,.38));
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 1px 0 rgba(255,255,255,.06);
    }
    .pbi-topbar-inner{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 12px;
      padding: 10px 14px;
      max-width: 1440px;
      margin: 0 auto;
      min-width: 0;
    }
    @supports (padding: env(safe-area-inset-top)) {
      .pbi-topbar-inner{
        padding-top: calc(10px + env(safe-area-inset-top));
        padding-bottom: 10px;
      }
    }

    .brand{
      display:flex;
      align-items:center;
      gap: 12px;
      min-width: 0;
    }
    .mark{
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: rgba(120,255,231,.92);
      box-shadow: 0 0 0 5px rgba(120,255,231,.10), 0 0 22px rgba(120,255,231,.22);
      flex: 0 0 auto;
    }
    .brand-text{
      display:flex;
      flex-direction:column;
      line-height: 1.1;
      gap: 2px;
      min-width: 0;
    }
    .brand-title{
      font-size: 13px;
      font-weight: 780;
      letter-spacing: .2px;
      color: var(--ink);
      white-space: nowrap;
    }
    .brand-sub{
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
      overflow:hidden;
      text-overflow: ellipsis;
      max-width: 56vw;
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
      border: 1px solid rgba(255,255,255,.16);
      background: rgba(255,255,255,.06);
      color: rgba(234,243,255,.92);
      font-size: 12px;
      font-weight: 650;
      letter-spacing: .15px;
      transition: transform .12s ease, background .12s ease, border-color .12s ease;
      user-select:none;
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }
    .btn:hover{
      background: rgba(255,255,255,.09);
      border-color: rgba(255,255,255,.22);
      transform: translateY(-1px);
    }
    .btn:active{ transform: translateY(0px); }
    .btn.primary{
      border-color: rgba(120,255,231,.35);
      background: rgba(120,255,231,.12);
    }

    /* Boot shell */
    .boot{
      display:flex;
      align-items:center;
      justify-content:center;
      padding: 40px 14px 60px;
    }
    .boot-card{
      width: min(960px, 100%);
      border-radius: var(--r2);
      border: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.04));
      box-shadow: var(--shadow2);
      padding: 18px 18px 16px;
    }
    .boot-title{
      font-size: 14px;
      font-weight: 820;
      letter-spacing: .2px;
      margin: 0 0 8px 0;
    }
    .boot-sub{
      font-size: 12px;
      color: var(--muted);
      margin: 0;
      line-height: 1.65;
    }
    .boot-sub code{
      font-family: var(--mono);
      font-size: 12px;
      padding: 2px 6px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(0,0,0,.30);
      color: rgba(234,243,255,.94);
    }

    /* ReDoc mount */
    #redoc{ min-height: calc(100vh - 64px); }

    @media (max-width: 720px){
      .brand-sub{ display:none; }
      .btn{ padding: 9px 10px; }
    }

    /* ============================================================
       ReDoc HARD READABILITY OVERRIDES
       Fix: pale pills, low-contrast headers, washed code panels,
       and the white/gray tab UI in request/response samples.
    ============================================================ */

    /* Baseline text contrast */
    #redoc, #redoc *{
      text-shadow: none;
    }
    #redoc .api-content, #redoc .api-content *{
      color: rgba(234,243,255,.92) !important;
    }
    #redoc .api-content p,
    #redoc .api-content li,
    #redoc .api-content td,
    #redoc .api-content small,
    #redoc .api-content .sc-bdVaJa,
    #redoc .api-content .sc-bwzfXH{
      color: rgba(234,243,255,.78) !important;
    }

    /* Links */
    #redoc a{
      color: rgba(120,255,231,.95) !important;
    }
    #redoc a:hover{
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    /* Sidebar */
    #redoc .menu-content{
      background: rgba(0,0,0,.44) !important;
      border-right: 1px solid rgba(255,255,255,.10) !important;
    }
    #redoc .menu-content *{
      color: rgba(234,243,255,.84) !important;
    }
    #redoc .menu-content a:hover{
      background: rgba(255,255,255,.06) !important;
    }
    #redoc .menu-content a[aria-current="page"],
    #redoc .menu-content a.active{
      background: rgba(120,255,231,.14) !important;
      color: rgba(234,243,255,.96) !important;
    }

    /* Section panels (most readability wins come from this) */
    #redoc .api-content > div,
    #redoc .api-content section,
    #redoc .api-content article{
      background: transparent !important;
    }
    #redoc .api-content .operation,
    #redoc .api-content .api-info,
    #redoc .api-content .api-content-wrap,
    #redoc .api-content .api-content-panel{
      background: rgba(0,0,0,.22) !important;
      border: 1px solid rgba(255,255,255,.10) !important;
      border-radius: 16px !important;
      box-shadow: 0 12px 34px rgba(0,0,0,.35) !important;
    }

    /* Operation header bar */
    #redoc .api-content .operation > div:first-child{
      background: rgba(0,0,0,.28) !important;
      border-bottom: 1px solid rgba(255,255,255,.08) !important;
    }

    /* HTTP method badge: always readable (no pale/washed) */
    #redoc .http-verb{
      color: #05070e !important;
      font-weight: 800 !important;
      letter-spacing: .04em !important;
    }

    /* Tabs (this fixes the “Payload” pill being pale/illegible) */
    #redoc .react-tabs__tab-list{
      background: rgba(0,0,0,.32) !important;
      border: 1px solid rgba(255,255,255,.12) !important;
      border-radius: 14px !important;
      padding: 6px !important;
      margin: 0 0 12px 0 !important;
    }
    #redoc .react-tabs__tab{
      border: 0 !important;
      border-radius: 12px !important;
      color: rgba(234,243,255,.76) !important;
      padding: 8px 10px !important;
      background: transparent !important;
      font-weight: 650 !important;
    }
    #redoc .react-tabs__tab--selected{
      background: rgba(120,255,231,.16) !important;
      border: 1px solid rgba(120,255,231,.28) !important;
      color: rgba(234,243,255,.96) !important;
      box-shadow: 0 0 0 3px rgba(120,255,231,.10) !important;
    }
    #redoc .react-tabs__tab:focus{
      outline: none !important;
    }

    /* Request/Response sample panel background */
    #redoc .react-tabs__tab-panel{
      background: rgba(0,0,0,.28) !important;
      border: 1px solid rgba(255,255,255,.12) !important;
      border-radius: 16px !important;
      padding: 14px !important;
    }

    /* Sample action links (Copy / Expand / Collapse) */
    #redoc .react-tabs__tab-panel a,
    #redoc .react-tabs__tab-panel button{
      color: rgba(234,243,255,.84) !important;
    }

    /* Code blocks: deep background + crisp text */
    #redoc pre,
    #redoc code,
    #redoc .redoc-json,
    #redoc .right-panel,
    #redoc .right-panel pre{
      font-family: var(--mono) !important;
    }
    #redoc pre{
      background: rgba(0,0,0,.42) !important;
      color: rgba(234,243,255,.94) !important;
      border: 1px solid rgba(255,255,255,.12) !important;
      border-radius: 14px !important;
      box-shadow: 0 10px 26px rgba(0,0,0,.30) !important;
      overflow: auto !important;
    }
    #redoc pre code{
      background: transparent !important;
      border: 0 !important;
      padding: 0 !important;
      color: rgba(234,243,255,.94) !important;
    }

    /* Inline code: avoid gray-on-gray */
    #redoc :not(pre) > code{
      color: rgba(234,243,255,.94) !important;
      background: rgba(0,0,0,.30) !important;
      border: 1px solid rgba(255,255,255,.12) !important;
      border-radius: 10px !important;
      padding: 1px 6px !important;
    }

    /* Tables */
    #redoc table{
      border-collapse: separate !important;
      border-spacing: 0 !important;
      border: 1px solid rgba(255,255,255,.10) !important;
      border-radius: 14px !important;
      overflow: hidden !important;
    }
    #redoc th{
      background: rgba(0,0,0,.30) !important;
      color: rgba(234,243,255,.92) !important;
      border-bottom: 1px solid rgba(255,255,255,.10) !important;
    }
    #redoc td{
      background: rgba(0,0,0,.18) !important;
      color: rgba(234,243,255,.78) !important;
      border-bottom: 1px solid rgba(255,255,255,.08) !important;
    }

    /* Floating scroll button (avoid bright white blob) */
    #redoc button[aria-label*="scroll"],
    #redoc button[aria-label*="Scroll"]{
      background: rgba(0,0,0,.38) !important;
      border: 1px solid rgba(255,255,255,.14) !important;
      color: rgba(234,243,255,.92) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
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
        <a class="btn" href="/docs">Interactive</a>
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
// Premium minimal topbar: Home / ReDoc / OpenAPI
// Implementation:
// 1) Hide Swagger's built-in topbar via CSS
// 2) Inject our own clickable frosted pill nav via customJs (because swagger-ui-express has NO customHtml)
// 3) Add padding-top so the fixed pillbar never overlaps content

// 1) JS injector (must be mounted BEFORE /docs middleware so it can be served)
publicRouter.get("/docs/kojib-pillbar.js", (_req, res) => {
  res.type("application/javascript").send(`(function () {
  "use strict";

  function ensureViewport() {
    var head = document.head || document.getElementsByTagName("head")[0];
    if (!head) return;

    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "viewport");
      head.appendChild(meta);
    }

    // The key: force device-width so iOS doesn't render at 980px and scale down.
    meta.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover");
  }

  function ensureTextAdjust() {
    // Prevent iOS Safari from doing weird automatic text scaling on some pages.
    try {
      document.documentElement.style.webkitTextSizeAdjust = "100%";
      document.documentElement.style.textSizeAdjust = "100%";
    } catch (_) {}
  }

  function mount() {
    ensureViewport();
    ensureTextAdjust();

    if (document.getElementById("kojib-pillbar")) return;

    var bar = document.createElement("div");
    bar.id = "kojib-pillbar";
    bar.className = "pbi-pillbar";
    bar.setAttribute("role", "banner");

    bar.innerHTML =
      '<div class="pbi-pillbrand" aria-label="Kojib">' +
        '<img class="pbi-pillbrandLogo" src="/kojib.svg" alt="Kojib" />' +
        '<div class="pbi-pillbrandText">Kojib · API Docs</div>' +
      '</div>' +
      '<nav class="pbi-pillnav" aria-label="Navigation">' +
        '<a class="pbi-pill" href="/">Home</a>' +
        '<a class="pbi-pill" href="/redoc">Reference</a>' +
        '<a class="pbi-pill primary" href="/openapi.yaml">OpenAPI</a>' +
      '</nav>';

    document.body.insertBefore(bar, document.body.firstChild);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();`);
});


// 2) Swagger UI route
publicRouter.use("/docs", (req, res, next) => {
  const loaded = loadSpec();
  if (!loaded) {
    res.status(404).json({ error: "openapi_not_found" });
    return;
  }
const setup = swaggerUi.setup(loaded.spec, {
  customSiteTitle: "Kojib · PBI Enterprise API Docs",
  customfavIcon: "/kojib.png",   // ✅ this sets the favicon for /docs
  swaggerOptions: { persistAuthorization: true },
  customJs: ["/docs/kojib-pillbar.js"],
  customCss: `...`
});

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
      customSiteTitle: "Kojib · PBI Enterprise API Docs",
      swaggerOptions: { persistAuthorization: true },

      // ✅ Supported by swagger-ui-express typings
      customJs: ["/docs/kojib-pillbar.js"],

      customCss: `
/* =========================
   GLOBAL DARK BASE
========================== */
html{
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
html, body{
  background:
    radial-gradient(1200px 800px at 18% 10%, rgba(120,255,231,.10), transparent 55%),
    radial-gradient(900px 700px at 82% 18%, rgba(140,155,255,.09), transparent 60%),
    radial-gradient(1100px 900px at 60% 92%, rgba(255,190,120,.06), transparent 55%),
    linear-gradient(180deg,#05070e,#070b18) !important;
  background-attachment: fixed !important;
}
/* Ensure Swagger UI itself doesn't paint a flat background over our gradient */
.swagger-ui{
  background: transparent !important;
}

/* Smooth fade under the fixed pillbar so there's no hard cutoff */
body::before{
  content:"";
  position: fixed;
  left: 0; right: 0; top: 0;
  height: 180px;
  z-index: 9999;            /* pillbar is 10000, so this stays behind it */
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgba(0,0,0,.62) 0%,
    rgba(0,0,0,.38) 35%,
    rgba(0,0,0,.18) 65%,
    rgba(0,0,0,0) 100%
  );
}

.swagger-ui { color: rgba(255,255,255,.92) !important; }
.swagger-ui * { color: rgba(255,255,255,.92) !important; }

/* Center content (Stripe-like) */
.swagger-ui .wrapper,
.swagger-ui .information-container,
.swagger-ui .scheme-container,
.swagger-ui .opblock-tag-section,
.swagger-ui .models,
.swagger-ui .info {
  max-width: 1080px !important;
  margin-left: auto !important;
  margin-right: auto !important;
}
.swagger-ui .wrapper { padding: 0 14px !important; }

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

/* ==========================================================
   REMOVE SWAGGER TOPBAR ENTIRELY
========================================================== */
.swagger-ui .topbar { display: none !important; }

/* Make room for the fixed pillbar */
body { padding-top: 78px !important; }
@supports (padding: env(safe-area-inset-top)) {
  body { padding-top: calc(78px + env(safe-area-inset-top)) !important; }
}

/* ==========================================================
   KOJIB FROSTED PILL NAV (CLICKABLE, PREMIUM)
========================================================== */
.pbi-pillbar{
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(1080px, calc(100% - 28px));
  height: 58px;
  z-index: 10000;

  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 12px;

  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.14);
  background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(0,0,0,.28));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 20px 70px rgba(0,0,0,.45);

  padding: 10px 12px;
  margin-top: 10px;
}
@supports (padding: env(safe-area-inset-top)) {
  .pbi-pillbar { margin-top: calc(10px + env(safe-area-inset-top)); }
}

.pbi-pillbrand{
  display:flex;
  align-items:center;
  gap: 10px;
  min-width: 0;
}
.pbi-pillbrandLogo{
  width: 28px;
  height: 28px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
  padding: 5px;
  box-shadow: 0 10px 28px rgba(0,0,0,.30);
}
.pbi-pillbrandText{
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  font-weight: 850;
  letter-spacing: .18px;
  font-size: 13px;
  color: rgba(255,255,255,.92);
  white-space: nowrap;
  overflow:hidden;
  text-overflow: ellipsis;
  max-width: 45vw;
}

.pbi-pillnav{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap: 10px;
}

.pbi-pill{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  height: 36px;
  padding: 0 14px;

  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.90) !important;

  font-weight: 850;
  font-size: 12px;
  letter-spacing: .12px;

  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 12px 34px rgba(0,0,0,.28);

  transition: transform .12s ease, background .12s ease, border-color .12s ease;
  text-decoration: none !important;
}
.pbi-pill:hover{
  transform: translateY(-1px);
  background: rgba(255,255,255,.09);
  border-color: rgba(255,255,255,.22);
}
.pbi-pill.primary{
  border-color: rgba(120,255,231,.32);
  background: rgba(120,255,231,.12);
}

/* Mobile: tighten but keep same left/right layout */
@media (max-width: 520px){
  body { padding-top: 70px !important; }
  .pbi-pillbar{
    height: 54px;
    border-radius: 16px;
    padding: 9px 10px;
  }
  .pbi-pill{ height: 34px; padding: 0 12px; }
  .pbi-pillbrandLogo{ width: 26px; height: 26px; border-radius: 11px; }
  .pbi-pillbrandText{ font-size: 12px; max-width: 42vw; }
}

/* =========================
   REST OF YOUR EXISTING STYLES
========================== */
.swagger-ui .scheme-container {
  background: rgba(255,255,255,.06) !important;
  border: 1px solid rgba(255,255,255,.12) !important;
  border-radius: 16px !important;
  box-shadow: 0 10px 28px rgba(0,0,0,.35) !important;
}

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

.swagger-ui .highlight-code,
.swagger-ui pre,
.swagger-ui code {
  background: rgba(0,0,0,.32) !important;
  color: #ffffff !important;
  border: 1px solid rgba(255,255,255,.10) !important;
  border-radius: 12px !important;
}

.swagger-ui .btn {
  border-radius: 12px !important;
  border: 1px solid rgba(255,255,255,.16) !important;
  background: rgba(255,255,255,.06) !important;
  color: #ffffff !important;
}
.swagger-ui .btn:hover { background: rgba(255,255,255,.08) !important; }

.swagger-ui .opblock-summary-method { color: #05070e !important; }
.swagger-ui .opblock.opblock-post .opblock-summary-method { background: #9aaaff !important; }
.swagger-ui .opblock.opblock-get .opblock-summary-method { background: #78ffe7 !important; }
.swagger-ui .opblock.opblock-put .opblock-summary-method { background: #ffd38a !important; }
.swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #ff8aa0 !important; }

.swagger-ui a { color: #78ffe7 !important; }

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
.swagger-ui .tab li.active button * { color: #ffffff !important; }

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
.swagger-ui .responses-table .response-col_status .response.selected * { color: #ffffff !important; }

.swagger-ui .modal-ux {
  background: rgba(10,12,20,.95) !important;
  border: 1px solid rgba(255,255,255,.12) !important;
  border-radius: 18px !important;
}
  @media (max-width: 900px){
  html, body { background-attachment: scroll !important; }
}

.swagger-ui .modal-ux * { color: rgba(255,255,255,.92) !important; }
`
    });

    setup(req, res, next);
  };

  runServe();
});
