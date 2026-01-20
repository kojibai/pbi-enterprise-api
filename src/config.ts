import dotenv from "dotenv";

dotenv.config();

function mustGet(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  if (!v || v.trim().length === 0) return undefined;
  return v;
}

function normalizeOrigin(input: string): string {
  // Trim, strip surrounding quotes, and remove trailing slashes.
  let s = input.trim();
  s = s.replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "");
  s = s.replace(/\/+$/g, "");
  return s;
}

function splitOrigins(raw: string): readonly string[] {
  return raw
    .split(",")
    .map((s) => normalizeOrigin(s))
    .filter((s) => s.length > 0);
}

function normalizePemEnv(v: string): string {
  // Support single-line PEM stored with \n escapes in env.
  // If already multi-line, this is a no-op.
  return v.includes("\\n") ? v.replace(/\\n/g, "\n") : v;
}

export type Config = {
  nodeEnv: "development" | "production" | "test";
  port: number;
  databaseUrl: string;
  allowedOrigins: readonly string[];
  receiptSecret: string;
  rlWindowSeconds: number;
  rlMaxRequests: number;
  policyVersion?: string;
  policyHash?: string;
  exportSigningPrivateKeyPem?: string;
  exportSigningPublicKeyPem?: string;
  webhookSecretKey?: string;
  trustSnapshotPath?: string;
};

const baseConfig: Config = {
  nodeEnv: (process.env.NODE_ENV ?? "development") as Config["nodeEnv"],
  port: Number(process.env.PORT ?? "8080"),
  databaseUrl: mustGet("DATABASE_URL"),
  allowedOrigins: splitOrigins(mustGet("PBI_ALLOWED_ORIGINS")),
  receiptSecret: mustGet("PBI_RECEIPT_SECRET"),
  rlWindowSeconds: Number(process.env.RL_WINDOW_SECONDS ?? "60"),
  rlMaxRequests: Number(process.env.RL_MAX_REQUESTS ?? "300")
};

const optionalConfig: Partial<Config> = {
  ...(optionalEnv("PBI_POLICY_VERSION") ? { policyVersion: optionalEnv("PBI_POLICY_VERSION")! } : {}),
  ...(optionalEnv("PBI_POLICY_HASH") ? { policyHash: optionalEnv("PBI_POLICY_HASH")! } : {}),
  ...(optionalEnv("PBI_EXPORT_SIGNING_PRIVATE_KEY_PEM")
    ? { exportSigningPrivateKeyPem: normalizePemEnv(optionalEnv("PBI_EXPORT_SIGNING_PRIVATE_KEY_PEM")!) }
    : {}),
  ...(optionalEnv("PBI_EXPORT_SIGNING_PUBLIC_KEY_PEM")
    ? { exportSigningPublicKeyPem: normalizePemEnv(optionalEnv("PBI_EXPORT_SIGNING_PUBLIC_KEY_PEM")!) }
    : {}),
  ...(optionalEnv("PBI_WEBHOOK_SECRET_KEY") ? { webhookSecretKey: optionalEnv("PBI_WEBHOOK_SECRET_KEY")! } : {}),
  ...(optionalEnv("PBI_TRUST_SNAPSHOT_PATH") ? { trustSnapshotPath: optionalEnv("PBI_TRUST_SNAPSHOT_PATH")! } : {})
};

export const config: Config = { ...baseConfig, ...optionalConfig };
