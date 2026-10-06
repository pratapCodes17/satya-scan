"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, Filter, LayoutDashboard, ListChecks, LogOut, Plus, ScanLine, ShieldCheck, UsersRound } from "lucide-react";
import AdminUserManager from "./admin-user-manager";
import type { AuthUser } from "@/lib/auth-types";

type InspectionStatus = "PASS" | "CHECK" | "NOT DETECTED" | "NOT APPLICABLE";
type QueueItem = { id: string; product: string; status: InspectionStatus; mode: "demo" | "ocr"; createdAt: string; inspectorId: string | null; inspectorName: string };
type InspectorActivity = { id: string; displayName: string; email: string; active: number; total: number; passed: number; checking: number; missing: number; lastInspectionAt: string | null };
type DashboardData = { metrics: { total: number; passed: number; checking: number; missing: number; activeInspectors: number }; reviewQueue: QueueItem[]; recentActivity: QueueItem[]; inspectors: InspectorActivity[] };

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "No inspections yet";
}

function statusClass(status: InspectionStatus) {
  return status.toLowerCase().replaceAll(" ", "-");
}

export default function AdminDashboard({ user, onNewInspection, onLogout }: { user: AuthUser; onNewInspection: () => void; onLogout: () => Promise<void> }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "CHECK" | "NOT DETECTED">("ALL");
  const [inspectorFilter, setInspectorFilter] = useState("ALL");

  const loadDashboard = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
      const result = await response.json() as DashboardData & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to load the administration dashboard.");
      setData(result);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load the administration dashboard.");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/dashboard", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const result = await response.json() as DashboardData & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load the administration dashboard.");
        setData(result);
        setError("");
      })
      .catch(reason => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Unable to load the administration dashboard.");
      });
    return () => controller.abort();
  }, []);

  const filteredQueue = useMemo(() => (data?.reviewQueue ?? []).filter(item =>
    (statusFilter === "ALL" || item.status === statusFilter) &&
    (inspectorFilter === "ALL" || item.inspectorId === inspectorFilter),
  ), [data, inspectorFilter, statusFilter]);

  const scrollToQueue = () => document.getElementById("review-queue")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const metrics = data?.metrics ?? { total: 0, passed: 0, checking: 0, missing: 0, activeInspectors: 0 };

  return <main className="admin-dashboard">
    <header className="admin-topbar">
      <button className="brand" onClick={() => undefined} aria-label="Satya Scan administrator dashboard"><span className="brand-icon"><ScanLine/></span><span>SATYA<span className="brand-light"> SCAN</span><small>THE SIXTH SENSE</small></span></button>
      <nav className="admin-nav" aria-label="Administrator navigation"><button className="selected" aria-current="page"><LayoutDashboard size={17}/>Overview</button><button onClick={scrollToQueue}><ListChecks size={17}/>Review queue</button><button onClick={() => document.getElementById("team-activity")?.scrollIntoView({ behavior: "smooth", block: "start" })}><UsersRound size={17}/>Team activity</button></nav>
      <div className="admin-account"><span className="account-avatar"><ShieldCheck size={16}/></span><span><strong>{user.displayName}</strong><small>Administrator</small></span><button className="admin-sign-out" type="button" onClick={() => void onLogout()}><LogOut size={14}/>Sign out</button></div>
    </header>
    <div className="admin-dashboard-body">
      <section className="admin-hero"><div><span className="eyebrow">AUTHORIZED TEAM OVERSIGHT</span><h1>Inspection control center.</h1><p>Monitor shared inspection outcomes, focus the team on records needing follow-up, and manage Inspector access.</p></div><div className="admin-hero-actions"><button className="btn primary" onClick={scrollToQueue}><ListChecks size={18}/>Review queue</button><button className="btn" onClick={onNewInspection}><Plus size={18}/>New inspection</button><AdminUserManager inline onChanged={loadDashboard}/></div></section>
      {error && <div role="alert" className="auth-error">{error}</div>}
      <section className="admin-stat-grid" aria-label="System-wide inspection metrics">
        <article><span>System-wide inspections</span><strong>{metrics.total}</strong><ClipboardList size={22}/></article>
        <article className="stat-pass"><span>Passed</span><strong>{metrics.passed}</strong><CheckCircle2 size={22}/></article>
        <article className="stat-check"><span>Needs review</span><strong>{metrics.checking}</strong><AlertTriangle size={22}/></article>
        <article className="stat-missing"><span>Not detected</span><strong>{metrics.missing}</strong><ListChecks size={22}/></article>
        <article className="stat-team"><span>Active inspectors</span><strong>{metrics.activeInspectors}</strong><UsersRound size={22}/></article>
      </section>
      <section className="admin-dashboard-grid">
        <article className="panel admin-priority-card"><div><span className="eyebrow">PRIMARY ACTION</span><h2>{metrics.checking + metrics.missing} records need team attention</h2><p>Review queue combines CHECK and NOT DETECTED outcomes. Use the filters to coordinate the right Inspector follow-up.</p></div><button className="btn primary" onClick={scrollToQueue}>Open review queue <ArrowRight size={16}/></button></article>
        <article className="panel admin-coverage-card"><Activity size={22}/><div><strong>Shared oversight, server-enforced</strong><p>Administrators can see authorized team activity. Inspectors remain restricted to their own assigned records.</p></div></article>
      </section>
      <section id="review-queue" className="panel admin-queue"><div className="section-heading compact"><div><span className="eyebrow">REVIEW QUEUE</span><h2>Records requiring follow-up</h2></div><span>{filteredQueue.length} shown</span></div><div className="admin-filters"><Filter size={17}/><label>Status<select value={statusFilter} onChange={event => setStatusFilter(event.target.value as "ALL" | "CHECK" | "NOT DETECTED")}><option value="ALL">All queue statuses</option><option value="CHECK">Needs review</option><option value="NOT DETECTED">Not detected</option></select></label><label>Inspector<select value={inspectorFilter} onChange={event => setInspectorFilter(event.target.value)}><option value="ALL">All inspectors</option>{(data?.inspectors ?? []).map(inspector => <option key={inspector.id} value={inspector.id}>{inspector.displayName}</option>)}</select></label></div>{filteredQueue.length ? <div className="admin-queue-list">{filteredQueue.map(item => <article key={item.id}><span><strong>{item.product}</strong><small>{item.inspectorName} · {formatDate(item.createdAt)}</small></span><span className="source-tag">{item.mode === "demo" ? "DEMO" : "OCR"}</span><span className={`dashboard-status ${statusClass(item.status)}`}>{item.status}</span></article>)}</div> : <div className="empty-state"><ListChecks size={30}/><h3>Queue is clear</h3><p>No records match the selected review filters.</p></div>}</section>
      <section className="admin-lower-grid"><article className="panel admin-activity"><div className="section-heading compact"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Latest authorized inspection activity</h2></div></div>{(data?.recentActivity ?? []).length ? <div className="admin-activity-list">{data!.recentActivity.map(item => <article key={item.id}><span className={`activity-dot ${statusClass(item.status)}`}/><span><strong>{item.product}</strong><small>{item.inspectorName} · {formatDate(item.createdAt)}</small></span><span className={`dashboard-status ${statusClass(item.status)}`}>{item.status}</span></article>)}</div> : <div className="empty-state"><Activity size={28}/><h3>No activity yet</h3><p>Authorized team inspections will appear here.</p></div>}</article><article className="panel admin-account-note"><ShieldCheck size={23}/><div><span className="eyebrow">ACCOUNT MANAGEMENT</span><h2>Manage Inspector access</h2><p>Create authorized Inspector accounts, activate a returning team member, or suspend access. Suspending an account revokes its active sessions.</p><AdminUserManager inline onChanged={loadDashboard}/></div></article></section>
      <section id="team-activity" className="panel inspector-activity-table"><div className="section-heading compact"><div><span className="eyebrow">INSPECTOR ACTIVITY</span><h2>Authorized team workload</h2></div><span>{data?.inspectors.length ?? 0} Inspector accounts</span></div><div className="activity-table-scroll"><table><thead><tr><th>Inspector</th><th>Access</th><th>Total</th><th>Passed</th><th>Review</th><th>Not detected</th><th>Last inspection</th></tr></thead><tbody>{(data?.inspectors ?? []).map(inspector => <tr key={inspector.id}><td><strong>{inspector.displayName}</strong><small>{inspector.email}</small></td><td><span className={`account-state ${inspector.active ? "active" : "inactive"}`}>{inspector.active ? "ACTIVE" : "SUSPENDED"}</span></td><td>{inspector.total}</td><td>{inspector.passed}</td><td>{inspector.checking}</td><td>{inspector.missing}</td><td>{formatDate(inspector.lastInspectionAt)}</td></tr>)}</tbody></table></div></section>
    </div>
  </main>;
}
