/**
 * Apply a SQL migration file to the project database.
 *
 *   node scripts/apply-migration.mjs supabase/migrations/0002_cargo_photo_review.sql
 *
 * Uses the direct Postgres connection (SUPABASE_PASSWD from .env) because DDL,
 * storage buckets and storage policies cannot be created over the publishable
 * key. Every migration in this folder is written to be idempotent, so rerunning
 * this script is safe. The password is never logged.
 */
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readEnvFile() {
  const out = {};
  const text = readFileSync(join(root, ".env"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-migration.mjs <path-to-migration.sql>");
  process.exit(1);
}

const env = readEnvFile();
const url = env["SUPABASE_URL"] ?? "";
const password = env["SUPABASE_PASSWD"];
const ref = url.replace(/^https?:\/\//, "").split(".")[0];
if (!ref || !password) {
  console.error("Missing SUPABASE_URL or SUPABASE_PASSWD in .env — aborting.");
  process.exit(1);
}

const sql = readFileSync(resolve(root, file), "utf8");
/**
 * Direct Postgres is IPv6-only on newer Supabase projects and does not resolve on
 * every network, so fall back to the Supavisor pooler (session mode) when the
 * direct host is unreachable. Both paths land on the same database.
 */
const candidates = [
  { host: `db.${ref}.supabase.co`, port: 5432, user: "postgres", label: "direct" },
  {
    host: "aws-0-ap-southeast-1.pooler.supabase.com",
    port: 5432,
    user: `postgres.${ref}`,
    label: "pooler (session)",
  },
  {
    host: "aws-1-ap-southeast-1.pooler.supabase.com",
    port: 5432,
    user: `postgres.${ref}`,
    label: "pooler (session, aws-1)",
  },
];

let client = null;
for (const candidate of candidates) {
  const attempt = new pg.Client({
    host: candidate.host,
    port: candidate.port,
    user: candidate.user,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });
  try {
    await attempt.connect();
    client = attempt;
    console.log(`connected via ${candidate.label} (${candidate.host})`);
    break;
  } catch (error) {
    await attempt.end().catch(() => {});
    console.log(
      `  ${candidate.label} unavailable: ${error instanceof Error ? error.message : error}`,
    );
  }
}

if (!client) {
  console.error("Could not reach the database through any host — aborting.");
  process.exit(1);
}

try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log(`✔ Applied ${file} to project ${ref}`);
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
