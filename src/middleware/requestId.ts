import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = randomUUID();
  (req as Request & { requestId?: string }).requestId = id;
  res.setHeader("x-request-id", id);
  next();
}