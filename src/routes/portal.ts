import { Router } from "express";
import { z } from "zod";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { pool } from "../db/pool.js";
import type { PortalAuthedRequest } from "../middleware/portalSession.js";
import { requirePortalSession } from "../middleware/portalSession.js";
import { hashApiKey } from "../db/queries/apiKeys.js";

export const portalRouter = Router();

const PORTAL_BASE_URL = process.env.PORTAL_BASE_URL ?? "http://localhost:3000";
const COOKIE_DOMAIN = process.env.PORTAL_COOKIE_DOMAIN ?? "localhost";
const COOKIE_SECURE = (process.env.PORTAL_COOKIE_SECURE ?? "false") === "true";

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function mintToken(): string {
  return Buffer.from(randomBytes(32)).toString("base64url");
}

function mintRawApiKey(): string {
  const rnd = Buffer.from(randomBytes(32)).toString("base64url");
  return `pbi_live_${rnd}`;
}

/**
 * EMAIL SENDER:
 * Replace this with Resend/SES/Postmark. For now we keep a minimal hook:
 * - In production, implement sendEmail() using your provider.
 */
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const mode = process.env.EMAIL_MODE ?? "log";
  if (mode === "log") {
    // eslint-disable-next-line no-console
    console.log({ to, subject, html }, "EMAIL_LOG");
    return;
  }
  throw new Error("EMAIL_MODE not implemented (set EMAIL_MODE=log or implement provider)");
}

// Start magic link
portalRouter.post("/auth/start", async (req, res) => {
  const Body = z.object({ email: z.string().email() });
  const { email } = Body.parse(req.body);

  // Create customer if not exists
  const c = await pool.query(`SELECT id FROM customers WHERE email=$1 LIMIT 1`, [email]);
  let customerId: string;

  if ((c.rowCount ?? 0) === 0) {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO customers (id, email, plan, quota_per_month, is_active)
       VALUES ($1, $2, 'starter', 100000, TRUE)`,
      [id, email]
    );
    customerId = id;
  } else {
    customerId = (c.rows[0] as { id: string }).id;
  }

  const rawToken = mintToken();
  const tokenHash = sha256Hex(rawToken);
  const id = randomUUID();

  await pool.query(
    `INSERT INTO portal_magic_links (id, customer_id, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + interval '15 minutes')`,
    [id, customerId, tokenHash]
  );

  const link = `${PORTAL_BASE_URL}/auth/callback?token=${encodeURIComponent(rawToken)}`;

  await sendEmail(
    email,
    "Your PBI Portal sign-in link",
    `<p>Click to sign in:</p><p><a href="${link}">${link}</a></p><p>This link expires in 15 minutes.</p>`
  );

  res.json({ ok: true });
});

// Consume magic link -> create session cookie
portalRouter.post("/auth/consume", async (req, res) => {
  const Body = z.object({ token: z.string().min(10) });
  const { token } = Body.parse(req.body);

  const tokenHash = sha256Hex(token);

  const r = await pool.query(
    `SELECT ml.id, ml.customer_id
     FROM portal_magic_links ml
     JOIN customers c ON c.id = ml.customer_id
     WHERE ml.token_hash=$1 AND ml.used_at IS NULL AND ml.expires_at > now() AND c.is_active=TRUE
     LIMIT 1`,
    [tokenHash]
  );

  if ((r.rowCount ?? 0) === 0) {
    res.status(400).json({ error: "invalid_or_expired_token" });
    return;
  }

  const row = r.rows[0] as { id: string; customer_id: string };

  // Mark used
  await pool.query(`UPDATE portal_magic_links SET used_at=now() WHERE id=$1`, [row.id]);

  // Create session
  const sid = randomUUID();
  await pool.query(
    `INSERT INTO portal_sessions (id, customer_id, expires_at)
     VALUES ($1, $2, now() + interval '14 days')`,
    [sid, row.customer_id]
  );

  res.cookie("pbi_portal_session", sid, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    domain: COOKIE_DOMAIN
  });

  res.json({ ok: true });
});

// Logout
portalRouter.post("/auth/logout", requirePortalSession, async (req: PortalAuthedRequest, res) => {
  const sid = (req as unknown as { cookies?: Record<string, string> }).cookies?.pbi_portal_session;
  if (typeof sid === "string" && sid.length > 0) {
    await pool.query(`UPDATE portal_sessions SET revoked_at=now() WHERE id=$1`, [sid]);
  }
  res.clearCookie("pbi_portal_session", { path: "/", domain: COOKIE_DOMAIN });
  res.json({ ok: true });
});

// Me
portalRouter.get("/me", requirePortalSession, async (req: PortalAuthedRequest, res) => {
  res.json({
    customer: {
      id: req.portalCustomer!.id,
      email: req.portalCustomer!.email,
      plan: req.portalCustomer!.plan,
      quotaPerMonth: req.portalCustomer!.quotaPerMonth.toString()
    }
  });
});

// List keys (never return raw)
portalRouter.get("/api-keys", requirePortalSession, async (req: PortalAuthedRequest, res) => {
  const rows = await pool.query(
    `SELECT id, label, plan, quota_per_month, is_active, created_at
     FROM api_keys
     WHERE customer_id=$1
     ORDER BY created_at DESC
     LIMIT 50`,
    [req.portalCustomer!.id]
  );

  res.json({ apiKeys: rows.rows });
});

// Create key (return raw once)
portalRouter.post("/api-keys", requirePortalSession, async (req: PortalAuthedRequest, res) => {
  const Body = z.object({ label: z.string().min(1).max(60).default("Portal Key") });
  const { label } = Body.parse(req.body);

  const raw = mintRawApiKey();
  const keyHash = hashApiKey(raw);
  const id = randomUUID();

  await pool.query(
    `INSERT INTO api_keys (id, label, key_hash, plan, quota_per_month, is_active, customer_id)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6)`,
    [id, label, keyHash, req.portalCustomer!.plan, req.portalCustomer!.quotaPerMonth.toString(), req.portalCustomer!.id]
  );

  res.json({ ok: true, apiKeyId: id, rawApiKey: raw });
});

// Revoke key
portalRouter.delete("/api-keys/:id", requirePortalSession, async (req: PortalAuthedRequest, res) => {
  const keyId = String(req.params.id);
  await pool.query(
    `UPDATE api_keys SET is_active=FALSE WHERE id=$1 AND customer_id=$2`,
    [keyId, req.portalCustomer!.id]
  );
  res.json({ ok: true });
});

// Usage (reuse your existing usage_events)
portalRouter.get("/usage", requirePortalSession, async (req: PortalAuthedRequest, res) => {
  const month = String(req.query.month ?? "");
  const mk = /^\d{4}-\d{2}$/.test(month) ? month : null;

  // sum usage for all api_keys belonging to customer
  const q = await pool.query(
    `SELECT ue.month_key, ue.kind, COALESCE(SUM(ue.units),0)::bigint AS total
     FROM usage_events ue
     JOIN api_keys k ON k.id = ue.api_key_id
     WHERE k.customer_id=$1
       AND ($2::text IS NULL OR ue.month_key=$2)
     GROUP BY ue.month_key, ue.kind
     ORDER BY ue.month_key DESC`,
    [req.portalCustomer!.id, mk]
  );

  res.json({ rows: q.rows });
});

// Invoices (reuse your invoices table if you’re generating them)
portalRouter.get("/invoices", requirePortalSession, async (req: PortalAuthedRequest, res) => {
  const q = await pool.query(
    `SELECT i.id, i.month_key, i.status, i.total_cents, i.line_items_json, i.created_at, i.finalized_at
     FROM invoices i
     JOIN api_keys k ON k.id = i.api_key_id
     WHERE k.customer_id=$1
     ORDER BY i.created_at DESC
     LIMIT 24`,
    [req.portalCustomer!.id]
  );

  res.json({
    invoices: (q.rows as Array<{
      id: string;
      month_key: string;
      status: string;
      total_cents: string;
      line_items_json: string;
      created_at: string;
      finalized_at: string | null;
    }>).map((r) => ({
      id: r.id,
      month: r.month_key,
      status: r.status,
      totalCents: r.total_cents,
      lineItems: JSON.parse(r.line_items_json) as unknown,
      createdAt: r.created_at,
      finalizedAt: r.finalized_at
    }))
  });
});