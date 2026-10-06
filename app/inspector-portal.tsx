"use client";

import { useState } from "react";
import { LayoutDashboard } from "lucide-react";
import InspectorDashboard from "./inspector-dashboard";
import InspectionApp from "./inspection-app";
import type { AuthUser } from "@/lib/auth-types";

type DraftSummary = { product: string; createdAt: string } | null;

export default function InspectorPortal({ user, onLogout }: { user: AuthUser; onLogout: () => Promise<void> }) {
  const [screen, setScreen] = useState<"dashboard" | "workspace">("dashboard");
  const [workspaceKey, setWorkspaceKey] = useState(0);
  const [draft, setDraft] = useState<DraftSummary>(null);

  const newInspection = () => {
    setDraft(null);
    setWorkspaceKey(current => current + 1);
    setScreen("workspace");
  };

  return <>
    {screen === "dashboard" && <InspectorDashboard user={user} draft={draft} onNewInspection={newInspection} onContinueReview={() => setScreen("workspace")} onLogout={onLogout}/>} 
    <div hidden={screen !== "workspace"}>
      <button className="inspector-dashboard-link" onClick={() => setScreen("dashboard")}><LayoutDashboard size={17}/>Dashboard</button>
      <InspectionApp key={workspaceKey} user={user} onLogout={onLogout} onReviewStateChange={setDraft}/>
    </div>
  </>;
}
