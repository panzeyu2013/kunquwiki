"use client";

import { useEffect, useState } from "react";
import { clearStoredToken, getStoredToken, hasRole, type AuthUser } from "../../lib/auth";
import { getMe } from "../../lib/api-client";

export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setReady(true);
      return;
    }

    getMe()
      .then((currentUser) => {
        setUser(currentUser);
      })
      .catch(() => {
        clearStoredToken();
        setUser(null);
      })
      .finally(() => {
        setReady(true);
      });
  }, []);

  return {
    user,
    ready,
    hasRole: (role: string) => hasRole(user, role)
  };
}
