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
          SELECT 1 FROM information_schema.columns
          WHERE table_name='customers' AND column_name='plan'
        ) THEN
          ALTER TABLE customers ALTER COLUMN plan SET DEFAULT 'pending';
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
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
      // 1) Rank customers by normalized email to pick a "keeper"
      //    Keeper priority: active > higher quota > older created_at
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

        -- 2) Move foreign-keyed rows to keeper (safe; no uniqueness on customer_id here)
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
        moved_subs AS (
          UPDATE subscriptions sub
          SET customer_id = r.keep_id
          FROM ranked r
          WHERE sub.customer_id = r.id AND r.rn > 1
          RETURNING 1
        ),

        -- 3) Stripe customers: dedupe per keep_id to avoid PK collisions.
        sc AS (
          SELECT
            sc.customer_id AS cid,
            sc.created_at,
            r.keep_id,
            EXISTS (SELECT 1 FROM stripe_customers sc2 WHERE sc2.customer_id = r.keep_id) AS keep_has
          FROM stripe_customers sc
          JOIN ranked r ON r.id = sc.customer_id
        ),
        sc_choice AS (
          -- Only for groups where the keeper does NOT already have a stripe_customers row:
          -- choose exactly ONE row to keep (oldest created_at wins)
          SELECT keep_id, cid AS chosen_cid
          FROM (
            SELECT
              keep_id,
              cid,
              row_number() OVER (PARTITION BY keep_id ORDER BY created_at ASC, cid ASC) AS rn
            FROM sc
            WHERE keep_has = FALSE
          ) t
          WHERE rn = 1
        ),
        deleted_stripe AS (
          DELETE FROM stripe_customers sc0
          USING sc s
          LEFT JOIN sc_choice c ON c.keep_id = s.keep_id
          WHERE sc0.customer_id = s.cid
            AND (
              -- If keeper already has stripe row, delete all non-keeper rows.
              (s.keep_has = TRUE AND s.cid <> s.keep_id)
              OR
              -- If keeper does NOT have stripe row, delete all but the chosen row.
              (s.keep_has = FALSE AND c.chosen_cid IS NOT NULL AND s.cid <> c.chosen_cid)
            )
          RETURNING 1
        ),
        moved_stripe AS (
          -- If keeper did NOT have a stripe row, move the chosen row to keeper_id.
          UPDATE stripe_customers sc0
          SET customer_id = c.keep_id
          FROM sc_choice c
          WHERE sc0.customer_id = c.chosen_cid
            AND c.chosen_cid <> c.keep_id
          RETURNING 1
        )

        -- 4) Delete duplicate customer rows
        DELETE FROM customers c
        USING ranked r
        WHERE c.id = r.id AND r.rn > 1;
      `);

      // 5) Normalize stored emails (now safe because duplicates are removed)
      await pool.query(`
        UPDATE customers
        SET email = lower(trim(email))
        WHERE email <> lower(trim(email));
      `);

      // 6) Enforce normalization forever (before UNIQUE(email) is checked)
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

      await pool.query(`DROP TRIGGER IF EXISTS trg_customers_normalize_email ON customers;`);

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