/**
 * Cargo-photo workflow: trader upload/resubmission, provider review queue and
 * provider/admin decisions.
 *
 * Rules enforced here (never in the browser):
 *  - only the trader on a booking may upload its photo (admins may also, for
 *    support/audit corrections);
 *  - a photo cannot be added or replaced once the booking is cancelled or
 *    delivered, and an approved photo must be re-opened by the provider first;
 *  - only that booking's provider (or an admin) may decide, and only while the
 *    photo is `pending` — a decided photo is immutable until resubmitted, which
 *    is what stops duplicate approve/reject races;
 *  - a rejection always carries a note, so the trader knows what to fix;
 *  - review never changes booking status or capacity: the photo is an advisory
 *    quality gate, so bookings without a photo (or awaiting review) keep working
 *    exactly as before and can never be stuck on it;
 *  - a photograph that leaves the "current" slot is archived instead of deleted
 *    (see 0003_cargo_photo_history.sql), so the provider can compare the newest
 *    submission against what came before.
 */

import { CODE, failure, success } from "@/domain/results";
import type { Result } from "@/domain/results";
import type {
  Booking,
  BookingView,
  CargoPhotoHistoryView,
  CargoPhotoSupersedeReason,
} from "@/domain/types";
import { requireAuthUser } from "@/server/services/auth";
import { bookingViews } from "@/server/services/data";
import {
  decodeCargoPhoto,
  removeCargoPhotoObject,
  signedCargoPhotoUrls,
  uploadCargoPhotoObject,
} from "@/server/services/storage";
import * as repoBookings from "@/server/db/repo/bookings";
import {
  ensureSeeded,
  findBookingById,
  findUserById,
  newId,
  notify,
  nowIso,
  recordAudit,
} from "@/server/store";

/**
 * Copy a photo that is leaving the "current" slot into the history table. The
 * snapshot passed in is the booking *before* the change, so the archived entry
 * keeps the decision (status, note, reviewer) the photograph had at that moment.
 *
 * Best effort: the archive is a convenience for comparison and must never fail
 * the trader's upload or the provider's reopen, so a write error is logged and
 * swallowed. `cargo_photo_history` dedupes on (booking_id, path).
 */
async function archiveSupersededPhoto(
  booking: Booking,
  supersededAt: string,
  reason: CargoPhotoSupersedeReason,
): Promise<void> {
  if (!booking.cargoPhotoPath) return;
  try {
    await repoBookings.archiveCargoPhoto({
      id: newId("cph"),
      bookingId: booking.id,
      path: booking.cargoPhotoPath,
      label: booking.cargoPhotoLabel ?? "",
      bytes: booking.cargoPhotoBytes,
      uploadedAt: booking.cargoPhotoUploadedAt ?? supersededAt,
      supersededAt,
      reason,
      reviewStatus: booking.reviewStatus,
      reviewNote: booking.reviewNote,
      reviewedAt: booking.reviewedAt,
      reviewerId: booking.reviewerId,
    });
  } catch (error) {
    console.warn(
      "[cargo] could not archive superseded photo:",
      error instanceof Error ? error.message : error,
    );
  }
}

async function viewForBooking(token: string, booking: Booking): Promise<Result<BookingView>> {
  const [view] = await bookingViews(token, [booking]);
  if (!view) return failure(CODE.NOT_FOUND, "Booking container is no longer available.");
  return success(view);
}

/** Real image type + size checks happen in the storage module; this is the flow. */
export async function submitCargoPhoto(
  token: string,
  input: { bookingId: string; label: string; contentType: string; dataBase64: string },
): Promise<Result<BookingView>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to upload a cargo photo.");

  const booking = await findBookingById(input.bookingId);
  if (!booking) return failure(CODE.NOT_FOUND, "Booking not found.");
  const isTrader = booking.userId === user.id;
  if (!isTrader && user.role !== "admin") {
    return failure(CODE.FORBIDDEN, "Only the trader on this booking can upload its cargo photo.");
  }
  if (booking.status === "cancelled") {
    return failure(CODE.INVALID_TRANSITION, "Cancelled bookings cannot take a new cargo photo.");
  }
  if (booking.status === "delivered") {
    return failure(
      CODE.INVALID_TRANSITION,
      "Delivered shipments can no longer change their cargo photo.",
    );
  }
  if (booking.reviewStatus === "approved" && user.role !== "admin") {
    return failure(
      CODE.PHOTO_ALREADY_REVIEWED,
      "This cargo photo is already approved. Ask the provider to reopen it before replacing it.",
    );
  }

  const decoded = decodeCargoPhoto(input);
  if (!decoded.ok) return decoded;

  const uploaded = await uploadCargoPhotoObject(token, booking.id, decoded.value);
  if (!uploaded.ok) return uploaded;

  const label = input.label.trim();
  const timestamp = nowIso();
  const updated = await repoBookings.setCargoPhoto(booking.id, {
    path: uploaded.value.path,
    label,
    bytes: uploaded.value.bytes,
    uploadedAt: timestamp,
    updatedAt: timestamp,
  });
  if (!updated) {
    await removeCargoPhotoObject(token, uploaded.value.path);
    return failure(CODE.NOT_FOUND, "Booking not found.");
  }

  // Replacement: the superseded object stays in the private bucket and is
  // archived, so the provider can compare this submission with the previous one.
  if (booking.cargoPhotoPath && booking.cargoPhotoPath !== updated.cargoPhotoPath) {
    await archiveSupersededPhoto(booking, timestamp, "replaced");
  }

  await recordAudit(user, "booking.cargo_photo.submit", `${booking.id} — ${label}`);
  await notify(
    booking.providerId,
    "booking",
    "Cargo photo awaiting review",
    `${label} was submitted for booking ${booking.id}. Approve or reject it in the cargo review queue.`,
    "/cargo-review",
  );

  return viewForBooking(token, updated);
}

export async function reviewCargoPhoto(
  token: string,
  input: { bookingId: string; decision: "approved" | "rejected"; note: string },
): Promise<Result<BookingView>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to review cargo photos.");

  const booking = await findBookingById(input.bookingId);
  if (!booking) return failure(CODE.NOT_FOUND, "Booking not found.");
  const isProvider = booking.providerId === user.id;
  if (!isProvider && user.role !== "admin") {
    return failure(CODE.FORBIDDEN, "Only the provider on this booking can review its cargo photo.");
  }
  if (booking.status === "cancelled") {
    return failure(CODE.INVALID_TRANSITION, "Cancelled bookings cannot be reviewed.");
  }
  if (!booking.cargoPhotoPath) {
    return failure(CODE.PHOTO_REQUIRED, "This booking has no cargo photo to review.");
  }
  if (booking.reviewStatus !== "pending") {
    return failure(
      CODE.PHOTO_ALREADY_REVIEWED,
      booking.reviewStatus === "approved"
        ? "This cargo photo is already approved."
        : "This cargo photo is already rejected — the trader must resubmit first.",
    );
  }
  const note = input.note.trim();
  if (input.decision === "rejected" && note.length < 3) {
    return failure(CODE.INVALID_INPUT, "Add a short reason so the trader knows what to fix.");
  }

  const timestamp = nowIso();
  const updated = await repoBookings.setCargoReview(booking.id, {
    status: input.decision,
    note,
    reviewedAt: timestamp,
    reviewerId: user.id,
    updatedAt: timestamp,
  });
  if (!updated) return failure(CODE.NOT_FOUND, "Booking not found.");

  await recordAudit(
    user,
    `booking.cargo_photo.${input.decision}`,
    `${booking.id}${note ? ` — ${note}` : ""}`,
  );
  await notify(
    booking.userId,
    "booking",
    input.decision === "approved" ? "Cargo photo approved" : "Cargo photo rejected",
    input.decision === "approved"
      ? `Your cargo photo for booking ${booking.id} was approved.`
      : `Your cargo photo for booking ${booking.id} was rejected${note ? `: ${note}` : "."}`,
    "/bookings",
  );

  return viewForBooking(token, updated);
}

/**
 * Reopen a decided photo: the provider (or an admin) clears their own decision so
 * the trader can replace the photograph and resubmit. The stored image is kept —
 * only `review_status`, the note and the reviewer are reset — so nothing is lost
 * if the trader never comes back with a better shot.
 */
export async function reopenCargoPhoto(
  token: string,
  input: { bookingId: string; note: string },
): Promise<Result<BookingView>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to reopen a cargo photo.");

  const booking = await findBookingById(input.bookingId);
  if (!booking) return failure(CODE.NOT_FOUND, "Booking not found.");
  const isProvider = booking.providerId === user.id;
  if (!isProvider && user.role !== "admin") {
    return failure(CODE.FORBIDDEN, "Only the provider on this booking can reopen its cargo photo.");
  }
  if (booking.status === "cancelled") {
    return failure(CODE.INVALID_TRANSITION, "Cancelled bookings cannot be reopened for review.");
  }
  if (!booking.cargoPhotoPath) {
    return failure(CODE.PHOTO_REQUIRED, "This booking has no cargo photo to reopen.");
  }
  if (booking.reviewStatus === "pending") {
    return failure(CODE.ALREADY_PENDING, "This cargo photo is already awaiting a decision.");
  }

  const timestamp = nowIso();
  // Archive before clearing: this preserves the decision the provider is undoing
  // even if the trader never replaces the photograph.
  await archiveSupersededPhoto(booking, timestamp, "reopened");

  const updated = await repoBookings.reopenCargoReview(booking.id, timestamp);
  if (!updated) return failure(CODE.NOT_FOUND, "Booking not found.");

  const note = input.note.trim();
  await recordAudit(user, "booking.cargo_photo.reopen", `${booking.id}${note ? ` — ${note}` : ""}`);
  await notify(
    booking.userId,
    "booking",
    "Cargo photo reopened for review",
    `The provider reopened the cargo photo for booking ${booking.id}${note ? `: ${note}` : "."} Upload a new photograph to resubmit it.`,
    "/bookings",
  );

  return viewForBooking(token, updated);
}

/**
 * Earlier versions of a booking's cargo photograph, newest first, each with a
 * short-lived signed URL. Readable by the same three parties the private bucket
 * already trusts: the booking's trader, its provider, and administrators.
 */
export async function cargoPhotoHistory(
  token: string,
  input: { bookingId: string },
): Promise<Result<CargoPhotoHistoryView[]>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to view earlier cargo photos.");

  const booking = await findBookingById(input.bookingId);
  if (!booking) return failure(CODE.NOT_FOUND, "Booking not found.");
  const isParty = booking.userId === user.id || booking.providerId === user.id;
  if (!isParty && user.role !== "admin") {
    return failure(
      CODE.FORBIDDEN,
      "Only this booking's trader, its provider or an administrator can view its photo history.",
    );
  }

  const entries = await repoBookings.listCargoPhotoHistory(booking.id);
  if (entries.length === 0) return success([]);

  const [urls, reviewerNames] = await Promise.all([
    signedCargoPhotoUrls(
      token,
      entries.map((entry) => entry.path),
    ),
    reviewerNamesFor(entries.map((entry) => entry.reviewerId)),
  ]);

  return success(
    entries.map((entry) => ({
      ...entry,
      url: urls.get(entry.path) ?? null,
      reviewerName: entry.reviewerId ? (reviewerNames.get(entry.reviewerId) ?? null) : null,
    })),
  );
}

/** Resolve archived reviewer ids to display names (one lookup per distinct id). */
async function reviewerNamesFor(ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      const reviewer = await findUserById(id);
      if (reviewer) names.set(id, reviewer.name);
    }),
  );
  return names;
}

/** How many photos are waiting for this caller's decision (navigation badge). */
export async function cargoPendingCount(token: string): Promise<Result<number>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to review cargo photos.");
  if (user.role === "trader") return success(0);
  const providerId = user.role === "admin" ? null : user.id;
  return success(await repoBookings.countPendingCargoReviews(providerId));
}

/**
 * Provider review queue (admins see every provider's submissions for audit).
 * Returns bookings that actually have a photo; the client splits pending from
 * decided so the UI can lead with what needs action.
 */
export async function cargoReviewQueue(token: string): Promise<Result<BookingView[]>> {
  await ensureSeeded();
  const user = await requireAuthUser(token);
  if (!user) return failure(CODE.UNAUTHORIZED, "Sign in to review cargo photos.");
  if (user.role === "trader") {
    return failure(CODE.FORBIDDEN, "Traders have no review queue — this view is for providers.");
  }
  const bookings = await repoBookings.listAllBookings();
  const scoped =
    user.role === "admin" ? bookings : bookings.filter((booking) => booking.providerId === user.id);
  const withPhoto = scoped.filter((booking) => booking.cargoPhotoPath !== null);
  const views = await bookingViews(token, withPhoto);
  return success(
    views.sort((a, b) => {
      const rank = (view: BookingView) => (view.booking.reviewStatus === "pending" ? 0 : 1);
      const byRank = rank(a) - rank(b);
      if (byRank !== 0) return byRank;
      return (b.booking.cargoPhotoUploadedAt ?? "").localeCompare(
        a.booking.cargoPhotoUploadedAt ?? "",
      );
    }),
  );
}

/** Kept for symmetry with other services' id helpers. */
export function cargoPhotoId(): string {
  return newId("pho");
}
