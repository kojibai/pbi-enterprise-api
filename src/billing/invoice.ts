import { pool } from "../db/pool.js";
import { randomUUID } from "node:crypto";
import { pricingByPlan, Plan } from "./pricing.js";
import { getUsageForMonth } from "./meter.js";

export type InvoiceStatus = "open" | "final" | "paid";

export type InvoiceLineItems = {
  monthKey: string;
  plan: Plan;
  challengeUnits: string;
  verifyUnits: string;
  challengeSubtotalCents: string;
  verifySubtotalCents: string;
};

export async function finalizeInvoiceForMonth(apiKeyId: string, plan: Plan, monthKey: string): Promise<string> {
  const usage = await getUsageForMonth(apiKeyId, monthKey);
  const pricing = pricingByPlan[plan];

  const challengeSubtotal = usage.challenge * BigInt(pricing.challengeCentsPerUnit);
  const verifySubtotal = usage.verify * BigInt(pricing.verifyCentsPerUnit);
  const total = challengeSubtotal + verifySubtotal;

  const line: InvoiceLineItems = {
    monthKey,
    plan,
    challengeUnits: usage.challenge.toString(),
    verifyUnits: usage.verify.toString(),
    challengeSubtotalCents: challengeSubtotal.toString(),
    verifySubtotalCents: verifySubtotal.toString()
  };

  const id = randomUUID();
  await pool.query(
    `INSERT INTO invoices (id, api_key_id, month_key, status, line_items_json, total_cents, finalized_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (id) DO NOTHING`,
    [id, apiKeyId, monthKey, "final", JSON.stringify(line), total.toString()]
  );

  return id;
}