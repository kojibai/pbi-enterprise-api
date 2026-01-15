import { randomBytes, randomUUID } from "node:crypto";
import { pool } from "../src/db/pool.js";
import { hashApiKey } from "../src/db/queries/apiKeys.js";
import { bytesToB64url } from "../src/util/base64url.js";

type Plan = "starter" | "pro" | "enterprise";

type Args = {
  label: string;
  plan: Plan;
  quotaPerMonth: bigint;
};

function parseArgs(argv: readonly string[]): Args {
  const map = new Map<string, string>();
  for (const a of argv) {
    const i = a.indexOf("=");
    if (i > 0) map.set(a.slice(0, i), a.slice(i + 1));
  }

  const label = map.get("label");
  const plan = map.get("plan") as Plan | undefined;
  const quota = map.get("quota");

  if (!label) throw new Error('Missing arg: label="Acme Corp Prod"');
  if (plan !== "starter" && plan !== "pro" && plan !== "enterprise") {
    throw new Error('Missing/invalid arg: plan=starter|pro|enterprise');
  }
  if (!quota || !/^\d+$/.test(quota)) throw new Error("Missing/invalid arg: quota=<integer>");

  return { label, plan, quotaPerMonth: BigInt(quota) };
}

function mintRawApiKey(): string {
  // raw key: pbi_live_<random>
  const rnd = bytesToB64url(new Uint8Array(randomBytes(32)));
  return `pbi_live_${rnd}`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rawKey = mintRawApiKey();
  const keyHash = hashApiKey(rawKey);

  const id = randomUUID();
  await pool.query(
    `INSERT INTO api_keys (id, label, key_hash, plan, quota_per_month, is_active)
     VALUES ($1, $2, $3, $4, $5, TRUE)`,
    [id, args.label, keyHash, args.plan, args.quotaPerMonth.toString()]
  );

  // Print ONCE (like Stripe). Store this somewhere safe.
  console.log("✅ API key provisioned");
  console.log(`id=${id}`);
  console.log(`label=${args.label}`);
  console.log(`plan=${args.plan}`);
  console.log(`quota_per_month=${args.quotaPerMonth.toString()}`);
  console.log("");
  console.log("RAW_API_KEY (show once):");
  console.log(rawKey);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });