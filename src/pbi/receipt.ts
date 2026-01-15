import { randomUUID } from "node:crypto";
import { hmacHex } from "../util/crypto.js";
import { config } from "../config.js";

export type ReceiptDecision = "PBI_VERIFIED" | "FAILED" | "EXPIRED" | "REPLAYED";

export type Receipt = {
  receiptId: string;
  receiptHashHex: string;
};

export function mintReceipt(challengeId: string, decision: ReceiptDecision): Receipt {
  const receiptId = randomUUID();
  const msg = `receipt:${receiptId}:challenge:${challengeId}:decision:${decision}`;
  const receiptHashHex = hmacHex(config.receiptSecret, msg);
  return { receiptId, receiptHashHex };
}