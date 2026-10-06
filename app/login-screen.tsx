"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, LockKeyhole, ScanLine, ShieldCheck, UserRound } from "lucide-react";
import type { AuthUser, UserRole } from "@/lib/auth-types";

type LoginResponse = { user?: AuthUser; error?: string };

export default function LoginScreen({ onSignedIn, initialError }: { onSignedIn: (user: AuthUser) => void; initialError: string }) {
  const [role, setRole] = useState<UserRole>("INSPECTOR");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, requestedRole: role }),
      });
      const data = await response.json() as LoginResponse;
      if (!response.ok || !data.user) throw new Error(data.error ?? "Unable to sign in.");
      onSignedIn(data.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-page">
    <section className="auth-intro">
      <div className="auth-brand"><span className="brand-icon"><ScanLine/></span><span>SATYA <span className="brand-light">SCAN</span><small>THE SIXTH SENSE</small></span></div>
      <div className="auth-copy">
        <span className="eyebrow">SECURE INSPECTION WORKSPACE</span>
        <h1>Every declaration.<br/><span>Backed by evidence.</span></h1>
        <p>Role-based access keeps inspection records, evidence and final decisions with the people authorized to review them.</p>
      </div>
      <div className="auth-points">
        <p><ShieldCheck size={18}/> Protected inspection history and evidence</p>
        <p><UserRound size={18}/> Administrator and inspector access controls</p>
      </div>
    </section>
    <section className="auth-panel-wrap">
      <form className="auth-panel" onSubmit={submit}>
        <div className="auth-panel-heading"><span className="eyebrow">SATYA SCAN ACCESS</span><h2>Sign in to your workspace</h2><p>Select the access type assigned to your account.</p></div>
        <div className="role-picker" aria-label="Select account type">
          <button type="button" className={role === "INSPECTOR" ? "selected" : ""} onClick={() => setRole("INSPECTOR")}><UserRound size={18}/><span>Inspector<small>My inspections and reviews</small></span></button>
          <button type="button" className={role === "ADMIN" ? "selected" : ""} onClick={() => setRole("ADMIN")}><ShieldCheck size={18}/><span>Administrator<small>Authorized team oversight</small></span></button>
        </div>
        {error && <div role="alert" className="auth-error">{error}</div>}
        <label>Work email<input autoComplete="email" type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="name@organization.in"/></label>
        <label>Password<input autoComplete="current-password" type="password" required maxLength={128} value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password"/></label>
        <button className="btn primary auth-submit" disabled={busy} type="submit"><LockKeyhole size={16}/>{busy ? "Signing in…" : `Sign in as ${role === "ADMIN" ? "Administrator" : "Inspector"}`}<ArrowRight size={16}/></button>
        <p className="auth-help">Accounts are provisioned by an administrator. Public registration is disabled.</p>
      </form>
    </section>
  </main>;
}
