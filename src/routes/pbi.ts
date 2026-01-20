import type { RequestHandler, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/apiKeyAuth.js";
import { createChallenge, getChallenge, markChallengeUsed } from "../pbi/challengeStore.js";
import { verifyWebAuthnAssertion } from "../pbi/verify.js";
import { getReceiptById, mintReceipt, storeReceipt } from "../pbi/receipt.js";
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
  "/receipts/:id",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const apiKey = req.apiKey!;
    const receiptId = String(req.params.id ?? "").trim();

    if (!receiptId) {
      res.status(400).json({ error: "invalid_receipt_id" });
      return;
    }

    const receipt = await getReceiptById(apiKey.id, receiptId);
    if (!receipt) {
      res.status(404).json({ error: "receipt_not_found" });
      return;
    }

    res.json({
      receipt: {
        id: receipt.id,
        challengeId: receipt.challengeId,
        receiptHashHex: receipt.receiptHashHex,
        decision: receipt.decision,
        createdAt: receipt.createdAt
      }
    });
  })
);
