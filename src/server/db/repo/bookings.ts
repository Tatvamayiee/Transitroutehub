/**
 * Repository for bookings and cargo boxes (the 3D load-plan data).
 * See `./users.ts` for the module-level design note.
 */
import { dbAsync } from "@/server/db/client";
import type { CargoBox, Placement } from "@/domain/loading";
import type {
  Booking,
  BookingStatus,
  CargoPhotoHistoryEntry,
  CargoPhotoSupersedeReason,
  CargoReviewStatus,
} from "@/domain/types";

function iso(value: string | null | undefined): string {
  return value ? new Date(value).toISOString() : new Date(0).toISOString();
}

function isoOrNull(value: string | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function toBooking(row: Record<string, unknown>): Booking {
  return {
    id: String(row["id"]),
    userId: String(row["user_id"]),
    providerId: String(row["provider_id"]),
    containerId: String(row["container_id"]),
    requestedM3: Number(row["requested_m3"]),
    status: row["status"] as BookingStatus,
    createdAt: iso(row["created_at"] as string),
    updatedAt: iso(row["updated_at"] as string),
    cargoPhotoPath: (row["cargo_photo_path"] as string | null) ?? null,
    cargoPhotoLabel: (row["cargo_photo_label"] as string | null) ?? null,
    cargoPhotoBytes: row["cargo_photo_bytes"] == null ? null : Number(row["cargo_photo_bytes"]),
    cargoPhotoUploadedAt: isoOrNull(row["cargo_photo_uploaded_at"] as string | null),
    reviewStatus: (row["review_status"] as CargoReviewStatus | null) ?? null,
    reviewNote: String(row["review_note"] ?? ""),
    reviewedAt: isoOrNull(row["reviewed_at"] as string | null),
    reviewerId: (row["reviewer_id"] as string | null) ?? null,
  };
}

function toCargoBox(row: Record<string, unknown>): CargoBox {
  const placement = row["placement"] as Placement | null;
  return {
    id: String(row["id"]),
    bookingId: String(row["booking_id"]),
    label: String(row["label"]),
    lengthCm: Number(row["length_cm"]),
    widthCm: Number(row["width_cm"]),
    heightCm: Number(row["height_cm"]),
    weightKg: Number(row["weight_kg"]),
    fragile: Boolean(row["fragile"]),
    hue: Number(row["hue"]),
    placement: placement ? { ...placement } : null,
  };
}

// ---------------- bookings ----------------

export async function listAllBookings(): Promise<Booking[]> {
  const { data, error } = await (await dbAsync()).from("bookings").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []).map(toBooking);
}

export async function findBookingById(id: string): Promise<Booking | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toBooking(data) : undefined;
}

export async function insertBooking(row: {
  id: string;
  userId: string;
  providerId: string;
  containerId: string;
  requestedM3: number;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}): Promise<Booking> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("bookings")
    .insert({
      id: row.id,
      user_id: row.userId,
      provider_id: row.providerId,
      container_id: row.containerId,
      requested_m3: row.requestedM3,
      status: row.status,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toBooking(data);
}

export async function updateBookingFields(
  id: string,
  patch: { status?: BookingStatus; updatedAt: string },
): Promise<Booking | undefined> {
  const payload: Record<string, unknown> = { updated_at: patch.updatedAt };
  if (patch.status !== undefined) payload["status"] = patch.status;
  const { data, error } = await (
    await dbAsync()
  )
    .from("bookings")
    .update(payload)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? toBooking(data) : undefined;
}

/** Store a (re)submitted cargo photo and put it back into the review queue. */
export async function setCargoPhoto(
  id: string,
  patch: {
    path: string;
    label: string;
    bytes: number;
    uploadedAt: string;
    updatedAt: string;
  },
): Promise<Booking | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("bookings")
    .update({
      cargo_photo_path: patch.path,
      cargo_photo_label: patch.label,
      cargo_photo_bytes: patch.bytes,
      cargo_photo_uploaded_at: patch.uploadedAt,
      review_status: "pending",
      review_note: "",
      reviewed_at: null,
      reviewer_id: null,
      updated_at: patch.updatedAt,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? toBooking(data) : undefined;
}

/**
 * Put a decided photo back into the review queue so it can be replaced and
 * judged again. The photo itself is kept — only the decision is cleared.
 */
export async function reopenCargoReview(
  id: string,
  updatedAt: string,
): Promise<Booking | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("bookings")
    .update({
      review_status: "pending",
      review_note: "",
      reviewed_at: null,
      reviewer_id: null,
      updated_at: updatedAt,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? toBooking(data) : undefined;
}

/**
 * Number of photos waiting for a provider decision (all providers for admins).
 * Counted in the database so the navigation badge stays a single cheap query.
 */
export async function countPendingCargoReviews(providerId: string | null): Promise<number> {
  let query = (await dbAsync())
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("review_status", "pending")
    .not("cargo_photo_path", "is", null);
  if (providerId) query = query.eq("provider_id", providerId);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/** Record a provider/admin decision. Does not touch the booking status. */
export async function setCargoReview(
  id: string,
  patch: {
    status: CargoReviewStatus;
    note: string;
    reviewedAt: string;
    reviewerId: string;
    updatedAt: string;
  },
): Promise<Booking | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("bookings")
    .update({
      review_status: patch.status,
      review_note: patch.note,
      reviewed_at: patch.reviewedAt,
      reviewer_id: patch.reviewerId,
      updated_at: patch.updatedAt,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? toBooking(data) : undefined;
}

// ---------------- cargo photo history ----------------

function toCargoPhotoHistoryEntry(row: Record<string, unknown>): CargoPhotoHistoryEntry {
  return {
    id: String(row["id"]),
    bookingId: String(row["booking_id"]),
    path: String(row["path"]),
    label: String(row["label"] ?? ""),
    bytes: row["bytes"] == null ? null : Number(row["bytes"]),
    uploadedAt: iso(row["uploaded_at"] as string),
    supersededAt: iso(row["superseded_at"] as string),
    reason: (row["reason"] as CargoPhotoSupersedeReason | null) ?? "replaced",
    reviewStatus: (row["review_status"] as CargoReviewStatus | null) ?? null,
    reviewNote: String(row["review_note"] ?? ""),
    reviewedAt: isoOrNull(row["reviewed_at"] as string | null),
    reviewerId: (row["reviewer_id"] as string | null) ?? null,
  };
}

/** Archived earlier versions of a booking's cargo photo, newest first. */
export async function listCargoPhotoHistory(
  bookingId: string,
  limit = 20,
): Promise<CargoPhotoHistoryEntry[]> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("cargo_photo_history")
    .select("*")
    .eq("booking_id", bookingId)
    .order("superseded_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toCargoPhotoHistoryEntry);
}

/**
 * Archive one superseded photo. The unique (booking_id, path) index makes this
 * idempotent, which is what lets a photo be archived when the provider reopens
 * it *and* again when the trader replaces it, while keeping the decision that
 * was recorded at reopen time.
 */
export async function archiveCargoPhoto(row: {
  id: string;
  bookingId: string;
  path: string;
  label: string;
  bytes: number | null;
  uploadedAt: string;
  supersededAt: string;
  reason: CargoPhotoSupersedeReason;
  reviewStatus: CargoReviewStatus | null;
  reviewNote: string;
  reviewedAt: string | null;
  reviewerId: string | null;
}): Promise<void> {
  const { error } = await (await dbAsync()).from("cargo_photo_history").upsert(
    {
      id: row.id,
      booking_id: row.bookingId,
      path: row.path,
      label: row.label,
      bytes: row.bytes,
      uploaded_at: row.uploadedAt,
      superseded_at: row.supersededAt,
      reason: row.reason,
      review_status: row.reviewStatus,
      review_note: row.reviewNote,
      reviewed_at: row.reviewedAt,
      reviewer_id: row.reviewerId,
    },
    { onConflict: "booking_id,path", ignoreDuplicates: true },
  );
  if (error) throw error;
}

/**
 * How many versions are archived per booking, for a whole list in one query
 * (PostgREST has no group-by, so the small row set is tallied here).
 */
export async function countCargoPhotoHistoryFor(
  bookingIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const ids = [...new Set(bookingIds)].filter((id) => id.length > 0);
  if (ids.length === 0) return counts;
  const { data, error } = await (
    await dbAsync()
  )
    .from("cargo_photo_history")
    .select("booking_id")
    .in("booking_id", ids);
  if (error) throw error;
  for (const row of data ?? []) {
    const id = String((row as Record<string, unknown>)["booking_id"]);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

// ---------------- cargo boxes ----------------

export async function listCargoBoxesForBooking(bookingId: string): Promise<CargoBox[]> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("cargo_boxes")
    .select("*")
    .eq("booking_id", bookingId)
    .order("id");
  if (error) throw error;
  return (data ?? []).map(toCargoBox);
}

export async function findCargoBoxById(id: string): Promise<CargoBox | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("cargo_boxes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toCargoBox(data) : undefined;
}

export async function insertCargoBox(box: CargoBox): Promise<CargoBox> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("cargo_boxes")
    .insert({
      id: box.id,
      booking_id: box.bookingId,
      label: box.label,
      length_cm: box.lengthCm,
      width_cm: box.widthCm,
      height_cm: box.heightCm,
      weight_kg: box.weightKg,
      fragile: box.fragile,
      hue: box.hue,
      placement: box.placement,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toCargoBox(data);
}

export async function updateCargoBoxPlacement(
  id: string,
  placement: Placement | null,
): Promise<CargoBox | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("cargo_boxes")
    .update({ placement })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? toCargoBox(data) : undefined;
}

export async function updateCargoBoxFields(
  id: string,
  patch: {
    label: string;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    weightKg: number;
    fragile: boolean;
    placement: Placement | null;
  },
): Promise<CargoBox | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("cargo_boxes")
    .update({
      label: patch.label,
      length_cm: patch.lengthCm,
      width_cm: patch.widthCm,
      height_cm: patch.heightCm,
      weight_kg: patch.weightKg,
      fragile: patch.fragile,
      placement: patch.placement,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? toCargoBox(data) : undefined;
}

export async function deleteCargoBox(id: string): Promise<void> {
  const { error } = await (await dbAsync()).from("cargo_boxes").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteCargoBoxesForBooking(bookingId: string): Promise<void> {
  const { error } = await (
    await dbAsync()
  )
    .from("cargo_boxes")
    .delete()
    .eq("booking_id", bookingId);
  if (error) throw error;
}
