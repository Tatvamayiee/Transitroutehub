/**
 * Server-only data access for the platform.
 *
 * Backed by Supabase Postgres through the typed repository in `src/server/db/repo/*`
 * (HTTP PostgREST with the publishable key — no TCP driver, works on edge runtimes).
 * Every lookup is now async; service code awaits these functions.
 *
 * The demo seed is written through the app's own client (Supabase Auth sign-ups +
 * repository inserts), so it lands in the database exactly like real data would.
 * IMPORTANT: no password hashes are ever exposed outside this module's auth sibling.
 */
import type { CargoBox } from "@/domain/loading";
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
import { CURRENCY_CODE, formatMoney } from "@/lib/money";
import { dbAsync } from "@/server/db/client";
import * as repoUsers from "@/server/db/repo/users";
import * as repoCatalog from "@/server/db/repo/catalog";
import * as repoBookings from "@/server/db/repo/bookings";
import * as repoPlatform from "@/server/db/repo/platform";
import type { UserRow } from "@/server/db/repo/users";

export type { UserRow };

// ---------------- ids & misc ----------------

export function newId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const suffix = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}-${suffix}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function escrowAmountFor(container: Container, requestedM3: number): number {
  return Math.round(container.pricePerM3 * requestedM3 * 100) / 100;
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    role: row.role,
    createdAt: row.createdAt,
  };
}

// ---------------- lookups (async, repo-backed) ----------------

export const findUserByEmail = repoUsers.findUserByEmail;
export const findUserById = repoUsers.findUserById;
export const listAllUsers = repoUsers.listAllUsers;

export function findUserByAuthId(authUserId: string): Promise<UserRow | undefined> {
  return repoUsers.findUserByAuthId(authUserId);
}

export const findLaneById = repoCatalog.findLaneById;
export const listAllLanes = repoCatalog.listAllLanes;
export const findContainerById = repoCatalog.findContainerById;
export const listAllContainers = repoCatalog.listAllContainers;

export const findBookingById = repoBookings.findBookingById;
export const listAllBookings = repoBookings.listAllBookings;
export const findCargoBoxById = repoBookings.findCargoBoxById;
export const listCargoBoxesForBooking = repoBookings.listCargoBoxesForBooking;

export const findPaymentByBooking = repoPlatform.findPaymentByBooking;
export const listAllPayments = repoPlatform.listAllPayments;
export const findThreadById = repoPlatform.findThreadById;
export const findThreadByBooking = repoPlatform.findThreadByBooking;
export const listAllThreads = repoPlatform.listAllThreads;
export const listMessagesForThreads = repoPlatform.listMessagesForThreads;
export const listAllVerifications = repoPlatform.listAllVerifications;
export const findVerificationByProvider = repoPlatform.findVerificationByProvider;
export const listRecentAudit = repoPlatform.listRecentAudit;

export async function cargoForBooking(bookingId: string): Promise<CargoBox[]> {
  return repoBookings.listCargoBoxesForBooking(bookingId);
}

// ---------------- writes used by services ----------------

export async function recordAudit(
  actor: { id: string; name: string },
  action: string,
  target: string,
): Promise<void> {
  await repoPlatform.insertAudit({
    id: newId("aud"),
    actorId: actor.id,
    actorName: actor.name,
    action,
    target,
    at: nowIso(),
  });
}

export async function notify(
  userId: string,
  kind: Notification["kind"],
  title: string,
  body: string,
  link: string | null,
): Promise<Notification> {
  return repoPlatform.insertNotification({
    id: newId("ntf"),
    userId,
    kind,
    title,
    body,
    link,
    createdAt: nowIso(),
  });
}

// ---------------- seed ----------------

let seedPromise: Promise<void> | undefined;

/** Dev-only file log: the Vite server's stdout is not visible here, but server
 * flows must be diagnosable. Best-effort, never throws, ignored on edge runtimes. */
export async function devLog(message: string): Promise<void> {
  try {
    const proc = (globalThis as { process?: { cwd?: () => string } }).process;
    if (!proc?.cwd) return;
    const path = await import(/* @vite-ignore */ "node:path");
    const fs = await import(/* @vite-ignore */ "node:fs/promises");
    await fs.appendFile(
      path.join(proc.cwd(), ".seed-debug.log"),
      `${new Date().toISOString()} ${message}\n`,
      "utf8",
    );
  } catch {
    // Logging is best-effort.
  }
}

/**
 * Seeds demo data once, into the database, so every module has something to show.
 * Safe to call from any service entry point; concurrent callers share one run.
 */
export function ensureSeeded(): Promise<void> {
  seedPromise ??= seed().catch(async (error) => {
    await devLog(
      `seed FAILED: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
    );
    throw error;
  });
  return seedPromise;
}

export const DEMO_PASSWORD = "demo1234";

type DemoUser = {
  id: string;
  authUserId: string | null;
  name: string;
  email: string;
  company: string;
  role: UserRole;
};

/**
 * GoTrue's Admin API — the only seeding path that produces auth users GoTrue itself
 * will authenticate. Requires SUPABASE_SERVICE_ROLE_KEY (env or .env); returns null
 * when absent, so the seed degrades to the SQL RPC fallback on edge/dev setups.
 */
async function adminAuth(): Promise<{ url: string; key: string } | null> {
  try {
    const proc = (
      globalThis as {
        process?: { env?: Record<string, string | undefined>; cwd?: () => string };
      }
    ).process;
    let url = proc?.env?.["SUPABASE_URL"]?.trim();
    let key = proc?.env?.["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
    if ((!url || !key) && proc?.cwd) {
      const path = await import(/* @vite-ignore */ "node:path");
      const fs = await import(/* @vite-ignore */ "node:fs");
      const text = fs.readFileSync(path.join(proc.cwd(), ".env"), "utf8");
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq <= 0) continue;
        const name = t.slice(0, eq).trim();
        const value = t.slice(eq + 1).trim();
        if (name === "SUPABASE_URL" && !url) url = value;
        if (name === "SUPABASE_SERVICE_ROLE_KEY" && !key) key = value;
      }
    }
    return url && key ? { url, key } : null;
  } catch {
    return null;
  }
}

/** Create a pre-confirmed, GoTrue-native auth user. Null if no service key or on error. */
async function adminCreateDemoUser(spec: {
  name: string;
  email: string;
  company: string;
  role: UserRole;
}): Promise<string | null> {
  const auth = await adminAuth();
  if (!auth) return null;
  try {
    const res = await fetch(`${auth.url}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: auth.key,
        Authorization: `Bearer ${auth.key}`,
      },
      body: JSON.stringify({
        email: normalizeEmail(spec.email),
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { name: spec.name, company: spec.company, role: spec.role },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      await devLog(`admin createUser ${spec.email}: HTTP ${res.status} ${body}`.slice(0, 300));
      return null;
    }
    const body = (await res.json()) as { id?: string };
    return body.id ?? null;
  } catch (error) {
    await devLog(
      `admin createUser threw: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Service-key path: drop any existing auth user for this profile and create a fresh
 * GoTrue-native one (the SQL-inserted users GoTrue will not authenticate are replaced).
 */
export async function adminReplaceDemoAuthUser(row: {
  id: string;
  authUserId: string | null;
  name: string;
  email: string;
  company: string;
  role: UserRole;
}): Promise<string | null> {
  const auth = await adminAuth();
  if (!auth) return null;
  if (row.authUserId) {
    try {
      const res = await fetch(`${auth.url}/auth/v1/admin/users/${row.authUserId}`, {
        method: "DELETE",
        headers: { apikey: auth.key, Authorization: `Bearer ${auth.key}` },
      });
      if (!res.ok && res.status !== 404) {
        await devLog(`admin delete ${row.email}: HTTP ${res.status}`);
      }
    } catch {
      // Best effort — recreate below regardless.
    }
  }
  return adminCreateDemoUser(row);
}

/** Create (or link) a demo account in Supabase Auth, then ensure its profile row. */
async function ensureDemoUser(spec: {
  name: string;
  email: string;
  company: string;
  role: UserRole;
}): Promise<DemoUser> {
  const email = normalizeEmail(spec.email);
  // Fast path: an already-linked account makes repeat seed runs a no-op.
  const already = await repoUsers.findUserByEmail(email);
  if (already?.authUserId) {
    return {
      id: already.id,
      authUserId: already.authUserId,
      name: already.name,
      email: already.email,
      company: already.company,
      role: already.role,
    };
  }
  const metadata = { name: spec.name, company: spec.company, role: spec.role };

  // Preferred: GoTrue's Admin API (service key) — native, login-ready, no email sent.
  // Null without the key, which falls through to the RPC / sign-up chain below.
  let authUserId: string | null = await adminCreateDemoUser(spec);
  // Fallback: the seed_demo_user RPC creates a pre-confirmed auth user directly
  // in auth.users — no confirmation email, no free-tier email rate limits.
  try {
    const { data, error } = await (
      await dbAsync()
    ).rpc("seed_demo_user", {
      p_email: email,
      p_password: DEMO_PASSWORD,
      p_name: spec.name,
      p_company: spec.company,
      p_role: spec.role,
    });
    if (!error && typeof data === "string" && data.length > 0) authUserId = data;
  } catch {
    // RPC missing — fall back to the normal GoTrue sign-up below.
  }

  if (!authUserId) {
    try {
      const { data, error } = await (
        await dbAsync()
      ).auth.signUp({
        email,
        password: DEMO_PASSWORD,
        options: { data: metadata },
      });
      if (error) throw error;
      authUserId = data.user?.id ?? null;
    } catch {
      // Already registered (or email rate-limited) — recover the id by signing in.
      try {
        const { data, error } = await (
          await dbAsync()
        ).auth.signInWithPassword({
          email,
          password: DEMO_PASSWORD,
        });
        if (!error) authUserId = data.user?.id ?? null;
      } catch {
        // Leave unlinked; login can still match the profile by email.
      }
    }
  }

  const existing = await repoUsers.findUserByEmail(email);
  if (existing) {
    if (authUserId && !existing.authUserId) {
      await repoUsers.linkAuthUser(existing.id, authUserId);
    }
    return { ...existing, authUserId: authUserId ?? existing.authUserId };
  }

  const created = await repoUsers.insertUser({
    id: newId("usr"),
    email,
    name: spec.name,
    company: spec.company,
    role: spec.role,
    createdAt: nowIso(),
    authUserId,
  });
  return {
    id: created.id,
    authUserId: authUserId ?? null,
    name: created.name,
    email: created.email,
    company: created.company,
    role: created.role,
  };
}

async function seed(): Promise<void> {
  const existingUsers = await repoUsers.listAllUsers().catch((error) => {
    void devLog(`listAllUsers threw: ${error instanceof Error ? error.message : String(error)}`);
    return [] as UserRow[];
  });
  const existingLanes = await repoCatalog.listAllLanes().catch((error) => {
    void devLog(`listAllLanes threw: ${error instanceof Error ? error.message : String(error)}`);
    return [] as Lane[];
  });
  await devLog(
    `seed: start, users=${existingUsers.length} (unlinked=${existingUsers.filter((row) => !row.authUserId).length}), lanes=${existingLanes.length}`,
  );

  const trader = await ensureDemoUser({
    name: "Priya Raman",
    email: "trader@trh.demo",
    company: "Kaveri Textiles",
    role: "trader",
  });
  await devLog(`seed: trader done (auth=${trader.authUserId ?? "none"})`);
  const trader2 = await ensureDemoUser({
    name: "Daniel Okafor",
    email: "shipper@trh.demo",
    company: "Lagos Agri Exports",
    role: "trader",
  });
  const provider = await ensureDemoUser({
    name: "Marco Silva",
    email: "provider@trh.demo",
    company: "Silva Freight Lines",
    role: "provider",
  });
  const provider2 = await ensureDemoUser({
    name: "Aisha Khan",
    email: "carrier@trh.demo",
    company: "Gulf Rail Cargo",
    role: "provider",
  });
  const admin = await ensureDemoUser({
    name: "Elena Novak",
    email: "admin@trh.demo",
    company: "Transit Route Hub",
    role: "admin",
  });

  // Static demo data is gated separately so a crash mid-seed heals on retry.
  if (existingLanes.length > 0) {
    await devLog(`seed: static data exists (lanes=${existingLanes.length}) — nothing to add`);
    return;
  }

  const createdAt = nowIso();
  const addDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

  const laneSpecs = [
    {
      providerId: provider.id,
      origin: "Mumbai, IN",
      destination: "Rotterdam, NL",
      mode: "sea" as const,
      scheduledAt: addDays(6),
    },
    {
      providerId: provider.id,
      origin: "Pune, IN",
      destination: "Chennai, IN",
      mode: "road" as const,
      scheduledAt: addDays(3),
    },
    {
      providerId: provider2.id,
      origin: "Dubai, AE",
      destination: "Riyadh, SA",
      mode: "rail" as const,
      scheduledAt: addDays(2),
    },
    {
      providerId: provider2.id,
      origin: "Singapore, SG",
      destination: "Sydney, AU",
      mode: "air" as const,
      scheduledAt: addDays(9),
    },
    {
      providerId: provider.id,
      origin: "Rotterdam, NL",
      destination: "Hamburg, DE",
      mode: "rail" as const,
      scheduledAt: addDays(11),
    },
  ];
  const laneList: Lane[] = [];
  for (const spec of laneSpecs) {
    laneList.push(await repoCatalog.insertLane({ id: newId("ln"), createdAt, ...spec }));
  }

  const containerSpecs = [
    { lane: laneList[0]!, label: "MSKU-4412", capacity: 67.0, available: 18.5, price: 145 },
    { lane: laneList[0]!, label: "MSKU-7731", capacity: 67.0, available: 67.0, price: 132 },
    { lane: laneList[1]!, label: "TRK-2201", capacity: 32.0, available: 6.0, price: 88 },
    { lane: laneList[2]!, label: "GRC-8890", capacity: 76.0, available: 42.0, price: 96 },
    { lane: laneList[3]!, label: "SIA-1150", capacity: 18.0, available: 4.5, price: 410 },
    { lane: laneList[4]!, label: "NWX-3302", capacity: 54.0, available: 54.0, price: 74 },
  ];
  const containerList: Container[] = [];
  for (const spec of containerSpecs) {
    containerList.push(
      await repoCatalog.insertContainer({
        id: newId("ctr"),
        providerId: spec.lane.providerId,
        laneId: spec.lane.id,
        label: spec.label,
        capacityM3: spec.capacity,
        availableM3: spec.available,
        pricePerM3: spec.price,
        status: "available",
        createdAt,
      }),
    );
  }

  // Two booked shipments with escrow and conversation threads.
  const bookShipment = async (
    container: Container,
    traderId: string,
    requestedM3: number,
    status: Booking["status"],
  ): Promise<void> => {
    const stamp = addDays(-3);
    const booking = await repoBookings.insertBooking({
      id: newId("bk"),
      userId: traderId,
      providerId: container.providerId,
      containerId: container.id,
      requestedM3,
      status,
      createdAt: stamp,
      updatedAt: stamp,
    });
    const nextAvailable = Math.max(0, container.availableM3 - requestedM3);
    await repoCatalog.updateContainerFields(container.id, {
      availableM3: nextAvailable,
      status: nextAvailable > 0 ? "available" : "inactive",
    });
    const payment = await repoPlatform.insertPayment({
      id: newId("pay"),
      bookingId: booking.id,
      traderId,
      providerId: container.providerId,
      amount: escrowAmountFor(container, requestedM3),
      currency: CURRENCY_CODE,
      status: status === "confirmed" || status === "in_transit" ? "funded" : "unfunded",
      createdAt: stamp,
      updatedAt: stamp,
    });
    const thread = await repoPlatform.insertThread({
      id: newId("thr"),
      bookingId: booking.id,
      traderId,
      providerId: container.providerId,
      createdAt: stamp,
    });
    const providerUser = await repoUsers.findUserById(container.providerId);
    await repoPlatform.insertMessage({
      id: newId("msg"),
      threadId: thread.id,
      senderId: providerUser?.id ?? container.providerId,
      senderName: providerUser?.name ?? "Provider",
      body: `${container.label} is confirmed on this route. Loading gate opens 6 hours before departure.`,
      createdAt: stamp,
    });
    await notify(
      traderId,
      "payment",
      "Escrow funded",
      `${formatMoney(payment.amount)} is held in escrow until delivery is confirmed.`,
      "/payments",
    );
  };

  await bookShipment(containerList[0]!, trader.id, 12, "confirmed");
  await bookShipment(containerList[3]!, trader2.id, 20, "in_transit");

  await repoPlatform.insertVerification({
    id: newId("vrf"),
    providerId: provider.id,
    legalName: "Silva Freight Lines BV",
    registrationNo: "NL-88213004",
    taxId: "NL-VAT-2210983",
    contactEmail: "ops@silvafreight.example",
    contactPhone: "+31 10 555 0198",
    fleetSize: 42,
    documentRefs: "chamber-of-commerce.pdf, insurance-2026.pdf",
    status: "pending",
    submittedAt: addDays(-4),
    reviewedAt: null,
    reviewerId: null,
    reviewNote: "",
  });

  await notify(
    admin.id,
    "verification",
    "Verification awaiting review",
    "Silva Freight Lines BV submitted provider verification 4 days ago.",
    "/admin",
  );
  await notify(
    provider.id,
    "booking",
    "New booking confirmed",
    "12 m³ booked on Mumbai, IN → Rotterdam, NL.",
    "/bookings",
  );

  await recordAudit({ id: admin.id, name: admin.name }, "seed.demo-data", "platform");
  await devLog("seed: complete");
}
