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

export const config: Config = {
  nodeEnv: (process.env.NODE_ENV ?? "development") as Config["nodeEnv"],
  port: Number(process.env.PORT ?? "8080"),
  databaseUrl: mustGet("DATABASE_URL"),
  allowedOrigins: mustGet("PBI_ALLOWED_ORIGINS")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
  receiptSecret: mustGet("PBI_RECEIPT_SECRET"),
  rlWindowSeconds: Number(process.env.RL_WINDOW_SECONDS ?? "60"),
  rlMaxRequests: Number(process.env.RL_MAX_REQUESTS ?? "300"),
  policyVersion: optionalEnv("PBI_POLICY_VERSION"),
  policyHash: optionalEnv("PBI_POLICY_HASH"),
  exportSigningPrivateKeyPem: optionalEnv("PBI_EXPORT_SIGNING_PRIVATE_KEY_PEM"),
  exportSigningPublicKeyPem: optionalEnv("PBI_EXPORT_SIGNING_PUBLIC_KEY_PEM"),
  webhookSecretKey: optionalEnv("PBI_WEBHOOK_SECRET_KEY"),
  trustSnapshotPath: optionalEnv("PBI_TRUST_SNAPSHOT_PATH")
};
