import { hmacHex } from "../util/crypto.js";

export function webhookSignatureBase(timestamp: number, deliveryId: string, rawBody: string): string {
  return `${timestamp}.${deliveryId}.${rawBody}`;
}

export function signWebhookPayload(secret: string, timestamp: number, deliveryId: string, rawBody: string): string {
  const base = webhookSignatureBase(timestamp, deliveryId, rawBody);
  return hmacHex(secret, base);
}
