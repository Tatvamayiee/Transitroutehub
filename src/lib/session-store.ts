/**
 * Client-side session bridge.
 *
 * The session token is issued and owned by the server; the client only holds an
 * opaque handle to it so it can attach it to server function calls. No password
 * hashes, credential data or server logic live here.
 */

import { useSyncExternalStore } from "react";
import type { User } from "@/domain/types";

export type ClientAuthState = {
  token: string | null;
  user: User | null;
};

const STORAGE_KEY = "trh.session.v1";

const emptyState: ClientAuthState = { token: null, user: null };

let state: ClientAuthState = emptyState;
let hydrated = false;
const listeners = new Set<() => void>();

export function setSession(next: ClientAuthState): void {
  state = next;
  if (typeof window !== "undefined") {
    try {
      if (next.token) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable — keep in-memory only */
    }
  }
  listeners.forEach((listener) => listener());
}

export function hydrateSession(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as ClientAuthState;
    if (parsed.token && parsed.user) state = parsed;
  } catch {
    /* ignore corrupt storage */
  }
}

export function clearSession(): void {
  setSession(emptyState);
}

/** Non-reactive read, for event handlers. */
export function currentToken(): string | null {
  hydrateSession();
  return state.token;
}

export function useClientAuthState(): ClientAuthState {
  return useSyncExternalStore(
    (listener) => {
      hydrateSession();
      listeners.add(listener);
      listener();
      return () => listeners.delete(listener);
    },
    () => state,
    () => emptyState,
  );
}
