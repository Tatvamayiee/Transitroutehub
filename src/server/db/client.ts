/**
 * Server-only Supabase (PostgREST) client for the persistent store.
 *
 * Credentials are read from the environment at call time, never at import time, and
 * never reach the browser bundle: this module is only imported from `src/server/**`,
 * which route components reference with `import type` only (see src/lib/api.ts).
 *
 * Resolution order: `process.env` (populated by Nitro on the server) then
 * `import.meta.env` (Vite). The key here is the *publishable* key — safe to expose.
 * Row-level security governs access; this client is a thin transport.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type EnvSource = Record<string, string | undefined>;

function envSources(): EnvSource[] {
  const sources: EnvSource[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = (globalThis as any).process as { env?: EnvSource } | undefined;
  if (proc?.env) sources.push(proc.env);
  // Vite statically replaces import.meta.env.* — guard for non-Vite runtimes.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (import.meta as any).env as EnvSource | undefined;
    if (meta) sources.push(meta);
  } catch {
    // import.meta.env unavailable — process.env is enough.
  }
  return sources;
}

/**
 * Dev fallback: the Vite dev server does not load .env into process.env (only
 * VITE_* vars reach import.meta.env), so read the file directly — server-side,
 * lazily, and only when the process env is empty. On edge runtimes the dynamic
 * import fails and we simply fall back to injected env vars.
 */
let fileEnv: EnvSource | undefined;
async function loadFileEnv(): Promise<EnvSource> {
  if (fileEnv !== undefined) return fileEnv;
  try {
    const proc = (globalThis as { process?: { cwd?: () => string } }).process;
    if (!proc?.cwd) return (fileEnv = {});
    const path = await import(/* @vite-ignore */ "node:path");
    const fs = await import(/* @vite-ignore */ "node:fs");
    const text = fs.readFileSync(path.join(proc.cwd(), ".env"), "utf8");
    const out: Record<string, string> = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    fileEnv = out;
  } catch {
    fileEnv = {};
  }
  return fileEnv;
}

function readEnv(name: string): string | undefined {
  for (const source of envSources()) {
    const value = source?.[name];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return undefined;
}

let client: SupabaseClient | null = null;

async function resolveConfig(): Promise<{ url: string; key: string } | null> {
  let url = readEnv("SUPABASE_URL");
  let key = readEnv("SUPABASE_PUBLISHABLE_KEY") ?? readEnv("SUPABASE_ANON_KEY");
  if (!url || !key) {
    const file = await loadFileEnv();
    url ??= file["SUPABASE_URL"];
    key ??= file["SUPABASE_PUBLISHABLE_KEY"] ?? file["SUPABASE_ANON_KEY"];
  }
  return url && key ? { url, key } : null;
}

/** Throws when configuration is missing — called by the async `dbAsync()` path. */
function missingConfigError(): Error {
  return new Error(
    "Database is not configured: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (see .env.example).",
  );
}

/**
 * Preferred entry: resolves .env from disk when the process environment lacks
 * the variables (Vite dev server case). Use this in server code.
 */
export async function dbAsync(): Promise<SupabaseClient> {
  if (client) return client;
  const config = await resolveConfig();
  if (!config) throw missingConfigError();
  client = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

export function db(): SupabaseClient {
  if (!client) {
    // Best-effort sync path: process env only. Prefer dbAsync(); if this runs
    // before dbAsync resolved and env vars are absent, it throws the config error.
    const url = readEnv("SUPABASE_URL");
    const key = readEnv("SUPABASE_PUBLISHABLE_KEY") ?? readEnv("SUPABASE_ANON_KEY");
    if (!url || !key) {
      throw new Error(
        "Database is not configured yet: SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY not in process env. Call dbAsync() first (or run with the vars exported).",
      );
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
