import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Icon } from "../common/Icons";

export function Sidebar({ role = "manager" }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/", { replace: true });
  };

  const managerNavItems = [
    { label: "Overview", to: "/manager", icon: "dashboard", end: true },
    { label: "Projects", to: "/manager/projects", icon: "projects" },
    { label: "Team Members", to: "/manager/team", icon: "team" },
    { label: "Assignments", to: "/manager/assignments", icon: "assignment" },
    { label: "Reported Bug List", to: "/manager/bug-list", icon: "bugs" },
    { label: "Sheet Defect Matrix", to: "/manager/bugs", icon: "sheet" },
  ];

  const testerNavItems = [
    { label: "Overview", to: "/tester", icon: "dashboard", end: true },
    { label: "My Projects", to: "/tester/projects", icon: "projects" },
    { label: "Sprint Progress", to: "/tester/progress", icon: "progress" },
    { label: "Reported Bug List", to: "/tester/bug-list", icon: "bugs" },
    { label: "Sheet Defect Sync", to: "/tester/bugs", icon: "sheet" },
  ];

  const navItems = role === "manager" ? managerNavItems : testerNavItems;

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="brand-icon-box">Q</div>
        <div className="brand-text">
          <h2>QualityHub</h2>
          <span>{role === "manager" ? "QA Management" : "Tester Portal"}</span>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="sidebar-nav-section">
        <div className="nav-section-title">Workspace</div>
        <nav className="sidebar-menu">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `sidebar-item ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-item-icon">
                <Icon name={item.icon} size={18} />
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Sidebar Footer with Profile & Signout */}
      <div className="sidebar-footer">
        <div className="sidebar-user-card">
          <div className="user-avatar-circle">
            {role === "manager" ? "M" : "T"}
          </div>
          <div className="user-info-text">
            <span className="user-info-name">
              {role === "manager" ? "QA Lead" : "QA Engineer"}
            </span>
            <span className="user-info-role">
              {role === "manager" ? "Administrator" : "Verified Tester"}
            </span>
          </div>
        </div>

        <button className="logout-button" onClick={handleLogout} title="Sign Out">
          <span className="sidebar-item-icon">
            <Icon name="logout" size={16} />
          </span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
