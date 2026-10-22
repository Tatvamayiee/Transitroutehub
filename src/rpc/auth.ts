/**
 * Server functions for authentication.
 * These are the only entry points the client has for auth mutations.
 */

import { createServerFn } from "@tanstack/react-start";
import { CODE, failure } from "@/domain/results";
import {
  loginSchema,
  logoutSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/domain/validation";
import { loginUser, logoutUser, registerUser, resetPassword } from "@/server/services/auth";
import { checkRateLimit, clearRateLimit } from "@/server/services/rate-limit";

/**
 * Per-request-ish bucket key. This is a best-effort brute-force damper, not a
 * security control — a real deployment would key on the client address.
 */
function rateKey(scope: string): string {
  return `${scope}:${Math.random().toString(36).slice(2, 10)}`;
}

function rateLimit(scope: string) {
  const key = rateKey(scope);
  if (!checkRateLimit(key)) {
    return {
      key,
      blocked: failure(CODE.RATE_LIMITED, "Too many attempts. Please wait a moment and retry."),
    };
  }
  return { key, blocked: null };
}

export const serverRegisterUser = createServerFn({ method: "POST" })
  .validator(registerSchema)
  .handler(async ({ data }) => {
    const { key, blocked } = rateLimit("register");
    if (blocked) return blocked;
    const result = await registerUser({
      name: data.name,
      email: data.email,
      company: data.company,
      role: data.role,
      password: data.password,
    });
    if (result.ok) clearRateLimit(key);
    return result;
  });

export const serverLoginUser = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }) => {
    const { key, blocked } = rateLimit("login");
    if (blocked) return blocked;
    const result = await loginUser({ email: data.email, password: data.password });
    if (result.ok) clearRateLimit(key);
    return result;
  });

export const serverLogout = createServerFn({ method: "POST" })
  .validator(logoutSchema)
  .handler(async ({ data }) => logoutUser(data.token));

export const serverResetPassword = createServerFn({ method: "POST" })
  .validator(resetPasswordSchema)
  .handler(async ({ data }) => {
    const { key, blocked } = rateLimit("reset");
    if (blocked) return blocked;
    const result = await resetPassword({ email: data.email, password: data.password });
    if (result.ok) clearRateLimit(key);
    return result;
  });
