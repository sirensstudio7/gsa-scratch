#!/usr/bin/env node
/**
 * Push Supabase + staff env from .env.local to a Vercel project.
 *
 * One-time setup:
 *   1. https://vercel.com/account/tokens → Create Token
 *   2. export VERCEL_TOKEN="..."
 *   3. npm run vercel:env
 *
 * Optional: VERCEL_PROJECT_NAME=gsa-scratch (auto-detected if linked)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal() {
  const path = resolve(root, ".env.local");
  if (!existsSync(path)) throw new Error("Missing .env.local");
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STAFF_TOKEN",
];

const token = process.env.VERCEL_TOKEN?.trim();
if (!token) {
  console.error(`Set VERCEL_TOKEN (https://vercel.com/account/tokens), then re-run:

  export VERCEL_TOKEN="your_token"
  npm run vercel:env
`);
  process.exit(1);
}

const local = loadEnvLocal();
for (const k of KEYS) {
  if (!local[k]?.trim()) {
    console.error(`Missing ${k} in .env.local`);
    process.exit(1);
  }
}

const teamId = process.env.VERCEL_TEAM_ID?.trim();
const teamQ = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";

async function api(path, opts = {}) {
  const res = await fetch(`https://api.vercel.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Vercel API ${res.status} ${path}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : {};
}

const wantName = process.env.VERCEL_PROJECT_NAME?.trim() || "gsa-scratch";

const projectsRes = await api(
  `/v9/projects${teamQ}${teamQ ? "&" : "?"}limit=100`,
);
const projects = projectsRes.projects || [];
const project =
  projects.find((p) => p.name === wantName) ||
  projects.find((p) => (p.link?.repo || "").includes("gsa-scratch"));

if (!project) {
  console.error(
    `No Vercel project "${wantName}". Found: ${projects.map((p) => p.name).join(", ") || "(none)"}`,
  );
  process.exit(1);
}

const projectId = project.id;
console.log(`Project: ${project.name} (${projectId})`);

const existingRes = await api(`/v9/projects/${projectId}/env${teamQ}`);
const envVars = existingRes.envs || [];
const targets = ["production", "preview", "development"];

for (const key of KEYS) {
  const value = local[key].trim();
  const matching = envVars.filter((e) => e.key === key);
  for (const row of matching) {
    await api(`/v9/projects/${projectId}/env/${row.id}${teamQ}`, {
      method: "DELETE",
    });
  }
  await api(`/v10/projects/${projectId}/env${teamQ}`, {
    method: "POST",
    body: JSON.stringify({
      key,
      value,
      type: "encrypted",
      target: targets,
    }),
  });
  console.log(matching.length ? `Replaced ${key}` : `Created ${key}`);
}

console.log("\nDone. Vercel → Deployments → Redeploy production (or wait for next git push).");
