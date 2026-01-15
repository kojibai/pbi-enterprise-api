import type { Request, Response, NextFunction } from "express";
import { logger } from "../util/logger.js";

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  void next;
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "internal_error" });
}