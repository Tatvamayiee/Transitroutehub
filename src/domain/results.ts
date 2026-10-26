/**
 * Stable result types for server functions and services.
 * Success carries a payload; Failure carries a stable code + message.
 * This avoids ad-hoc { ok, user?, error? } shapes and lets clients
 * map internal failures to safe user-facing messages.
 */

export type ResultSuccess<T> = {
  ok: true;
  value: T;
};

export type ResultFailure = {
  ok: false;
  code: string;
  message: string;
};

export type Result<T> = ResultSuccess<T> | ResultFailure;

export function success<T>(value: T): ResultSuccess<T> {
  return { ok: true, value };
}

export function failure(code: string, message: string): ResultFailure {
  return { ok: false, code, message };
}

/**
 * Stable error codes used by the auth and data services.
 * Client code should map these to user-facing text; internals stay server-only.
 */
export const CODE = {
  // auth
  EMAIL_TAKEN: "EMAIL_TAKEN",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  UNKNOWN_EMAIL: "UNKNOWN_EMAIL",
  SESSION_INVALID: "SESSION_INVALID",
  ROLE_MISMATCH: "ROLE_MISMATCH",
  UNAUTHORIZED: "UNAUTHORIZED",
  RATE_LIMITED: "RATE_LIMITED",

  // data
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  INVALID_INPUT: "INVALID_INPUT",
  CAPACITY_EXCEEDED: "CAPACITY_EXCEEDED",
  ALREADY_BOOKED: "ALREADY_BOOKED",
  CONTAINER_UNAVAILABLE: "CONTAINER_UNAVAILABLE",

  // loading
  PLACEMENT_INVALID: "PLACEMENT_INVALID",

  // payments
  ALREADY_FUNDED: "ALREADY_FUNDED",
  NOT_FUNDED: "NOT_FUNDED",
  INVALID_TRANSITION: "INVALID_TRANSITION",

  // verification
  ALREADY_PENDING: "ALREADY_PENDING",
  ALREADY_APPROVED: "ALREADY_APPROVED",

  // cargo photos
  PHOTO_REQUIRED: "PHOTO_REQUIRED",
  PHOTO_INVALID: "PHOTO_INVALID",
  PHOTO_TOO_LARGE: "PHOTO_TOO_LARGE",
  PHOTO_ALREADY_REVIEWED: "PHOTO_ALREADY_REVIEWED",
  STORAGE_FAILED: "STORAGE_FAILED",

  // messaging
  THREAD_FORBIDDEN: "THREAD_FORBIDDEN",
} as const;
