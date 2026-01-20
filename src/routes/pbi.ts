import type { RequestHandler, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/apiKeyAuth.js";
import { createChallenge, getChallenge, markChallengeUsed } from "../pbi/challengeStore.js";
import { verifyWebAuthnAssertion } from "../pbi/verify.js";
import { getReceiptByChallengeId, getReceiptById, mintReceipt, storeReceipt } from "../pbi/receipt.js";
import { pool } from "../db/pool.js";
import { consumeQuotaUnit } from "../billing/quota.js";

export const pbiRouter = Router();

/**
 * Express 4 does NOT catch async exceptions by default.
 * This wrapper ensures any thrown error reaches your app-level errorHandler
 * instead of crashing the process (and causing 502s on Render).
 */
function asyncHandler(fn: (req: AuthedRequest, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req as AuthedRequest, res)).catch(next);
  };
}

const PurposeEnum = z.enum(["ACTION_COMMIT", "ARTIFACT_AUTHORSHIP", "EVIDENCE_SUBMIT", "ADMIN_DANGEROUS_OP"]);

/**
 * Challenge request
 * - Accept BOTH: `purpose` (canonical) and `kind` (legacy/demo UI)
 * - Never throw on invalid input (use safeParse in handlers)
 */
const ChallengeReq = z
  .object({
    purpose: PurposeEnum.optional(),
    kind: PurposeEnum.optional(),

    actionHashHex: z
      .string()
      .regex(/^[0-9a-f]{64}$/i, "actionHashHex must be 64 hex chars")
      .transform((s) => s.toLowerCase()),

    ttlSeconds: z.coerce.number().int().min(10).max(600).optional()
  })
  .superRefine((v, ctx) => {
    // Require either purpose or kind
    if (!v.purpose && !v.kind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["purpose"],
        message: "Required (purpose or kind)"
      });
    }
  });

const VerifyReq = z.object({
  challengeId: z.string().uuid(),
  assertion: z.object({
    authenticatorDataB64Url: z.string().min(1),
    clientDataJSONB64Url: z.string().min(1),
    signatureB64Url: z.string().min(1),
    credIdB64Url: z.string().min(1),
    pubKeyPem: z.string().min(1)
  })
});
const ReceiptIdParam = z.string().uuid();
const CursorParam = z
  .string()
  .regex(/^.+\|[0-9a-f-]{36}$/i, "cursor must be <ISO8601>|<uuid>")
  .superRefine((value, ctx) => {
    const sep = value.indexOf("|");
    if (sep <= 0 || sep >= value.length - 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cursor must be <ISO8601>|<uuid>"
      });
      return;
    }

    const rawDate = value.slice(0, sep);
    const rawId = value.slice(sep + 1);

    const createdAt = new Date(rawDate);
    if (Number.isNaN(createdAt.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cursor timestamp invalid"
      });
    }

    const uuidOk = z.string().uuid().safeParse(rawId);
    if (!uuidOk.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cursor id invalid"
      });
    }
  })
  .transform((value): { createdAt: Date; id: string } => {
    const sep = value.indexOf("|");
    const rawDate = sep > -1 ? value.slice(0, sep) : "";
    const rawId = sep > -1 ? value.slice(sep + 1) : "";
    const createdAt = new Date(rawDate);
    return { createdAt, id: rawId };
  });


const ReceiptListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), CursorParam).optional(),
  actionHashHex: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, "actionHashHex must be 64 hex chars")
    .transform((s) => s.toLowerCase())
    .optional(),
  challengeId: z.string().uuid().optional(),
  purpose: PurposeEnum.optional(),
  decision: z.enum(["PBI_VERIFIED", "FAILED", "EXPIRED", "REPLAYED"]).optional()
});

pbiRouter.post(
  "/challenge",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const apiKey = req.apiKey!;
    const parsed = ChallengeReq.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "invalid_request",
        issues: parsed.error.issues
      });
      return;
    }

    const body = parsed.data;
    const purpose = body.purpose ?? body.kind!;
    const ttlSeconds = body.ttlSeconds ?? 120;

    const quota = apiKey.quotaPerMonth;

    const q = await consumeQuotaUnit(apiKey.id, "challenge", quota);
    if (!q.ok) {
      res.status(402).json({
        error: "quota_exceeded",
        month: q.monthKey,
        used: q.used.toString(),
        quota: q.quota.toString()
      });
      return;
    }

    const ch = await createChallenge(apiKey.id, purpose, body.actionHashHex, ttlSeconds);

    // Keep response backward-friendly:
    // - Tool/demo often expect id + challengeB64Url at top level
    // - But also return the full object under `challenge` for your portal usage
    res.json({
      id: ch.id,
      challengeB64Url: ch.challengeB64Url,
      expiresAtIso: ch.expiresAtIso,
      purpose: ch.purpose,
      actionHashHex: ch.actionHashHex,

      challenge: ch,
      metering: { month: q.monthKey, used: q.usedAfter.toString(), quota: q.quota.toString() }
    });
  })
);

pbiRouter.post(
  "/verify",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const apiKey = req.apiKey!;
    const parsed = VerifyReq.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        decision: "FAILED",
        reason: "invalid_request",
        issues: parsed.error.issues
      });
      return;
    }

    const body = parsed.data;

    const stored = await getChallenge(body.challengeId);
    if (!stored || stored.apiKeyId !== apiKey.id) {
      res.status(404).json({ ok: false, decision: "FAILED", reason: "unknown_challenge" });
      return;
    }

    const now = new Date();
    if (now > stored.expiresAt) {
      res.status(400).json({ ok: false, decision: "EXPIRED" });
      return;
    }

    if (stored.usedAt) {
      res.status(400).json({ ok: false, decision: "REPLAYED" });
      return;
    }

    const v = verifyWebAuthnAssertion({
      expectedChallengeB64Url: stored.challengeB64Url,
      assertion: body.assertion
    });

    if (!v.ok) {
      res.status(400).json({ ok: false, decision: "FAILED", reason: v.reason });
      return;
    }

    // ✅ Only charge quota if verification is valid
    const quota = apiKey.quotaPerMonth;

    const q = await consumeQuotaUnit(apiKey.id, "verify", quota);
    if (!q.ok) {
      res.status(402).json({
        ok: false,
        decision: "FAILED",
        reason: "quota_exceeded",
        month: q.monthKey,
        used: q.used.toString(),
        quota: q.quota.toString()
      });
      return;
    }

    // Burn the challenge (single-use)
    await markChallengeUsed(stored.id);

    const receipt = mintReceipt(stored.id, "PBI_VERIFIED");
    await storeReceipt(apiKey.id, stored.id, "PBI_VERIFIED", receipt);

    res.json({
      ok: true,
      decision: "PBI_VERIFIED",
      receiptId: receipt.receiptId,
      receiptHashHex: receipt.receiptHashHex,
      challenge: { id: stored.id, purpose: stored.purpose, actionHashHex: stored.actionHashHex },
      metering: { month: q.monthKey, used: q.usedAfter.toString(), quota: q.quota.toString() }
    });
  })
);

pbiRouter.get(
  "/challenges/:id",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const apiKey = req.apiKey!;
    const challengeId = String(req.params.id ?? "").trim();

    if (!challengeId) {
      res.status(400).json({ error: "invalid_challenge_id" });
      return;
    }

    const stored = await getChallenge(challengeId);
    if (!stored || stored.apiKeyId !== apiKey.id) {
      res.status(404).json({ error: "challenge_not_found" });
      return;
    }

    const now = new Date();
    const status = stored.usedAt ? "used" : now > stored.expiresAt ? "expired" : "active";

    res.json({
      challenge: {
        id: stored.id,
        purpose: stored.purpose,
        actionHashHex: stored.actionHashHex,
        expiresAtIso: stored.expiresAt.toISOString(),
        usedAtIso: stored.usedAt ? stored.usedAt.toISOString() : null,
        status
      }
    });
  })
);

pbiRouter.get(
  "/challenges/:id/receipt",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const apiKey = req.apiKey!;
    const challengeId = String(req.params.id ?? "").trim();

    if (!challengeId) {
      res.status(400).json({ error: "invalid_challenge_id" });
      return;
    }

    const receipt = await getReceiptByChallengeId(apiKey.id, challengeId);
    if (!receipt) {
      res.status(404).json({ error: "receipt_not_found" });
      return;
    }

    const challenge = await getChallenge(challengeId);
    const challengePayload = challenge
      ? {
          id: challenge.id,
          purpose: challenge.purpose,
          actionHashHex: challenge.actionHashHex,
          expiresAtIso: challenge.expiresAt.toISOString(),
          usedAtIso: challenge.usedAt ? challenge.usedAt.toISOString() : null
        }
      : null;

    res.json({
      receipt: {
        id: receipt.id,
        challengeId: receipt.challengeId,
        receiptHashHex: receipt.receiptHashHex,
        decision: receipt.decision,
        createdAt: receipt.createdAt
      },
      challenge: challengePayload
    });
  })
);

pbiRouter.get(
  "/receipts/:id",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const apiKey = req.apiKey!;
    const receiptId = String(req.params.id ?? "").trim();

    const parsedReceiptId = ReceiptIdParam.safeParse(receiptId);
    if (!parsedReceiptId.success) {
      res.status(400).json({ error: "invalid_receipt_id", issues: parsedReceiptId.error.issues });
      return;
    }

    const receipt = await getReceiptById(apiKey.id, parsedReceiptId.data);
    if (!receipt) {
      res.status(404).json({ error: "receipt_not_found" });
      return;
    }

    const challengeRow = await pool.query(
      `SELECT purpose, action_hash_hex, expires_at, used_at
       FROM pbi_challenges
       WHERE id=$1 AND api_key_id=$2
       LIMIT 1`,
      [receipt.challengeId, apiKey.id]
    );

    const challenge = challengeRow.rowCount
      ? {
          id: receipt.challengeId,
          purpose: challengeRow.rows[0]?.purpose as string,
          actionHashHex: challengeRow.rows[0]?.action_hash_hex as string,
          expiresAtIso: new Date(challengeRow.rows[0]?.expires_at as string).toISOString(),
          usedAtIso: challengeRow.rows[0]?.used_at ? new Date(challengeRow.rows[0]?.used_at as string).toISOString() : null
        }
      : null;

    res.json({
      receipt: {
        id: receipt.id,
        challengeId: receipt.challengeId,
        receiptHashHex: receipt.receiptHashHex,
        decision: receipt.decision,
        createdAt: receipt.createdAt
      },
      challenge
    });
  })
);

pbiRouter.post(
  "/receipts/verify",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const apiKey = req.apiKey!;
    const Body = z.object({
      receiptId: z.string().uuid(),
      receiptHashHex: z.string().min(1)
    });

    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.issues });
      return;
    }

    const { receiptId, receiptHashHex } = parsed.data;
    const receipt = await getReceiptById(apiKey.id, receiptId);
    if (!receipt) {
      res.status(404).json({ error: "receipt_not_found" });
      return;
    }

    const ok = receipt.receiptHashHex === receiptHashHex;

    res.json({
      ok,
      receipt: {
        id: receipt.id,
        challengeId: receipt.challengeId,
        decision: receipt.decision,
        createdAt: receipt.createdAt
      }
    });
  })
);

pbiRouter.get(
  "/receipts",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const apiKey = req.apiKey!;
    const parsed = ReceiptListQuery.safeParse(req.query ?? {});

    if (parsed && !parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.issues });
      return;
    }

    const params = parsed.data;
    const limit = params.limit ?? 50;

    const values: Array<string | number | Date> = [apiKey.id];
    const clauses = ["r.api_key_id = $1"];

    if (params.cursor) {
      values.push(params.cursor.createdAt, params.cursor.id);
      clauses.push(
        `(r.created_at < $${values.length - 1} OR (r.created_at = $${values.length - 1} AND r.id < $${
          values.length
        }))`
      );
    }

    if (params.actionHashHex) {
      values.push(params.actionHashHex);
      clauses.push(`c.action_hash_hex = $${values.length}`);
    }

    if (params.challengeId) {
      values.push(params.challengeId);
      clauses.push(`r.challenge_id = $${values.length}`);
    }

    if (params.purpose) {
      values.push(params.purpose);
      clauses.push(`c.purpose = $${values.length}`);
    }

    if (params.decision) {
      values.push(params.decision);
      clauses.push(`r.decision = $${values.length}`);
    }

    values.push(limit);

    const query = `
      SELECT r.id, r.challenge_id, r.receipt_hash_hex, r.decision, r.created_at,
             c.purpose, c.action_hash_hex, c.expires_at, c.used_at
      FROM pbi_receipts r
      JOIN pbi_challenges c ON c.id = r.challenge_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT $${values.length}
    `;

    const rows = await pool.query(query, values);
    const receipts = (rows.rows as Array<Record<string, unknown>>).map((row) => ({
      receipt: {
        id: String(row.id),
        challengeId: String(row.challenge_id),
        receiptHashHex: String(row.receipt_hash_hex),
        decision: String(row.decision),
        createdAt: new Date(row.created_at as string).toISOString()
      },
      challenge: {
        id: String(row.challenge_id),
        purpose: String(row.purpose),
        actionHashHex: String(row.action_hash_hex),
        expiresAtIso: new Date(row.expires_at as string).toISOString(),
        usedAtIso: row.used_at ? new Date(row.used_at as string).toISOString() : null
      }
    }));

    const last = receipts.at(-1);
    const nextCursor = last ? `${last.receipt.createdAt}|${last.receipt.id}` : null;

    res.json({ receipts, nextCursor });
  })
);
