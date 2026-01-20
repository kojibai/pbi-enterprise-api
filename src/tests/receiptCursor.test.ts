import test from "node:test";
import assert from "node:assert/strict";
import { decodeReceiptCursor, encodeReceiptCursor } from "../pbi/receiptCursor.js";
import { buildReceiptQuery } from "../pbi/receiptQuery.js";

test("receipt cursor encodes and decodes roundtrip", () => {
  const createdAt = new Date("2026-02-01T12:34:56.000Z");
  const id = "7b4e1f68-0c1e-4e52-9c85-8a9f1d0c64f3";
  const cursor = encodeReceiptCursor({ createdAt, id });
  const decoded = decodeReceiptCursor(cursor);
  assert.ok(decoded);
  assert.equal(decoded.id, id);
  assert.equal(decoded.createdAt.toISOString(), createdAt.toISOString());
});

test("receipt cursor rejects invalid payloads", () => {
  const decoded = decodeReceiptCursor("not-a-real-cursor");
  assert.equal(decoded, null);
});

test("receipt query uses stable tuple ordering for asc/desc", () => {
  const cursor = { createdAt: new Date("2026-02-01T00:00:00Z"), id: "00000000-0000-0000-0000-000000000001" };
  const asc = buildReceiptQuery({ apiKeyId: "key", limit: 10, order: "asc", cursor });
  const desc = buildReceiptQuery({ apiKeyId: "key", limit: 10, order: "desc", cursor });

  assert.ok(asc.text.includes("r.created_at >"));
  assert.ok(desc.text.includes("r.created_at <"));
});
