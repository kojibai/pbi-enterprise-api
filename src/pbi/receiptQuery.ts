import type { ReceiptCursor } from "./receiptCursor.js";

export type ReceiptOrder = "asc" | "desc";

export type ReceiptFilters = {
  apiKeyId: string;
  limit: number;
  order: ReceiptOrder;
  cursor?: ReceiptCursor;
  actionHashHex?: string;
  challengeId?: string;
  purpose?: string;
  decision?: string;
  createdAfter?: Date;
  createdBefore?: Date;
};

export type ReceiptQuery = {
  text: string;
  values: Array<string | number | Date>;
};

export function buildReceiptQuery(filters: ReceiptFilters): ReceiptQuery {
  const values: Array<string | number | Date> = [filters.apiKeyId];
  const clauses = ["r.api_key_id = $1"];

  if (filters.cursor) {
    values.push(filters.cursor.createdAt, filters.cursor.id);
    const createdIdx = values.length - 1;
    const idIdx = values.length;
    const op = filters.order === "asc" ? ">" : "<";
    clauses.push(
      `(r.created_at ${op} $${createdIdx} OR (r.created_at = $${createdIdx} AND r.id ${op} $${idIdx}))`
    );
  }

  if (filters.createdAfter) {
    values.push(filters.createdAfter);
    clauses.push(`r.created_at >= $${values.length}`);
  }

  if (filters.createdBefore) {
    values.push(filters.createdBefore);
    clauses.push(`r.created_at < $${values.length}`);
  }

  if (filters.actionHashHex) {
    values.push(filters.actionHashHex);
    clauses.push(`c.action_hash_hex = $${values.length}`);
  }

  if (filters.challengeId) {
    values.push(filters.challengeId);
    clauses.push(`r.challenge_id = $${values.length}`);
  }

  if (filters.purpose) {
    values.push(filters.purpose);
    clauses.push(`c.purpose = $${values.length}`);
  }

  if (filters.decision) {
    values.push(filters.decision);
    clauses.push(`r.decision = $${values.length}`);
  }

  values.push(filters.limit);

  const order = filters.order.toUpperCase();

  const text = `
      SELECT r.id, r.challenge_id, r.receipt_hash_hex, r.decision, r.created_at,
             c.id AS challenge_row_id, c.purpose, c.action_hash_hex, c.expires_at, c.used_at
      FROM pbi_receipts r
      LEFT JOIN pbi_challenges c ON c.id = r.challenge_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY r.created_at ${order}, r.id ${order}
      LIMIT $${values.length}
    `;

  return { text, values };
}
