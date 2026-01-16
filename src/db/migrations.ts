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

  // ---------------------------------------------------------------------------
  // Patch 1: customers default should be pending/0 (instead of starter/100000)
  // ---------------------------------------------------------------------------
  const patchId1 = "2026-01-15_customers_default_pending";

  if (!(await alreadyApplied(patchId1))) {
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

    await markApplied(patchId1);
  }

  // ---------------------------------------------------------------------------
  // Patch 2: normalize customer emails (lower+trim) + merge duplicates + trigger
  // ---------------------------------------------------------------------------
  const patchId2 = "2026-01-16_customers_email_normalize_and_dedupe";

  if (!(await alreadyApplied(patchId2))) {
    await pool.query(`BEGIN;`);

    try {
      // A) Merge duplicate customers by normalized email.
      // Preference for keeper:
      //   - is_active desc
      //   - quota_per_month desc
      //   - created_at asc
      await pool.query(`
        WITH ranked AS (
          SELECT
            id,
            lower(trim(email)) AS em,
            row_number() OVER (
              PARTITION BY lower(trim(email))
              ORDER BY is_active DESC, quota_per_month DESC, created_at ASC
            ) AS rn,
            first_value(id) OVER (
              PARTITION BY lower(trim(email))
              ORDER BY is_active DESC, quota_per_month DESC, created_at ASC
            ) AS keep_id
          FROM customers
        ),
        moved_api_keys AS (
          UPDATE api_keys k
          SET customer_id = r.keep_id
          FROM ranked r
          WHERE k.customer_id = r.id AND r.rn > 1
          RETURNING 1
        ),
        moved_sessions AS (
          UPDATE portal_sessions s
          SET customer_id = r.keep_id
          FROM ranked r
          WHERE s.customer_id = r.id AND r.rn > 1
          RETURNING 1
        ),
        moved_magic AS (
          UPDATE portal_magic_links ml
          SET customer_id = r.keep_id
          FROM ranked r
          WHERE ml.customer_id = r.id AND r.rn > 1
          RETURNING 1
        ),
        deleted_stripe_dupes AS (
          DELETE FROM stripe_customers sc
          USING ranked r
          WHERE sc.customer_id = r.id
            AND r.rn > 1
            AND EXISTS (SELECT 1 FROM stripe_customers sc2 WHERE sc2.customer_id = r.keep_id)
          RETURNING 1
        ),
        moved_stripe AS (
          UPDATE stripe_customers sc
          SET customer_id = r.keep_id
          FROM ranked r
          WHERE sc.customer_id = r.id AND r.rn > 1
          RETURNING 1
        ),
        moved_subs AS (
          UPDATE subscriptions sub
          SET customer_id = r.keep_id
          FROM ranked r
          WHERE sub.customer_id = r.id AND r.rn > 1
          RETURNING 1
        )
        DELETE FROM customers c
        USING ranked r
        WHERE c.id = r.id AND r.rn > 1;
      `);

      // B) Normalize stored emails
      await pool.query(`
        UPDATE customers
        SET email = lower(trim(email))
        WHERE email <> lower(trim(email));
      `);

      // C) Trigger to enforce normalization forever (before unique checks)
      await pool.query(`
        CREATE OR REPLACE FUNCTION normalize_customer_email()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          NEW.email := lower(trim(NEW.email));
          RETURN NEW;
        END;
        $$;
      `);

      await pool.query(`
        DROP TRIGGER IF EXISTS trg_customers_normalize_email ON customers;
      `);

      await pool.query(`
        CREATE TRIGGER trg_customers_normalize_email
        BEFORE INSERT OR UPDATE OF email ON customers
        FOR EACH ROW
        EXECUTE FUNCTION normalize_customer_email();
      `);

      await pool.query(`COMMIT;`);
      await markApplied(patchId2);
    } catch (e) {
      await pool.query(`ROLLBACK;`);
      throw e;
    }
  }
}