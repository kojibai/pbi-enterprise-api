import type { Response } from "express";
import { Router } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../middleware/apiKeyAuth.js";
import { createChallenge, getChallenge, markChallengeUsed } from "../pbi/challengeStore.js";
import { verifyWebAuthnAssertion } from "../pbi/verify.js";
import { mintReceipt } from "../pbi/receipt.js";
import { consumeQuotaUnit } from "../billing/quota.js";

export const pbiRouter = Router();

const ChallengeReq = z.object({
  purpose: z.enum(["ACTION_COMMIT", "ARTIFACT_AUTHORSHIP", "EVIDENCE_SUBMIT", "ADMIN_DANGEROUS_OP"]),
  actionHashHex: z.string().regex(/^[0-9a-f]{64}$/),
  ttlSeconds: z.number().int().min(10).max(600).default(120)
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

pbiRouter.post("/challenge", async (req: AuthedRequest, res: Response) => {
  const apiKey = req.apiKey!;
  const body = ChallengeReq.parse(req.body);

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

  const ch = await createChallenge(apiKey.id, body.purpose, body.actionHashHex, body.ttlSeconds);

  res.json({
    challenge: ch,
    metering: { month: q.monthKey, used: q.usedAfter.toString(), quota: q.quota.toString() }
  });
});

pbiRouter.post("/verify", async (req: AuthedRequest, res: Response) => {
  const apiKey = req.apiKey!;
  const body = VerifyReq.parse(req.body);

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

  res.json({
    ok: true,
    decision: "PBI_VERIFIED",
    receiptId: receipt.receiptId,
    receiptHashHex: receipt.receiptHashHex,
    challenge: { id: stored.id, purpose: stored.purpose, actionHashHex: stored.actionHashHex },
    metering: { month: q.monthKey, used: q.usedAfter.toString(), quota: q.quota.toString() }
  });
});