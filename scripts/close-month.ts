import { pool } from "../src/db/pool.js";
import { monthKey } from "../src/util/time.js";
import { finalizeInvoiceForMonth } from "../src/billing/invoice.js";

const mk = monthKey(new Date());
const keys = await pool.query(`SELECT id, plan FROM api_keys WHERE is_active=TRUE`);

for (const row of keys.rows as Array<{ id: string; plan: string }>) {
  const plan = row.plan as "starter" | "pro" | "enterprise";
  const invoiceId = await finalizeInvoiceForMonth(row.id, plan, mk);
  console.log(`Finalized invoice ${invoiceId} for api_key_id=${row.id} month=${mk}`);
}

await pool.end();