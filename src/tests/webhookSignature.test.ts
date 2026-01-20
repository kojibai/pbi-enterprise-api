import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { signWebhookPayload } from "../webhooks/signature.js";

test("webhook signature uses expected base string", () => {
  const secret = "test-secret";
  const timestamp = 1710000000;
  const deliveryId = "f1e05b9f-6df2-4dd7-b02f-1a4900abca3a";
  const rawBody = JSON.stringify({ ok: true });

  const expected = createHmac("sha256", secret).update(`${timestamp}.${deliveryId}.${rawBody}`).digest("hex");
  const actual = signWebhookPayload(secret, timestamp, deliveryId, rawBody);
  assert.equal(actual, expected);
});
