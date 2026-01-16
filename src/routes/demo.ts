import { Router } from "express";
import { pbiRouter } from "./pbi.js";
import { getApiKeyByRaw } from "../db/queries/apiKeys.js";

// This router is a PUBLIC demo proxy.
// It uses a server-held demo API key and never accepts customer keys.
export const demoRouter = Router();

const DEMO_KEY = (process.env.DEMO_PBI_API_KEY ?? "").trim();

async function demoKeyAuth(req: any, res: any, next: any) {
  // Allow preflight
  if (req.method === "OPTIONS") return next();

  if (!DEMO_KEY) {
    return res.status(500).json({ error: "demo_not_configured" });
  }

  const rec = await getApiKeyByRaw(DEMO_KEY);
  if (!rec || !rec.isActive) {
    return res.status(500).json({ error: "demo_key_invalid" });
  }

  req.apiKey = rec;
  next();
}

// Rate limit hard at the edge if you want; this is just the auth wrapper.
// Mount your existing pbiRouter behind it:
demoRouter.use("/pbi", demoKeyAuth, pbiRouter);