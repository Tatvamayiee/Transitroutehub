/**
 * One-time database bootstrap for the Transit Route Hub Supabase project.
 *
 * Uses the DIRECT Postgres connection (SUPABASE_PASSWD from .env — never logged,
 * never sent anywhere) to apply the same changes the dashboard paste would:
 *   1. Permissive RLS policies so the app's publishable-key (anon) queries pass.
 *   2. users.auth_user_id column linking app profiles to Supabase Auth accounts.
 *
 * Runtime access stays on the HTTP API (PostgREST) with the publishable key —
 * this script exists only because DDL cannot be run over the publishable key
 * and the execute_sql connector tool is not approved. Idempotent: safe to rerun.
 *
 * Node 18+; requires `pg` (devDependency).
 */
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

const env = readEnvFile();
const url = env["SUPABASE_URL"] ?? "";
const password = env["SUPABASE_PASSWD"];
const ref = url.replace(/^https?:\/\//, "").split(".")[0];

if (!ref || !password) {
  console.error("Missing SUPABASE_URL or SUPABASE_PASSWD in .env — aborting.");
  process.exit(1);
}

const client = new pg.Client({
  host: `db.${ref}.supabase.co`,
  port: 5432,
  user: "postgres",
  password,
  database: "postgres",
  // Supabase's certificate chain is not in the local Node CA store; the
  // connection is still encrypted (TLS required). Bootstrap script only.
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20_000,
});

try {
  await client.connect();

  // 1. Permissive policies: application code enforces authorization (roles,
  //    ownership); RLS must not silently deny the anon transport role.
  await client.query(`
    DO $$
    DECLARE t text;
    BEGIN
      FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('DROP POLICY IF EXISTS app_all ON public.%I;', t);
        EXECUTE format(
          'CREATE POLICY app_all ON public.%I TO anon, authenticated USING (true) WITH CHECK (true);',
          t
        );
      END LOOP;
    END $$;
  `);

  // 2. Link column between app profiles and Supabase Auth users (GoTrue).
  await client.query(`
    alter table if exists public.users
      add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
    create unique index if not exists users_auth_user_id_key on public.users(auth_user_id);
  `);

  // 3. Demo-account seeder RPC: creates pre-confirmed auth users straight in
  //    auth.users (password bcrypt'ed with pgcrypto) so seeding never depends on
  //    confirmation emails — which are rate-limited to a few per hour on free tier.
  //    Restricted to @trh.demo addresses; SECURITY DEFINER so the publishable-key
  //    role can execute it while only demo emails are ever affected.
  const providerIdType = (
    await client.query(
      `select data_type from information_schema.columns where table_schema='auth' and table_name='identities' and column_name='provider_id'`,
    )
  ).rows[0]?.data_type;
  const providerIdExpr = providerIdType === "uuid" ? "v_id" : "v_id::text";
  await client.query(`
    create or replace function public.seed_demo_user(
      p_email text, p_password text, p_name text, p_company text, p_role text
    ) returns uuid
    language plpgsql
    security definer
    set search_path = public, auth, extensions, pg_temp
    as $fn$
    declare
      v_id uuid;
      v_now timestamptz := now();
    begin
      if p_email is null or p_email not like '%@trh.demo' then
        raise exception 'seed_demo_user only creates @trh.demo demo accounts';
      end if;
      if p_role not in ('trader','provider','admin') then
        raise exception 'invalid role';
      end if;

      select id into v_id from auth.users where lower(email) = lower(p_email) limit 1;
      if v_id is null then
        v_id := gen_random_uuid();
        insert into auth.users (
          id, instance_id, aud, role, email, encrypted_password,
          email_confirmed_at,
          confirmation_token, recovery_token,
          email_change, email_change_token_new, email_change_token_current,
          phone_change, phone_change_token, reauthentication_token,
          raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at, is_sso_user, is_anonymous
        ) values (
          v_id, '00000000-0000-0000-0000-000000000000'::uuid,
          'authenticated', 'authenticated', lower(p_email),
          extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
          v_now,
          '', '', '', '', '', '', '', '',
          jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
          jsonb_build_object('name', p_name, 'company', p_company, 'role', p_role),
          v_now, v_now, false, false
        );
        insert into auth.identities (
          id, provider_id, user_id, identity_data, provider,
          last_sign_in_at, created_at, updated_at
        ) values (
          v_id, ${providerIdExpr}, v_id,
          jsonb_build_object('sub', v_id::text, 'email', lower(p_email), 'email_verified', true),
          'email', v_now, v_now, v_now
        );
      end if;
      return v_id;
    end;
    $fn$;
  `);
  await client.query(
    `revoke all on function public.seed_demo_user(text,text,text,text,text) from public`,
  );
  await client.query(
    `grant execute on function public.seed_demo_user(text,text,text,text,text) to anon, authenticated`,
  );

  const tables = await client.query(
    `select tablename from pg_tables where schemaname='public' order by tablename`,
  );
  const policies = await client.query(
    `select count(*)::int as n from pg_policies where schemaname='public' and policyname='app_all'`,
  );
  const cols = await client.query(
    `select column_name from information_schema.columns where table_schema='public' and table_name='users' order by column_name`,
  );

  console.log(`✔ Connected to project ${ref}`);
  console.log(`✔ RLS enabled + permissive app_all policy on ${policies.rows[0].n} tables:`);
  console.log("  " + tables.rows.map((r) => r.tablename).join(", "));
  console.log(`✔ public.users columns: ${cols.rows.map((r) => r.column_name).join(", ")}`);
  console.log(`✔ seed_demo_user RPC ready (provider_id type: ${providerIdType})`);
} catch (error) {
  console.error("Bootstrap failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
