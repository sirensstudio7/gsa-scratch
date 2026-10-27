#!/usr/bin/env node
/**
 * One-shot GSA Supabase setup for gsa-scratch:
 * - Applies supabase/schema.sql when SUPABASE_DB_URL is set
 * - Optionally points Cursor Supabase MCP at SUPABASE_PROJECT_REF
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
const examplePath = resolve(root, ".env.example");

function loadEnvLocal() {
  if (!existsSync(envPath)) {
    copyFileSync(examplePath, envPath);
    console.log("Created .env.local from .env.example — fill in GSA project keys, then re-run.\n");
  }
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
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

function patchCursorMcpProjectRef(projectRef) {
  const mcpPath = resolve(homedir(), ".cursor/mcp.json");
  if (!existsSync(mcpPath)) {
    console.log("No ~/.cursor/mcp.json — skip MCP project_ref update.");
    return;
  }
  const raw = readFileSync(mcpPath, "utf8");
  const json = JSON.parse(raw);
  const servers = json.mcpServers ?? json;
  const supa = servers.supabase ?? servers["user-supabase"];
  if (!supa?.url) {
    console.log("No supabase MCP entry in ~/.cursor/mcp.json — skip.");
    return;
  }
  const nextUrl = supa.url.replace(
    /project_ref=[^&]+/,
    `project_ref=${projectRef}`,
  );
  if (nextUrl === supa.url && !nextUrl.includes("project_ref=")) {
    supa.url = `${supa.url}${supa.url.includes("?") ? "&" : "?"}project_ref=${projectRef}`;
  } else {
    supa.url = nextUrl;
  }
  writeFileSync(mcpPath, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`Updated Cursor Supabase MCP → project_ref=${projectRef}`);
  console.log("Restart Cursor (or reload MCP) so the agent uses the GSA project.\n");
}

function applySchema() {
  const dbUrl =
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;
  if (!dbUrl) {
    console.log(`Missing SUPABASE_DB_URL in .env.local.

GSA Dashboard → Project Settings → Database → Connection string (URI).
Use the *Session pooler* or *Direct* URI (replace [YOUR-PASSWORD]).

Then re-run: npm run setup:supabase
`);
    return false;
  }

  const sqlFile = resolve(root, "supabase/schema.sql");
  const psql = spawnSync(
    "psql",
    [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlFile],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );

  if (psql.error?.code === "ENOENT") {
    console.error(
      "psql not found. Install PostgreSQL client, or paste supabase/schema.sql in GSA → SQL Editor.",
    );
    process.exit(1);
  }

  process.stdout.write(psql.stdout ?? "");
  process.stderr.write(psql.stderr ?? "");
  if (psql.status !== 0) {
    console.error("\nSchema apply failed. You can paste supabase/schema.sql in Supabase SQL Editor instead.");
    process.exit(psql.status ?? 1);
  }
  console.log("\n✓ GSA schema applied (participants, scratch_*, bubble_pops, realtime).");
  return true;
}

async function verifyApi() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.log("\nAdd NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart: npm run dev");
    return;
  }
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/scratch_settings?select=target&id=eq.1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      console.log("✓ API reachable — scratch_settings readable.");
    } else {
      console.log(`API check returned ${res.status} — confirm keys match the GSA project.`);
    }
  } catch (e) {
    console.log("API check failed:", e.message);
  }
}

loadEnvLocal();

const ref = process.env.SUPABASE_PROJECT_REF?.trim();
if (ref) patchCursorMcpProjectRef(ref);

const applied = applySchema();
if (applied) await verifyApi();

if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
  console.log("\nAlso set SUPABASE_SERVICE_ROLE_KEY in .env.local (Dashboard → API → service_role).");
}
