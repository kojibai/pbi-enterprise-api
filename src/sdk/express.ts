import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ReceiptVerifyResponse } from "./client.js";
import { PbiReceiptsClient } from "./client.js";

export type ReceiptGuardOptions = {
  receiptIdHeader?: string;
  receiptHashHeader?: string;
  onFailure?: (res: Response, result: ReceiptGuardFailure) => void;
};

export type ReceiptGuardFailure = {
  error: "missing_receipt" | "invalid_receipt" | "verification_failed";
  status: number;
  result?: ReceiptVerifyResponse;
};

export type ReceiptGuardRequest = Request & {
  pbiReceipt?: Record<string, unknown>;
};

export function createReceiptGuard(
  client: PbiReceiptsClient,
  options: ReceiptGuardOptions = {}
): RequestHandler {
  const receiptIdHeader = options.receiptIdHeader ?? "x-pbi-receipt-id";
  const receiptHashHeader = options.receiptHashHeader ?? "x-pbi-receipt-hash";

  return async (req: Request, res: Response, next: NextFunction) => {
    const receiptId = req.header(receiptIdHeader) ?? "";
    const receiptHashHex = req.header(receiptHashHeader) ?? "";

    if (!receiptId || !receiptHashHex) {
      const failure: ReceiptGuardFailure = { error: "missing_receipt", status: 400 };
      if (options.onFailure) {
        options.onFailure(res, failure);
      } else {
        res.status(failure.status).json({ error: failure.error });
      }
      return;
    }

    try {
      const result = await client.verifyReceipt({ receiptId, receiptHashHex });
      if (!result.ok) {
        const failure: ReceiptGuardFailure = { error: "invalid_receipt", status: 403, result };
        if (options.onFailure) {
          options.onFailure(res, failure);
        } else {
          res.status(failure.status).json({ error: failure.error, reason: result.reason });
        }
        return;
      }

      (req as ReceiptGuardRequest).pbiReceipt = result.receipt;
      next();
    } catch (err) {
      const failure: ReceiptGuardFailure = { error: "verification_failed", status: 502 };
      if (options.onFailure) {
        options.onFailure(res, failure);
      } else {
        res.status(failure.status).json({ error: failure.error });
      }
    }
  };
}
