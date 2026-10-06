"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, PauseCircle, PlayCircle, UserPlus, UsersRound, X } from "lucide-react";

type Inspector = { id: string; email: string; displayName: string; role: "ADMIN" | "INSPECTOR"; active: number; createdAt: string };

export default function AdminUserManager({ inline = false, onChanged }: { inline?: boolean; onChanged?: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      const data = await response.json() as Inspector[] & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to load inspector accounts.");
      setInspectors(data.filter(user => user.role === "INSPECTOR"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load inspector accounts.");
    }
  };

  const createInspector = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: form.get("displayName"), email: form.get("email"), password: form.get("password") }),
      });
      const data = await response.json() as { user?: Inspector; error?: string };
      if (!response.ok || !data.user) throw new Error(data.error ?? "Unable to provision this inspector.");
      const newInspector = data.user;
      event.currentTarget.reset();
      setInspectors(current => [...current, newInspector].sort((left, right) => left.displayName.localeCompare(right.displayName)));
      setNotice(`${newInspector.displayName} can now sign in as an Inspector.`);
      void onChanged?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to provision this inspector.");
    } finally {
      setSaving(false);
    }
  };

  const changeAccess = async (inspector: Inspector) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/users/${inspector.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !inspector.active }) });
      const data = await response.json() as { user?: Inspector; error?: string };
      if (!response.ok || !data.user) throw new Error(data.error ?? "Unable to update this Inspector account.");
      setInspectors(current => current.map(entry => entry.id === inspector.id ? data.user! : entry));
      setNotice(inspector.active ? `${inspector.displayName}'s access was suspended and active sessions were revoked.` : `${inspector.displayName}'s access was restored.`);
      void onChanged?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update this Inspector account.");
    } finally {
      setSaving(false);
    }
  };

  const openManager = () => { setOpen(true); void loadUsers(); };
  return <>
    <button className={inline ? "btn admin-account-trigger" : "manage-inspectors"} onClick={openManager}><UsersRound size={17}/>{inline ? "Manage accounts" : "Manage inspectors"}</button>
    {open && <div className="account-dialog-backdrop" role="presentation" onMouseDown={() => !saving && setOpen(false)}>
      <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="inspector-accounts-title" onMouseDown={event => event.stopPropagation()}>
        <div className="account-dialog-heading"><div><span className="eyebrow">ADMINISTRATION</span><h2 id="inspector-accounts-title">Inspector accounts</h2><p>Provision, restore or suspend authorized inspection staff. Public registration is disabled.</p></div><button className="dialog-close" aria-label="Close inspector accounts" disabled={saving} onClick={() => setOpen(false)}><X size={20}/></button></div>
        {error && <div role="alert" className="auth-error">{error}</div>}
        {notice && <div role="status" className="account-notice">{notice}</div>}
        <form className="inspector-form" onSubmit={createInspector}>
          <label>Inspector name<input required name="displayName" minLength={2} maxLength={100} autoComplete="name" placeholder="e.g. Ananya Sharma"/></label>
          <label>Work email<input required name="email" type="email" maxLength={254} autoComplete="email" placeholder="inspector@example.gov.in"/></label>
          <label>Temporary password<input required name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" placeholder="12+ characters with a letter and number"/></label>
          <button className="btn primary" disabled={saving} type="submit">{saving ? <LoaderCircle className="spin" size={16}/> : <UserPlus size={16}/>} Provision inspector</button>
        </form>
        <div className="inspector-list"><h3>Inspector account access <span>{inspectors.length}</span></h3>{inspectors.length ? <ul>{inspectors.map(inspector => <li key={inspector.id}><span><strong>{inspector.displayName}</strong><small>{inspector.email}</small></span><span className={`account-state ${inspector.active ? "active" : "inactive"}`}>{inspector.active ? "ACTIVE" : "SUSPENDED"}</span><button className="text-button account-access-action" disabled={saving} onClick={() => void changeAccess(inspector)}>{inspector.active ? <><PauseCircle size={15}/>Suspend</> : <><PlayCircle size={15}/>Restore</>}</button></li>)}</ul> : <p>No inspector accounts have been provisioned yet.</p>}</div>
      </section>
    </div>}
  </>;
}
