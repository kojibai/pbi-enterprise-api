import { pool } from "./pool.js";
import fs from "node:fs";
import path from "node:path";

async function ensureMetaTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations_meta (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function alreadyApplied(id: string): Promise<boolean> {
  const r = await pool.query(`SELECT id FROM migrations_meta WHERE id=$1 LIMIT 1`, [id]);
  return (r.rowCount ?? 0) > 0;
}

async function markApplied(id: string): Promise<void> {
  await pool.query(`INSERT INTO migrations_meta (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [id]);
}

export async function runMigrations(): Promise<void> {
  // 1) Base schema (idempotent)
  const schemaPath = path.join(process.cwd(), "src", "db", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  await pool.query(sql);

  // 2) One-time patches (versioned)
  await ensureMetaTable();

  // Patch: customers default should be pending/0 (instead of starter/100000)
  const patchId = "2026-01-15_customers_default_pending";

  if (!(await alreadyApplied(patchId))) {
    // Ensure column exists first (safety for older envs)
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name='customers' AND column_name='plan'
        ) THEN
          ALTER TABLE customers ALTER COLUMN plan SET DEFAULT 'pending';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name='customers' AND column_name='quota_per_month'
        ) THEN
          ALTER TABLE customers ALTER COLUMN quota_per_month SET DEFAULT 0;
        END IF;
      END $$;
    `);

    await markApplied(patchId);
  }
}