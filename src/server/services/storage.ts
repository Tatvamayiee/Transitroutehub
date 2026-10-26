/**
 * Cargo-photo storage — the private `cargo-photos` Supabase Storage bucket.
 *
 * Access model:
 *  - the bucket is private, so objects are never publicly readable;
 *  - every object is keyed by booking (`<booking-id>/<stamp>-<rand>.<ext>`);
 *  - all calls here run on a client that carries the *caller's* GoTrue token, so
 *    the storage policies in 0002_cargo_photo_review.sql (`can_access_cargo_photo`)
 *    decide access with `auth.uid()` — the server never needs a service-role key;
 *  - reads hand out short-lived signed URLs instead of exposing paths.
 *
 * The server still authorizes the operation first (see services/cargo.ts); the
 * policies are defence in depth, not the only gate.
 */

import { CODE, failure, success } from "@/domain/results";
import type { Result } from "@/domain/results";
import { dbAs } from "@/server/db/client";

export const CARGO_PHOTO_BUCKET = "cargo-photos";
/** 3 MiB — mirrors the bucket's file_size_limit and keeps base64 bodies small. */
export const MAX_CARGO_PHOTO_BYTES = 3 * 1024 * 1024;
export const CARGO_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type CargoPhotoType = (typeof CARGO_PHOTO_TYPES)[number];

const EXTENSION: Record<CargoPhotoType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function isCargoPhotoType(value: string): value is CargoPhotoType {
  return (CARGO_PHOTO_TYPES as readonly string[]).includes(value);
}

/** Verify the bytes really are the image type the client claims. */
function sniffImageType(bytes: Uint8Array): CargoPhotoType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((byte, index) => bytes[index] === byte)) {
    return "image/png";
  }
  if (bytes.length >= 12) {
    const riff = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
    const webp = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
    if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  }
  return null;
}

function base64ToBytes(input: string): Uint8Array | null {
  // Accept a raw base64 payload or a data URL from the browser.
  const comma = input.startsWith("data:") ? input.indexOf(",") : -1;
  const payload = comma >= 0 ? input.slice(comma + 1) : input;
  const normalized = payload.replace(/\s+/g, "");
  if (normalized.length === 0) return null;
  try {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export type DecodedPhoto = { bytes: Uint8Array; contentType: CargoPhotoType };

/** Validate a client payload: declared type, real signature, and size ceiling. */
export function decodeCargoPhoto(input: {
  contentType: string;
  dataBase64: string;
}): Result<DecodedPhoto> {
  if (!isCargoPhotoType(input.contentType)) {
    return failure(CODE.PHOTO_INVALID, "Cargo photos must be JPEG, PNG or WebP images.");
  }
  const bytes = base64ToBytes(input.dataBase64);
  if (!bytes || bytes.length === 0) {
    return failure(CODE.PHOTO_INVALID, "That file could not be read as an image.");
  }
  if (bytes.length > MAX_CARGO_PHOTO_BYTES) {
    return failure(
      CODE.PHOTO_TOO_LARGE,
      `Photographs must be ${MAX_CARGO_PHOTO_BYTES / (1024 * 1024)} MB or smaller after compression.`,
    );
  }
  const sniffed = sniffImageType(bytes);
  if (sniffed !== input.contentType) {
    return failure(CODE.PHOTO_INVALID, "The file content does not match its declared image type.");
  }
  return success({ bytes, contentType: sniffed });
}

function randomSuffix(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function storageMessage(message: string): string {
  if (/bucket not found/i.test(message)) {
    return "Cargo photo storage is not provisioned — apply supabase/migrations/0002_cargo_photo_review.sql.";
  }
  if (/row-level security|policy/i.test(message)) {
    return "Storage refused this photo for your account. Sign in again and retry.";
  }
  return `Photo storage rejected the upload: ${message}`;
}

/** Upload one photo as the caller. Returns the storage object path. */
export async function uploadCargoPhotoObject(
  token: string,
  bookingId: string,
  photo: DecodedPhoto,
): Promise<Result<{ path: string; bytes: number }>> {
  try {
    const client = await dbAs(token);
    const path = `${bookingId}/${Date.now().toString(36)}-${randomSuffix()}.${EXTENSION[photo.contentType]}`;
    const { error } = await client.storage
      .from(CARGO_PHOTO_BUCKET)
      .upload(path, photo.bytes, { contentType: photo.contentType, upsert: false });
    if (error) {
      return failure(CODE.STORAGE_FAILED, storageMessage(error.message));
    }
    return success({ path, bytes: photo.bytes.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failure(CODE.STORAGE_FAILED, storageMessage(message));
  }
}

/** Best-effort removal of a replaced photo. Never fails the caller's action. */
export async function removeCargoPhotoObject(token: string, path: string): Promise<void> {
  try {
    const client = await dbAs(token);
    await client.storage.from(CARGO_PHOTO_BUCKET).remove([path]);
  } catch {
    // Orphaned objects are harmless and unreadable without a signed URL.
  }
}

/**
 * Mint short-lived signed URLs for a set of object paths in one round trip.
 * Unreadable paths are simply omitted, so a stale row never breaks a page.
 */
export async function signedCargoPhotoUrls(
  token: string,
  paths: string[],
  expiresInSeconds = 600,
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((path) => path.length > 0))];
  const out = new Map<string, string>();
  if (unique.length === 0 || !token) return out;
  try {
    const client = await dbAs(token);
    const { data, error } = await client.storage
      .from(CARGO_PHOTO_BUCKET)
      .createSignedUrls(unique, expiresInSeconds);
    if (error || !data) return out;
    for (const entry of data) {
      if (entry.signedUrl && entry.path) out.set(entry.path, entry.signedUrl);
    }
  } catch {
    // Preview is a convenience; the upload/review actions still work.
  }
  return out;
}
