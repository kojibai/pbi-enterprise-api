import type { Plan } from "./pricing.js";

export type UsageKind = "challenge" | "verify";

export type UsageSummary = {
  monthKey: string;
  challengeUnits: bigint;
  verifyUnits: bigint;
};

export type InvoiceStatus = "open" | "final" | "paid";

export type InvoiceLineItems = {
  monthKey: string;
  plan: Plan;
  challengeUnits: string;
  verifyUnits: string;
  challengeSubtotalCents: string;
  verifySubtotalCents: string;
};

export type Invoice = {
  id: string;
  apiKeyId: string;
  monthKey: string;
  status: InvoiceStatus;
  lineItems: InvoiceLineItems;
  totalCents: bigint;
  createdAtIso: string;
  finalizedAtIso?: string;
};