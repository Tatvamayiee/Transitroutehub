/**
 * Repository for bookings and cargo boxes (the 3D load-plan data).
 * See `./users.ts` for the module-level design note.
 */
import { dbAsync } from "@/server/db/client";
import type { CargoBox, Placement } from "@/domain/loading";
import type { Booking, BookingStatus } from "@/domain/types";

function iso(value: string | null | undefined): string {
  return value ? new Date(value).toISOString() : new Date(0).toISOString();
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
