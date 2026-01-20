import { z } from "zod";
import { b64urlToBytes, bytesToB64url } from "../util/base64url.js";

export type ReceiptCursor = {
  createdAt: Date;
  id: string;
};

const CursorPayload = z.object({
  createdAt: z.string().datetime(),
  id: z.string().uuid()
});

export function encodeReceiptCursor(cursor: ReceiptCursor): string {
  const payload = {
    createdAt: cursor.createdAt.toISOString(),
    id: cursor.id
  };
  const json = JSON.stringify(payload);
  return bytesToB64url(new TextEncoder().encode(json));
}

export function decodeReceiptCursor(raw: string): ReceiptCursor | null {
  try {
    const json = new TextDecoder().decode(b64urlToBytes(raw));
    const parsed = JSON.parse(json) as unknown;
    const result = CursorPayload.safeParse(parsed);
    if (!result.success) return null;
    return { createdAt: new Date(result.data.createdAt), id: result.data.id };
  } catch {
    return null;
  }
}
