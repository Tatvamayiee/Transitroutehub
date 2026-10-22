/**
 * Server auth service — backed by Supabase Auth (GoTrue).
 *
 * Credentials live in Supabase Auth; this module keeps only the app profile row
 * (public.users) and translates between GoTrue users and the platform's `User`
 * shape. The token the client holds is the GoTrue access token; server functions
 * verify it with `auth.getUser(token)` and resolve the profile by auth_user_id
 * (falling back to an email match that self-links on first use).
 *
 * No password material is ever stored, hashed or returned by this module.
 */

import { CODE, failure, success } from "@/domain/results";
import type { Result } from "@/domain/results";
import type { User, UserRole } from "@/domain/types";
import { dbAsync } from "@/server/db/client";
import {
  devLog,
  ensureSeeded,
  DEMO_PASSWORD,
  findUserByAuthId,
  findUserByEmail,
  newId,
  normalizeEmail,
  nowIso,
  recordAudit,
  toUser,
} from "@/server/store";
import * as repoUsers from "@/server/db/repo/users";

export type AuthSession = {
  token: string;
  user: User;
};

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

/**
 * Tiny verification cache so a burst of server calls in one request flow does not
 * hammer GoTrue. Short TTL keeps revocation lag bounded; failures bypass it.
 */
const VERIFY_TTL_MS = 60_000;
const verifyCache = new Map<string, { authUserId: string; expiresAt: number }>();

function cacheVerify(token: string, authUserId: string): void {
  verifyCache.set(token, { authUserId, expiresAt: Date.now() + VERIFY_TTL_MS });
  if (verifyCache.size > 500) {
    const now = Date.now();
    for (const [key, entry] of verifyCache) {
      if (entry.expiresAt <= now) verifyCache.delete(key);
    }
  }
}

async function verifyToken(token: string): Promise<AuthUser | null> {
  if (!token) return null;
  const cached = verifyCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return { id: cached.authUserId };
  }
  const { data, error } = await (await dbAsync()).auth.getUser(token);
  if (error || !data.user) {
    verifyCache.delete(token);
    return null;
  }
  cacheVerify(token, data.user.id);
  return data.user as AuthUser;
}

/** Resolve the profile row for a verified GoTrue user, self-linking on first use. */
async function resolveProfile(authUser: AuthUser): Promise<repoUsers.UserRow | null> {
  const byAuth = await findUserByAuthId(authUser.id);
  if (byAuth) return byAuth;

  const email = authUser.email ? normalizeEmail(authUser.email) : null;
  if (!email) return null;
  const byEmail = await findUserByEmail(email);
  if (byEmail) {
    return (await repoUsers.linkAuthUser(byEmail.id, authUser.id)) ?? byEmail;
  }

  // Profile row missing entirely: create it from the auth account's metadata so
  // sign-ups through GoTrue always yield a usable platform profile.
  const meta = authUser.user_metadata ?? {};
  const role: UserRole =
    meta["role"] === "provider" || meta["role"] === "admin" ? (meta["role"] as UserRole) : "trader";
  return repoUsers.insertUser({
    id: newId("usr"),
    email,
    name: typeof meta["name"] === "string" ? meta["name"] : (email.split("@")[0] ?? email),
    company: typeof meta["company"] === "string" ? meta["company"] : "",
    role,
    createdAt: nowIso(),
    authUserId: authUser.id,
  });
}

/** Verified token plus the full profile row. */
export async function requireAuthUser(token: string): Promise<User | null> {
  const authUser = await verifyToken(token);
  if (!authUser) return null;
  const profile = await resolveProfile(authUser);
  return profile ? toUser(profile) : null;
}

export async function requireRole(token: string, allowed: UserRole[]): Promise<User | null> {
  const user = await requireAuthUser(token);
  if (!user) return null;
  return allowed.includes(user.role) ? user : null;
}

export async function registerUser(data: {
  name: string;
  email: string;
  company: string;
  role: UserRole;
  password: string;
}): Promise<Result<AuthSession>> {
  await ensureSeeded();
  const email = normalizeEmail(data.email);

  const { data: signed, error } = await (
    await dbAsync()
  ).auth.signUp({
    email,
    password: data.password,
    options: { data: { name: data.name.trim(), company: data.company.trim(), role: data.role } },
  });

  if (error) {
    const message = String(error.message ?? "");
    const code = String((error as { code?: string }).code ?? "");
    if (error.status === 422 || /already (registered|exists)/i.test(message)) {
      return failure(CODE.EMAIL_TAKEN, "An account with this email already exists.");
    }
    if (error.status === 429 || /rate limit/i.test(message) || code.includes("rate_limit")) {
      return failure(
        CODE.RATE_LIMITED,
        "Too many sign-up attempts on this project — wait a few minutes and try again.",
      );
    }
    return failure(CODE.INVALID_INPUT, shortAuthError(message, "Could not create the account."));
  }

  const authUser = signed.user as AuthUser | null;
  if (!authUser) {
    return failure(CODE.INVALID_INPUT, "Could not create the account.");
  }

  const profile = await resolveProfile(authUser);

  // With email confirmation enabled GoTrue returns no session; ask the user to confirm.
  if (!signed.session) {
    return failure(
      CODE.UNAUTHORIZED,
      "Check your inbox to confirm your email address, then sign in.",
    );
  }

  if (!profile) {
    return failure(CODE.INVALID_INPUT, "Could not prepare your account profile.");
  }
  await recordAudit({ id: profile.id, name: profile.name }, "auth.register", profile.email);
  return success({ token: signed.session.access_token, user: toUser(profile) });
}

export async function loginUser(data: {
  email: string;
  password: string;
}): Promise<Result<AuthSession>> {
  await devLog(`login: ensureSeeded… (${data.email})`);
  await ensureSeeded();
  await devLog("login: seed ok, calling GoTrue signInWithPassword");
  const email = normalizeEmail(data.email);
  const { data: signed, error } = await (
    await dbAsync()
  ).auth.signInWithPassword({
    email,
    password: data.password,
  });
  if (error || !signed.session || !signed.user) {
    await devLog(`login: GoTrue rejected — ${error?.message ?? "no session"}`);
    // Self-heal: profiles exist (seed already ran) but GoTrue has no matching auth
    // user. Only trigger this when the seed password is used — no credit for
    // guessing a random password on a seeded account.
    const alreadySeeded = (await findUserByEmail(email)) !== undefined;
    if (alreadySeeded && passwordMatchesDemoSeed(data.password)) {
      await devLog("login: seed-era profiles exist but GoTrue has no auth users — repairing");
      const repaired = await repairDemoAuthLinks();
      if (repaired) {
        const retry = await (
          await dbAsync()
        ).auth.signInWithPassword({ email, password: data.password });
        if (!retry.error && retry.data.session && retry.data.user) {
          return finishLogin(retry.data.session.access_token, retry.data.user as AuthUser);
        }
        await devLog(`login: GoTrue retry rejected — ${retry.error?.message ?? "no session"}`);
      }
    }
    return failure(CODE.INVALID_CREDENTIALS, "Invalid email or password.");
  }
  return finishLogin(signed.session.access_token, signed.user as AuthUser);
}

/**
 * Demo accounts are seeded through the app with a fixed dev password. When GoTrue
 * has no matching auth user for a seeded profile (rate-limited sign-up, missed
 * seed, or an email-confirmation flow), re-run the seed's auth-user creation so
 * sign-in can succeed on retry. Only triggers for the demo seed password.
 */
async function repairDemoAuthLinks(): Promise<boolean> {
  try {
    const rows = await (
      await dbAsync()
    )
      .from("users")
      .select("id, name, email, company, role, auth_user_id")
      .is("auth_user_id", null)
      .limit(50);
    if (rows.error || !rows.data) {
      await devLog(`login: repair query failed — ${rows.error?.message ?? "no rows"}`);
      return false;
    }
    const candidates = rows.data.filter(
      (row) =>
        row.email &&
        String(row.email).endsWith("@trh.demo") &&
        (row.role === "trader" || row.role === "provider" || row.role === "admin"),
    );
    if (candidates.length === 0) {
      await devLog("login: no unlinked @trh.demo profiles — GoTrue still missing auth users");
      return false;
    }
    let linked = 0;
    for (const row of candidates) {
      const { data: uuid, error } = await (
        await dbAsync()
      ).rpc("seed_demo_user", {
        p_email: row.email,
        p_password: DEMO_PASSWORD,
        p_name: row.name,
        p_company: row.company,
        p_role: row.role,
      });
      if (!error && typeof uuid === "string" && uuid.length > 0) {
        await repoUsers.linkAuthUser(row.id, uuid);
        linked += 1;
      } else {
        await devLog(
          `login: seed_demo_user failed for ${row.email} — ${error?.message ?? "no uuid"}`,
        );
      }
    }
    await devLog(`login: repaired ${linked}/${candidates.length} auth links`);
    return linked > 0;
  } catch (e) {
    await devLog(`login: repair threw — ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

function passwordMatchesDemoSeed(password: string): boolean {
  return password === DEMO_PASSWORD;
}

async function finishLogin(token: string, authUser: AuthUser): Promise<Result<AuthSession>> {
  const profile = await resolveProfile(authUser);
  if (!profile) {
    return failure(CODE.INVALID_CREDENTIALS, "Invalid email or password.");
  }
  verifyCache.set(token, { authUserId: authUser.id, expiresAt: Date.now() + VERIFY_TTL_MS });
  await recordAudit({ id: profile.id, name: profile.name }, "auth.login", profile.email);
  await devLog(`login: OK for ${profile.email} (role=${profile.role})`);
  return success({ token, user: toUser(profile) });
}

/** Best-effort server-side revocation of this specific session. */
export async function logoutUser(token: string): Promise<Result<true>> {
  verifyCache.delete(token);
  try {
    const { error } = await (await dbAsync()).auth.admin.signOut(token, "global");
    if (error) {
      // Non-fatal: the client discards its token regardless.
      console.warn("[auth] logout revoke failed:", error.message);
    }
  } catch {
    console.warn("[auth] logout revoke threw");
  }
  return success(true);
}

/**
 * Password reset via Supabase Auth email. Returns success regardless of whether
 * the address exists (no account enumeration). Requires a configured SMTP
 * provider in the Supabase project for the email to actually deliver.
 */
export async function resetPassword(data: {
  email: string;
  password: string;
}): Promise<Result<true>> {
  await ensureSeeded();
  const { error } = await (await dbAsync()).auth.resetPasswordForEmail(normalizeEmail(data.email));
  if (error) {
    console.warn("[auth] reset email failed:", error.message);
  }
  return success(true);
}

function shortAuthError(message: string, fallback: string): string {
  if (!message) return fallback;
  return message.length > 140 ? fallback : message;
}
