/**
 * Repository for escrow, messaging, notifications, verification and audit rows.
 * See `./users.ts` for the module-level design note.
 */
import { dbAsync } from "@/server/db/client";
import type {
  AuditEvent,
  Message,
  Notification,
  Payment,
  PaymentStatus,
  ProviderVerification,
  Thread,
  VerificationStatus,
} from "@/domain/types";

function iso(value: string | null | undefined): string {
  return value ? new Date(value).toISOString() : new Date(0).toISOString();
}

function isoOrNull(value: string | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

// ---------------- payments ----------------

function toPayment(row: Record<string, unknown>): Payment {
  return {
    id: String(row["id"]),
    bookingId: String(row["booking_id"]),
    traderId: String(row["trader_id"]),
    providerId: String(row["provider_id"]),
    amount: Number(row["amount"]),
    currency: String(row["currency"]),
    status: row["status"] as PaymentStatus,
    createdAt: iso(row["created_at"] as string),
    updatedAt: iso(row["updated_at"] as string),
  };
}

export async function listAllPayments(): Promise<Payment[]> {
  const { data, error } = await (await dbAsync()).from("payments").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []).map(toPayment);
}

export async function findPaymentByBooking(bookingId: string): Promise<Payment | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("payments")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error) throw error;
  return data ? toPayment(data) : undefined;
}

export async function insertPayment(row: {
  id: string;
  bookingId: string;
  traderId: string;
  providerId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}): Promise<Payment> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("payments")
    .insert({
      id: row.id,
      booking_id: row.bookingId,
      trader_id: row.traderId,
      provider_id: row.providerId,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toPayment(data);
}

export async function updatePaymentFields(
  id: string,
  patch: { status?: PaymentStatus; updatedAt: string },
): Promise<Payment | undefined> {
  const payload: Record<string, unknown> = { updated_at: patch.updatedAt };
  if (patch.status !== undefined) payload["status"] = patch.status;
  const { data, error } = await (
    await dbAsync()
  )
    .from("payments")
    .update(payload)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? toPayment(data) : undefined;
}

// ---------------- threads & messages ----------------

function toThread(row: Record<string, unknown>): Thread {
  return {
    id: String(row["id"]),
    bookingId: String(row["booking_id"]),
    traderId: String(row["trader_id"]),
    providerId: String(row["provider_id"]),
    createdAt: iso(row["created_at"] as string),
  };
}

function toMessage(row: Record<string, unknown>): Message {
  return {
    id: String(row["id"]),
    threadId: String(row["thread_id"]),
    senderId: String(row["sender_id"]),
    senderName: String(row["sender_name"]),
    body: String(row["body"]),
    createdAt: iso(row["created_at"] as string),
  };
}

export async function listAllThreads(): Promise<Thread[]> {
  const { data, error } = await (await dbAsync()).from("threads").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []).map(toThread);
}

export async function findThreadById(id: string): Promise<Thread | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("threads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toThread(data) : undefined;
}

export async function findThreadByBooking(bookingId: string): Promise<Thread | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("threads")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error) throw error;
  return data ? toThread(data) : undefined;
}

export async function insertThread(row: {
  id: string;
  bookingId: string;
  traderId: string;
  providerId: string;
  createdAt: string;
}): Promise<Thread> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("threads")
    .insert({
      id: row.id,
      booking_id: row.bookingId,
      trader_id: row.traderId,
      provider_id: row.providerId,
      created_at: row.createdAt,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toThread(data);
}

export async function listMessagesForThreads(threadIds: string[]): Promise<Message[]> {
  if (threadIds.length === 0) return [];
  const { data, error } = await (
    await dbAsync()
  )
    .from("messages")
    .select("*")
    .in("thread_id", threadIds)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map(toMessage);
}

export async function insertMessage(row: {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
}): Promise<Message> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("messages")
    .insert({
      id: row.id,
      thread_id: row.threadId,
      sender_id: row.senderId,
      sender_name: row.senderName,
      body: row.body,
      created_at: row.createdAt,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toMessage(data);
}

// ---------------- notifications ----------------

function toNotification(row: Record<string, unknown>): Notification {
  return {
    id: String(row["id"]),
    userId: String(row["user_id"]),
    kind: row["kind"] as Notification["kind"],
    title: String(row["title"]),
    body: String(row["body"]),
    link: (row["link"] as string | null) ?? null,
    read: Boolean(row["read"]),
    createdAt: iso(row["created_at"] as string),
  };
}

export async function listNotificationsForUser(userId: string): Promise<Notification[]> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toNotification);
}

export async function insertNotification(row: {
  id: string;
  userId: string;
  kind: Notification["kind"];
  title: string;
  body: string;
  link: string | null;
  createdAt: string;
}): Promise<Notification> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("notifications")
    .insert({
      id: row.id,
      user_id: row.userId,
      kind: row.kind,
      title: row.title,
      body: row.body,
      link: row.link,
      read: false,
      created_at: row.createdAt,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toNotification(data);
}

export async function markNotificationRead(
  id: string,
  userId: string,
): Promise<Notification | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? toNotification(data) : undefined;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false)
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}

// ---------------- provider verification ----------------

function toVerification(row: Record<string, unknown>): ProviderVerification {
  return {
    id: String(row["id"]),
    providerId: String(row["provider_id"]),
    legalName: String(row["legal_name"]),
    registrationNo: String(row["registration_no"]),
    taxId: String(row["tax_id"]),
    contactEmail: String(row["contact_email"]),
    contactPhone: String(row["contact_phone"]),
    fleetSize: Number(row["fleet_size"]),
    documentRefs: String(row["document_refs"]),
    status: row["status"] as VerificationStatus,
    submittedAt: iso(row["submitted_at"] as string),
    reviewedAt: isoOrNull(row["reviewed_at"] as string | null),
    reviewerId: (row["reviewer_id"] as string | null) ?? null,
    reviewNote: String(row["review_note"] ?? ""),
  };
}

export async function listAllVerifications(): Promise<ProviderVerification[]> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("verifications")
    .select("*")
    .order("submitted_at");
  if (error) throw error;
  return (data ?? []).map(toVerification);
}

export async function findVerificationByProvider(
  providerId: string,
): Promise<ProviderVerification | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("verifications")
    .select("*")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (error) throw error;
  return data ? toVerification(data) : undefined;
}

export async function insertVerification(
  record: ProviderVerification,
): Promise<ProviderVerification> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("verifications")
    .insert({
      id: record.id,
      provider_id: record.providerId,
      legal_name: record.legalName,
      registration_no: record.registrationNo,
      tax_id: record.taxId,
      contact_email: record.contactEmail,
      contact_phone: record.contactPhone,
      fleet_size: record.fleetSize,
      document_refs: record.documentRefs,
      status: record.status,
      submitted_at: record.submittedAt,
      reviewed_at: record.reviewedAt,
      reviewer_id: record.reviewerId,
      review_note: record.reviewNote,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toVerification(data);
}

export async function updateVerification(
  id: string,
  patch: {
    legalName: string;
    registrationNo: string;
    taxId: string;
    contactEmail: string;
    contactPhone: string;
    fleetSize: number;
    documentRefs: string;
    status: VerificationStatus;
    submittedAt: string;
    reviewedAt: string | null;
    reviewerId: string | null;
    reviewNote: string;
  },
): Promise<ProviderVerification | undefined> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("verifications")
    .update({
      legal_name: patch.legalName,
      registration_no: patch.registrationNo,
      tax_id: patch.taxId,
      contact_email: patch.contactEmail,
      contact_phone: patch.contactPhone,
      fleet_size: patch.fleetSize,
      document_refs: patch.documentRefs,
      status: patch.status,
      submitted_at: patch.submittedAt,
      reviewed_at: patch.reviewedAt,
      reviewer_id: patch.reviewerId,
      review_note: patch.reviewNote,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? toVerification(data) : undefined;
}

// ---------------- audit ----------------

function toAudit(row: Record<string, unknown>): AuditEvent {
  return {
    id: String(row["id"]),
    actorId: String(row["actor_id"]),
    actorName: String(row["actor_name"]),
    action: String(row["action"]),
    target: String(row["target"]),
    at: iso(row["at"] as string),
  };
}

export async function insertAudit(event: AuditEvent): Promise<void> {
  const { error } = await (await dbAsync()).from("audit_events").insert({
    id: event.id,
    actor_id: event.actorId,
    actor_name: event.actorName,
    action: event.action,
    target: event.target,
    at: event.at,
  });
  if (error) throw error;
}

export async function listRecentAudit(limit: number): Promise<AuditEvent[]> {
  const { data, error } = await (
    await dbAsync()
  )
    .from("audit_events")
    .select("*")
    .order("at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toAudit);
}

export async function countMessages(): Promise<number> {
  const { count, error } = await (
    await dbAsync()
  )
    .from("messages")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
