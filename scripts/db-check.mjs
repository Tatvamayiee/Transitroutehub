/** Read-only seed progress check: row counts per app table + auth.users. */
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of readFileSync(join(root, ".env"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq > 0) env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}
const ref = (env["SUPABASE_URL"] ?? "").replace(/^https?:\/\//, "").split(".")[0];

const client = new pg.Client({
  host: `db.${ref}.supabase.co`,
  port: 5432,
  user: "postgres",
  password: env["SUPABASE_PASSWD"],
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20_000,
});

try {
  await client.connect();
  const tables = await client.query(
    `select tablename from pg_tables where schemaname='public' order by tablename`,
  );
  const counts = [];
  for (const { tablename } of tables.rows) {
    const r = await client.query(`select count(*)::int as n from public.${tablename}`);
    counts.push(`${tablename}=${r.rows[0].n}`);
  }
  const auth = await client.query(`select count(*)::int as n from auth.users`);
  const authList = await client.query(
    `select email, email_confirmed_at is not null as confirmed from auth.users order by email`,
  );
  console.log("app tables: " + counts.join(", "));
  console.log(`auth.users=${auth.rows[0].n}`);
  for (const row of authList.rows) console.log(`  - ${row.email} confirmed=${row.confirmed}`);
} catch (error) {
  console.error("check failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
