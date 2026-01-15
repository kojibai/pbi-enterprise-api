import type { Request, Response, NextFunction } from "express";
import { getApiKeyByRaw, ApiKeyRecord } from "../db/queries/apiKeys.js";

export type AuthedRequest = Request & { apiKey?: ApiKeyRecord };

export async function apiKeyAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "missing_api_key" });
    return;
  }

  const raw = auth.slice("Bearer ".length).trim();
  const rec = await getApiKeyByRaw(raw);
  if (!rec || !rec.isActive) {
    res.status(403).json({ error: "invalid_api_key" });
    return;
  }

  req.apiKey = rec;
  next();
}