import { randomBytes, randomUUID } from "node:crypto";
import { pool } from "../src/db/pool.js";
import { hashApiKey } from "../src/db/queries/apiKeys.js";
import { bytesToB64url } from "../src/util/base64url.js";

type Plan = "starter" | "pro" | "enterprise";

function mintRawApiKey(prefix: "pbi_live" | "pbi_test"): string {
  const rnd = bytesToB64url(new Uint8Array(randomBytes(32)));
  return `${prefix}_${rnd}`;
}

async function ensureKey(
  label: string,
  plan: Plan,
  quotaPerMonth: bigint
): Promise<{ id: string; rawKey: string; plan: Plan; quotaPerMonth: bigint }> {
  const existing = await pool.query(
    `SELECT id, plan, quota_per_month
     FROM api_keys
     WHERE label=$1
     LIMIT 1`,
    [label]
  );

  const n = existing.rowCount ?? 0;
  if (n > 0) {
    const row = existing.rows[0] as { id: string; plan: Plan; quota_per_month: string };
    return {
      id: row.id,
      rawKey: "",
      plan: row.plan,
      quotaPerMonth: BigInt(row.quota_per_month)
    };
  }

  const rawKey = mintRawApiKey("pbi_live");
  const keyHash = hashApiKey(rawKey);
  const id = randomUUID();

  await pool.query(
    `INSERT INTO api_keys (id, label, key_hash, plan, quota_per_month, is_active)
     VALUES ($1, $2, $3, $4, $5, TRUE)`,
    [id, label, keyHash, plan, quotaPerMonth.toString()]
  );

  return { id, rawKey, plan, quotaPerMonth };
}

async function main(): Promise<void> {
  const label = process.env.SEED_LABEL ?? "Enterprise (Seed)";
  const plan = (process.env.SEED_PLAN ?? "enterprise") as Plan;
  const quota = BigInt(process.env.SEED_QUOTA_PER_MONTH ?? "1000000");

  if (plan !== "starter" && plan !== "pro" && plan !== "enterprise") {
    throw new Error("SEED_PLAN must be starter|pro|enterprise");
  }

  const out = await ensureKey(label, plan, quota);

  console.log("✅ Seed complete");
  console.log(`label=${label}`);
  console.log(`id=${out.id}`);
  console.log(`plan=${out.plan}`);
  console.log(`quota_per_month=${out.quotaPerMonth.toString()}`);

  if (out.rawKey) {
    console.log("\nRAW_API_KEY (show once):");
    console.log(out.rawKey);

    console.log("\nCopy/paste export lines:");
    console.log(`export PBI_API_KEY="${out.rawKey}"`);
    console.log(`export PBI_API_BASE="http://localhost:8080"`);

    console.log("\nSmoke test (challenge):");
    console.log(
      `curl -s -X POST "$PBI_API_BASE/v1/pbi/challenge" \\\n` +
        `  -H "authorization: Bearer $PBI_API_KEY" \\\n` +
        `  -H "content-type: application/json" \\\n` +
        `  -d '{"purpose":"ACTION_COMMIT","actionHashHex":"${"0".repeat(64)}","ttlSeconds":120}' | jq`
    );

    console.log(
      "\nNote: /verify requires a real WebAuthn assertion bundle (UP+UV). Use the examples/ wrappers to generate it from a client."
    );
  } else {
    console.log(
      "\n⚠️ A key with this label already exists. Raw API keys are not recoverable.\n" +
        "If you need a new raw key, provision another label (e.g., 'Enterprise (Seed) v2') using scripts/provision-api-key.ts."
    );
  }
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });