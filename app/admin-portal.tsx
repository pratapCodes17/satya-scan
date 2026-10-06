"use client";

import { useState } from "react";
import { LayoutDashboard } from "lucide-react";
import AdminDashboard from "./admin-dashboard";
import InspectionApp from "./inspection-app";
import type { AuthUser } from "@/lib/auth-types";

export default function AdminPortal({ user, onLogout }: { user: AuthUser; onLogout: () => Promise<void> }) {
  const [screen, setScreen] = useState<"dashboard" | "workspace">("dashboard");
  const [workspaceKey, setWorkspaceKey] = useState(0);
  const newInspection = () => { setWorkspaceKey(current => current + 1); setScreen("workspace"); };
  return <>
    {screen === "dashboard" && <AdminDashboard user={user} onNewInspection={newInspection} onLogout={onLogout}/>} 
    <div hidden={screen !== "workspace"}>
      <button className="admin-dashboard-link" onClick={() => setScreen("dashboard")}><LayoutDashboard size={17}/>Admin dashboard</button>
      <InspectionApp key={workspaceKey} user={user} onLogout={onLogout}/>
    </div>
  </>;
}
