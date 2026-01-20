import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { PresenceBound, PresenceBoundError } from "presencebound-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.use(express.static(path.join(__dirname, "public")));

const client = new PresenceBound({
  apiKey: mustEnv("PRESENCEBOUND_API_KEY"),
  baseUrl: process.env.PRESENCEBOUND_BASE_URL || "https://api.kojib.com",
  timeoutMs: 15000,
  userAgent: "pbi-node-sdk-example/0.0.0"
});

// Minimal deterministic “action hash” for demo purposes.
// In production, hash the irreversible action details (amount, recipient, policy, etc).
function actionHashHexFromMessage(message) {
  return crypto.createHash("sha256").update(message, "utf8").digest("hex");
}

app.get("/health", (_req, res) => res.json({ ok: true }));

// Step 1: Create challenge on server
app.post("/api/challenge", async (req, res) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message : "demo-action";
    const actionHashHex = actionHashHexFromMessage(message);

    const result = await client.createChallenge({
      actionHashHex,
      purpose: "ACTION_COMMIT"
    });

    res.json({
      ok: true,
      requestId: result.requestId,
      challengeId: result.data.id,
      challengeB64Url: result.data.challengeB64Url,
      expiresAtIso: result.data.expiresAtIso,
      actionHashHex,
      purpose: result.data.purpose
    });
  } catch (e) {
    if (e instanceof PresenceBoundError) {
      return res.status(500).json({
        ok: false,
        error: e.message,
        status: e.status,
        requestId: e.requestId,
        details: e.details
      });
    }
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Step 2: Verify WebAuthn assertion via PBI
app.post("/api/verify", async (req, res) => {
  try {
    const challengeId = typeof req.body?.challengeId === "string" ? req.body.challengeId : "";
    const assertion = req.body?.assertion;

    if (!challengeId) return res.status(400).json({ ok: false, error: "Missing challengeId" });
    if (!assertion || typeof assertion !== "object") return res.status(400).json({ ok: false, error: "Missing assertion" });

    const result = await client.verifyChallenge({
      challengeId,
      assertion
    });

    res.json({
      ok: true,
      requestId: result.requestId,
      decision: result.data.decision,
      reason: result.data.reason ?? null,
      receiptId: result.data.receiptId ?? null,
      receiptHashHex: result.data.receiptHashHex ?? null
    });
  } catch (e) {
    if (e instanceof PresenceBoundError) {
      return res.status(500).json({
        ok: false,
        error: e.message,
        status: e.status,
        requestId: e.requestId,
        details: e.details
      });
    }
    res.status(500).json({ ok: false, error: String(e) });
  }
});

const port = Number(process.env.PORT || "8787");
app.listen(port, () => {
  console.log(`Example running: http://localhost:${port}`);
});
