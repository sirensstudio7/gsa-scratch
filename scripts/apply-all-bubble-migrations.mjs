#!/usr/bin/env node
/**
 * Applies all supabase/migrations/*.sql in order when SUPABASE_DB_URL is set.
 * Loads .env.local from repo root (same as setup-gsa-supabase.mjs).
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal() {
  const path = resolve(root, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const dbUrl =
  process.env.SUPABASE_DB_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  process.env.POSTGRES_URL?.trim();

if (!dbUrl) {
  console.error(
    "Missing SUPABASE_DB_URL in .env.local (Postgres URI from Supabase Dashboard → Database).",
  );
  process.exit(1);
}

const dir = resolve(root, "supabase/migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (!files.length) {
  console.error("No migration files in supabase/migrations/");
  process.exit(1);
}

for (const file of files) {
  const sqlFile = resolve(dir, file);
  console.log(`Applying ${file}…`);
  const psql = spawnSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlFile], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (psql.stdout) process.stdout.write(psql.stdout);
  if (psql.stderr) process.stderr.write(psql.stderr);
  if (psql.error?.code === "ENOENT") {
    console.error("psql not found. Install PostgreSQL client or use Supabase SQL Editor.");
    process.exit(1);
  }
  if (psql.status !== 0) {
    process.exit(psql.status ?? 1);
  }
}

console.log("All migrations applied.");
