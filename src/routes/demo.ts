import { Router } from "express";
import { pbiRouter } from "./pbi.js";
import { getApiKeyByRaw } from "../db/queries/apiKeys.js";

export const demoRouter = Router();

const DEMO_KEY = (process.env.DEMO_PBI_API_KEY ?? "").trim();

async function demoKeyAuth(req: any, res: any, next: any) {
  if (req.method === "OPTIONS") return next();

  if (!DEMO_KEY) return res.status(500).json({ error: "demo_not_configured" });

  const rec = await getApiKeyByRaw(DEMO_KEY);
  if (!rec || !rec.isActive) return res.status(500).json({ error: "demo_key_invalid" });

  // attach like apiKeyAuth does
  req.apiKey = rec;
  next();
}

// Reuse your existing pbiRouter implementation safely
demoRouter.use("/pbi", demoKeyAuth, pbiRouter);