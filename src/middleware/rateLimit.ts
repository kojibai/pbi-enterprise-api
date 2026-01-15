import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";

type Bucket = { count: number; resetAtMs: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers.authorization ?? "anon";
  const now = Date.now();

  const b = buckets.get(key);
  if (!b || now > b.resetAtMs) {
    buckets.set(key, { count: 1, resetAtMs: now + config.rlWindowSeconds * 1000 });
    next();
    return;
  }

  if (b.count >= config.rlMaxRequests) {
    res.status(429).json({ error: "rate_limited" });
    return;
  }

  b.count += 1;
  next();
}