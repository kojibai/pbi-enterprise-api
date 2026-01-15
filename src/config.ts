import dotenv from "dotenv";

dotenv.config();

function mustGet(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
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
  rlMaxRequests: Number(process.env.RL_MAX_REQUESTS ?? "300")
};