"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, LayoutDashboard, LogOut, Plus, ScanLine, ShieldCheck, UserRound } from "lucide-react";
import type { AuthUser } from "@/lib/auth-types";

type InspectionStatus = "PASS" | "CHECK" | "NOT DETECTED" | "NOT APPLICABLE";
type HistoryRow = { id: string; product: string; createdAt: string; status: InspectionStatus; mode: "demo" | "ocr" };
type DraftSummary = { product: string; createdAt: string } | null;

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function statusClass(status: InspectionStatus) {
  return status.toLowerCase().replaceAll(" ", "-");
}

export default function InspectorDashboard({ user, draft, onNewInspection, onContinueReview, onLogout }: {
  user: AuthUser;
  draft: DraftSummary;
  onNewInspection: () => void;
  onContinueReview: () => void;
  onLogout: () => Promise<void>;
}) {
  const [records, setRecords] = useState<HistoryRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/inspections", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json() as HistoryRow[] & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to load your inspections.");
        setRecords(data);
      })
      .catch(reason => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Unable to load your inspections.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const stats = useMemo(() => ({
    total: records.length,
    passed: records.filter(record => record.status === "PASS").length,
    checking: records.filter(record => record.status === "CHECK").length,
    missing: records.filter(record => record.status === "NOT DETECTED").length,
  }), [records]);

  return <main className="inspector-dashboard">
    <header className="inspector-topbar">
      <button className="brand" onClick={() => undefined} aria-label="Satya Scan inspector dashboard"><span className="brand-icon"><ScanLine/></span><span>SATYA<span className="brand-light"> SCAN</span><small>THE SIXTH SENSE</small></span></button>
      <nav className="inspector-nav" aria-label="Inspector navigation"><button className="selected" aria-current="page"><LayoutDashboard size={17}/>Dashboard</button></nav>
      <div className="inspector-account"><span className="account-avatar"><UserRound size={16}/></span><span><strong>{user.displayName}</strong><small>Inspector</small></span><button className="sign-out" onClick={() => void onLogout()} aria-label="Sign out"><LogOut size={16}/><span>Sign out</span></button></div>
    </header>
    <div className="inspector-dashboard-body">
      <section className="inspector-hero"><div><span className="eyebrow">INSPECTOR WORKSPACE</span><h1>Welcome back, {user.displayName.split(" ")[0]}.</h1><p>Start a new label review or return to the inspection work assigned to your account.</p></div><button className="btn primary inspector-new" onClick={onNewInspection}><Plus size={18}/>New inspection</button></section>
      <section className="inspector-stat-grid" aria-label="Your inspection statistics">
        <article><span>Total inspections</span><strong>{loading ? "—" : stats.total}</strong><ClipboardCheck size={21}/></article>
        <article className="stat-pass"><span>Passed</span><strong>{loading ? "—" : stats.passed}</strong><CheckCircle2 size={21}/></article>
        <article className="stat-check"><span>Needs review</span><strong>{loading ? "—" : stats.checking}</strong><AlertTriangle size={21}/></article>
        <article className="stat-missing"><span>Not detected</span><strong>{loading ? "—" : stats.missing}</strong><ShieldCheck size={21}/></article>
      </section>
      <section className="inspector-dashboard-grid">
        <article className="panel continue-review"><div><span className="eyebrow">CONTINUE INCOMPLETE REVIEW</span><h2>{draft ? draft.product : "No active review"}</h2><p>{draft ? `Started ${formatDate(draft.createdAt)}. Your evidence and review choices are ready in this browser session.` : "Start an inspection to review its OCR findings and evidence here before saving the final record."}</p></div><button className="btn" onClick={draft ? onContinueReview : onNewInspection}>{draft ? "Continue review" : "Start inspection"}<ArrowRight size={16}/></button></article>
        <article className="panel inspector-security-note"><ShieldCheck size={22}/><div><strong>Your assigned records only</strong><p>These totals and records come from your authenticated Inspector account. Other inspectors’ evidence remains unavailable.</p></div></article>
      </section>
      <section className="panel inspector-recent"><div className="section-heading compact"><div><span className="eyebrow">RECENT INSPECTIONS</span><h2>Latest work assigned to you</h2></div><span className="recent-help">Open History from your workspace for saved reports.</span></div>{error ? <div role="alert" className="empty-state"><AlertTriangle/><p>{error}</p></div> : !loading && !records.length ? <div className="empty-state"><ClipboardCheck size={30}/><h3>Your inspection history starts here</h3><p>Finalize your first review to see it in this list.</p><button className="btn primary" onClick={onNewInspection}>New inspection</button></div> : <div className="inspector-recent-list">{records.slice(0, 6).map(record => <article key={record.id}><span className="recent-product"><strong>{record.product}</strong><small>{record.id.slice(0, 8).toUpperCase()} · {formatDate(record.createdAt)}</small></span><span className="source-tag">{record.mode === "demo" ? "DEMO" : "OCR"}</span><span className={`dashboard-status ${statusClass(record.status)}`}>{record.status}</span><ArrowRight size={17}/></article>)}</div>}</section>
    </div>
  </main>;
}
