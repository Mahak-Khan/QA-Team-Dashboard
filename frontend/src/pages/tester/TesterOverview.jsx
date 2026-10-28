import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { getTesterProjects } from "../../services/testerService";
import { getBugs, getBugSummary, updateBug, updateBugStatus } from "../../services/bugService";
import { Icon } from "../../components/common/Icons";
import { StatusBadge, SeverityBadge, IssueTypeBadge } from "../../components/common/Badge";
import { Modal } from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";

export function TesterOverview() {
  const { addToast } = useToast();
  const [projects, setProjects] = useState([]);
  const [bugs, setBugs] = useState([]);
  const [bugSummary, setBugSummary] = useState({});
  const [loading, setLoading] = useState(true);

  // Focus queue filter: "today" | "need_retest" | "critical" | "all_active"
  const [todayFilter, setTodayFilter] = useState("all_active");

  // Inline Quick Edit state
  const [editBug, setEditBug] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSeverity, setEditSeverity] = useState("medium");
  const [editStatus, setEditStatus] = useState("open");
  const [editCategory, setEditCategory] = useState("bug");
  const [editSheetUrl, setEditSheetUrl] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const getUserIdFromToken = () => {
    try {
      const token = sessionStorage.getItem("access_token");
      if (!token) return null;
      const payloadPart = token.split(".")[1];
      const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(base64));
      return Number(payload.sub) || null;
    } catch {
      return null;
    }
  };

  const currentUserId = getUserIdFromToken();

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [projData, bugData, sumData] = await Promise.allSettled([
          getTesterProjects(),
          getBugs(),
          getBugSummary(),
        ]);

        if (projData.status === "fulfilled" && Array.isArray(projData.value)) {
          setProjects(projData.value);
        }
        if (bugData.status === "fulfilled" && Array.isArray(bugData.value)) {
          setBugs(bugData.value);
        }
        if (sumData.status === "fulfilled" && sumData.value) {
          setBugSummary(sumData.value);
        }
      } catch (err) {
        console.error("Failed to load tester overview", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const totalBugs = Number(bugSummary.total ?? bugs.length);
  const openBugsCount = Number(bugSummary.open ?? 0);
  const needRetestCount = Number(bugSummary.need_retest ?? 0);
  const retestedCount = Number(bugSummary.retested ?? 0);
  const closedCount = Number(bugSummary.closed ?? 0);

  const isCreatedToday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  // Format date & time nicely
  const formatReportedTime = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    if (isCreatedToday(dateStr)) {
      return `Today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  // Memoized counts for high-velocity triage
  const todayCount = useMemo(
    () => bugs.filter((b) => isCreatedToday(b.created_at)).length,
    [bugs]
  );
  const queueNeedRetestCount = useMemo(
    () => bugs.filter((b) => b.status === "need_retest").length,
    [bugs]
  );
  const criticalActiveCount = useMemo(
    () =>
      bugs.filter(
        (b) => (b.severity || "").toLowerCase() === "critical" && b.status !== "closed"
      ).length,
    [bugs]
  );
  const activeCount = useMemo(
    () => bugs.filter((b) => b.status !== "closed").length,
    [bugs]
  );

  // Automatically default filter to today if today has items, otherwise need_retest or all_active
  useEffect(() => {
    if (todayCount > 0) {
      setTodayFilter("today");
    } else if (queueNeedRetestCount > 0) {
      setTodayFilter("need_retest");
    } else {
      setTodayFilter("all_active");
    }
  }, [todayCount, queueNeedRetestCount]);

  // Memoized focused items (capped at 6 for clean overview performance)
  const focusedBugs = useMemo(() => {
    return bugs
      .filter((bug) => {
        if (todayFilter === "today") return isCreatedToday(bug.created_at);
        if (todayFilter === "need_retest") return bug.status === "need_retest";
        if (todayFilter === "critical")
          return (bug.severity || "").toLowerCase() === "critical" && bug.status !== "closed";
        if (todayFilter === "all_active") return bug.status !== "closed";
        return true;
      })
      .slice(0, 6);
  }, [bugs, todayFilter]);

  // Quick 1-Click Retest Verification: Pass & Close
  const handleQuickVerify = async (bug) => {
    try {
      setUpdatingId(bug.id);
      await updateBugStatus(bug.id, "closed");
      addToast(`Ticket #${bug.id} verified and closed!`, "success");
      setBugs((prev) =>
        prev.map((b) => (b.id === bug.id ? { ...b, status: "closed" } : b))
      );
      const newSummary = await getBugSummary();
      if (newSummary) setBugSummary(newSummary);
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to close ticket.", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Open Quick Edit Modal
  const openQuickEdit = (bug) => {
    setEditBug(bug);
    setEditTitle(bug.title || "");
    setEditDescription(bug.description || "");
    setEditSeverity(bug.severity || "medium");
    setEditStatus(bug.status || "open");
    setEditCategory(bug.category || "bug");
    setEditSheetUrl(bug.sheet_url || "");
  };

  // Save Quick Edit
  const handleSaveQuickEdit = async (e) => {
    e.preventDefault();
    if (!editBug) return;
    if (!editTitle.trim()) {
      addToast("Title is required", "error");
      return;
    }
    setSavingEdit(true);
    try {
      const updated = await updateBug(editBug.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        severity: editSeverity,
        status: editStatus,
        category: editCategory,
        sheet_url: editSheetUrl.trim() || null,
      });
      addToast(`Defect #${editBug.id} updated!`, "success");
      setBugs((prev) =>
        prev.map((b) => (b.id === editBug.id ? { ...b, ...updated } : b))
      );
      const newSummary = await getBugSummary();
      if (newSummary) setBugSummary(newSummary);
      setEditBug(null);
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to update defect.", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const myReportedCount = useMemo(() => {
    if (!currentUserId) return bugs.length;
    return bugs.filter((b) => b.reported_by === currentUserId).length;
  }, [bugs, currentUserId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <div className="page-header-row">
        <div className="page-title-box">
          <h1>Tester Workspace</h1>
          <p className="page-subtitle">
            Welcome back! Here is an overview of your assigned testing projects, cloud spreadsheets, and defect tallies.
          </p>
        </div>

        <div className="header-action-group">
          <Link to="/tester/progress" className="btn btn-secondary">
            <Icon name="progress" size={16} />
            <span>Update Progress</span>
          </Link>
          <Link to="/tester/bug-list" className="btn btn-primary">
            <Icon name="bugs" size={16} />
            <span>Reported Bug List</span>
          </Link>
          <Link to="/tester/bugs" className="btn btn-secondary">
            <Icon name="sheet" size={16} />
            <span>Sheet Defect Sync</span>
          </Link>
        </div>
      </div>

      {/* Stats Grid: Project Scopes, Defects Reported, and Active Statuses */}
      <div className="stats-grid-container" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))" }}>
        <div className="stat-metric-card">
          <div className="stat-card-top-row">
            <span className="stat-metric-label">Assigned Projects</span>
            <div className="stat-card-icon-wrapper indigo">
              <Icon name="projects" size={20} />
            </div>
          </div>
          <div className="stat-metric-value">{loading ? "—" : projects.length}</div>
          <div className="stat-metric-footer">
            <Icon name="check" size={13} color="#6366f1" />
            <span>Active testing scopes</span>
          </div>
        </div>

        <div className="stat-metric-card">
          <div className="stat-card-top-row">
            <span className="stat-metric-label">Reported by You</span>
            <div className="stat-card-icon-wrapper success">
              <Icon name="bugs" size={20} />
            </div>
          </div>
          <div className="stat-metric-value" style={{ color: "var(--accent-cyan)" }}>{loading ? "—" : myReportedCount}</div>
          <div className="stat-metric-footer">
            <span style={{ color: "var(--accent-cyan)", fontWeight: 700 }}>{myReportedCount}</span>
            <span>Total defects reported</span>
          </div>
        </div>

        <div className="stat-metric-card">
          <div className="stat-card-top-row">
            <span className="stat-metric-label">Open (Dev Fix)</span>
            <div className="stat-card-icon-wrapper danger">
              <Icon name="alert" size={20} />
            </div>
          </div>
          <div className="stat-metric-value" style={{ color: "#f43f5e" }}>{loading ? "—" : openBugsCount}</div>
          <div className="stat-metric-footer">
            <span style={{ color: "#f43f5e", fontWeight: 700 }}>Awaiting Fix</span>
          </div>
        </div>

        <div className="stat-metric-card">
          <div className="stat-card-top-row">
            <span className="stat-metric-label">Need Retest</span>
            <div className="stat-card-icon-wrapper warning">
              <Icon name="refresh" size={20} />
            </div>
          </div>
          <div className="stat-metric-value" style={{ color: "#f59e0b" }}>{loading ? "—" : needRetestCount}</div>
          <div className="stat-metric-footer">
            <span style={{ color: "#f59e0b", fontWeight: 700 }}>Ready for QA Retest</span>
          </div>
        </div>

        <div className="stat-metric-card">
          <div className="stat-card-top-row">
            <span className="stat-metric-label">Retested & Closed</span>
            <div className="stat-card-icon-wrapper success">
              <Icon name="check" size={20} />
            </div>
          </div>
          <div className="stat-metric-value" style={{ color: "#10b981" }}>{loading ? "—" : retestedCount + closedCount}</div>
          <div className="stat-metric-footer">
            <span style={{ color: "#10b981", fontWeight: 700 }}>{retestedCount}</span>
            <span>Retested • {closedCount} Closed</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Projects & Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "1.5rem" }}>
        {/* Assigned Projects Preview */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>My Assigned Projects</h3>
              <p className="card-subtitle">Active initiatives & connected spreadsheets</p>
            </div>
            <Link to="/tester/projects" className="btn btn-secondary btn-sm">
              <span>View All</span>
              <Icon name="arrowRight" size={14} />
            </Link>
          </div>

          {loading ? (
            <p>Loading projects...</p>
          ) : projects.length === 0 ? (
            <div className="empty-state-card" style={{ padding: "2.5rem 1rem" }}>
              <div className="empty-state-icon">
                <Icon name="projects" size={24} />
              </div>
              <h3>No projects assigned yet</h3>
              <p>Your QA manager will assign projects for you to test.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "420px", overflowY: "auto", paddingRight: "0.25rem" }}>
              {projects.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: "1rem",
                    background: "var(--bg-surface-elevated)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <h4 style={{ fontSize: "0.975rem", marginBottom: "0.2rem" }}>{p.name}</h4>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
                      <span style={{ fontSize: "0.72rem", color: "#f43f5e", fontWeight: 600 }}>
                        {p.open_bugs || 0} Open
                      </span>
                      <span style={{ color: "var(--text-faint)" }}>•</span>
                      <span style={{ fontSize: "0.72rem", color: "#f59e0b", fontWeight: 600 }}>
                        {p.need_retest_bugs || 0} Need Retest
                      </span>
                      <span style={{ color: "var(--text-faint)" }}>•</span>
                      <span style={{ fontSize: "0.72rem", color: "#06b6d4", fontWeight: 600 }}>
                        {p.retested_bugs || 0} Retested
                      </span>
                      <span style={{ color: "var(--text-faint)" }}>•</span>
                      <span style={{ fontSize: "0.72rem", color: "#10b981", fontWeight: 600 }}>
                        {p.closed_bugs || p.fixed_bugs || 0} Closed
                      </span>
                      {Number(p.critical_bugs) > 0 && (
                        <>
                          <span style={{ color: "var(--text-faint)" }}>•</span>
                          <span style={{ fontSize: "0.72rem", color: "#ef4444", fontWeight: 700 }}>
                            {p.critical_bugs} Crit
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                    {p.excel_sheet_url && (
                      <a
                        href={p.excel_sheet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{
                          fontSize: "0.75rem",
                          color: "#10b981",
                          borderColor: "rgba(16, 185, 129, 0.4)",
                          background: "rgba(16, 185, 129, 0.08)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                        title="Open live Google Sheet / Excel in new tab"
                      >
                        <Icon name="sheet" size={13} color="#10b981" />
                        <span>Sheet</span>
                        <Icon name="externalLink" size={10} color="#10b981" />
                      </a>
                    )}
                    <Link
                      to={`/tester/progress?projectId=${p.id}`}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: "0.75rem" }}
                    >
                      Progress
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Defect Reporting & Sheet Hub Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div className="card-header">
              <div className="card-title-group">
                <h3>Live Sheet Bug Tally Hub</h3>
                <p className="card-subtitle">Real-time QA team testing workflow</p>
              </div>
              <div className="stat-card-icon-wrapper success" style={{ width: 34, height: 34 }}>
                <Icon name="sheet" size={16} />
              </div>
            </div>

            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "1.25rem" }}>
              Testing teams maintain testing progress directly in cloud spreadsheets. Simply update your project's current bug counts (Open, Need Retest, Retested, Closed) or attach your live Google Sheet link anytime.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Link
              to="/tester/bugs"
              className="btn btn-primary"
              style={{ justifyContent: "center" }}
            >
              <Icon name="sheet" size={16} />
              <span>Open QA Sheets & Bug Matrix</span>
            </Link>
            <Link
              to="/tester/progress"
              className="btn btn-secondary"
              style={{ justifyContent: "center" }}
            >
              <Icon name="progress" size={16} />
              <span>Log Sprint Milestone</span>
            </Link>
          </div>
        </div>
      </div>

      {/* TODAY'S ACTIVE FOCUS & RETEST QUEUE (Replaced generic redundant bug table) */}
      <div className="card" style={{ border: "1px solid rgba(99, 102, 241, 0.25)" }}>
        <div className="card-header" style={{ flexWrap: "wrap", gap: "1rem" }}>
          <div className="card-title-group">
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#10b981",
                  boxShadow: "0 0 10px #10b981",
                }}
              />
              <h3 style={{ margin: 0 }}>Today's Active Focus & Priority Retests</h3>
            </div>
            <p className="card-subtitle" style={{ marginTop: "0.25rem" }}>
              Action-oriented daily workspace for newly logged defects and retests. Complete historical defect records are stored in the Reported Bug List.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            {/* Filter Pills */}
            <div
              style={{
                display: "inline-flex",
                background: "var(--bg-surface-elevated)",
                padding: "0.2rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
                gap: "0.25rem",
              }}
            >
              <button
                type="button"
                className={`btn btn-sm ${todayFilter === "today" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setTodayFilter("today")}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.25rem 0.65rem",
                  borderColor: todayFilter !== "today" && todayCount > 0 ? "rgba(99, 102, 241, 0.4)" : undefined,
                  color: todayFilter !== "today" && todayCount > 0 ? "var(--primary-glow)" : undefined,
                }}
              >
                Today ({todayCount})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${todayFilter === "need_retest" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setTodayFilter("need_retest")}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.25rem 0.65rem",
                  borderColor: todayFilter !== "need_retest" && queueNeedRetestCount > 0 ? "rgba(245, 158, 11, 0.5)" : undefined,
                  color: todayFilter !== "need_retest" && queueNeedRetestCount > 0 ? "#f59e0b" : undefined,
                }}
              >
                Need Retest ({queueNeedRetestCount})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${todayFilter === "critical" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setTodayFilter("critical")}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.25rem 0.65rem",
                  borderColor: todayFilter !== "critical" && criticalActiveCount > 0 ? "rgba(244, 63, 94, 0.5)" : undefined,
                  color: todayFilter !== "critical" && criticalActiveCount > 0 ? "#f43f5e" : undefined,
                }}
              >
                Critical ({criticalActiveCount})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${todayFilter === "all_active" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setTodayFilter("all_active")}
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.65rem" }}
              >
                All Active ({activeCount})
              </button>
            </div>

            <Link to="/tester/bug-list" className="btn btn-secondary btn-sm" title="View complete historical archive">
              <span>Full Archive ({totalBugs})</span>
              <Icon name="arrowRight" size={13} />
            </Link>
          </div>
        </div>

        {focusedBugs.length === 0 ? (
          <div className="empty-state-card" style={{ padding: "2.5rem 1rem" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.12)",
                color: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 0.75rem auto",
              }}
            >
              <Icon name="check" size={22} />
            </div>
            <h4 style={{ margin: "0 0 0.35rem 0", color: "var(--text-main)" }}>
              {todayFilter === "today"
                ? "No Defects Logged Today"
                : todayFilter === "need_retest"
                ? "All Retests Signed Off!"
                : todayFilter === "critical"
                ? "Zero Critical Blockers"
                : "Active Defect Queue is Clear"}
            </h4>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: 420, margin: "0 auto 1rem auto" }}>
              {todayFilter === "today"
                ? "You haven't reported any new defects today. Need to search historical issues or requirement alterations?"
                : "Great job! All active items in this category are verified and resolved."}
            </p>
            <Link to="/tester/bug-list" className="btn btn-secondary btn-sm">
              <span>Browse Full Reported Bug List ({totalBugs})</span>
              <Icon name="arrowRight" size={13} />
            </Link>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="custom-table" style={{ minWidth: "920px" }}>
              <thead>
                <tr>
                  <th style={{ minWidth: "240px", padding: "0.75rem 0.75rem" }}>Defect Summary</th>
                  <th style={{ minWidth: "125px", padding: "0.75rem 0.6rem", whiteSpace: "nowrap" }}>Type</th>
                  <th style={{ minWidth: "100px", padding: "0.75rem 0.6rem", whiteSpace: "nowrap" }}>Severity</th>
                  <th style={{ minWidth: "135px", padding: "0.75rem 0.6rem", whiteSpace: "nowrap" }}>QA Status</th>
                  <th style={{ minWidth: "140px", padding: "0.75rem 0.6rem", whiteSpace: "nowrap" }}>Reported</th>
                  <th style={{ minWidth: "155px", textAlign: "right", padding: "0.75rem 0.75rem", whiteSpace: "nowrap" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {focusedBugs.map((b) => {
                  const isRetestReady = b.status === "need_retest";
                  const isToday = isCreatedToday(b.created_at);

                  return (
                    <tr key={b.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "0.72rem",
                              color: "var(--text-faint)",
                              background: "var(--bg-surface-elevated)",
                              padding: "0.15rem 0.35rem",
                              borderRadius: "var(--radius-sm)",
                            }}
                          >
                            #{b.id}
                          </span>
                          <strong style={{ color: "var(--text-main)", fontSize: "0.9rem" }}>
                            {b.title}
                          </strong>
                        </div>
                        {b.project_name && (
                          <div style={{ fontSize: "0.72rem", color: "var(--text-faint)", marginTop: "0.2rem" }}>
                            {b.project_name}
                          </div>
                        )}
                        {b.description && (
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                              maxWidth: 380,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              marginTop: "0.15rem",
                            }}
                          >
                            {b.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <IssueTypeBadge category={b.category} />
                      </td>
                      <td>
                        <SeverityBadge severity={b.severity} />
                      </td>
                      <td>
                        <StatusBadge status={b.status} />
                      </td>
                      <td style={{ padding: "0.75rem 0.6rem", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            fontSize: "0.785rem",
                            color: isToday ? "var(--primary-glow)" : "var(--text-faint)",
                            fontWeight: isToday ? 600 : 400,
                            whiteSpace: "nowrap",
                            display: "inline-block",
                          }}
                        >
                          {formatReportedTime(b.created_at)}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap", padding: "0.75rem 0.75rem" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", whiteSpace: "nowrap" }}>
                          {isRetestReady && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={updatingId === b.id}
                              onClick={() => handleQuickVerify(b)}
                              style={{
                                fontSize: "0.72rem",
                                padding: "0.22rem 0.55rem",
                                background: "rgba(16, 185, 129, 0.15)",
                                color: "#10b981",
                                border: "1px solid rgba(16, 185, 129, 0.4)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                                whiteSpace: "nowrap",
                                flexShrink: 0,
                                fontWeight: 700,
                              }}
                              title="1-Click verify & close retested defect"
                            >
                              <Icon name="check" size={11} color="#10b981" />
                              <span>{updatingId === b.id ? "..." : "Close"}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openQuickEdit(b)}
                            style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem", whiteSpace: "nowrap", flexShrink: 0 }}
                            title="Quick Edit defect title, category, or status"
                          >
                            <Icon name="edit" size={11} />
                            <span>Edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Edit Modal */}
      {editBug && (
        <Modal
          isOpen={Boolean(editBug)}
          onClose={() => setEditBug(null)}
          title={`Quick Edit Defect #${editBug.id}`}
        >
          <form onSubmit={handleSaveQuickEdit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            <div className="form-group">
              <label>Defect Title *</label>
              <input
                type="text"
                className="form-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Issue Type / Category *</label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                  marginTop: "0.35rem",
                }}
              >
                <button
                  type="button"
                  onClick={() => setEditCategory("bug")}
                  style={{
                    padding: "0.6rem 0.85rem",
                    borderRadius: "var(--radius-md)",
                    border: editCategory === "bug" ? "1px solid #f43f5e" : "1px solid var(--border-subtle)",
                    background: editCategory === "bug" ? "rgba(244, 63, 94, 0.12)" : "var(--bg-surface-elevated)",
                    color: editCategory === "bug" ? "#f43f5e" : "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.45rem",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                  }}
                >
                  <Icon name="bugs" size={15} color={editCategory === "bug" ? "#f43f5e" : "currentColor"} />
                  <span>Defect / Bug</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditCategory("requirement_change")}
                  style={{
                    padding: "0.6rem 0.85rem",
                    borderRadius: "var(--radius-md)",
                    border: editCategory === "requirement_change" ? "1px solid #a855f7" : "1px solid var(--border-subtle)",
                    background: editCategory === "requirement_change" ? "rgba(168, 85, 247, 0.12)" : "var(--bg-surface-elevated)",
                    color: editCategory === "requirement_change" ? "#c084fc" : "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.45rem",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                  }}
                >
                  <Icon name="gitBranch" size={15} color={editCategory === "requirement_change" ? "#c084fc" : "currentColor"} />
                  <span>Req Changed</span>
                </button>
              </div>
            </div>

            <div className="form-grid-2col">
              <div className="form-group">
                <label>Severity</label>
                <select
                  className="form-input"
                  value={editSeverity}
                  onChange={(e) => setEditSeverity(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className="form-group">
                <label>QA Status</label>
                <select
                  className="form-input"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="open">Open (Dev Fix)</option>
                  <option value="need_retest">Need Retest</option>
                  <option value="retested">Retested</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Link a Sheet / Test Run URL (Optional)</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={editSheetUrl}
                onChange={(e) => setEditSheetUrl(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Description (Optional)</label>
              <textarea
                className="form-input"
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditBug(null)}
                disabled={savingEdit}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingEdit}
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default TesterOverview;
