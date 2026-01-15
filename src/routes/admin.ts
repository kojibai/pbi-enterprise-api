import { Router } from "express";
import type { Response } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { finalizeInvoiceForMonth } from "../billing/invoice.js";
import { AuthedRequest } from "../middleware/apiKeyAuth.js";

export const adminRouter = Router();

// Minimal operator gate: require enterprise plan API key.
// In production you’d swap this for a separate operator key or mTLS.
adminRouter.post("/close-month", async (req: AuthedRequest, res: Response) => {
  const apiKey = req.apiKey!;
  if (apiKey.plan !== "enterprise") {
    res.status(403).json({ error: "operator_only" });
    return;
  }

  const Body = z.object({ monthKey: z.string().regex(/^\d{4}-\d{2}$/) });
  const body = Body.parse(req.body);

  const keys = await pool.query(`SELECT id, plan FROM api_keys WHERE is_active=TRUE`);
  const out: Array<{ apiKeyId: string; invoiceId: string }> = [];

  for (const row of keys.rows as Array<{ id: string; plan: "starter" | "pro" | "enterprise" }>) {
    const invoiceId = await finalizeInvoiceForMonth(row.id, row.plan, body.monthKey);
    out.push({ apiKeyId: row.id, invoiceId });
  }

  res.json({ ok: true, closed: out });
});