/**
 * Repository for lanes and containers (catalog + capacity).
 * See `./users.ts` for the module-level design note.
 */
import { dbAsync } from "@/server/db/client";
import type { Container, ContainerStatus, Lane, RouteMode } from "@/domain/types";

function iso(value: string | null | undefined): string {
  return value ? new Date(value).toISOString() : new Date(0).toISOString();
}

function toLane(row: Record<string, unknown>): Lane {
  return {
    id: String(row["id"]),
    providerId: String(row["provider_id"]),
    origin: String(row["origin"]),
    destination: String(row["destination"]),
    mode: row["mode"] as RouteMode,
    scheduledAt: iso(row["scheduled_at"] as string),
    createdAt: iso(row["created_at"] as string),
  };
}

function toContainer(row: Record<string, unknown>): Container {
  return {
    id: String(row["id"]),
    providerId: String(row["provider_id"]),
    laneId: String(row["lane_id"]),
    label: String(row["label"]),
    capacityM3: Number(row["capacity_m3"]),
    availableM3: Number(row["available_m3"]),
    pricePerM3: Number(row["price_per_m3"]),
    status: row["status"] as ContainerStatus,
    createdAt: iso(row["created_at"] as string),
  };
}

// ---------------- lanes ----------------

export async function listAllLanes(): Promise<Lane[]> {
  const { data, error } = await (await dbAsync()).from("lanes").select("*").order("scheduled_at");
  if (error) throw error;
  return (data ?? []).map(toLane);
}

export async function findLaneById(id: string): Promise<Lane | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("lanes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toLane(data) : undefined;
}

export async function insertLane(row: {
  id: string;
  providerId: string;
  origin: string;
  destination: string;
  mode: RouteMode;
  scheduledAt: string;
  createdAt: string;
}): Promise<Lane> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("lanes")
    .insert({
      id: row.id,
      provider_id: row.providerId,
      origin: row.origin,
      destination: row.destination,
      mode: row.mode,
      scheduled_at: row.scheduledAt,
      created_at: row.createdAt,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toLane(data);
}

// ---------------- containers ----------------

export async function listAllContainers(): Promise<Container[]> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("containers")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map(toContainer);
}

export async function findContainerById(id: string): Promise<Container | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("containers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toContainer(data) : undefined;
}

export async function insertContainer(row: {
  id: string;
  providerId: string;
  laneId: string;
  label: string;
  capacityM3: number;
  availableM3: number;
  pricePerM3: number;
  status: ContainerStatus;
  createdAt: string;
}): Promise<Container> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("containers")
    .insert({
      id: row.id,
      provider_id: row.providerId,
      lane_id: row.laneId,
      label: row.label,
      capacity_m3: row.capacityM3,
      available_m3: row.availableM3,
      price_per_m3: row.pricePerM3,
      status: row.status,
      created_at: row.createdAt,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toContainer(data);
}

export async function updateContainerFields(
  id: string,
  patch: { availableM3?: number; pricePerM3?: number; status?: ContainerStatus },
): Promise<Container | undefined> {
  const payload: Record<string, unknown> = {};
  if (patch.availableM3 !== undefined) payload["available_m3"] = patch.availableM3;
  if (patch.pricePerM3 !== undefined) payload["price_per_m3"] = patch.pricePerM3;
  if (patch.status !== undefined) payload["status"] = patch.status;
  if (Object.keys(payload).length === 0) return findContainerById(id);
  const { data, error } = await (
    await dbAsync()
  )
    .from("containers")
    .update(payload)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? toContainer(data) : undefined;
}
