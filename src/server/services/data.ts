/**
 * Server-authoritative catalog, capacity and booking services.
 * Every mutation re-checks the caller's role and ownership; the client is never trusted.
 *
 * Backed by Supabase Postgres (async repository) — see src/server/db/repo/*.
 */

import { CODE, failure, success } from "@/domain/results";
import type { Result } from "@/domain/results";
import type {
  Booking,
  BookingStatus,
  BookingView,
  CapacitySummary,
  Container,
  ContainerStatus,
  Lane,
  RouteMode,
  SpaceListing,
} from "@/domain/types";
import { requireAuthUser } from "@/server/services/auth";
import { signedCargoPhotoUrls } from "@/server/services/storage";
import * as repoCatalog from "@/server/db/repo/catalog";
import * as repoBookings from "@/server/db/repo/bookings";
import * as repoPlatform from "@/server/db/repo/platform";
import * as repoUsers from "@/server/db/repo/users";
import {
  ensureSeeded,
  escrowAmountFor,
  findBookingById,
  findContainerById,
  findLaneById,
  findUserById,
  findVerificationByProvider,
  newId,
  notify,
  nowIso,
  recordAudit,
} from "@/server/store";

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// ---------------- helpers ----------------

function providerName(provider: { name: string } | undefined): string {
  return provider?.name ?? "Unknown provider";
}

async function providerIsVerified(providerId: string): Promise<boolean> {
  const record = await findVerificationByProvider(providerId);
  return record?.status === "approved";
}

async function toView(booking: Booking): Promise<BookingView | null> {
  const container = await findContainerById(booking.containerId);
  const lane = container ? await findLaneById(container.laneId) : undefined;
  if (!container || !lane) return null;
  const [trader, payment, provider, reviewer] = await Promise.all([
    findUserById(booking.userId),
    repoPlatform.findPaymentByBooking(booking.id),
    findUserById(booking.providerId),
    booking.reviewerId ? findUserById(booking.reviewerId) : Promise.resolve(undefined),
  ]);
  return {
    booking,
    container,
    lane,
    providerName: providerName(provider),
    traderName: trader?.name ?? "Unknown trader",
    paymentStatus: payment?.status ?? "unfunded",
    amount: payment?.amount ?? escrowAmountFor(container, booking.requestedM3),
    cargoPhotoUrl: null,
    reviewerName: reviewer?.name ?? null,
  };
}

function recomputeContainerStatus(container: Container): ContainerStatus | undefined {
  if (container.status === "inactive") return undefined;
  return container.availableM3 > 0 ? "available" : "booked";
}

async function viewsFor(token: string, rows: Booking[]): Promise<BookingView[]> {
  const views = await Promise.all(rows.map(toView));
  const sorted = views
    .filter((view): view is BookingView => view !== null)
    .sort((a, b) => b.booking.createdAt.localeCompare(a.booking.createdAt));
  return attachPhotoUrls(token, sorted);
}

/**
 * Mint signed URLs for every attached cargo photo in one storage call. The
 * bucket is private, so this is the only way a browser can display the image.
 * Exported for the cargo-photo service, which builds single views after a write.
 */
export async function attachPhotoUrls(token: string, views: BookingView[]): Promise<BookingView[]> {
  const paths = views
    .map((view) => view.booking.cargoPhotoPath)
    .filter((path): path is string => Boolean(path));
  if (paths.length === 0) return views;
  const urls = await signedCargoPhotoUrls(token, paths);
  return views.map((view) => {
    const path = view.booking.cargoPhotoPath;
    return path ? { ...view, cargoPhotoUrl: urls.get(path) ?? null } : view;
  });
}

/** Public wrapper so other services can build the same read model. */
export async function bookingViews(token: string, rows: Booking[]): Promise<BookingView[]> {
  return viewsFor(token, rows);
}

// ---------------- lanes ----------------

export async function listLanes(): Promise<Result<Lane[]>> {
  await ensureSeeded();
  const lanes = await repoCatalog.listAllLanes();
  return success(
    lanes
      .slice()
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .map((lane) => ({ ...lane })),
  );
}

export async function listMyLanes(token: string): Promise<Result<Lane[]>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to manage routes.");
  if (user.role === "trader") return failure(CODE.FORBIDDEN, "Traders cannot manage routes.");
  const lanes = await repoCatalog.listAllLanes();
  return success(
    lanes
      .filter((lane) => user.role === "admin" || lane.providerId === user.id)
      .map((lane) => ({ ...lane })),
  );
}

export async function createLane(
  token: string,
  input: { origin: string; destination: string; mode: RouteMode; scheduledAt: string },
): Promise<Result<Lane>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to add a route.");
  if (user.role === "trader") {
    return failure(CODE.FORBIDDEN, "Only providers and admins can add routes.");
  }
  const lane = await repoCatalog.insertLane({
    id: newId("ln"),
    providerId: user.id,
    origin: input.origin.trim(),
    destination: input.destination.trim(),
    mode: input.mode,
    scheduledAt: input.scheduledAt,
    createdAt: nowIso(),
  });
  await recordAudit(user, "lane.create", `${lane.origin} → ${lane.destination}`);
  return success({ ...lane });
}

// ---------------- containers ----------------

export async function listContainersForLane(laneId: string): Promise<Result<SpaceListing[]>> {
  await ensureSeeded();
  const lane = await findLaneById(laneId);
  if (!lane) return failure(CODE.NOT_FOUND, "Route not found.");
  const containers = await repoCatalog.listAllContainers();
  const scoped = containers.filter((container) => container.laneId === laneId);
  const providerIds = [...new Set(scoped.map((container) => container.providerId))];
  const providers = await Promise.all(providerIds.map((id) => findUserById(id)));
  const providerById = new Map(providerIds.map((id, index) => [id, providers[index]]));
  const verified = new Set(
    (await Promise.all(providerIds.map((id) => providerIsVerified(id))))
      .map((ok, index) => [providerIds[index], ok] as const)
      .filter(([, ok]) => ok)
      .map(([id]) => id),
  );
  return success(
    scoped.map((container) => ({
      container: { ...container },
      lane: { ...lane },
      providerName: providerName(providerById.get(container.providerId)),
      providerVerified: verified.has(container.providerId),
    })),
  );
}

export async function listMyContainers(token: string): Promise<Result<Container[]>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to manage containers.");
  if (user.role === "trader") {
    return failure(CODE.FORBIDDEN, "Only providers can manage container space.");
  }
  const containers = await repoCatalog.listAllContainers();
  return success(
    containers
      .filter((container) => user.role === "admin" || container.providerId === user.id)
      .map((container) => ({ ...container })),
  );
}

export async function createContainer(
  token: string,
  input: {
    laneId: string;
    label: string;
    capacityM3: number;
    availableM3: number;
    pricePerM3: number;
  },
): Promise<Result<Container>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to list container space.");
  if (user.role === "trader") {
    return failure(CODE.FORBIDDEN, "Only providers can list container space.");
  }
  const lane = await findLaneById(input.laneId);
  if (!lane) return failure(CODE.NOT_FOUND, "Route not found.");
  if (user.role !== "admin" && lane.providerId !== user.id) {
    return failure(CODE.FORBIDDEN, "You can only list space on your own routes.");
  }
  if (input.availableM3 > input.capacityM3) {
    return failure(CODE.INVALID_INPUT, "Available space cannot exceed total capacity.");
  }
  const container = await repoCatalog.insertContainer({
    id: newId("ctr"),
    providerId: user.id,
    laneId: input.laneId,
    label: input.label.trim().toUpperCase(),
    capacityM3: input.capacityM3,
    availableM3: input.availableM3,
    pricePerM3: input.pricePerM3,
    status: input.availableM3 > 0 ? "available" : "inactive",
    createdAt: nowIso(),
  });
  await recordAudit(user, "container.create", container.label);
  return success({ ...container });
}

export async function updateContainer(
  token: string,
  input: {
    containerId: string;
    availableM3: number;
    pricePerM3: number;
    status: ContainerStatus;
  },
): Promise<Result<Container>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to update container space.");
  const container = await findContainerById(input.containerId);
  if (!container) return failure(CODE.NOT_FOUND, "Container not found.");
  if (user.role !== "admin" && container.providerId !== user.id) {
    return failure(CODE.FORBIDDEN, "You can only edit your own containers.");
  }
  if (input.availableM3 > container.capacityM3) {
    return failure(CODE.INVALID_INPUT, "Available space cannot exceed total capacity.");
  }
  const next: Container = {
    ...container,
    availableM3: input.availableM3,
    pricePerM3: input.pricePerM3,
    status: input.status,
  };
  const computed = recomputeContainerStatus(next);
  if (computed) next.status = computed;
  const updated = await repoCatalog.updateContainerFields(input.containerId, {
    availableM3: next.availableM3,
    pricePerM3: next.pricePerM3,
    status: next.status,
  });
  await recordAudit(user, "container.update", next.label);
  return success(updated ?? next);
}

// ---------------- search ----------------

export type SearchQuery = {
  origin?: string | undefined;
  destination?: string | undefined;
  mode?: RouteMode | "any" | undefined;
  minM3?: number | undefined;
  maxPricePerM3?: number | undefined;
};

function matches(value: string, needle: string): boolean {
  return value.toLowerCase().includes(needle.trim().toLowerCase());
}

export async function searchSpace(query: SearchQuery): Promise<Result<SpaceListing[]>> {
  await ensureSeeded();
  const minM3 = query.minM3 ?? 0;
  const maxPrice = query.maxPricePerM3 ?? Number.POSITIVE_INFINITY;

  const containers = await repoCatalog.listAllContainers();
  const lanes = await repoCatalog.listAllLanes();
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]));

  const candidates = containers
    .filter((container) => container.status !== "inactive")
    .filter((container) => container.availableM3 >= minM3)
    .filter((container) => container.pricePerM3 <= maxPrice)
    .map((container): SpaceListing | null => {
      const lane = laneById.get(container.laneId);
      if (!lane) return null;
      if (query.origin?.trim() && !matches(lane.origin, query.origin)) return null;
      if (query.destination?.trim() && !matches(lane.destination, query.destination)) {
        return null;
      }
      if (query.mode && query.mode !== "any" && lane.mode !== query.mode) return null;
      return {
        container: { ...container },
        lane: { ...lane },
        providerName: "",
        providerVerified: false,
      };
    })
    .filter((listing): listing is SpaceListing => listing !== null);

  const providerIds = [...new Set(candidates.map((listing) => listing.container.providerId))];
  const providerRows = await Promise.all(providerIds.map((id) => findUserById(id)));
  const nameById = new Map(
    providerIds.map((id, index) => [id, providerRows[index]?.name ?? "Unknown provider"]),
  );
  const verifiedIds = new Set<string>();
  const verifiedResults = await Promise.all(providerIds.map((id) => providerIsVerified(id)));
  providerIds.forEach((id, index) => {
    if (verifiedResults[index]) verifiedIds.add(id);
  });

  const results = candidates.map((listing) => ({
    ...listing,
    providerName: nameById.get(listing.container.providerId) ?? "Unknown provider",
    providerVerified: verifiedIds.has(listing.container.providerId),
  }));
  results.sort((a, b) => a.container.pricePerM3 - b.container.pricePerM3);
  return success(results);
}

// ---------------- aggregation ----------------

export async function aggregateCapacity(): Promise<Result<CapacitySummary>> {
  await ensureSeeded();

  const [containers, lanes] = await Promise.all([
    repoCatalog.listAllContainers(),
    repoCatalog.listAllLanes(),
  ]);
  const active = containers.filter((container) => container.status !== "inactive");
  const laneProviderIds = [...new Set(lanes.map((lane) => lane.providerId))];
  const providerRows = await Promise.all(laneProviderIds.map((id) => findUserById(id)));
  const nameById = new Map(
    laneProviderIds.map((id, index) => [id, providerRows[index]?.name ?? "Unknown provider"]),
  );

  const aggregatedLanes = lanes
    .map((lane) => {
      const laneContainers = active.filter((container) => container.laneId === lane.id);
      const capacityM3 = round(laneContainers.reduce((sum, c) => sum + c.capacityM3, 0));
      const availableM3 = round(laneContainers.reduce((sum, c) => sum + c.availableM3, 0));
      const prices = laneContainers.map((container) => container.pricePerM3);
      return {
        lane: { ...lane },
        providerName: nameById.get(lane.providerId) ?? "Unknown provider",
        containerCount: laneContainers.length,
        capacityM3,
        availableM3,
        utilisationPct:
          capacityM3 > 0 ? round(((capacityM3 - availableM3) / capacityM3) * 100, 1) : 0,
        cheapestPricePerM3: prices.length > 0 ? Math.min(...prices) : 0,
      };
    })
    .filter((row) => row.containerCount > 0)
    .sort((a, b) => b.utilisationPct - a.utilisationPct);

  const modes: RouteMode[] = ["road", "rail", "sea", "air"];
  const byMode = modes
    .map((mode) => {
      const laneIds = new Set(lanes.filter((lane) => lane.mode === mode).map((lane) => lane.id));
      const modeContainers = active.filter((container) => laneIds.has(container.laneId));
      return {
        mode,
        containerCount: modeContainers.length,
        capacityM3: round(modeContainers.reduce((sum, c) => sum + c.capacityM3, 0)),
        availableM3: round(modeContainers.reduce((sum, c) => sum + c.availableM3, 0)),
      };
    })
    .filter((row) => row.containerCount > 0);

  const totalCapacityM3 = round(active.reduce((sum, c) => sum + c.capacityM3, 0));
  const totalAvailableM3 = round(active.reduce((sum, c) => sum + c.availableM3, 0));

  return success({
    totalCapacityM3,
    totalAvailableM3,
    utilisationPct:
      totalCapacityM3 > 0
        ? round(((totalCapacityM3 - totalAvailableM3) / totalCapacityM3) * 100, 1)
        : 0,
    laneCount: aggregatedLanes.length,
    containerCount: active.length,
    aggregatedLanes,
    byMode,
  });
}

// ---------------- bookings ----------------

export async function createBooking(
  token: string,
  input: { containerId: string; requestedM3: number },
): Promise<Result<Booking>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to book space.");
  if (user.role === "provider") {
    return failure(CODE.FORBIDDEN, "Providers cannot book their own capacity.");
  }
  const container = await findContainerById(input.containerId);
  if (!container) return failure(CODE.NOT_FOUND, "Container not found.");
  if (container.status === "inactive") {
    return failure(CODE.CONTAINER_UNAVAILABLE, "That container is no longer accepting bookings.");
  }
  if (input.requestedM3 > container.availableM3) {
    return failure(
      CODE.CAPACITY_EXCEEDED,
      `Only ${container.availableM3.toFixed(2)} m³ is still available on ${container.label}.`,
    );
  }

  const timestamp = nowIso();
  const booking = await repoBookings.insertBooking({
    id: newId("bk"),
    userId: user.id,
    providerId: container.providerId,
    containerId: container.id,
    requestedM3: input.requestedM3,
    status: "confirmed",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const nextAvailable = round(container.availableM3 - input.requestedM3);
  const nextStatus = nextAvailable > 0 ? "available" : "booked";
  await repoCatalog.updateContainerFields(container.id, {
    availableM3: nextAvailable,
    status: nextStatus,
  });

  const amount = escrowAmountFor(container, input.requestedM3);
  await repoPlatform.insertPayment({
    id: newId("pay"),
    bookingId: booking.id,
    traderId: user.id,
    providerId: container.providerId,
    amount,
    currency: "EUR",
    status: "unfunded",
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await repoPlatform.insertThread({
    id: newId("thr"),
    bookingId: booking.id,
    traderId: user.id,
    providerId: container.providerId,
    createdAt: timestamp,
  });

  await notify(
    container.providerId,
    "booking",
    "New booking confirmed",
    `${input.requestedM3} m³ booked on ${container.label}.`,
    "/bookings",
  );
  await notify(
    user.id,
    "payment",
    "Escrow ready to fund",
    `€${amount.toFixed(2)} is held once you fund escrow, released on delivery.`,
    "/payments",
  );
  await recordAudit(user, "booking.create", container.label);

  return success({ ...booking });
}

export async function myBookings(token: string): Promise<Result<BookingView[]>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to see your bookings.");
  const bookings = await repoBookings.listAllBookings();
  return success(
    await viewsFor(
      token,
      bookings.filter((booking) => booking.userId === user.id),
    ),
  );
}

export async function providerBookings(token: string): Promise<Result<BookingView[]>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to see inbound bookings.");
  if (user.role === "trader") {
    return failure(CODE.FORBIDDEN, "Only providers and admins have inbound bookings.");
  }
  const bookings = await repoBookings.listAllBookings();
  const scoped =
    user.role === "admin"
      ? bookings.slice()
      : bookings.filter((booking) => booking.providerId === user.id);
  return success(await viewsFor(token, scoped));
}

export async function allBookings(token: string): Promise<Result<BookingView[]>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in first.");
  if (user.role !== "admin") return failure(CODE.FORBIDDEN, "Administrators only.");
  return success(await viewsFor(token, await repoBookings.listAllBookings()));
}

export async function bookingDetails(
  token: string,
  bookingId: string,
): Promise<Result<BookingView>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in first.");
  const booking = await findBookingById(bookingId);
  if (!booking) return failure(CODE.NOT_FOUND, "Booking not found.");
  if (user.role !== "admin" && booking.userId !== user.id && booking.providerId !== user.id) {
    return failure(CODE.FORBIDDEN, "You can only view your own bookings.");
  }
  const view = await toView(booking);
  if (!view) return failure(CODE.NOT_FOUND, "Booking container is no longer available.");
  const [withPhoto] = await attachPhotoUrls(token, [view]);
  return success(withPhoto ?? view);
}

export async function updateBookingStatus(
  token: string,
  input: { bookingId: string; status: BookingStatus },
): Promise<Result<Booking>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in first.");
  const booking = await findBookingById(input.bookingId);
  if (!booking) return failure(CODE.NOT_FOUND, "Booking not found.");
  const isOwner = booking.userId === user.id;
  const isProvider = booking.providerId === user.id;
  if (user.role !== "admin" && !isOwner && !isProvider) {
    return failure(CODE.FORBIDDEN, "That booking is not yours.");
  }
  if (input.status === "cancelled") {
    return cancelBookingInternal(booking, user, "Cancelled from booking management.");
  }
  if (
    (input.status === "delivered" || input.status === "in_transit") &&
    !isProvider &&
    user.role !== "admin"
  ) {
    return failure(CODE.FORBIDDEN, "Only the provider can advance a shipment.");
  }
  if (booking.status === "cancelled") {
    return failure(CODE.INVALID_TRANSITION, "Cancelled bookings cannot be updated.");
  }
  const updated = await repoBookings.updateBookingFields(input.bookingId, {
    status: input.status,
    updatedAt: nowIso(),
  });
  await recordAudit(user, "booking.status", `${booking.id} → ${input.status}`);
  await notify(
    isProvider ? booking.userId : booking.providerId,
    "booking",
    "Booking updated",
    `Booking ${booking.id} is now ${input.status.replace("_", " ")}.`,
    "/bookings",
  );
  return success(updated ?? { ...booking, status: input.status });
}

export async function cancelBooking(
  token: string,
  input: { bookingId: string; reason: string },
): Promise<Result<Booking>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in first.");
  const booking = await findBookingById(input.bookingId);
  if (!booking) return failure(CODE.NOT_FOUND, "Booking not found.");
  if (user.role !== "admin" && booking.userId !== user.id && booking.providerId !== user.id) {
    return failure(CODE.FORBIDDEN, "That booking is not yours.");
  }
  return cancelBookingInternal(booking, user, input.reason);
}

async function cancelBookingInternal(
  booking: Booking,
  actor: { id: string; name: string },
  reason: string,
): Promise<Result<Booking>> {
  if (booking.status === "cancelled") {
    return failure(CODE.INVALID_TRANSITION, "That booking is already cancelled.");
  }
  if (booking.status === "delivered") {
    return failure(CODE.INVALID_TRANSITION, "Delivered shipments cannot be cancelled.");
  }
  const updated = await repoBookings.updateBookingFields(booking.id, {
    status: "cancelled",
    updatedAt: nowIso(),
  });

  // Release the reserved volume back onto the container.
  const container = await findContainerById(booking.containerId);
  if (container) {
    const available = round(
      Math.min(container.capacityM3, container.availableM3 + booking.requestedM3),
    );
    const nextStatus =
      container.status === "inactive" ? "inactive" : available > 0 ? "available" : "booked";
    await repoCatalog.updateContainerFields(container.id, {
      availableM3: available,
      status: nextStatus,
    });
  }

  const payment = await repoPlatform.findPaymentByBooking(booking.id);
  if (payment && payment.status !== "released") {
    await repoPlatform.updatePaymentFields(payment.id, {
      status: "refunded",
      updatedAt: nowIso(),
    });
  }

  await recordAudit(actor, "booking.cancel", `${booking.id}${reason ? ` — ${reason}` : ""}`);
  await notify(
    booking.userId === actor.id ? booking.providerId : booking.userId,
    "booking",
    "Booking cancelled",
    `Booking ${booking.id} was cancelled${reason ? `: ${reason}` : "."}`,
    "/bookings",
  );
  return success(updated ?? { ...booking, status: "cancelled" });
}

// ---------------- admin overview ----------------

export type DashboardMetrics = {
  users: { total: number; traders: number; providers: number; admins: number };
  lanes: number;
  containers: number;
  capacityM3: number;
  availableM3: number;
  utilisationPct: number;
  bookings: { total: number; byStatus: Record<BookingStatus, number> };
  escrowHeld: number;
  released: number;
  refunded: number;
  pendingVerifications: number;
  unreadNotifications: number;
  threads: number;
  messages: number;
};

export async function dashboardMetrics(): Promise<DashboardMetrics> {
  await ensureSeeded();
  const statuses: BookingStatus[] = [
    "pending",
    "confirmed",
    "in_transit",
    "delivered",
    "cancelled",
  ];
  const byStatus = Object.fromEntries(statuses.map((status) => [status, 0])) as Record<
    BookingStatus,
    number
  >;

  const [bookings, containers, payments, verifications, threads, userCounts, messageRows] =
    await Promise.all([
      repoBookings.listAllBookings(),
      repoCatalog.listAllContainers(),
      repoPlatform.listAllPayments(),
      repoPlatform.listAllVerifications(),
      repoPlatform.listAllThreads(),
      repoUsers.countUsersByRole(),
      repoPlatform.countMessages(),
    ]);
  for (const booking of bookings) byStatus[booking.status] += 1;

  const active = containers.filter((container) => container.status !== "inactive");
  const capacityM3 = round(active.reduce((sum, c) => sum + c.capacityM3, 0));
  const availableM3 = round(active.reduce((sum, c) => sum + c.availableM3, 0));

  const ledger = (status: string) =>
    round(payments.filter((p) => p.status === status).reduce((sum, p) => sum + p.amount, 0));

  return {
    users: {
      total: userCounts.trader + userCounts.provider + userCounts.admin,
      traders: userCounts.trader,
      providers: userCounts.provider,
      admins: userCounts.admin,
    },
    lanes: (await repoCatalog.listAllLanes()).length,
    containers: containers.length,
    capacityM3,
    availableM3,
    utilisationPct: capacityM3 > 0 ? round(((capacityM3 - availableM3) / capacityM3) * 100, 1) : 0,
    bookings: { total: bookings.length, byStatus },
    escrowHeld: ledger("funded"),
    released: ledger("released"),
    refunded: ledger("refunded"),
    pendingVerifications: verifications.filter((v) => v.status === "pending").length,
    unreadNotifications: 0,
    threads: threads.length,
    messages: messageRows,
  };
}
