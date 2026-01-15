import { runMigrations } from "../src/db/migrations.js";
import { pool } from "../src/db/pool.js";

await runMigrations();
await pool.end();
console.log("Migrations applied.");