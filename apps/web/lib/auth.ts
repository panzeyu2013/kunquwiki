"use client";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  roles: string[];
  status?: string;
  reputation?: number;
};

const TOKEN_KEY = "kunquwiki_token";

export function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return null;
    }
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

export function hasRole(user: { roles: string[] } | null | undefined, role: string) {
  return Boolean(user?.roles.includes(role));
}
