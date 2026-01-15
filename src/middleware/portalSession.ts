import type { NextFunction, Request, Response } from "express";
import { pool } from "../db/pool.js";

export type PortalAuthedRequest = Request & {
  portalCustomer?: {
    id: string;
    email: string;
    plan: "starter" | "pro" | "enterprise";
    quotaPerMonth: bigint;
  };
};

function getCookie(req: Request, name: string): string | null {
  const v = (req as Request & { cookies?: Record<string, string> }).cookies?.[name];
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function requirePortalSession(
  req: PortalAuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const sid = getCookie(req, "pbi_portal_session");
  if (!sid) {
    res.status(401).json({ error: "no_portal_session" });
    return;
  }

  const r = await pool.query(
    `SELECT s.id AS session_id, c.id AS customer_id, c.email, c.plan, c.quota_per_month
     FROM portal_sessions s
     JOIN customers c ON c.id = s.customer_id
     WHERE s.id=$1 AND s.revoked_at IS NULL AND s.expires_at > now() AND c.is_active=TRUE
     LIMIT 1`,
    [sid]
  );

  if ((r.rowCount ?? 0) === 0) {
    res.status(401).json({ error: "invalid_portal_session" });
    return;
  }

  const row = r.rows[0] as {
    customer_id: string;
    email: string;
    plan: "starter" | "pro" | "enterprise";
    quota_per_month: string;
  };

  req.portalCustomer = {
    id: row.customer_id,
    email: row.email,
    plan: row.plan,
    quotaPerMonth: BigInt(row.quota_per_month)
  };

  next();
}