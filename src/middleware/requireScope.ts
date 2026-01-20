import type { RequestHandler, Response } from "express";
import type { AuthedRequest } from "./apiKeyAuth.js";

export type ApiScope = "pbi.verify" | "pbi.read_receipts" | "pbi.export";

export function apiKeyHasScope(scopes: string[] | null, scope: ApiScope): boolean {
  if (!scopes || scopes.length === 0) return true;
  return scopes.includes(scope);
}

export function requireScope(scope: ApiScope): RequestHandler {
  return (req, res, next) => {
    const authedReq = req as AuthedRequest;
    const apiKey = authedReq.apiKey;
    if (!apiKey) {
      res.status(401).json({ error: "missing_api_key" });
      return;
    }

    if (!apiKeyHasScope(apiKey.scopes, scope)) {
      res.status(403).json({ error: "insufficient_scope", required: scope });
      return;
    }

    next();
  };
}
