import { Router } from "express";
import type { Response } from "express";
import { AuthedRequest } from "../middleware/apiKeyAuth.js";
import { monthKey } from "../util/time.js";
import { getUsageForMonth } from "../billing/meter.js";

export const billingRouter = Router();

billingRouter.get("/usage", async (req: AuthedRequest, res: Response) => {
  const apiKey = req.apiKey!;
  const mk = String(req.query.month ?? monthKey(new Date()));
  const usage = await getUsageForMonth(apiKey.id, mk);
  res.json({ month: mk, usage: { challenge: usage.challenge.toString(), verify: usage.verify.toString() } });
});

billingRouter.get("/invoices", async (req: AuthedRequest, res: Response) => {
  const apiKey = req.apiKey!;
  const rows = await (await import("../db/pool.js")).pool.query(
    `SELECT id, month_key, status, total_cents, line_items_json, created_at, finalized_at
     FROM invoices WHERE api_key_id=$1 ORDER BY created_at DESC LIMIT 12`,
    [apiKey.id]
  );

  res.json({
    invoices: (rows.rows as Array<{
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