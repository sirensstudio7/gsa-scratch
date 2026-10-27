#!/usr/bin/env node
/**
 * Applies bubble_clicks migration via psql when SUPABASE_DB_URL is in .env.local
 */
import { readFileSync, existsSync } from "node:fs";
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
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

const sqlFile = resolve(
  root,
  "supabase/migrations/20261026145100_gsa_bubble_clicks.sql",
);

if (!dbUrl) {
  console.log(`No SUPABASE_DB_URL in .env.local.

To apply on hosted Supabase:
  1. Dashboard → SQL Editor
  2. Paste: supabase/migrations/20261026145100_gsa_bubble_clicks.sql

Or add SUPABASE_DB_URL to .env.local and re-run: npm run db:bubble-migration
`);
  process.exit(0);
}

const psql = spawnSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlFile], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (psql.error?.code === "ENOENT") {
  console.error("psql not found. Install PostgreSQL client or paste SQL in Supabase Dashboard.");
  process.exit(1);
}

process.stdout.write(psql.stdout ?? "");
process.stderr.write(psql.stderr ?? "");
process.exit(psql.status ?? 1);
