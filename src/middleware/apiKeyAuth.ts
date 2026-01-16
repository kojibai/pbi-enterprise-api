import type { Request, Response, NextFunction } from "express";
import { getApiKeyByRaw, ApiKeyRecord } from "../db/queries/apiKeys.js";

export type AuthedRequest = Request & { apiKey?: ApiKeyRecord };

export async function apiKeyAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  // ✅ CORS preflight must never require auth
  if (req.method === "OPTIONS") {
    next();
    return;
  }

  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "missing_api_key" });
    return;
  }

  const raw = auth.slice("Bearer ".length).trim();
  if (!raw) {
    res.status(401).json({ error: "missing_api_key" });
    return;
  }

  try {
    const rec = await getApiKeyByRaw(raw);
    if (!rec || !rec.isActive) {
      res.status(403).json({ error: "invalid_api_key" });
      return;
    }

    req.apiKey = rec;
    next();
  } catch {
    // Avoid leaking DB errors; keep semantics stable
    res.status(500).json({ error: "auth_failed" });
  }
}