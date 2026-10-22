/**
 * Async Supabase-backed repository.
 *
 * Replaces the in-memory arrays that used to live in `store.ts`. Every function is a
 * thin, typed PostgREST call mapped to the exact shapes the domain and services already
 * use (`UserRow`, `Lane`, `Booking`, `CargoBox`, …), so service code keeps reading the
 * same objects — it just `await`s them now.
 *
 * Security note: RLS policies (see supabase/migrations) gate row access by role; this
 * module never widens access beyond what the caller's token already allows. No password
 * material is ever read or returned here — credentials live in Supabase Auth.
 */
import { dbAsync } from "@/server/db/client";
import type { CargoBox, Placement } from "@/domain/loading";
import type {
  AuditEvent,
  Booking,
  Container,
  Lane,
  Message,
  Notification,
  Payment,
  ProviderVerification,
  Thread,
  User,
  UserRole,
} from "@/domain/types";

// ---------------- shared helpers ----------------

export interface UserRow {
  id: string;
  email: string;
  name: string;
  company: string;
  role: UserRole;
  createdAt: string;
  /** Supabase Auth (GoTrue) user id; null until the account first signs in. */
  authUserId: string | null;
}

function iso(value: string | null | undefined): string {
  return value ? new Date(value).toISOString() : new Date(0).toISOString();
}

// ---------------- users ----------------

function toUserRow(row: Record<string, unknown>): UserRow {
  return {
    id: String(row["id"]),
    email: String(row["email"]),
    name: String(row["name"]),
    company: String(row["company"]),
    role: row["role"] as UserRole,
    createdAt: iso(row["created_at"] as string),
    authUserId: (row["auth_user_id"] as string | null) ?? null,
  };
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("users")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data ? toUserRow(data) : undefined;
}

export async function findUserById(id: string): Promise<UserRow | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toUserRow(data) : undefined;
}

export async function listAllUsers(): Promise<UserRow[]> {
  const { data, error } = await (await dbAsync()).from("users").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []).map(toUserRow);
}

export async function countUsersByRole(): Promise<Record<UserRole, number>> {
  const { data, error } = await (await dbAsync()).from("users").select("role");
  if (error) throw error;
  const counts: Record<UserRole, number> = { trader: 0, provider: 0, admin: 0 };
  for (const row of data ?? []) {
    const role = (row as { role: UserRole }).role;
    if (role in counts) counts[role] += 1;
  }
  return counts;
}

export async function insertUser(row: {
  id: string;
  email: string;
  name: string;
  company: string;
  role: UserRole;
  createdAt: string;
  authUserId?: string | null;
}): Promise<UserRow> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("users")
    .insert({
      id: row.id,
      email: row.email.trim().toLowerCase(),
      name: row.name,
      company: row.company,
      role: row.role,
      created_at: row.createdAt,
      auth_user_id: row.authUserId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toUserRow(data);
}

export async function findUserByAuthId(authUserId: string): Promise<UserRow | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("users")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  return data ? toUserRow(data) : undefined;
}

/** Attach a Supabase Auth id to an existing profile row (first-login linking). */
export async function linkAuthUser(id: string, authUserId: string): Promise<UserRow | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("users")
    .update({ auth_user_id: authUserId })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? toUserRow(data) : undefined;
}

export async function updateUserRole(id: string, role: UserRole): Promise<UserRow | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("users")
    .update({ role })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? toUserRow(data) : undefined;
}
