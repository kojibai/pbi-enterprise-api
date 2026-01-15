import { pool } from "./pool.js";
import fs from "node:fs";
import path from "node:path";

export async function runMigrations(): Promise<void> {
  const schemaPath = path.join(process.cwd(), "src", "db", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  await pool.query(sql);
}