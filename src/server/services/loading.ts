/**
 * 3D container loading service.
 *
 * Traders (and the provider on the booking) can build the cargo list for a shipment,
 * let the solver load it, then nudge individual packages by hand. Every placement is
 * validated server-side, so a stale client cannot stack two boxes in the same space.
 * Each change notifies the other side of the booking, so a provider sees the moment a
 * trader starts placing cargo without polling the planner.
 *
 * Backed by Supabase Postgres (async repository) — see src/server/db/repo/*.
 */

import {
  checkPlacement,
  computeLoadStats,
  findDropSlot,
  generateCargoFromVolume,
  packBoxes,
  specForContainer,
} from "@/domain/loading";
import type { CargoBox, ContainerSpec, LoadStats, Placement } from "@/domain/loading";
import { CODE, failure, success } from "@/domain/results";
import type { Result } from "@/domain/results";
import type { Booking, BookingStatus, Container, Lane, RouteMode } from "@/domain/types";
import { requireAuthUser } from "@/server/services/auth";
import * as repoBookings from "@/server/db/repo/bookings";
import {
  cargoForBooking,
  ensureSeeded,
  findBookingById,
  findCargoBoxById,
  findContainerById,
  findLaneById,
  findUserById,
  newId,
  nowIso,
  notify,
  recordAudit,
} from "@/server/store";

export type LoadPlan = {
  bookingId: string;
  bookingStatus: BookingStatus;
  containerLabel: string;
  containerKind: string;
  laneLabel: string;
  mode: RouteMode;
  providerName: string;
  traderName: string;
  spec: ContainerSpec;
  bookedM3: number;
  boxes: CargoBox[];
  stats: LoadStats;
  /** Platform metric: how much of the booked volume is physically loaded. */
  lastPackedAt: string | null;
};

type Resolved = {
  booking: Booking;
  container: Container;
  lane: Lane;
  spec: ContainerSpec;
};

async function resolve(bookingId: string): Promise<Resolved | null> {
  const booking = await findBookingById(bookingId);
  if (!booking) return null;
  const container = await findContainerById(booking.containerId);
  if (!container) return null;
  const lane = await findLaneById(container.laneId);
  if (!lane) return null;
  return { booking, container, lane, spec: specForContainer(lane.mode, container.capacityM3) };
}

function canAccess(
  user: { id: string; role: "trader" | "provider" | "admin" },
  booking: Booking,
): boolean {
  return user.role === "admin" || booking.userId === user.id || booking.providerId === user.id;
}

async function buildPlan(resolved: Resolved): Promise<LoadPlan> {
  const { booking, container, lane, spec } = resolved;
  const [boxes, providerUser, traderUser] = await Promise.all([
    cargoForBooking(booking.id),
    findUserById(booking.providerId),
    findUserById(booking.userId),
  ]);
  const copied = boxes.map((box) => ({
    ...box,
    placement: box.placement ? { ...box.placement } : null,
  }));
  const stats = computeLoadStats(spec, copied, booking.requestedM3);
  return {
    bookingId: booking.id,
    bookingStatus: booking.status,
    containerLabel: container.label,
    containerKind: spec.name,
    laneLabel: `${lane.origin} → ${lane.destination}`,
    mode: lane.mode,
    providerName: providerUser?.name ?? "Provider",
    traderName: traderUser?.name ?? "Trader",
    spec,
    bookedM3: booking.requestedM3,
    boxes: copied,
    stats,
    lastPackedAt: copied.some((box) => box.placement) ? booking.updatedAt : null,
  };
}

/**
 * First visit to a booking generates stand-in pallets from the booked volume, so the
 * load plan is never an empty box. Replaced as soon as real dimensions are entered.
 */
async function ensureCargo(resolved: Resolved): Promise<void> {
  const existing = await cargoForBooking(resolved.booking.id);
  if (existing.length > 0) return;
  const generated = generateCargoFromVolume(
    resolved.booking.id,
    resolved.booking.requestedM3,
    resolved.spec,
    () => newId("pkg"),
  );
  const placements = packBoxes(resolved.spec, generated);
  for (const box of generated) {
    box.placement = placements.get(box.id) ?? null;
  }
  for (const box of generated) {
    await repoBookings.insertCargoBox(box);
  }
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function sanitizePlacement(spec: ContainerSpec, placement: Placement): Placement {
  return {
    xCm: clampInt(placement.xCm, 0, spec.lengthCm),
    yCm: clampInt(placement.yCm, 0, spec.heightCm),
    zCm: clampInt(placement.zCm, 0, spec.widthCm),
    rotated: Boolean(placement.rotated),
  };
}

// ---------------- counterparty notification ----------------

// A drag fires one request per gesture; coalesce them so a trader arranging a load
// does not bury the provider in a notification per nudge. Best effort by design: a
// restart or a second instance can only mean one extra notification, never a missed
// change, because the load plan itself always carries the latest placements.
const DEFAULT_NOTICE_COOLDOWN_MS = 2 * 60_000;
const lastPlanNoticeAt = new Map<string, number>();

/** Overridable for verification runs that need every change announced. */
function noticeCooldownMs(): number {
  const raw = process.env["LOAD_PLAN_NOTICE_COOLDOWN_MS"];
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_NOTICE_COOLDOWN_MS;
}

/**
 * Tells the other side of the booking that the 3D plan changed. Cargo a trader places
 * is exactly what the provider has to load, so every change reaches the provider; a
 * provider's own adjustment reaches the trader back. The actor never hears about
 * their own edit, and admins notify both parties.
 */
async function announcePlanChange(
  user: { id: string; name: string; role: "trader" | "provider" | "admin" },
  resolved: Resolved,
  summary: string,
  coalesce = false,
): Promise<void> {
  const { booking } = resolved;
  const recipients = [...new Set([booking.userId, booking.providerId])].filter(
    (id) => id !== user.id,
  );
  if (recipients.length === 0) return;
  const now = Date.now();
  if (coalesce) {
    const last = lastPlanNoticeAt.get(booking.id) ?? 0;
    if (now - last < noticeCooldownMs()) return;
  }
  lastPlanNoticeAt.set(booking.id, now);
  const link = `/loading?booking=${booking.id}`;
  for (const recipientId of recipients) {
    await notify(
      recipientId,
      "booking",
      "3D load plan updated",
      `${user.name} ${summary}. Open the load planner to see the current placements.`,
      link,
    );
  }
}

/** Placement edits are booking activity, so "last packed" reflects reality. */
async function touchBooking(resolved: Resolved): Promise<void> {
  const stamp = nowIso();
  await repoBookings.updateBookingFields(resolved.booking.id, { updatedAt: stamp });
  resolved.booking = { ...resolved.booking, updatedAt: stamp };
}

// ---------------- read ----------------

export async function getLoadPlan(token: string, bookingId: string): Promise<Result<LoadPlan>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to open a load plan.");
  const resolved = await resolve(bookingId);
  if (!resolved) return failure(CODE.NOT_FOUND, "Booking not found.");
  if (!canAccess(user, resolved.booking)) {
    return failure(CODE.FORBIDDEN, "That booking is not yours.");
  }
  await ensureCargo(resolved);
  return success(await buildPlan(resolved));
}

// ---------------- write ----------------

export type CargoInput = {
  label: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
  fragile: boolean;
};

function validateDimensions(spec: ContainerSpec, input: CargoInput): string | null {
  if (input.lengthCm <= 0 || input.widthCm <= 0 || input.heightCm <= 0) {
    return "Every dimension must be greater than zero.";
  }
  if (input.lengthCm > spec.lengthCm || input.widthCm > spec.widthCm) {
    return `That footprint does not fit through the ${spec.name} opening.`;
  }
  if (input.heightCm > spec.heightCm) {
    return `The package is taller than the ${spec.heightCm} cm interior.`;
  }
  if (input.weightKg < 0) return "Weight cannot be negative.";
  return null;
}

export async function addCargoBox(
  token: string,
  bookingId: string,
  input: CargoInput,
): Promise<Result<LoadPlan>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to edit this load plan.");
  const resolved = await resolve(bookingId);
  if (!resolved) return failure(CODE.NOT_FOUND, "Booking not found.");
  if (!canAccess(user, resolved.booking)) {
    return failure(CODE.FORBIDDEN, "That booking is not yours.");
  }
  if (input.lengthCm > 100_000 || input.widthCm > 100_000 || input.heightCm > 100_000) {
    return failure(CODE.INVALID_INPUT, "Those dimensions are out of range.");
  }
  const dimensionError = validateDimensions(resolved.spec, input);
  if (dimensionError) return failure(CODE.INVALID_INPUT, dimensionError);

  await ensureCargo(resolved);

  const existing = await cargoForBooking(bookingId);
  const box: CargoBox = {
    id: newId("pkg"),
    bookingId,
    label: input.label.trim() || "Package",
    lengthCm: Math.round(input.lengthCm),
    widthCm: Math.round(input.widthCm),
    heightCm: Math.round(input.heightCm),
    weightKg: Math.round(input.weightKg),
    fragile: input.fragile,
    hue: existing.length % 6,
    placement: null,
  };

  box.placement = findDropSlot(resolved.spec, existing, box);
  await repoBookings.insertCargoBox(box);
  await recordAudit(user, "loading.add-cargo", `${resolved.container.label} · ${box.label}`);
  await touchBooking(resolved);
  await announcePlanChange(
    user,
    resolved,
    `added ${box.label} to the load plan for booking ${bookingId}`,
  );
  return success(await buildPlan(resolved));
}

export async function updateCargoBox(
  token: string,
  boxId: string,
  input: CargoInput,
): Promise<Result<LoadPlan>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to edit this load plan.");
  const box = await findCargoBoxById(boxId);
  if (!box) return failure(CODE.NOT_FOUND, "Package not found.");
  const resolved = await resolve(box.bookingId);
  if (!resolved) return failure(CODE.NOT_FOUND, "Booking not found.");
  if (!canAccess(user, resolved.booking)) {
    return failure(CODE.FORBIDDEN, "That booking is not yours.");
  }
  const dimensionError = validateDimensions(resolved.spec, input);
  if (dimensionError) return failure(CODE.INVALID_INPUT, dimensionError);

  const resized =
    box.lengthCm !== Math.round(input.lengthCm) ||
    box.widthCm !== Math.round(input.widthCm) ||
    box.heightCm !== Math.round(input.heightCm);

  const next: CargoBox = {
    ...box,
    label: input.label.trim() || box.label,
    lengthCm: Math.round(input.lengthCm),
    widthCm: Math.round(input.widthCm),
    heightCm: Math.round(input.heightCm),
    weightKg: Math.round(input.weightKg),
    fragile: input.fragile,
    placement: box.placement ? { ...box.placement } : null,
  };

  if (resized) {
    // New dimensions may no longer fit where the old ones did.
    next.placement = null;
    const others = (await cargoForBooking(box.bookingId)).filter((row) => row.id !== box.id);
    next.placement = findDropSlot(resolved.spec, others, next);
  }

  await repoBookings.updateCargoBoxFields(box.id, {
    label: next.label,
    lengthCm: next.lengthCm,
    widthCm: next.widthCm,
    heightCm: next.heightCm,
    weightKg: next.weightKg,
    fragile: next.fragile,
    placement: next.placement,
  });
  await recordAudit(user, "loading.update-cargo", `${resolved.container.label} · ${next.label}`);
  await touchBooking(resolved);
  await announcePlanChange(user, resolved, `updated ${next.label} in the load plan`);
  return success(await buildPlan(resolved));
}

export async function removeCargoBox(token: string, boxId: string): Promise<Result<LoadPlan>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to edit this load plan.");
  const box = await findCargoBoxById(boxId);
  if (!box) return failure(CODE.NOT_FOUND, "Package not found.");
  const resolved = await resolve(box.bookingId);
  if (!resolved) return failure(CODE.NOT_FOUND, "Booking not found.");
  if (!canAccess(user, resolved.booking)) {
    return failure(CODE.FORBIDDEN, "That booking is not yours.");
  }
  await repoBookings.deleteCargoBox(boxId);
  await recordAudit(user, "loading.remove-cargo", `${resolved.container.label} · ${box.label}`);
  await touchBooking(resolved);
  await announcePlanChange(user, resolved, `removed ${box.label} from the load plan`);
  return success(await buildPlan(resolved));
}

/**
 * Manual placement. Rejects moves that leave the equipment or intersect other cargo,
 * which is what keeps the drag interaction honest when the client view is stale.
 * When the target intersects other cargo, the first clear height above it is used so
 * the package rests on top of whatever is in the way (stacking stays reachable).
 */
export async function moveCargoBox(
  token: string,
  boxId: string,
  placement: Placement,
): Promise<Result<LoadPlan>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to edit this load plan.");
  const box = await findCargoBoxById(boxId);
  if (!box) return failure(CODE.NOT_FOUND, "Package not found.");
  const resolved = await resolve(box.bookingId);
  if (!resolved) return failure(CODE.NOT_FOUND, "Booking not found.");
  if (!canAccess(user, resolved.booking)) {
    return failure(CODE.FORBIDDEN, "That booking is not yours.");
  }

  const next = sanitizePlacement(resolved.spec, placement);
  const others = await cargoForBooking(box.bookingId);
  const check = checkPlacement(resolved.spec, others, boxId, next);
  if (!check.ok) {
    // Lift onto the first clear height (or fail with the server's precise reason).
    const clearY = firstClearY(resolved.spec, others, boxId, next);
    if (clearY === null) return failure(CODE.PLACEMENT_INVALID, check.reason);
    next.yCm = clearY;
  }

  await repoBookings.updateCargoBoxPlacement(box.id, next);
  await touchBooking(resolved);
  await announcePlanChange(
    user,
    resolved,
    `moved ${box.label} inside ${resolved.container.label}`,
    true,
  );
  return success(await buildPlan(resolved));
}

/** First clear height at/above the requested placement, or null when none fits. */
function firstClearY(
  spec: ContainerSpec,
  boxes: readonly CargoBox[],
  boxId: string,
  placement: Placement,
): number | null {
  const box = boxes.find((row) => row.id === boxId);
  if (!box) return null;
  const start = Math.max(0, Math.ceil(placement.yCm));
  const ceiling = spec.heightCm - box.heightCm;
  for (let y = start; y <= ceiling; y += 1) {
    if (checkPlacement(spec, boxes, boxId, { ...placement, yCm: y }).ok) return y;
  }
  return null;
}

export async function autoPackBooking(token: string, bookingId: string): Promise<Result<LoadPlan>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to edit this load plan.");
  const resolved = await resolve(bookingId);
  if (!resolved) return failure(CODE.NOT_FOUND, "Booking not found.");
  if (!canAccess(user, resolved.booking)) {
    return failure(CODE.FORBIDDEN, "That booking is not yours.");
  }
  await ensureCargo(resolved);
  const boxes = await cargoForBooking(bookingId);
  const placements = packBoxes(resolved.spec, boxes);
  for (const box of boxes) {
    const placement = placements.get(box.id) ?? null;
    await repoBookings.updateCargoBoxPlacement(box.id, placement);
  }
  await recordAudit(
    user,
    "loading.auto-pack",
    `${resolved.container.label} (${boxes.length} packages)`,
  );
  await touchBooking(resolved);
  await announcePlanChange(
    user,
    resolved,
    `auto-packed ${boxes.length} packages into ${resolved.container.label}`,
  );
  return success(await buildPlan(resolved));
}

/** Throws the plan away and rebuilds stand-in pallets from the booked volume. */
export async function resetLoadPlan(token: string, bookingId: string): Promise<Result<LoadPlan>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to edit this load plan.");
  const resolved = await resolve(bookingId);
  if (!resolved) return failure(CODE.NOT_FOUND, "Booking not found.");
  if (!canAccess(user, resolved.booking)) {
    return failure(CODE.FORBIDDEN, "That booking is not yours.");
  }
  await repoBookings.deleteCargoBoxesForBooking(bookingId);
  await ensureCargo(resolved);
  await recordAudit(user, "loading.reset", resolved.container.label);
  await touchBooking(resolved);
  await announcePlanChange(user, resolved, `reset the load plan for ${resolved.container.label}`);
  return success(await buildPlan(resolved));
}
