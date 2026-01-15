import type { Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { AuthedRequest } from "../middleware/apiKeyAuth.js";
import { createChallenge, getChallenge, markChallengeUsed } from "../pbi/challengeStore.js";
import { verifyWebAuthnAssertion } from "../pbi/verify.js";
import { mintReceipt } from "../pbi/receipt.js";
import { recordUsage } from "../billing/meter.js";

export const pbiRouter = Router();

const ChallengeReq = z.object({
  purpose: z.enum(["ACTION_COMMIT", "ARTIFACT_AUTHORSHIP", "EVIDENCE_SUBMIT", "ADMIN_DANGEROUS_OP"]),
  actionHashHex: z.string().regex(/^[0-9a-f]{64}$/),
  ttlSeconds: z.number().int().min(10).max(600).default(120)
});

pbiRouter.post("/challenge", async (req: AuthedRequest, res: Response) => {
  const apiKey = req.apiKey!;
  const body = ChallengeReq.parse(req.body);

  const ch = await createChallenge(apiKey.id, body.purpose, body.actionHashHex, body.ttlSeconds);
  await recordUsage(apiKey.id, "challenge", 1n);

  res.json({ challenge: ch });
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
    const decision = "FAILED";
    res.status(400).json({ ok: false, decision, reason: v.reason });
    return;
  }

  await markChallengeUsed(stored.id);

  const receipt = mintReceipt(stored.id, "PBI_VERIFIED");
  await recordUsage(apiKey.id, "verify", 1n);

  res.json({
    ok: true,
    decision: "PBI_VERIFIED",
    receiptId: receipt.receiptId,
    receiptHashHex: receipt.receiptHashHex,
    challenge: {
      id: stored.id,
      purpose: stored.purpose,
      actionHashHex: stored.actionHashHex
    }
  });
});