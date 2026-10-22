/**
 * Server-side auth primitives.
 * These run only on the server. No password hash is ever returned to the client.
 */

import { ROLE_PERMISSIONS } from "./types";
import type { UserRole } from "./types";

export type Session = {
  id: string;
  userId: string;
  role: UserRole;
  expiresAt: number;
};

const HASH_VERSION = "6";
const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length === 0 || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const value = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (!Number.isFinite(value)) return null;
    bytes[i] = value;
  }
  return bytes;
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const keyMaterial = new TextEncoder().encode(password);
  const imported = await crypto.subtle.importKey("raw", keyMaterial, "PBKDF2", false, [
    "deriveBits",
  ]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    imported,
    KEY_BITS,
  );
  return new Uint8Array(derived as ArrayBuffer);
}

/**
 * Per-user password hashing using Web Crypto PBKDF2 with a random salt.
 * The stored value encodes version:iterations:salt:derivedKey.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await derive(password, salt, PBKDF2_ITERATIONS);
  return `${HASH_VERSION}:${PBKDF2_ITERATIONS}:${toHex(salt)}:${toHex(derived)}`;
}

/** Verify a password against a stored PBKDF2 payload in constant time. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4) return false;
  const [version, iterationsRaw, saltHex, derivedHex] = parts;
  if (version !== HASH_VERSION || !iterationsRaw || !saltHex || !derivedHex) return false;

  const iterations = Number.parseInt(iterationsRaw, 10);
  if (!Number.isFinite(iterations) || iterations < 1) return false;

  const salt = fromHex(saltHex);
  const expected = fromHex(derivedHex);
  if (!salt || !expected) return false;
  if (salt.byteLength !== SALT_BYTES || expected.byteLength !== KEY_BITS / 8) return false;

  const actual = await derive(password, salt, iterations);
  return constantTimeEqual(actual, expected);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

/** Random session token (also used to mint opaque row ids). */
export function createSessionId(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

/** Role → allowed actions. */
export function permissionsFor(role: UserRole): string[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
