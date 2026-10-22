/**
 * Thin client-only auth view layer.
 *
 * The client never sees password hashes, user storage or session internals. It only:
 *  - renders the signed-in user from the session bridge
 *  - calls server functions for register / login / reset / logout
 *  - exposes role labels and permission helpers for the UI
 */

import { ROLE_LABELS, ROLE_PERMISSIONS } from "@/domain/types";
import type { User, UserRole } from "@/domain/types";
import { serverLoginUser, serverLogout, serverRegisterUser, serverResetPassword } from "@/rpc";
import { clearSession, currentToken, setSession, useClientAuthState } from "@/lib/session-store";

export type { User, UserRole };
export { ROLE_LABELS, ROLE_PERMISSIONS };

export function useCurrentUser(): User | null {
  return useClientAuthState().user;
}

export function useToken(): string | null {
  return useClientAuthState().token;
}

export function useRole(): UserRole | null {
  return useClientAuthState().user?.role ?? null;
}

export async function registerUser(input: {
  name: string;
  email: string;
  company: string;
  role: UserRole;
  password: string;
  confirm: string;
}) {
  const result = await serverRegisterUser({ data: input });
  if (!result.ok) return result;
  setSession({ token: result.value.token, user: result.value.user });
  return result;
}

export async function loginUser(email: string, password: string) {
  const result = await serverLoginUser({ data: { email, password } });
  if (!result.ok) return result;
  setSession({ token: result.value.token, user: result.value.user });
  return result;
}

export async function resetPassword(email: string, password: string, confirm: string) {
  return serverResetPassword({ data: { email, password, confirm } });
}

export function logout(): void {
  const token = currentToken() ?? "";
  clearSession();
  // Best-effort server-side revoke; the client never blocks sign-out on it.
  if (token) void serverLogout({ data: { token } });
}

export function canManageRoutes(role: UserRole | null): boolean {
  return role === "provider" || role === "admin";
}

export function isAdmin(role: UserRole | null): boolean {
  return role === "admin";
}
