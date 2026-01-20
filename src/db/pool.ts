import pg from "pg";
import { config } from "../config.js";

function shouldUseSsl(connectionString: string): boolean {
  try {
    const u = new URL(connectionString);
    const host = u.hostname;
    const sslmode = (u.searchParams.get("sslmode") ?? "").toLowerCase();

    // Local dev: no SSL
    if (host === "localhost" || host === "127.0.0.1") return false;
    if (sslmode === "disable") return false;

    // Remote DB: default to SSL unless explicitly disabled
    return true;
  } catch {
    return false;
  }
}

const connectionString = config.databaseUrl;
if (!connectionString) {
  throw new Error("DATABASE_URL not configured");
}

const ssl = shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined;

export const pool = new pg.Pool({
  connectionString,
  ...(ssl ? { ssl } : {}),
  max: Number(process.env.PGPOOL_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_MS ?? 30_000),
  connectionTimeoutMillis: Number(process.env.PGPOOL_CONN_MS ?? 5_000)
});

// Pool-level errors can happen (network drops, etc). Do not crash the process.
pool.on("error", (err: Error) => {
  // Avoid importing logger here (can introduce cycles). Keep it simple.
  // eslint-disable-next-line no-console
  console.error("pg_pool_error", err);
});

export async function closePool(): Promise<void> {
  await pool.end();
}
