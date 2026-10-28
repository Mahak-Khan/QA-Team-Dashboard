import React from "react";
import { useLocation } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";
import { ActivityTracker } from "./ActivityTracker";

export function Topbar({ role = "manager" }) {
  const location = useLocation();

  const getPageTitle = (path) => {
    if (path.includes("/projects")) return "Projects";
    if (path.includes("/team")) return "Team Members";
    if (path.includes("/assignments")) return "Assignments & Progress";
    if (path.includes("/bugs")) return "Bug Tracking";
    if (path.includes("/progress")) return "Sprint Progress";
    return "Dashboard Overview";
  };

  const pageTitle = getPageTitle(location.pathname);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="breadcrumb-trail">
          <span>QualityHub</span>
          <span className="sep">/</span>
          <span>{role === "manager" ? "Manager" : "Tester"}</span>
          <span className="sep">/</span>
          <strong>{pageTitle}</strong>
        </div>
      </div>

      <div className="topbar-right">
        <ActivityTracker role={role} />
        <NotificationBell role={role} />

        <div className={`role-pill-badge ${role}`}>
          <span className="pulse-indicator" />
          <span>{role === "manager" ? "Manager Mode" : "Tester Mode"}</span>
        </div>
      </div>
    </header>
  );
}
