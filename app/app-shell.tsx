"use client";

import { useEffect, useState } from "react";
import AdminPortal from "./admin-portal";
import InspectorPortal from "./inspector-portal";
import LoginScreen from "./login-screen";
import type { AuthUser } from "@/lib/auth-types";

type SessionResponse = { user: AuthUser | null; error?: string };

export default function AppShell() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async response => {
        const data = await response.json() as SessionResponse;
        if (!response.ok) throw new Error(data.error ?? "Unable to check the current session.");
        setUser(data.user);
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Unable to check the current session."))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  if (loading) return <main className="auth-loading" aria-live="polite">Loading secure workspace…</main>;
  if (!user) return <LoginScreen onSignedIn={setUser} initialError={error}/>;
  if (user.role === "INSPECTOR") return <InspectorPortal user={user} onLogout={logout}/>;
  return <AdminPortal user={user} onLogout={logout}/>;
}
