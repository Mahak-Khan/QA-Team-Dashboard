import React from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout({ role = "manager" }) {
  return (
    <div className="app-container">
      <Sidebar role={role} />
      <div className="main-wrapper">
        <Topbar role={role} />
        <main className="page-content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
