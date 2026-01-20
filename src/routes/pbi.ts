import type { RequestHandler, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { AuthedRequest } from "../middleware/apiKeyAuth.js";
import { createChallenge, getChallenge, markChallengeUsed } from "../pbi/challengeStore.js";
import { verifyWebAuthnAssertion } from "../pbi/verify.js";
import { getReceiptByChallengeId, getReceiptById, mintReceipt, storeReceipt } from "../pbi/receipt.js";
import { pool } from "../db/pool.js";
import { consumeQuotaUnit } from "../billing/quota.js";
import { buildEvidenceMetadata, withEvidenceMetadata } from "../pbi/evidence.js";
import { decodeReceiptCursor, encodeReceiptCursor } from "../pbi/receiptCursor.js";
import { buildReceiptQuery } from "../pbi/receiptQuery.js";
import { enqueueReceiptCreated } from "../webhooks/queue.js";
import { requireScope } from "../middleware/requireScope.js";
import { buildExportPack } from "../pbi/exportPack.js";
import { config } from "../config.js";
import fs from "node:fs";
import { logger } from "../util/logger.js";
import { createZipFromFiles } from "../util/zip.js";
import type { VerifierInfo } from "../pbi/evidence.js";

function evidenceParams(traceId: string | undefined, verifier?: VerifierInfo): { traceId?: string; verifier?: VerifierInfo } {
  return {
    ...(traceId ? { traceId } : {}),
    ...(verifier ? { verifier } : {})
  };
}

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
const CursorParam = z.string().min(1).transform((value, ctx) => {
  const decoded = decodeReceiptCursor(value);
  if (!decoded) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "cursor must be base64url encoded JSON with {createdAt, id}"
    });
    return z.NEVER;
  }
  return decoded;
});

const IsoDateParam = z
  .string()
  .datetime()
  .transform((value) => new Date(value));


const ReceiptListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  cursor: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), CursorParam).optional(),
  createdAfter: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), IsoDateParam).optional(),
  createdBefore: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), IsoDateParam).optional(),
  order: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.enum(["asc", "desc"]).default("desc")),
  actionHashHex: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, "actionHashHex must be 64 hex chars")
    .transform((s) => s.toLowerCase())
    .optional(),
  challengeId: z.string().uuid().optional(),
  purpose: PurposeEnum.optional(),
  decision: z.enum(["PBI_VERIFIED", "FAILED", "EXPIRED", "REPLAYED"]).optional()
});

const ReceiptExportQuery = ReceiptListQuery.extend({
  limit: z.coerce.number().int().min(1).max(10000)
}).omit({ cursor: true });

pbiRouter.post(
  "/challenge",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const apiKey = req.apiKey!;
    const traceId = (req as AuthedRequest & { requestId?: string }).requestId;
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
    const evidence = buildEvidenceMetadata(evidenceParams(traceId));
    const challengePayload = withEvidenceMetadata(ch, evidence);

    // Keep response backward-friendly:
    // - Tool/demo often expect id + challengeB64Url at top level
    // - But also return the full object under `challenge` for your portal usage
    res.json({
      id: ch.id,
      challengeB64Url: ch.challengeB64Url,
      expiresAtIso: ch.expiresAtIso,
      purpose: ch.purpose,
      actionHashHex: ch.actionHashHex,

      challenge: challengePayload,
      metering: { month: q.monthKey, used: q.usedAfter.toString(), quota: q.quota.toString() }
    });
  })
);

pbiRouter.post(
  "/verify",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const apiKey = req.apiKey!;
    const traceId = (req as AuthedRequest & { requestId?: string }).requestId;
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

    const verifier: VerifierInfo | undefined =
      typeof v.up === "boolean" && typeof v.uv === "boolean"
        ? { method: "webauthn", up: v.up, uv: v.uv }
        : undefined;

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

    const createdAtIso = new Date().toISOString();
    const evidence = buildEvidenceMetadata(evidenceParams(traceId, verifier));

    const receiptPayload = withEvidenceMetadata(
      {
        id: receipt.receiptId,
        challengeId: stored.id,
        receiptHashHex: receipt.receiptHashHex,
        decision: "PBI_VERIFIED",
        createdAt: createdAtIso
      },
      evidence
    );

    const storedUsedAt = stored.usedAt as Date | null;
    const usedAtIso = storedUsedAt ? storedUsedAt.toISOString() : null;
    const challengePayload = withEvidenceMetadata(
      {
        id: stored.id,
        purpose: stored.purpose,
        actionHashHex: stored.actionHashHex,
        expiresAtIso: stored.expiresAt.toISOString(),
        usedAtIso
      },
      evidence
    );

    try {
      const eventPayload = {
        id: randomUUID(),
        type: "receipt.created" as const,
        createdAt: createdAtIso,
        data: { receipt: receiptPayload, challenge: challengePayload }
      };
      await enqueueReceiptCreated(apiKey.id, receipt.receiptId, eventPayload);
    } catch (e) {
      logger.error({ err: e }, "webhook_enqueue_failed");
    }

    res.json({
      ok: true,
      decision: "PBI_VERIFIED",
      receiptId: receipt.receiptId,
      receiptHashHex: receipt.receiptHashHex,
      challenge: withEvidenceMetadata(
        { id: stored.id, purpose: stored.purpose, actionHashHex: stored.actionHashHex },
        evidence
      ),
      metering: { month: q.monthKey, used: q.usedAfter.toString(), quota: q.quota.toString() }
    });
  })
);

pbiRouter.get(
  "/challenges/:id",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const apiKey = req.apiKey!;
    const traceId = (req as AuthedRequest & { requestId?: string }).requestId;
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

    const evidence = buildEvidenceMetadata(evidenceParams(traceId));
    res.json({
      challenge: withEvidenceMetadata(
        {
          id: stored.id,
          purpose: stored.purpose,
          actionHashHex: stored.actionHashHex,
          expiresAtIso: stored.expiresAt.toISOString(),
          usedAtIso: stored.usedAt ? stored.usedAt.toISOString() : null,
          status
        },
        evidence
      )
    });
  })
);

pbiRouter.get(
  "/challenges/:id/receipt",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const apiKey = req.apiKey!;
    const traceId = (req as AuthedRequest & { requestId?: string }).requestId;
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
    const evidence = buildEvidenceMetadata(evidenceParams(traceId));
    const challengePayload = challenge
      ? withEvidenceMetadata(
          {
            id: challenge.id,
            purpose: challenge.purpose,
            actionHashHex: challenge.actionHashHex,
            expiresAtIso: challenge.expiresAt.toISOString(),
            usedAtIso: challenge.usedAt ? challenge.usedAt.toISOString() : null
          },
          evidence
        )
      : null;

    res.json({
      receipt: withEvidenceMetadata(
        {
          id: receipt.id,
          challengeId: receipt.challengeId,
          receiptHashHex: receipt.receiptHashHex,
          decision: receipt.decision,
          createdAt: receipt.createdAt
        },
        evidence
      ),
      challenge: challengePayload
    });
  })
);

pbiRouter.get(
  "/receipts/export",
  requireScope("pbi.export"),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const apiKey = req.apiKey!;
    const traceId = (req as AuthedRequest & { requestId?: string }).requestId;
    const parsed = ReceiptExportQuery.safeParse(req.query ?? {});

    if (parsed && !parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.issues });
      return;
    }

    const params = parsed.data;
    const limit = params.limit;
    const order = params.order;

    if (limit > 2000 && (!params.createdAfter || !params.createdBefore)) {
      res.status(400).json({
        error: "time_window_required",
        message: "createdAfter and createdBefore are required for exports over 2000 receipts"
      });
      return;
    }

    if (!config.exportSigningPrivateKeyPem) {
      res.status(500).json({ error: "signing_not_configured" });
      return;
    }

    const exportFilters = {
      apiKeyId: apiKey.id,
      limit,
      order,
      ...(params.actionHashHex ? { actionHashHex: params.actionHashHex } : {}),
      ...(params.challengeId ? { challengeId: params.challengeId } : {}),
      ...(params.purpose ? { purpose: params.purpose } : {}),
      ...(params.decision ? { decision: params.decision } : {}),
      ...(params.createdAfter ? { createdAfter: params.createdAfter } : {}),
      ...(params.createdBefore ? { createdBefore: params.createdBefore } : {})
    };

    const { text, values } = buildReceiptQuery(exportFilters);

    const rows = await pool.query(text, values);
    const evidence = buildEvidenceMetadata(evidenceParams(traceId));

    const receipts = (rows.rows as Array<Record<string, unknown>>).map((row) => {
      const challengeRowId = row.challenge_row_id as string | null;
      const challenge =
        challengeRowId !== null
          ? withEvidenceMetadata(
              {
                id: String(row.challenge_id),
                purpose: String(row.purpose),
                actionHashHex: String(row.action_hash_hex),
                expiresAtIso: new Date(row.expires_at as string).toISOString(),
                usedAtIso: row.used_at ? new Date(row.used_at as string).toISOString() : null
              },
              evidence
            )
          : null;

      return {
        receipt: withEvidenceMetadata(
          {
            id: String(row.id),
            challengeId: String(row.challenge_id),
            receiptHashHex: String(row.receipt_hash_hex),
            decision: String(row.decision),
            createdAt: new Date(row.created_at as string).toISOString()
          },
          evidence
        ),
        challenge
      };
    });

    let trustSnapshot: Record<string, unknown> | undefined;
    if (config.trustSnapshotPath && fs.existsSync(config.trustSnapshotPath)) {
      const raw = fs.readFileSync(config.trustSnapshotPath, "utf8");
      const parsedTrust = JSON.parse(raw) as Record<string, unknown>;
      trustSnapshot = parsedTrust;
    }

    const policySnapshot: Record<string, unknown> = {
      policyVer: config.policyVersion ?? null,
      policyHash: config.policyHash ?? null,
      generatedAt: new Date().toISOString()
    };

    const filters: Record<string, unknown> = {
      limit,
      order,
      createdAfter: params.createdAfter ? params.createdAfter.toISOString() : null,
      createdBefore: params.createdBefore ? params.createdBefore.toISOString() : null,
      actionHashHex: params.actionHashHex ?? null,
      challengeId: params.challengeId ?? null,
      purpose: params.purpose ?? null,
      decision: params.decision ?? null
    };

    const signingKey = {
      privateKeyPem: config.exportSigningPrivateKeyPem,
      ...(config.exportSigningPublicKeyPem ? { publicKeyPem: config.exportSigningPublicKeyPem } : {})
    };

    const pack = buildExportPack({
      receipts,
      filters,
      policySnapshot,
      ...(trustSnapshot ? { trustSnapshot } : {}),
      signingKey
    });

    const zipFiles = [
      ...pack.files.map((file) => ({ name: file.name, bytes: file.bytes })),
      { name: "manifest.json", bytes: Buffer.from(JSON.stringify(pack.manifest, null, 2) + "\n", "utf8") },
      { name: "manifest.sig.json", bytes: Buffer.from(JSON.stringify(pack.signature, null, 2) + "\n", "utf8") }
    ];

    const { zipPath, cleanup } = await createZipFromFiles(zipFiles);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="pbi-receipts-export.zip"');

    res.download(zipPath, "pbi-receipts-export.zip", async (err) => {
      await cleanup();
      if (err) {
        logger.error({ err }, "export_zip_send_failed");
      }
    });
  })
);

pbiRouter.get(
  "/receipts/:id",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const apiKey = req.apiKey!;
    const traceId = (req as AuthedRequest & { requestId?: string }).requestId;
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

    const evidence = buildEvidenceMetadata(evidenceParams(traceId));
    const challenge = challengeRow.rowCount
      ? withEvidenceMetadata(
          {
            id: receipt.challengeId,
            purpose: challengeRow.rows[0]?.purpose as string,
            actionHashHex: challengeRow.rows[0]?.action_hash_hex as string,
            expiresAtIso: new Date(challengeRow.rows[0]?.expires_at as string).toISOString(),
            usedAtIso: challengeRow.rows[0]?.used_at ? new Date(challengeRow.rows[0]?.used_at as string).toISOString() : null
          },
          evidence
        )
      : null;

    res.json({
      receipt: withEvidenceMetadata(
        {
          id: receipt.id,
          challengeId: receipt.challengeId,
          receiptHashHex: receipt.receiptHashHex,
          decision: receipt.decision,
          createdAt: receipt.createdAt
        },
        evidence
      ),
      challenge
    });
  })
);

pbiRouter.post(
  "/receipts/verify",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const apiKey = req.apiKey!;
    const traceId = (req as AuthedRequest & { requestId?: string }).requestId;
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

    const evidence = buildEvidenceMetadata(evidenceParams(traceId));
    res.json({
      ok,
      receipt: withEvidenceMetadata(
        {
          id: receipt.id,
          challengeId: receipt.challengeId,
          decision: receipt.decision,
          createdAt: receipt.createdAt
        },
        evidence
      )
    });
  })
);

pbiRouter.get(
  "/receipts",
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const apiKey = req.apiKey!;
    const traceId = (req as AuthedRequest & { requestId?: string }).requestId;
    const parsed = ReceiptListQuery.safeParse(req.query ?? {});

    if (parsed && !parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.issues });
      return;
    }

    const params = parsed.data;
    const limit = params.limit ?? 50;
    const order = params.order;

    const listFilters = {
      apiKeyId: apiKey.id,
      limit,
      order,
      ...(params.cursor ? { cursor: params.cursor } : {}),
      ...(params.actionHashHex ? { actionHashHex: params.actionHashHex } : {}),
      ...(params.challengeId ? { challengeId: params.challengeId } : {}),
      ...(params.purpose ? { purpose: params.purpose } : {}),
      ...(params.decision ? { decision: params.decision } : {}),
      ...(params.createdAfter ? { createdAfter: params.createdAfter } : {}),
      ...(params.createdBefore ? { createdBefore: params.createdBefore } : {})
    };

    const { text, values } = buildReceiptQuery(listFilters);

    const rows = await pool.query(text, values);
    const evidence = buildEvidenceMetadata(evidenceParams(traceId));
    const receipts = (rows.rows as Array<Record<string, unknown>>).map((row) => {
      const challengeRowId = row.challenge_row_id as string | null;
      const challenge =
        challengeRowId !== null
          ? withEvidenceMetadata(
              {
                id: String(row.challenge_id),
                purpose: String(row.purpose),
                actionHashHex: String(row.action_hash_hex),
                expiresAtIso: new Date(row.expires_at as string).toISOString(),
                usedAtIso: row.used_at ? new Date(row.used_at as string).toISOString() : null
              },
              evidence
            )
          : null;

      return {
        receipt: withEvidenceMetadata(
          {
            id: String(row.id),
            challengeId: String(row.challenge_id),
            receiptHashHex: String(row.receipt_hash_hex),
            decision: String(row.decision),
            createdAt: new Date(row.created_at as string).toISOString()
          },
          evidence
        ),
        challenge
      };
    });

    const last = receipts.at(-1);
    const nextCursor = last
      ? encodeReceiptCursor({ createdAt: new Date(last.receipt.createdAt), id: last.receipt.id })
      : null;

    res.json({ receipts, nextCursor });
  })
);
