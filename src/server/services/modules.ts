/**
 * Services backing the remaining platform modules:
 * payments & escrow, communication & notifications, provider verification,
 * the admin dashboard and the reporting/insight engine.
 *
 * Backed by Supabase Postgres (async repository) — see src/server/db/repo/*.
 */

import { CODE, failure, success } from "@/domain/results";
import type { Result } from "@/domain/results";
import type {
  AdminUserView,
  AuditEvent,
  BookingStatus,
  BookingView,
  Insight,
  Message,
  Notification,
  Payment,
  PaymentStatus,
  ProviderVerification,
  ReportPayload,
  RouteMode,
  Thread,
  ThreadView,
  User,
  UserRole,
  VerificationView,
} from "@/domain/types";
import {
  BOOKING_STATUS_LABELS,
  MODE_LABELS,
  PAYMENT_STATUS_LABELS,
  VERIFICATION_LABELS,
} from "@/domain/types";
import { requireAuthUser } from "@/server/services/auth";
import { dashboardMetrics, round } from "@/server/services/data";
import * as repoUsers from "@/server/db/repo/users";
import * as repoCatalog from "@/server/db/repo/catalog";
import * as repoBookings from "@/server/db/repo/bookings";
import * as repoPlatform from "@/server/db/repo/platform";
import {
  ensureSeeded,
  findBookingById,
  findContainerById,
  findLaneById,
  findPaymentByBooking,
  findThreadByBooking,
  findThreadById,
  findUserById,
  findVerificationByProvider,
  newId,
  notify,
  nowIso,
  recordAudit,
} from "@/server/store";

// =====================================================================
// Payments & escrow
// =====================================================================

export async function paymentViews(bookingIds: string[]): Promise<BookingView[]> {
  const bookings = await repoBookings.listAllBookings();
  const byId = new Map(bookings.map((booking) => [booking.id, booking]));
  const scoped = bookingIds
    .map((id) => byId.get(id))
    .filter((booking): booking is NonNullable<typeof booking> => booking !== undefined);

  const views = await Promise.all(
    scoped.map(async (booking): Promise<BookingView | null> => {
      const container = await findContainerById(booking.containerId);
      const lane = container ? await findLaneById(container.laneId) : undefined;
      if (!container || !lane) return null;
      const [payment, provider, trader] = await Promise.all([
        findPaymentByBooking(booking.id),
        findUserById(booking.providerId),
        findUserById(booking.userId),
      ]);
      return {
        booking,
        container,
        lane,
        providerName: provider?.name ?? "Unknown provider",
        traderName: trader?.name ?? "Unknown trader",
        paymentStatus: payment?.status ?? "unfunded",
        amount: payment?.amount ?? 0,
        cargoPhotoUrl: null,
        reviewerName: null,
        // The ledger renders payment state, not photographs; no lookup here.
        cargoPhotoHistoryCount: 0,
      } satisfies BookingView;
    }),
  );
  return views
    .filter((view): view is BookingView => view !== null)
    .sort((a, b) => b.booking.createdAt.localeCompare(a.booking.createdAt));
}

export async function listLedger(token: string): Promise<Result<BookingView[]>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to review escrow.");
  const bookings = await repoBookings.listAllBookings();
  const scoped = bookings.filter((booking) => {
    if (user.role === "admin") return true;
    return booking.userId === user.id || booking.providerId === user.id;
  });
  return success(await paymentViews(scoped.map((booking) => booking.id)));
}

async function escrow(bookingId: string): Promise<Payment | undefined> {
  return findPaymentByBooking(bookingId);
}

export async function fundEscrow(token: string, bookingId: string): Promise<Result<Payment>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to fund escrow.");
  const booking = await findBookingById(bookingId);
  if (!booking) return failure(CODE.NOT_FOUND, "Booking not found.");
  if (booking.userId !== user.id && user.role !== "admin") {
    return failure(CODE.FORBIDDEN, "Only the trader on this booking can fund escrow.");
  }
  const payment = await escrow(bookingId);
  if (!payment) return failure(CODE.NOT_FOUND, "No escrow record exists for this booking.");
  if (payment.status === "funded") return failure(CODE.ALREADY_FUNDED, "Escrow is already funded.");
  if (payment.status === "released") {
    return failure(CODE.INVALID_TRANSITION, "This escrow has already been released.");
  }
  const updated = await repoPlatform.updatePaymentFields(payment.id, {
    status: "funded",
    updatedAt: nowIso(),
  });
  await recordAudit(user, "escrow.fund", `${bookingId} (€${payment.amount.toFixed(2)})`);
  await notify(
    booking.providerId,
    "payment",
    "Escrow funded",
    `€${payment.amount.toFixed(2)} is now held for booking ${bookingId}.`,
    "/payments",
  );
  return success(updated ?? { ...payment, status: "funded" });
}

export async function releaseEscrow(token: string, bookingId: string): Promise<Result<Payment>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to release escrow.");
  const booking = await findBookingById(bookingId);
  if (!booking) return failure(CODE.NOT_FOUND, "Booking not found.");
  const isTrader = booking.userId === user.id;
  if (!isTrader && user.role !== "admin") {
    return failure(CODE.FORBIDDEN, "Only the trader or an admin can release escrow.");
  }
  const payment = await escrow(bookingId);
  if (!payment) return failure(CODE.NOT_FOUND, "No escrow record exists for this booking.");
  if (payment.status !== "funded") {
    return failure(CODE.NOT_FUNDED, "Escrow must be funded before it can be released.");
  }
  const stamp = nowIso();
  const updated = await repoPlatform.updatePaymentFields(payment.id, {
    status: "released",
    updatedAt: stamp,
  });
  if (booking.status !== "delivered") {
    await repoBookings.updateBookingFields(booking.id, {
      status: "delivered",
      updatedAt: stamp,
    });
  }
  await recordAudit(user, "escrow.release", `${bookingId} (€${payment.amount.toFixed(2)})`);
  await notify(
    booking.providerId,
    "payment",
    "Escrow released",
    `€${payment.amount.toFixed(2)} has been released to you.`,
    "/payments",
  );
  return success(updated ?? { ...payment, status: "released" });
}

export async function refundEscrow(token: string, bookingId: string): Promise<Result<Payment>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in first.");
  if (user.role !== "admin") {
    return failure(CODE.FORBIDDEN, "Only administrators can force a refund.");
  }
  const payment = await escrow(bookingId);
  if (!payment) return failure(CODE.NOT_FOUND, "No escrow record exists for this booking.");
  if (payment.status === "refunded") {
    return failure(CODE.INVALID_TRANSITION, "This payment is already refunded.");
  }
  const updated = await repoPlatform.updatePaymentFields(payment.id, {
    status: "refunded",
    updatedAt: nowIso(),
  });
  await recordAudit(user, "escrow.refund", `${bookingId} (€${payment.amount.toFixed(2)})`);
  await notify(
    payment.traderId,
    "payment",
    "Escrow refunded",
    `€${payment.amount.toFixed(2)} was returned for booking ${bookingId}.`,
    "/payments",
  );
  return success(updated ?? { ...payment, status: "refunded" });
}

// =====================================================================
// Communication & notifications
// =====================================================================

export async function listThreads(token: string): Promise<Result<ThreadView[]>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to view conversations.");
  const threads = await repoPlatform.listAllThreads();
  const scoped = threads.filter(
    (thread) =>
      user.role === "admin" || thread.traderId === user.id || thread.providerId === user.id,
  );
  const allMessages = await repoPlatform.listMessagesForThreads(scoped.map((t) => t.id));
  const byThread = new Map<string, Message[]>();
  for (const message of allMessages) {
    const list = byThread.get(message.threadId);
    if (list) list.push(message);
    else byThread.set(message.threadId, [message]);
  }
  const views = await Promise.all(scoped.map((thread) => threadView(thread, byThread)));
  return success(views.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)));
}

async function threadView(
  thread: Thread,
  messagesByThread: Map<string, Message[]>,
): Promise<ThreadView> {
  const booking = await findBookingById(thread.bookingId);
  const container = booking ? await findContainerById(booking.containerId) : undefined;
  const lane = container ? await findLaneById(container.laneId) : undefined;
  const owner = thread.traderId;
  const counterparty = await findUserById(
    thread.providerId === owner ? thread.traderId : thread.providerId,
  );
  const threadMessages = (messagesByThread.get(thread.id) ?? []).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const last = threadMessages[threadMessages.length - 1];
  return {
    thread,
    bookingId: thread.bookingId,
    counterpartyName: counterparty?.name ?? "Unknown",
    counterpartyRole: counterparty?.role ?? "trader",
    subject: lane
      ? `${container?.label ?? "Container"} · ${lane.origin} → ${lane.destination}`
      : "Shipment",
    lastMessage: last?.body ?? "No messages yet.",
    lastMessageAt: last?.createdAt ?? thread.createdAt,
    messageCount: threadMessages.length,
  };
}

export async function listMessages(token: string, threadId: string): Promise<Result<Message[]>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to read messages.");
  const thread = await findThreadById(threadId);
  if (!thread) return failure(CODE.NOT_FOUND, "Conversation not found.");
  if (user.role !== "admin" && thread.traderId !== user.id && thread.providerId !== user.id) {
    return failure(CODE.THREAD_FORBIDDEN, "This conversation is not yours.");
  }
  const rows = await repoPlatform.listMessagesForThreads([threadId]);
  return success(
    rows
      .filter((message) => message.senderId !== "")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((message) => ({ ...message })),
  );
}

export async function sendMessage(
  token: string,
  threadId: string,
  body: string,
): Promise<Result<Message>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to send a message.");
  const thread = await findThreadById(threadId);
  if (!thread) return failure(CODE.NOT_FOUND, "Conversation not found.");
  const isTrader = thread.traderId === user.id;
  const isProvider = thread.providerId === user.id;
  if (!isTrader && !isProvider && user.role !== "admin") {
    return failure(CODE.THREAD_FORBIDDEN, "This conversation is not yours.");
  }
  const message = await repoPlatform.insertMessage({
    id: newId("msg"),
    threadId,
    senderId: user.id,
    senderName: user.name,
    body: body.trim(),
    createdAt: nowIso(),
  });
  await notify(
    isTrader ? thread.providerId : thread.traderId,
    "system",
    "New message",
    `${user.name}: ${message.body.slice(0, 80)}`,
    "/messages",
  );
  return success({ ...message });
}

export async function startThreadForBooking(
  token: string,
  bookingId: string,
): Promise<Result<Thread>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in first.");
  const booking = await findBookingById(bookingId);
  if (!booking) return failure(CODE.NOT_FOUND, "Booking not found.");
  if (user.role !== "admin" && booking.userId !== user.id && booking.providerId !== user.id) {
    return failure(CODE.FORBIDDEN, "That booking is not yours.");
  }
  const existing = await findThreadByBooking(bookingId);
  if (existing) return success({ ...existing });
  const thread = await repoPlatform.insertThread({
    id: newId("thr"),
    bookingId,
    traderId: booking.userId,
    providerId: booking.providerId,
    createdAt: nowIso(),
  });
  return success({ ...thread });
}

export async function listNotifications(token: string): Promise<Result<Notification[]>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to see notifications.");
  return success(await repoPlatform.listNotificationsForUser(user.id));
}

export async function markNotificationRead(
  token: string,
  notificationId: string,
): Promise<Result<Notification>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in first.");
  const notification = await repoPlatform.markNotificationRead(notificationId, user.id);
  if (!notification) return failure(CODE.NOT_FOUND, "Notification not found.");
  return success({ ...notification });
}

export async function markAllNotificationsRead(token: string): Promise<Result<number>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in first.");
  const changed = await repoPlatform.markAllNotificationsRead(user.id);
  return success(changed);
}

// =====================================================================
// Provider verification
// =====================================================================

export async function getMyVerification(
  token: string,
): Promise<Result<ProviderVerification | null>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in first.");
  const record = await findVerificationByProvider(user.id);
  return success(record ? { ...record } : null);
}

export async function submitVerification(
  token: string,
  input: {
    legalName: string;
    registrationNo: string;
    taxId: string;
    contactEmail: string;
    contactPhone: string;
    fleetSize: number;
    documentRefs: string;
  },
): Promise<Result<ProviderVerification>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to submit verification.");
  if (user.role === "trader") {
    return failure(CODE.FORBIDDEN, "Only providers can submit verification.");
  }
  const existing = await findVerificationByProvider(user.id);
  if (existing?.status === "pending") {
    return failure(CODE.ALREADY_PENDING, "Your verification is already awaiting review.");
  }
  if (existing?.status === "approved") {
    return failure(CODE.ALREADY_APPROVED, "Your provider account is already verified.");
  }

  const stamp = nowIso();
  let record: ProviderVerification;
  if (existing) {
    const updated = await repoPlatform.updateVerification(existing.id, {
      legalName: input.legalName,
      registrationNo: input.registrationNo,
      taxId: input.taxId,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      fleetSize: input.fleetSize,
      documentRefs: input.documentRefs,
      status: "pending",
      submittedAt: stamp,
      reviewedAt: null,
      reviewerId: null,
      reviewNote: "",
    });
    record = updated ?? { ...existing, status: "pending", submittedAt: stamp };
    await recordAudit(user, "verification.resubmit", record.legalName);
    for (const admin of (await repoUsers.listAllUsers()).filter((row) => row.role === "admin")) {
      await notify(
        admin.id,
        "verification",
        "Verification resubmitted",
        `${record.legalName} resubmitted verification documents.`,
        "/admin",
      );
    }
    return success(record);
  }

  record = await repoPlatform.insertVerification({
    id: newId("vrf"),
    providerId: user.id,
    legalName: input.legalName,
    registrationNo: input.registrationNo,
    taxId: input.taxId,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    fleetSize: input.fleetSize,
    documentRefs: input.documentRefs,
    status: "pending",
    submittedAt: stamp,
    reviewedAt: null,
    reviewerId: null,
    reviewNote: "",
  });
  await recordAudit(user, "verification.submit", record.legalName);
  for (const admin of (await repoUsers.listAllUsers()).filter((row) => row.role === "admin")) {
    await notify(
      admin.id,
      "verification",
      "Verification submitted",
      `${record.legalName} is awaiting review.`,
      "/admin",
    );
  }
  return success({ ...record });
}

export async function listVerifications(token: string): Promise<Result<VerificationView[]>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in first.");
  if (user.role !== "admin") return failure(CODE.FORBIDDEN, "Administrators only.");
  const [verifications, lanes, containers] = await Promise.all([
    repoPlatform.listAllVerifications(),
    repoCatalog.listAllLanes(),
    repoCatalog.listAllContainers(),
  ]);
  const views = await Promise.all(
    verifications.map(async (verification) => {
      const provider = await findUserById(verification.providerId);
      return {
        verification: { ...verification },
        providerName: provider?.name ?? "Unknown",
        providerCompany: provider?.company ?? "",
        providerEmail: provider?.email ?? "",
        laneCount: lanes.filter((lane) => lane.providerId === verification.providerId).length,
        containerCount: containers.filter((c) => c.providerId === verification.providerId).length,
      } satisfies VerificationView;
    }),
  );
  return success(
    views.sort((a, b) => a.verification.submittedAt.localeCompare(b.verification.submittedAt)),
  );
}

export async function reviewVerification(
  token: string,
  input: { providerId: string; decision: "approved" | "rejected"; note: string },
): Promise<Result<ProviderVerification>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in first.");
  if (user.role !== "admin") return failure(CODE.FORBIDDEN, "Administrators only.");
  const record = await findVerificationByProvider(input.providerId);
  if (!record) return failure(CODE.NOT_FOUND, "No verification record for that provider.");
  const updated = await repoPlatform.updateVerification(record.id, {
    legalName: record.legalName,
    registrationNo: record.registrationNo,
    taxId: record.taxId,
    contactEmail: record.contactEmail,
    contactPhone: record.contactPhone,
    fleetSize: record.fleetSize,
    documentRefs: record.documentRefs,
    status: input.decision,
    submittedAt: record.submittedAt,
    reviewedAt: nowIso(),
    reviewerId: user.id,
    reviewNote: input.note,
  });
  const result = updated ?? { ...record, status: input.decision };
  await recordAudit(user, `verification.${input.decision}`, result.legalName);
  await notify(
    result.providerId,
    "verification",
    input.decision === "approved" ? "Provider verified" : "Verification rejected",
    input.decision === "approved"
      ? "Your company details were approved. You can now list and trade without limits."
      : `Your verification was rejected${input.note ? `: ${input.note}` : "."}`,
    "/verification",
  );
  return success(result);
}

// =====================================================================
// Admin
// =====================================================================

export async function listUsers(token: string): Promise<Result<AdminUserView[]>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in first.");
  if (user.role !== "admin") return failure(CODE.FORBIDDEN, "Administrators only.");
  const [rows, lanes, containers, bookings, verifications] = await Promise.all([
    repoUsers.listAllUsers(),
    repoCatalog.listAllLanes(),
    repoCatalog.listAllContainers(),
    repoBookings.listAllBookings(),
    repoPlatform.listAllVerifications(),
  ]);
  const verificationByProvider = new Map(verifications.map((v) => [v.providerId, v]));
  return success(
    rows.map((row) => {
      const record = verificationByProvider.get(row.id);
      return {
        user: {
          id: row.id,
          name: row.name,
          email: row.email,
          company: row.company,
          role: row.role,
          createdAt: row.createdAt,
        },
        laneCount: lanes.filter((lane) => lane.providerId === row.id).length,
        containerCount: containers.filter((c) => c.providerId === row.id).length,
        bookingCount: bookings.filter(
          (booking) => booking.userId === row.id || booking.providerId === row.id,
        ).length,
        verificationStatus: record?.status ?? "unverified",
      } satisfies AdminUserView;
    }),
  );
}

export async function setUserRole(
  token: string,
  input: { userId: string; role: UserRole },
): Promise<Result<User>> {
  await ensureSeeded();
  const actor = await requireAuthUser(token);
  if (!actor) return failure(CODE.UNAUTHORIZED, "Sign in first.");
  if (actor.role !== "admin") return failure(CODE.FORBIDDEN, "Administrators only.");
  const row = await repoUsers.findUserById(input.userId);
  if (!row) return failure(CODE.NOT_FOUND, "User not found.");
  if (row.id === actor.id) {
    return failure(CODE.INVALID_TRANSITION, "You cannot change your own role.");
  }
  const updated = await repoUsers.updateUserRole(input.userId, input.role);
  const result = updated ?? { ...row, role: input.role };
  await recordAudit(actor, "user.role", `${result.email} → ${input.role}`);
  await notify(
    result.id,
    "system",
    "Your role changed",
    `An administrator set your role to ${input.role}.`,
    "/dashboard",
  );
  return success({
    id: result.id,
    name: result.name,
    email: result.email,
    company: result.company,
    role: result.role,
    createdAt: result.createdAt,
  });
}

export async function listAudit(token: string): Promise<Result<AuditEvent[]>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in first.");
  if (user.role !== "admin") return failure(CODE.FORBIDDEN, "Administrators only.");
  return success((await repoPlatform.listRecentAudit(60)).map((event) => ({ ...event })));
}

export async function adminOverview(token: string) {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in first.");
  if (user.role !== "admin") return failure(CODE.FORBIDDEN, "Administrators only.");
  return success(await dashboardMetrics());
}

// =====================================================================
// Reports & insight engine
// =====================================================================

function windowStart(window: ReportPayload["window"]): number {
  if (window === "30d") return Date.now() - 30 * 86_400_000;
  if (window === "90d") return Date.now() - 90 * 86_400_000;
  return 0;
}

export async function generateReport(
  token: string,
  window: ReportPayload["window"],
): Promise<Result<ReportPayload>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to generate reports.");
  if (user.role === "trader") {
    return failure(CODE.FORBIDDEN, "Reports are available to providers and administrators.");
  }

  const since = windowStart(window);
  const [allBookings, containers, lanes, payments, verifications] = await Promise.all([
    repoBookings.listAllBookings(),
    repoCatalog.listAllContainers(),
    repoCatalog.listAllLanes(),
    repoPlatform.listAllPayments(),
    repoPlatform.listAllVerifications(),
  ]);
  const containerById = new Map(containers.map((container) => [container.id, container]));
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]));
  const paymentByBooking = new Map(payments.map((payment) => [payment.bookingId, payment]));

  const scoped = allBookings.filter((booking) => {
    if (new Date(booking.createdAt).getTime() < since) return false;
    if (user.role === "admin") return true;
    return booking.providerId === user.id;
  });

  const valueOf = (bookingId: string): number => paymentByBooking.get(bookingId)?.amount ?? 0;

  const statuses: BookingStatus[] = [
    "pending",
    "confirmed",
    "in_transit",
    "delivered",
    "cancelled",
  ];
  const byStatus = statuses.map((status) => ({
    label: BOOKING_STATUS_LABELS[status],
    value: scoped.filter((booking) => booking.status === status).length,
  }));

  const modes: RouteMode[] = ["road", "rail", "sea", "air"];
  const byMode = modes
    .map((mode) => ({
      label: MODE_LABELS[mode],
      value: scoped.filter((booking) => {
        const container = containerById.get(booking.containerId);
        const lane = container ? laneById.get(container.laneId) : undefined;
        return lane?.mode === mode;
      }).length,
    }))
    .filter((row) => row.value > 0);

  const laneIds = new Set<string>();
  for (const booking of scoped) {
    const container = containerById.get(booking.containerId);
    if (container) laneIds.add(container.laneId);
  }

  const topLanes = Array.from(laneIds)
    .map((laneId) => {
      const lane = laneById.get(laneId);
      if (!lane) return null;
      const laneBookings = scoped.filter((booking) => {
        const container = containerById.get(booking.containerId);
        return container?.laneId === laneId;
      });
      const laneContainers = containers.filter(
        (container) => container.laneId === laneId && container.status !== "inactive",
      );
      const capacity = laneContainers.reduce((sum, c) => sum + c.capacityM3, 0);
      const available = laneContainers.reduce((sum, c) => sum + c.availableM3, 0);
      const bookedM3 = round(laneBookings.reduce((sum, b) => sum + b.requestedM3, 0));
      return {
        laneId,
        label: `${lane.origin} → ${lane.destination}`,
        bookings: laneBookings.length,
        bookedM3,
        value: round(laneBookings.reduce((sum, b) => sum + valueOf(b.id), 0)),
        utilisationPct: capacity > 0 ? round(((capacity - available) / capacity) * 100, 1) : 0,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const providerIds = new Set(scoped.map((booking) => booking.providerId));
  const providerRows = await Promise.all(Array.from(providerIds).map((id) => findUserById(id)));
  const providerNameById = new Map(
    Array.from(providerIds).map((id, index) => [id, providerRows[index]?.name ?? "Unknown"]),
  );
  const byProvider = Array.from(providerIds)
    .map((providerId) => {
      const providerBookings = scoped.filter((booking) => booking.providerId === providerId);
      return {
        providerId,
        providerName: providerNameById.get(providerId) ?? "Unknown",
        bookings: providerBookings.length,
        shippedM3: round(providerBookings.reduce((sum, b) => sum + b.requestedM3, 0)),
        value: round(providerBookings.reduce((sum, b) => sum + valueOf(b.id), 0)),
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const metrics = await dashboardMetrics();
  const grossValue = round(scoped.reduce((sum, booking) => sum + valueOf(booking.id), 0));
  const cancelled = scoped.filter((booking) => booking.status === "cancelled").length;

  return success({
    window,
    generatedAt: nowIso(),
    summary: {
      bookings: scoped.length,
      grossValue,
      escrowHeld: metrics.escrowHeld,
      released: metrics.released,
      refunded: metrics.refunded,
      avgUtilisationPct: metrics.utilisationPct,
      cancellationRatePct: scoped.length > 0 ? round((cancelled / scoped.length) * 100, 1) : 0,
      verifiedProviders: verifications.filter((v) => v.status === "approved").length,
      bookingsPerLane: metrics.lanes > 0 ? round(scoped.length / metrics.lanes, 2) : 0,
    },
    byStatus,
    byMode,
    topLanes,
    byProvider,
  });
}

/**
 * Rules-based insight engine.
 * Everything here is derived from live metrics — no external model call, so the
 * page stays functional offline. Swap `analyse` for an LLM call to upgrade it.
 */
export async function listInsights(token: string): Promise<Result<Insight[]>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to see insights.");
  if (user.role === "trader") {
    return failure(CODE.FORBIDDEN, "Insights are available to providers and administrators.");
  }

  const [lanes, containers, payments, bookings, verifications] = await Promise.all([
    repoCatalog.listAllLanes(),
    repoCatalog.listAllContainers(),
    repoPlatform.listAllPayments(),
    repoBookings.listAllBookings(),
    repoPlatform.listAllVerifications(),
  ]);
  const bookingById = new Map(bookings.map((booking) => [booking.id, booking]));

  const scopedLanes =
    user.role === "admin" ? lanes : lanes.filter((lane) => lane.providerId === user.id);
  const scopedContainers = containers.filter(
    (container) =>
      container.status !== "inactive" && scopedLanes.some((lane) => lane.id === container.laneId),
  );

  const insights: Insight[] = [];

  for (const lane of scopedLanes) {
    const laneContainers = scopedContainers.filter((container) => container.laneId === lane.id);
    const capacity = laneContainers.reduce((sum, c) => sum + c.capacityM3, 0);
    const available = laneContainers.reduce((sum, c) => sum + c.availableM3, 0);
    if (capacity === 0) continue;
    const utilisation = ((capacity - available) / capacity) * 100;
    if (utilisation >= 85) {
      insights.push({
        id: `util-high-${lane.id}`,
        severity: "warning",
        title: `Add capacity on ${lane.origin} → ${lane.destination}`,
        detail: `This ${MODE_LABELS[lane.mode].toLowerCase()} lane is ${utilisation.toFixed(0)}% booked. Demand is outpacing listed volume.`,
        metric: `${utilisation.toFixed(1)}% utilised`,
        action: "List another container on this route",
      });
    } else if (utilisation <= 15) {
      insights.push({
        id: `util-low-${lane.id}`,
        severity: "info",
        title: `Underused lane: ${lane.origin} → ${lane.destination}`,
        detail: `Only ${utilisation.toFixed(0)}% of listed volume is booked. Consider a lower price per m³ to win spot cargo.`,
        metric: `${utilisation.toFixed(1)}% utilised`,
        action: "Review price per m³",
      });
    }
  }

  let heldTotal = 0;
  for (const payment of payments) {
    if (payment.status === "funded") heldTotal += payment.amount;
  }
  const staleUnfunded = payments.filter((payment) => {
    if (payment.status !== "unfunded") return false;
    const booking = bookingById.get(payment.bookingId);
    if (!booking) return false;
    return Date.now() - new Date(booking.createdAt).getTime() > 3 * 86_400_000;
  });
  if (staleUnfunded.length > 0) {
    insights.push({
      id: "escrow-stale",
      severity: "critical",
      title: `${staleUnfunded.length} booking(s) without funded escrow`,
      detail:
        "These bookings have been confirmed for more than 3 days with no escrow funded. Shipment risk is unsecured.",
      metric: `€${round(staleUnfunded.reduce((sum, p) => sum + p.amount, 0)).toFixed(2)} at risk`,
      action: "Chase the trader or cancel the booking",
    });
  }

  const escrowHeld = round(heldTotal);
  if (escrowHeld > 0) {
    insights.push({
      id: "escrow-held",
      severity: "info",
      title: "Escrow balance awaiting release",
      detail:
        "Funded escrow is held until the trader confirms delivery and releases it. Settling completed shipments improves provider cash flow and trust.",
      metric: `€${escrowHeld.toFixed(2)} held`,
      action: "Review the payments ledger",
    });
  }

  const pendingVerifications = verifications.filter((v) => v.status === "pending");
  if (user.role === "admin" && pendingVerifications.length > 0) {
    insights.push({
      id: "verification-backlog",
      severity: pendingVerifications.length > 2 ? "warning" : "info",
      title: `${pendingVerifications.length} provider verification(s) pending`,
      detail:
        "Unreviewed providers cannot be surfaced as trusted. Clearing the backlog improves booking conversion.",
      metric: `${pendingVerifications.length} pending`,
      action: "Open the admin dashboard",
    });
  }

  const verificationByProvider = new Map(verifications.map((v) => [v.providerId, v]));
  const unverifiedWithListings = scopedLanes.filter((lane) => {
    const record = verificationByProvider.get(lane.providerId);
    return !record || record.status !== "approved";
  });
  if (unverifiedWithListings.length > 0) {
    insights.push({
      id: "unverified-listings",
      severity: "warning",
      title: "Active listings from unverified providers",
      detail: `${unverifiedWithListings.length} lane(s) are published by providers without an approved verification. Traders see these as unverified.`,
      metric: `${unverifiedWithListings.length} lane(s)`,
      action: "Request verification documents",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "healthy",
      severity: "info",
      title: "No anomalies detected",
      detail:
        "Capacity, escrow and verification signals are all within expected ranges for the current window.",
      metric: "All clear",
      action: "Keep monitoring",
    });
  }

  const order: Record<Insight["severity"], number> = { critical: 0, warning: 1, info: 2 };
  return success(insights.sort((a, b) => order[a.severity] - order[b.severity]));
}

/** Unused-payment-status label re-export kept for any UI imports. */
export { PAYMENT_STATUS_LABELS, VERIFICATION_LABELS };
