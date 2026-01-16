import { Router } from "express";
import { z } from "zod";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { Resend } from "resend";
import { pool } from "../db/pool.js";
import type { PortalAuthedRequest } from "../middleware/portalSession.js";
import { requirePortalSession } from "../middleware/portalSession.js";
import { hashApiKey } from "../db/queries/apiKeys.js";
import { normalizeEmail } from "../util/email.js";
export const portalRouter = Router();

const PORTAL_BASE_URL = process.env.PORTAL_BASE_URL ?? "http://localhost:3000";

/**
 * Cookie domain rules:
 * - For production on pbi.kojib.com, set PORTAL_COOKIE_DOMAIN=.kojib.com
 * - For localhost dev, leave undefined (browser rejects "domain=localhost" in many cases)
 */
const COOKIE_DOMAIN_ENV = (process.env.PORTAL_COOKIE_DOMAIN ?? "").trim();
const COOKIE_DOMAIN: string | undefined = COOKIE_DOMAIN_ENV.length > 0 ? COOKIE_DOMAIN_ENV : undefined;

const COOKIE_SECURE = (process.env.PORTAL_COOKIE_SECURE ?? "false") === "true";

type EmailMode = "log" | "resend";
type Plan = "pending" | "starter" | "pro" | "enterprise";

function getEmailMode(): EmailMode {
  const v = (process.env.EMAIL_MODE ?? "log").toLowerCase();
  return v === "resend" ? "resend" : "log";
}

function mustGet(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`Missing env var: ${name}`);
  return v;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type EmailSendResult = { ok: true } | { ok: false; error: string };

async function sendEmail(to: string, subject: string, html: string): Promise<EmailSendResult> {
  const mode = getEmailMode();

  if (mode === "log") {
    // eslint-disable-next-line no-console
    console.log({ to, subject, html }, "EMAIL_LOG");
    return { ok: true };
  }

  // Never throw on config — return a clean error
  let apiKey = "";
  let from = "";
  try {
    apiKey = mustGet("RESEND_API_KEY");
    from = mustGet("EMAIL_FROM");
  } catch (e: unknown) {
    // eslint-disable-next-line no-console
    console.error("sendEmail config missing", e);
    return { ok: false, error: "email_not_configured" };
  }

  try {
    const resend = new Resend(apiKey);
    const safeSubject = subject.trim().slice(0, 140);
    const text = htmlToText(html);

    const result = await resend.emails.send({
      from,
      to: [to],
      subject: safeSubject,
      html,
      text
    });

    const err = (result as unknown as { error?: { message?: string } }).error;
    if (err) {
      const msg = err.message ?? "unknown_error";
      // eslint-disable-next-line no-console
      console.error("Resend send failed", { msg });
      return { ok: false, error: `resend_failed:${msg}` };
    }

    return { ok: true };
  } catch (e: unknown) {
    // eslint-disable-next-line no-console
    console.error("Resend exception", e);
    return { ok: false, error: "resend_exception" };
  }
}

function isPaidPlan(plan: Plan, quotaPerMonth: bigint): boolean {
  return plan !== "pending" && quotaPerMonth > 0n;
}

// -------------------------
// AUTH: Start magic link
// -------------------------
portalRouter.post("/auth/start", async (req, res) => {
  const Body = z.object({ email: z.string().email() });
  const { email: rawEmail } = Body.parse(req.body);

  const email = normalizeEmail(rawEmail);

  // Create-or-get customer in ONE statement (race-safe)
  const newId = randomUUID();
  const cr = await pool.query(
    `INSERT INTO customers (id, email, plan, quota_per_month, is_active)
     VALUES ($1, $2, 'pending', 0, TRUE)
     ON CONFLICT (email) DO UPDATE
       SET email = EXCLUDED.email
     RETURNING id`,
    [newId, email]
  );

  const customerId = (cr.rows[0] as { id: string }).id;

  const rawToken = mintToken();
  const tokenHash = sha256Hex(rawToken);
  const id = randomUUID();

  await pool.query(
    `INSERT INTO portal_magic_links (id, customer_id, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + interval '15 minutes')`,
    [id, customerId, tokenHash]
  );

  const link = `${PORTAL_BASE_URL}/auth/callback?token=${encodeURIComponent(rawToken)}`;
  const prettyLink = escapeHtml(link);
  const safeEmail = escapeHtml(email);

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background:#05070e; padding:24px;">
      <div style="max-width:560px; margin:0 auto; border:1px solid rgba(255,255,255,.14); border-radius:18px; background:rgba(255,255,255,.06); padding:18px;">
        <div style="color:#ffffff; font-weight:800; font-size:16px; letter-spacing:.2px;">PBI Client Portal</div>
        <div style="color:rgba(255,255,255,.78); margin-top:6px; line-height:1.45; font-size:13px;">
          Sign in to manage your API keys, usage, and billing.
        </div>

        <div style="margin-top:14px;">
          <a href="${prettyLink}"
             style="display:inline-block; padding:12px 14px; border-radius:14px; text-decoration:none; color:#05070e; background:#78ffe7; font-weight:800;">
            Sign in
          </a>
        </div>

        <div style="color:rgba(255,255,255,.72); margin-top:14px; font-size:12px; line-height:1.45;">
          This link expires in <b>15 minutes</b> and can only be used once.
        </div>

        <div style="margin-top:10px; color:rgba(255,255,255,.55); font-size:11px;">
          If you didn’t request this, you can ignore this email.
        </div>

        <hr style="border:none; border-top:1px solid rgba(255,255,255,.10); margin:14px 0;" />

        <div style="color:rgba(255,255,255,.55); font-size:11px;">
          Requested for: ${safeEmail}
        </div>

        <div style="margin-top:8px; color:rgba(255,255,255,.55); font-size:11px; word-break:break-all;">
          Or paste this URL:<br/>
          <span style="color:rgba(255,255,255,.86);">${prettyLink}</span>
        </div>
      </div>
    </div>
  `;

  // IMPORTANT: always respond ok to avoid email enumeration
  const r = await sendEmail(email, "Your PBI Portal sign-in link", html);
  if (!r.ok) {
    // eslint-disable-next-line no-console
    console.error("sendEmail failed", { error: r.error, email });
  }

  res.json({ ok: true });
});

// -------------------------
// AUTH: Consume magic link -> session cookie
// -------------------------
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

  await pool.query(`UPDATE portal_magic_links SET used_at=now() WHERE id=$1`, [row.id]);

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
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {})
  });

  res.json({ ok: true });
});

// -------------------------
// AUTH: Logout
// -------------------------
portalRouter.post("/auth/logout", requirePortalSession, async (req: PortalAuthedRequest, res) => {
  const sid = (req as unknown as { cookies?: Record<string, string> }).cookies?.pbi_portal_session;
  if (typeof sid === "string" && sid.length > 0) {
    await pool.query(`UPDATE portal_sessions SET revoked_at=now() WHERE id=$1`, [sid]);
  }
  res.clearCookie("pbi_portal_session", { path: "/", ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}) });
  res.json({ ok: true });
});

// -------------------------
// ME
// -------------------------
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

// -------------------------
// API KEYS
// -------------------------
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

portalRouter.post("/api-keys", requirePortalSession, async (req: PortalAuthedRequest, res) => {
  // ✅ Paid gate: cannot mint API keys unless plan is active + quota > 0
  const plan = req.portalCustomer!.plan as Plan;
  const quota = req.portalCustomer!.quotaPerMonth; // bigint
  if (!isPaidPlan(plan, quota)) {
    res.status(402).json({ error: "no_active_plan" });
    return;
  }

  const Body = z.object({ label: z.string().min(1).max(60).default("Portal Key") });
  const { label } = Body.parse(req.body);

  const raw = mintRawApiKey();
  const keyHash = hashApiKey(raw);
  const id = randomUUID();

  await pool.query(
    `INSERT INTO api_keys (id, label, key_hash, plan, quota_per_month, is_active, customer_id)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6)`,
    [id, label, keyHash, plan, quota.toString(), req.portalCustomer!.id]
  );

  res.json({ ok: true, apiKeyId: id, rawApiKey: raw });
});

portalRouter.delete("/api-keys/:id", requirePortalSession, async (req: PortalAuthedRequest, res) => {
  const keyId = String(req.params.id);
  await pool.query(`UPDATE api_keys SET is_active=FALSE WHERE id=$1 AND customer_id=$2`, [
    keyId,
    req.portalCustomer!.id
  ]);
  res.json({ ok: true });
});

// -------------------------
// USAGE
// -------------------------
portalRouter.get("/usage", requirePortalSession, async (req: PortalAuthedRequest, res) => {
  const month = String(req.query.month ?? "");
  const mk = /^\d{4}-\d{2}$/.test(month) ? month : null;

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

// -------------------------
// INVOICES
// -------------------------
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