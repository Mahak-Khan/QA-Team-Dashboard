import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { getBugs, updateBug, updateBugStatus, getBugSummary } from "../../services/bugService";
import { getProjects, updateProjectMetrics } from "../../services/projectService";
import { Icon } from "../../components/common/Icons";
import { StatusBadge, SeverityBadge, IssueTypeBadge } from "../../components/common/Badge";
import { Modal } from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";

export function ManagerBugs() {
  const [bugs, setBugs] = useState([]);
  const [bugSummary, setBugSummary] = useState({});
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Focus queue filter: "all_active" | "today" | "need_retest" | "critical"
  const [focusFilter, setFocusFilter] = useState("all_active");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");

  // Inspect Modal
  const [activeBug, setActiveBug] = useState(null);

  // Quick Edit Modal
  const [editBug, setEditBug] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSeverity, setEditSeverity] = useState("medium");
  const [editStatus, setEditStatus] = useState("open");
  const [editCategory, setEditCategory] = useState("bug");
  const [editSheetUrl, setEditSheetUrl] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Quick Sync Tally Modal for Project Sheets
  const [tallyProject, setTallyProject] = useState(null);
  const [tallySheetUrl, setTallySheetUrl] = useState("");
  const [tallyOpen, setTallyOpen] = useState(0);
  const [tallyNeedRetest, setTallyNeedRetest] = useState(0);
  const [tallyRetested, setTallyRetested] = useState(0);
  const [tallyClosed, setTallyClosed] = useState(0);
  const [tallyCritical, setTallyCritical] = useState(0);
  const [tallySubmitting, setTallySubmitting] = useState(false);

  const { addToast } = useToast();

  const statuses = [
    { key: "open", label: "Open", color: "#f43f5e" },
    { key: "need_retest", label: "Need Retest", color: "#f59e0b" },
    { key: "retested", label: "Retested", color: "#06b6d4" },
    { key: "closed", label: "Closed", color: "#10b981" },
  ];

  const loadData = async () => {
    try {
      setLoading(true);
      const [bugData, summaryData, projData] = await Promise.all([
        getBugs(),
        getBugSummary(),
        getProjects(),
      ]);
      setBugs(Array.isArray(bugData) ? bugData : []);
      setBugSummary(summaryData || {});
      setProjects(Array.isArray(projData) ? projData : []);
    } catch {
      addToast("Failed to fetch bug reports and test sheets.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openTallyModal = (project) => {
    setTallyProject(project);
    setTallySheetUrl(project.excel_sheet_url || "");
    setTallyOpen(project.open_bugs || 0);
    setTallyNeedRetest(project.need_retest_bugs || 0);
    setTallyRetested(project.retested_bugs || 0);
    setTallyClosed(project.closed_bugs || project.fixed_bugs || 0);
    setTallyCritical(project.critical_bugs || 0);
  };

  const handleSaveTally = async (e) => {
    e.preventDefault();
    if (!tallyProject) return;

    setTallySubmitting(true);
    try {
      const openCount = Number(tallyOpen) || 0;
      const needRetestCount = Number(tallyNeedRetest) || 0;
      const retestedCount = Number(tallyRetested) || 0;
      const closedCount = Number(tallyClosed) || 0;
      const critCount = Number(tallyCritical) || 0;
      const totalCount = openCount + needRetestCount + retestedCount + closedCount;

      const updated = await updateProjectMetrics(tallyProject.id, {
        excel_sheet_url: tallySheetUrl.trim() || null,
        open_bugs: openCount,
        need_retest_bugs: needRetestCount,
        retested_bugs: retestedCount,
        closed_bugs: closedCount,
        critical_bugs: critCount,
        total_bugs: totalCount,
      });

      addToast("Project sheet tallies updated successfully!", "success");
      setProjects((prev) =>
        prev.map((p) => (p.id === tallyProject.id ? { ...p, ...updated } : p))
      );
      setTallyProject(null);

      // Refresh bug summary
      const newSummary = await getBugSummary();
      setBugSummary(newSummary || {});
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to update metrics.", "error");
    } finally {
      setTallySubmitting(false);
    }
  };

  const handleStatusChange = async (bugId, newStatus) => {
    try {
      await updateBugStatus(bugId, newStatus);
      const displayLabel = statuses.find((s) => s.key === newStatus)?.label || newStatus;
      addToast(`Bug #${bugId} marked as ${displayLabel}.`, "success");
      setBugs((prev) =>
        prev.map((b) => (b.id === bugId ? { ...b, status: newStatus } : b))
      );
      if (activeBug && activeBug.id === bugId) {
        setActiveBug((prev) => ({ ...prev, status: newStatus }));
      }
      const newSummary = await getBugSummary();
      setBugSummary(newSummary || {});
    } catch (err) {
      addToast(
        err.response?.data?.detail || "Failed to update bug status.",
        "error"
      );
    }
  };

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

  const openEditModal = (bug) => {
    setEditBug(bug);
    setEditTitle(bug.title || "");
    setEditDescription(bug.description || "");
    setEditSeverity(bug.severity || "medium");
    setEditStatus(bug.status || "open");
    setEditCategory(bug.category || "bug");
    setEditSheetUrl(bug.sheet_url || "");
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editBug) return;
    if (!editTitle.trim()) {
      addToast("Title is required", "error");
      return;
    }
    setSubmittingEdit(true);
    try {
      const updated = await updateBug(editBug.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        severity: editSeverity,
        status: editStatus,
        category: editCategory,
        sheet_url: editSheetUrl.trim() || null,
      });
      addToast(`Defect #${editBug.id} updated successfully!`, "success");
      setBugs((prev) =>
        prev.map((b) => (b.id === editBug.id ? { ...b, ...updated } : b))
      );
      if (activeBug && activeBug.id === editBug.id) {
        setActiveBug((prev) => ({ ...prev, ...updated }));
      }
      const newSummary = await getBugSummary();
      if (newSummary) setBugSummary(newSummary);
      setEditBug(null);
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to update defect.", "error");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const totalOpenBugs = Number(bugSummary.open ?? 0);
  const totalNeedRetest = Number(bugSummary.need_retest ?? 0);
  const totalRetested = Number(bugSummary.retested ?? 0);
  const totalClosedBugs = Number(bugSummary.closed ?? 0);
  const totalCriticalBugs = Number(bugSummary.severities?.critical ?? 0);
  const totalOverallBugs = Number(bugSummary.total ?? 0);

  // Queue counts for active workspace (Single-pass O(N) memoized accumulator)
  const { todayCount, needRetestCount, criticalActiveCount, allActiveCount } = useMemo(() => {
    let today = 0;
    let needRetest = 0;
    let criticalActive = 0;
    let allActive = 0;

    for (let i = 0; i < bugs.length; i++) {
      const b = bugs[i];
      if (isCreatedToday(b.created_at)) today++;
      if (b.status === "need_retest") needRetest++;
      if (b.status !== "closed") {
        allActive++;
        if ((b.severity || "").toLowerCase() === "critical") criticalActive++;
      }
    }

    return {
      todayCount: today,
      needRetestCount: needRetest,
      criticalActiveCount: criticalActive,
      allActiveCount: allActive,
    };
  }, [bugs]);

  // Automatically default filter to today if today has items
  useEffect(() => {
    if (todayCount > 0) {
      setFocusFilter("today");
    }
  }, [todayCount]);

  const focusedBugs = useMemo(() => {
    return bugs.filter((bug) => {
      if (focusFilter === "today" && !isCreatedToday(bug.created_at)) return false;
      if (focusFilter === "need_retest" && bug.status !== "need_retest") return false;
      if (
        focusFilter === "critical" &&
        ((bug.severity || "").toLowerCase() !== "critical" || bug.status === "closed")
      )
        return false;
      if (focusFilter === "all_active" && bug.status === "closed") return false;

      const matchesSearch =
        !search ||
        (bug.title || "").toLowerCase().includes(search.toLowerCase()) ||
        (bug.description || "").toLowerCase().includes(search.toLowerCase());

      const matchesStatus = !statusFilter || bug.status === statusFilter;
      const matchesSeverity =
        !severityFilter ||
        (bug.severity || "").toLowerCase() === severityFilter.toLowerCase();
      const matchesProject =
        !projectFilter || String(bug.project_id) === projectFilter;

      return matchesSearch && matchesStatus && matchesSeverity && matchesProject;
    });
  }, [bugs, focusFilter, search, statusFilter, severityFilter, projectFilter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header Row */}
      <div className="page-header-row">
        <div className="page-title-box">
          <h1>QA Test Sheets & Bug Matrix</h1>
          <p className="page-subtitle">
            Manage your QA team's live cloud spreadsheets, track real defect lifecycles, and coordinate retests.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link to="/manager/bug-list" className="btn btn-primary">
            <Icon name="bugs" size={16} />
            <span>View Reported Bug List</span>
          </Link>
          <button className="btn btn-secondary" onClick={loadData}>
            <Icon name="refresh" size={16} />
            <span>Refresh Sheets</span>
          </button>
        </div>
      </div>

      {/* Aggregate KPI Badges Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: "1rem" }}>
        <div
          className="stat-metric-card"
          style={{ padding: "1.1rem 1.25rem", cursor: "default" }}
        >
          <div className="stat-card-top-row">
            <span className="stat-metric-label">Total Tracked</span>
            <div className="stat-card-icon-wrapper indigo" style={{ width: 34, height: 34 }}>
              <Icon name="bugs" size={16} />
            </div>
          </div>
          <div className="stat-metric-value" style={{ fontSize: "1.75rem" }}>
            {loading ? "—" : totalOverallBugs}
          </div>
          <div className="stat-metric-footer">
            <span style={{ color: "var(--text-muted)" }}>Across all testing sheets</span>
          </div>
        </div>

        <div
          className="stat-metric-card"
          style={{ padding: "1.1rem 1.25rem", cursor: "pointer", border: statusFilter === "open" ? "1px solid #f43f5e" : undefined }}
          onClick={() => setStatusFilter(statusFilter === "open" ? "" : "open")}
        >
          <div className="stat-card-top-row">
            <span className="stat-metric-label">Open</span>
            <div className="stat-card-icon-wrapper danger" style={{ width: 34, height: 34 }}>
              <Icon name="alert" size={16} />
            </div>
          </div>
          <div className="stat-metric-value" style={{ fontSize: "1.75rem", color: "#f43f5e" }}>
            {loading ? "—" : totalOpenBugs}
          </div>
          <div className="stat-metric-footer">
            <span style={{ color: "#f43f5e", fontWeight: 600 }}>Awaiting Developer Fix</span>
          </div>
        </div>

        <div
          className="stat-metric-card"
          style={{ padding: "1.1rem 1.25rem", cursor: "pointer", border: statusFilter === "need_retest" ? "1px solid #f59e0b" : undefined }}
          onClick={() => setStatusFilter(statusFilter === "need_retest" ? "" : "need_retest")}
        >
          <div className="stat-card-top-row">
            <span className="stat-metric-label">Need Retest</span>
            <div className="stat-card-icon-wrapper warning" style={{ width: 34, height: 34 }}>
              <Icon name="refresh" size={16} />
            </div>
          </div>
          <div className="stat-metric-value" style={{ fontSize: "1.75rem", color: "#f59e0b" }}>
            {loading ? "—" : totalNeedRetest}
          </div>
          <div className="stat-metric-footer">
            <span style={{ color: "#f59e0b", fontWeight: 600 }}>Ready for QA Retest</span>
          </div>
        </div>

        <div
          className="stat-metric-card"
          style={{ padding: "1.1rem 1.25rem", cursor: "pointer", border: statusFilter === "retested" ? "1px solid #06b6d4" : undefined }}
          onClick={() => setStatusFilter(statusFilter === "retested" ? "" : "retested")}
        >
          <div className="stat-card-top-row">
            <span className="stat-metric-label">Retested</span>
            <div className="stat-card-icon-wrapper cyan" style={{ width: 34, height: 34 }}>
              <Icon name="check" size={16} />
            </div>
          </div>
          <div className="stat-metric-value" style={{ fontSize: "1.75rem", color: "#06b6d4" }}>
            {loading ? "—" : totalRetested}
          </div>
          <div className="stat-metric-footer">
            <span style={{ color: "#06b6d4", fontWeight: 600 }}>Verified Working</span>
          </div>
        </div>

        <div
          className="stat-metric-card"
          style={{ padding: "1.1rem 1.25rem", cursor: "pointer", border: statusFilter === "closed" ? "1px solid #10b981" : undefined }}
          onClick={() => setStatusFilter(statusFilter === "closed" ? "" : "closed")}
        >
          <div className="stat-card-top-row">
            <span className="stat-metric-label">Closed</span>
            <div className="stat-card-icon-wrapper success" style={{ width: 34, height: 34 }}>
              <Icon name="check" size={16} />
            </div>
          </div>
          <div className="stat-metric-value" style={{ fontSize: "1.75rem", color: "#10b981" }}>
            {loading ? "—" : totalClosedBugs}
          </div>
          <div className="stat-metric-footer">
            <span style={{ color: "#10b981", fontWeight: 600 }}>Signed-off by Team</span>
          </div>
        </div>
      </div>

      {/* Primary Section: Project Cloud Sheets Matrix */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <h3>Project Cloud Test Sheets & Live Defect Matrix</h3>
            <p className="card-subtitle">
              Live Google Sheets & Cloud Excel workbooks maintained by testing teams during test runs
            </p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state-card" style={{ padding: "2rem" }}>
            <p>Loading project test sheets...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-state-card" style={{ padding: "2rem" }}>
            <div className="empty-state-icon">
              <Icon name="sheet" size={28} />
            </div>
            <p>No projects found. Create a project to attach test spreadsheets.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="custom-table" style={{ minWidth: "920px" }}>
              <thead>
                <tr>
                  <th style={{ width: "18%", whiteSpace: "nowrap", padding: "0.65rem 0.5rem" }}>Project</th>
                  <th style={{ width: "18%", whiteSpace: "nowrap", padding: "0.65rem 0.4rem" }}>Cloud Test Sheet</th>
                  <th style={{ width: "6%", textAlign: "center", whiteSpace: "nowrap", padding: "0.65rem 0.2rem" }}>Open</th>
                  <th style={{ width: "7%", textAlign: "center", whiteSpace: "nowrap", padding: "0.65rem 0.2rem" }}>Retest</th>
                  <th style={{ width: "8%", textAlign: "center", whiteSpace: "nowrap", padding: "0.65rem 0.2rem" }}>Retested</th>
                  <th style={{ width: "7%", textAlign: "center", whiteSpace: "nowrap", padding: "0.65rem 0.2rem" }}>Closed</th>
                  <th style={{ width: "8%", textAlign: "center", whiteSpace: "nowrap", padding: "0.65rem 0.2rem" }}>Critical</th>
                  <th style={{ width: "6%", textAlign: "center", whiteSpace: "nowrap", padding: "0.65rem 0.2rem" }}>Total</th>
                  <th style={{ width: "10%", textAlign: "center", whiteSpace: "nowrap", padding: "0.65rem 0.25rem" }}>Last Sync</th>
                  <th style={{ width: "12%", textAlign: "right", whiteSpace: "nowrap", padding: "0.65rem 0.4rem" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td style={{ padding: "0.65rem 0.5rem" }}>
                      <strong
                        style={{
                          color: "var(--text-main)",
                          fontSize: "0.9rem",
                          display: "block",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={p.name}
                      >
                        {p.name}
                      </strong>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--text-faint)",
                          textTransform: "capitalize",
                          display: "block",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        Status: {p.status} • ID #{p.id}
                      </span>
                    </td>
                    <td style={{ padding: "0.65rem 0.4rem", whiteSpace: "nowrap" }}>
                      {p.excel_sheet_url ? (
                        <a
                          href={p.excel_sheet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{
                            color: "#10b981",
                            borderColor: "rgba(16, 185, 129, 0.4)",
                            background: "rgba(16, 185, 129, 0.08)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            fontSize: "0.75rem",
                            padding: "0.25rem 0.55rem",
                            whiteSpace: "nowrap",
                            textDecoration: "none",
                          }}
                          title="Open Live Spreadsheet"
                        >
                          <Icon name="sheet" size={13} color="#10b981" />
                          <span>Live Sheet</span>
                          <Icon name="externalLink" size={11} color="#10b981" />
                        </a>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openTallyModal(p)}
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.25rem 0.55rem",
                            color: "var(--text-muted)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          + Attach Link
                        </button>
                      )}
                    </td>
                    <td style={{ textAlign: "center", padding: "0.65rem 0.2rem" }}>
                      <span
                        style={{
                          padding: "0.2rem 0.45rem",
                          borderRadius: "var(--radius-sm)",
                          background: "rgba(244, 63, 94, 0.12)",
                          color: "#f43f5e",
                          fontWeight: 700,
                          fontSize: "0.825rem",
                          display: "inline-block",
                        }}
                      >
                        {p.open_bugs || 0}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", padding: "0.65rem 0.2rem" }}>
                      <span
                        style={{
                          padding: "0.2rem 0.45rem",
                          borderRadius: "var(--radius-sm)",
                          background: "rgba(245, 158, 11, 0.15)",
                          color: "#f59e0b",
                          fontWeight: 700,
                          fontSize: "0.825rem",
                          display: "inline-block",
                        }}
                      >
                        {p.need_retest_bugs || 0}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", padding: "0.65rem 0.2rem" }}>
                      <span
                        style={{
                          padding: "0.2rem 0.45rem",
                          borderRadius: "var(--radius-sm)",
                          background: "rgba(6, 182, 212, 0.15)",
                          color: "#06b6d4",
                          fontWeight: 700,
                          fontSize: "0.825rem",
                          display: "inline-block",
                        }}
                      >
                        {p.retested_bugs || 0}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", padding: "0.65rem 0.2rem" }}>
                      <span
                        style={{
                          padding: "0.2rem 0.45rem",
                          borderRadius: "var(--radius-sm)",
                          background: "rgba(16, 185, 129, 0.12)",
                          color: "#10b981",
                          fontWeight: 700,
                          fontSize: "0.825rem",
                          display: "inline-block",
                        }}
                      >
                        {p.closed_bugs || p.fixed_bugs || 0}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", padding: "0.65rem 0.2rem" }}>
                      <span
                        style={{
                          padding: "0.2rem 0.45rem",
                          borderRadius: "var(--radius-sm)",
                          background: Number(p.critical_bugs) > 0 ? "rgba(239, 68, 68, 0.2)" : "transparent",
                          color: Number(p.critical_bugs) > 0 ? "#ef4444" : "var(--text-faint)",
                          fontWeight: Number(p.critical_bugs) > 0 ? 700 : 400,
                          fontSize: "0.825rem",
                          display: "inline-block",
                        }}
                      >
                        {p.critical_bugs || 0}
                      </span>
                    </td>
                    <td style={{ textAlign: "center", padding: "0.65rem 0.2rem" }}>
                      <strong style={{ fontSize: "0.9rem", color: "var(--text-main)" }}>
                        {p.total_bugs || 0}
                      </strong>
                    </td>
                    <td style={{ textAlign: "center", padding: "0.65rem 0.25rem" }}>
                      {p.last_sheet_sync ? (
                        <div style={{ fontSize: "0.725rem", color: "var(--text-faint)", lineHeight: 1.25, whiteSpace: "nowrap" }}>
                          <div>{new Date(p.last_sheet_sync).toLocaleDateString()}</div>
                          <div style={{ fontSize: "0.675rem", opacity: 0.8 }}>
                            {new Date(p.last_sheet_sync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.725rem", color: "var(--text-faint)", whiteSpace: "nowrap" }}>Not synced</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap", padding: "0.65rem 0.4rem" }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openTallyModal(p)}
                        style={{
                          fontSize: "0.75rem",
                          padding: "0.3rem 0.55rem",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Icon name="edit" size={12} />
                        <span>Update Tally</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Secondary Section: Today's Active Focus & Retest Queue */}
      <div className="card">
        <div className="card-header" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div className="card-title-group">
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Icon name="clock" size={18} color="var(--primary)" />
              <span>Today's Active Focus & Retest Queue</span>
              <span
                style={{
                  fontSize: "0.78rem",
                  padding: "0.15rem 0.55rem",
                  borderRadius: "var(--radius-full)",
                  background: "rgba(99, 102, 241, 0.15)",
                  color: "var(--primary)",
                  fontWeight: 600,
                }}
              >
                {focusedBugs.length} in queue
              </span>
            </h3>
            <p className="card-subtitle">
              Focused real-time workspace for today's reported defects, pending QA retests, and critical escalations.
            </p>
          </div>

          <Link
            to="/manager/bug-list"
            className="btn btn-secondary btn-sm"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "rgba(168, 85, 247, 0.1)",
              borderColor: "rgba(168, 85, 247, 0.35)",
              color: "#c084fc",
            }}
          >
            <Icon name="bugs" size={14} color="#c084fc" />
            <span>Full Historical Archive ({bugs.length} total)</span>
            <Icon name="arrowRight" size={12} color="#c084fc" />
          </Link>
        </div>

        {/* Notice Banner */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius-md)",
            background: "rgba(99, 102, 241, 0.06)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
            margin: "0.5rem 0 1rem 0",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ color: "var(--primary)", display: "flex" }}>
              <Icon name="shield" size={16} />
            </span>
            <span style={{ fontSize: "0.825rem", color: "var(--text-main)" }}>
              <strong>Active Workspace Filter:</strong> Displaying actionable tickets. Historical records are preserved in the <strong>Reported Bug List</strong>.
            </span>
          </div>

          {/* Focus Queue Segmented Pills */}
          <div style={{ display: "inline-flex", gap: "0.35rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`btn btn-sm ${focusFilter === "all_active" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFocusFilter("all_active")}
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.65rem" }}
            >
              All Active ({allActiveCount})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${focusFilter === "today" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFocusFilter("today")}
              style={{
                fontSize: "0.75rem",
                padding: "0.25rem 0.65rem",
                borderColor: focusFilter !== "today" && todayCount > 0 ? "rgba(168, 85, 247, 0.5)" : undefined,
                color: focusFilter !== "today" && todayCount > 0 ? "#c084fc" : undefined,
              }}
            >
              Today's Logs ({todayCount})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${focusFilter === "need_retest" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFocusFilter("need_retest")}
              style={{
                fontSize: "0.75rem",
                padding: "0.25rem 0.65rem",
                borderColor: focusFilter !== "need_retest" && needRetestCount > 0 ? "rgba(245, 158, 11, 0.5)" : undefined,
                color: focusFilter !== "need_retest" && needRetestCount > 0 ? "#f59e0b" : undefined,
              }}
            >
              Ready for Retest ({needRetestCount})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${focusFilter === "critical" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFocusFilter("critical")}
              style={{
                fontSize: "0.75rem",
                padding: "0.25rem 0.65rem",
                borderColor: focusFilter !== "critical" && criticalActiveCount > 0 ? "rgba(244, 63, 94, 0.5)" : undefined,
                color: focusFilter !== "critical" && criticalActiveCount > 0 ? "#f43f5e" : undefined,
              }}
            >
              Critical ({criticalActiveCount})
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="filter-search-container" style={{ margin: "0.25rem 0 1.25rem 0", flexWrap: "wrap" }}>
          <div className="search-input-wrapper" style={{ minWidth: 240, flex: "1 1 240px" }}>
            <span className="search-icon">
              <Icon name="search" size={16} />
            </span>
            <input
              type="text"
              className="search-input-field"
              placeholder="Search active tickets in queue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filters-cluster" style={{ flexWrap: "wrap" }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              {statuses.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>

            {(search || statusFilter || severityFilter || projectFilter) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setSeverityFilter("");
                  setProjectFilter("");
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Active Queue Table */}
        {focusedBugs.length === 0 ? (
          <div className="empty-state-card" style={{ padding: "2.5rem 1.5rem" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.12)",
                color: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 0.75rem auto",
              }}
            >
              <Icon name="check" size={24} />
            </div>
            <h4 style={{ margin: "0 0 0.35rem 0", color: "var(--text-main)" }}>
              {focusFilter === "today"
                ? "No New Defects Logged Today"
                : focusFilter === "need_retest"
                  ? "No Retests Awaiting Verification"
                  : focusFilter === "critical"
                    ? "No Active Critical Blockers"
                    : "Active Queue is Empty"}
            </h4>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: 420, margin: "0 auto 1rem auto" }}>
              {focusFilter === "today"
                ? "No issues have been reported so far today. You can inspect previous sprint records in the historical archive."
                : "All priority tickets in this filter view have been addressed or signed off."}
            </p>
            <Link to="/manager/bug-list" className="btn btn-secondary btn-sm">
              <span>View Full Historical Bug List</span>
              <Icon name="arrowRight" size={13} />
            </Link>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="custom-table" style={{ minWidth: "980px" }}>
              <thead>
                <tr>
                  <th style={{ minWidth: "240px", padding: "0.75rem 0.75rem" }}>Defect Summary</th>
                  <th style={{ minWidth: "125px", padding: "0.75rem 0.6rem", whiteSpace: "nowrap" }}>Type</th>
                  <th style={{ minWidth: "130px", padding: "0.75rem 0.6rem" }}>Project</th>
                  <th style={{ minWidth: "100px", padding: "0.75rem 0.6rem", whiteSpace: "nowrap" }}>Severity</th>
                  <th style={{ minWidth: "135px", padding: "0.75rem 0.6rem", whiteSpace: "nowrap" }}>QA Status</th>
                  <th style={{ minWidth: "125px", padding: "0.75rem 0.6rem", whiteSpace: "nowrap" }}>Linked Sheet</th>
                  <th style={{ minWidth: "165px", padding: "0.75rem 0.6rem", whiteSpace: "nowrap" }}>Reported Time</th>
                  <th style={{ minWidth: "155px", textAlign: "right", padding: "0.75rem 0.75rem", whiteSpace: "nowrap" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {focusedBugs.map((bug) => {
                  const todayLogged = isCreatedToday(bug.created_at);
                  return (
                    <tr key={bug.id}>
                      <td>
                        <div
                          style={{ cursor: "pointer" }}
                          onClick={() => setActiveBug(bug)}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: "0.75rem",
                                color: "var(--text-faint)",
                                background: "var(--bg-surface-elevated)",
                                padding: "0.15rem 0.4rem",
                                borderRadius: "var(--radius-sm)",
                              }}
                            >
                              #{bug.id}
                            </span>
                            <strong
                              style={{
                                color: "var(--text-main)",
                                fontSize: "0.915rem",
                                display: "block",
                              }}
                            >
                              {bug.title}
                            </strong>
                          </div>
                          {bug.description && (
                            <div
                              style={{
                                fontSize: "0.775rem",
                                color: "var(--text-muted)",
                                maxWidth: 360,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                marginTop: "0.2rem",
                                paddingLeft: "0.2rem",
                              }}
                            >
                              {bug.description}
                            </div>
                          )}
                        </div>
                      </td>

                      <td>
                        <IssueTypeBadge category={bug.category} />
                      </td>

                      <td>
                        <strong style={{ fontSize: "0.85rem", color: "var(--text-main)" }}>
                          {bug.project_name || `Project #${bug.project_id}`}
                        </strong>
                      </td>

                      <td>
                        <SeverityBadge severity={bug.severity} />
                      </td>

                      <td>
                        <select
                          value={bug.status}
                          onChange={(e) => handleStatusChange(bug.id, e.target.value)}
                          style={{
                            padding: "0.28rem 0.55rem",
                            fontSize: "0.785rem",
                            fontWeight: 600,
                            borderRadius: "var(--radius-sm)",
                            background: "var(--bg-surface-elevated)",
                            color: "var(--text-main)",
                            border: "1px solid var(--border-color)",
                            cursor: "pointer",
                            width: "auto",
                            maxWidth: "100%",
                          }}
                        >
                          {statuses.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td style={{ padding: "0.75rem 0.6rem", whiteSpace: "nowrap" }}>
                        {bug.sheet_url ? (
                          <a
                            href={bug.sheet_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{
                              fontSize: "0.72rem",
                              padding: "0.2rem 0.45rem",
                              color: "#10b981",
                              borderColor: "rgba(16, 185, 129, 0.4)",
                              background: "rgba(16, 185, 129, 0.08)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.3rem",
                            }}
                            title="Open linked Google Sheet / Excel in new tab"
                          >
                            <Icon name="sheet" size={12} color="#10b981" />
                            <span>Sheet</span>
                            <Icon name="externalLink" size={10} color="#10b981" />
                          </a>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-faint)" }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: "0.75rem 0.6rem", whiteSpace: "nowrap" }}>
                        {bug.created_at ? (
                          <div style={{ fontSize: "0.8rem", color: "var(--text-main)", lineHeight: 1.35, whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", whiteSpace: "nowrap" }}>
                              {todayLogged && (
                                <span
                                  style={{
                                    fontSize: "0.68rem",
                                    padding: "0.12rem 0.4rem",
                                    borderRadius: "var(--radius-sm)",
                                    background: "rgba(16, 185, 129, 0.15)",
                                    color: "#10b981",
                                    fontWeight: 700,
                                    whiteSpace: "nowrap",
                                    display: "inline-block",
                                    letterSpacing: "0.04em",
                                  }}
                                >
                                  TODAY
                                </span>
                              )}
                              <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                                {new Date(bug.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-faint)", marginTop: "0.15rem", whiteSpace: "nowrap" }}>
                              {new Date(bug.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.785rem", color: "var(--text-faint)" }}>—</span>
                        )}
                      </td>

                      <td style={{ textAlign: "right", whiteSpace: "nowrap", padding: "0.75rem 0.75rem" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", whiteSpace: "nowrap" }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEditModal(bug)}
                            style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem", whiteSpace: "nowrap", flexShrink: 0 }}
                            title="Quick Edit defect"
                          >
                            <Icon name="edit" size={12} />
                            <span>Edit</span>
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setActiveBug(bug)}
                            style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem", whiteSpace: "nowrap", flexShrink: 0 }}
                          >
                            Inspect
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

      {/* Modal: Quick Edit Defect */}
      {editBug && (
        <Modal
          isOpen={Boolean(editBug)}
          onClose={() => !submittingEdit && setEditBug(null)}
          title={`Quick Edit Defect #${editBug.id}`}
        >
          <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div className="form-group">
              <label className="form-label">Classification / Issue Type</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "var(--radius-md)",
                    border:
                      editCategory === "bug"
                        ? "2px solid #f43f5e"
                        : "1px solid var(--border-color)",
                    background:
                      editCategory === "bug"
                        ? "rgba(244, 63, 94, 0.12)"
                        : "var(--bg-surface-elevated)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    transition: "all 0.15s ease",
                  }}
                  onClick={() => setEditCategory("bug")}
                >
                  <Icon name="bugs" size={16} color="#f43f5e" />
                  <div>
                    <div style={{ color: "var(--text-main)", fontSize: "0.85rem", fontWeight: 700 }}>Software Defect</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Code bug or glitch</div>
                  </div>
                </div>

                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "var(--radius-md)",
                    border:
                      editCategory === "requirement_change"
                        ? "2px solid #a855f7"
                        : "1px solid var(--border-color)",
                    background:
                      editCategory === "requirement_change"
                        ? "rgba(168, 85, 247, 0.15)"
                        : "var(--bg-surface-elevated)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    transition: "all 0.15s ease",
                  }}
                  onClick={() => setEditCategory("requirement_change")}
                >
                  <Icon name="gitBranch" size={16} color="#c084fc" />
                  <div>
                    <div style={{ color: "var(--text-main)", fontSize: "0.85rem", fontWeight: 700 }}>Requirement Change</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Scope or spec change</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="m-edit-title">Title *</label>
              <input
                id="m-edit-title"
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Brief summary of the issue..."
                required
              />
            </div>

            <div className="form-grid-2col">
              <div className="form-group">
                <label className="form-label" htmlFor="m-edit-sev">Severity Level</label>
                <select
                  id="m-edit-sev"
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
                <label className="form-label" htmlFor="m-edit-status">QA Status</label>
                <select
                  id="m-edit-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  {statuses.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="m-edit-sheet">
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                  <Icon name="sheet" size={13} color="#10b981" />
                  <span>Link a Sheet / Test Run URL (Optional)</span>
                </span>
              </label>
              <input
                id="m-edit-sheet"
                type="url"
                value={editSheetUrl}
                onChange={(e) => setEditSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/... or Excel online URL"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="m-edit-desc">Reproduction Steps / Details</label>
              <textarea
                id="m-edit-desc"
                rows={4}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Describe reproduction steps, expected behavior, or notes..."
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditBug(null)}
                disabled={submittingEdit}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submittingEdit}>
                {submittingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Quick Tally & Sheet Sync */}
      {tallyProject && (
        <Modal
          isOpen={Boolean(tallyProject)}
          onClose={() => setTallyProject(null)}
          title={`Update Sheet Counts: ${tallyProject.name}`}
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setTallyProject(null)}
                disabled={tallySubmitting}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveTally}
                disabled={tallySubmitting}
              >
                {tallySubmitting ? "Saving..." : "Save Sheet Tallies"}
              </button>
            </>
          }
        >
          <form onSubmit={handleSaveTally} style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%", maxWidth: "100%", boxSizing: "border-box", overflowX: "hidden" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Update the defect tallies directly from your team's live Google Sheet or Excel workbook.
            </p>

            <div className="form-group-block">
              <label htmlFor="m-sheet-url" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Icon name="sheet" size={15} color="#10b981" />
                <span>Cloud Excel / Google Sheets Link</span>
              </label>
              <input
                id="m-sheet-url"
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/... or OneDrive link"
                value={tallySheetUrl}
                onChange={(e) => setTallySheetUrl(e.target.value)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))", gap: "0.65rem", width: "100%", boxSizing: "border-box" }}>
              <div className="form-group-block">
                <label htmlFor="m-open" style={{ color: "#f43f5e", fontWeight: 600, fontSize: "0.8rem" }}>
                  Open
                </label>
                <input
                  id="m-open"
                  type="number"
                  min="0"
                  value={tallyOpen}
                  onChange={(e) => setTallyOpen(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-block">
                <label htmlFor="m-retest" style={{ color: "#f59e0b", fontWeight: 600, fontSize: "0.8rem" }}>
                  Need Retest
                </label>
                <input
                  id="m-retest"
                  type="number"
                  min="0"
                  value={tallyNeedRetest}
                  onChange={(e) => setTallyNeedRetest(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-block">
                <label htmlFor="m-retested" style={{ color: "#06b6d4", fontWeight: 600, fontSize: "0.8rem" }}>
                  Retested
                </label>
                <input
                  id="m-retested"
                  type="number"
                  min="0"
                  value={tallyRetested}
                  onChange={(e) => setTallyRetested(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-block">
                <label htmlFor="m-closed" style={{ color: "#10b981", fontWeight: 600, fontSize: "0.8rem" }}>
                  Closed
                </label>
                <input
                  id="m-closed"
                  type="number"
                  min="0"
                  value={tallyClosed}
                  onChange={(e) => setTallyClosed(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-block">
                <label htmlFor="m-crit" style={{ color: "#ef4444", fontWeight: 600, fontSize: "0.8rem" }}>
                  Critical
                </label>
                <input
                  id="m-crit"
                  type="number"
                  min="0"
                  value={tallyCritical}
                  onChange={(e) => setTallyCritical(e.target.value)}
                  required
                />
              </div>
            </div>

            <div
              style={{
                padding: "0.75rem 1rem",
                background: "var(--bg-surface-elevated)",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.85rem",
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>Total Calculated Bugs:</span>
              <strong style={{ fontSize: "1.1rem", color: "var(--primary)" }}>
                {(Number(tallyOpen) || 0) + (Number(tallyNeedRetest) || 0) + (Number(tallyRetested) || 0) + (Number(tallyClosed) || 0)}
              </strong>
            </div>
          </form>
        </Modal>
      )}

      {/* Bug Details Modal */}
      {activeBug && (
        <Modal
          isOpen={Boolean(activeBug)}
          onClose={() => setActiveBug(null)}
          title={`Defect #${activeBug.id} Details`}
          footer={
            <button className="btn btn-secondary" onClick={() => setActiveBug(null)}>
              Close
            </button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 700 }}>
                Title
              </span>
              <h2 style={{ fontSize: "1.2rem", marginTop: "0.25rem" }}>{activeBug.title}</h2>
            </div>

            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 700 }}>
                  Severity
                </span>
                <div style={{ marginTop: "0.3rem" }}>
                  <SeverityBadge severity={activeBug.severity} />
                </div>
              </div>

              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 700 }}>
                  QA Status
                </span>
                <div style={{ marginTop: "0.3rem" }}>
                  <select
                    value={activeBug.status}
                    onChange={(e) => handleStatusChange(activeBug.id, e.target.value)}
                    style={{ padding: "0.35rem 0.65rem", fontSize: "0.8rem", fontWeight: 600 }}
                  >
                    {statuses.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 700 }}>
                  Project ID
                </span>
                <div style={{ marginTop: "0.3rem", fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}>
                  #{activeBug.project_id}
                </div>
              </div>

              {activeBug.sheet_url && (
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 700 }}>
                    Linked Sheet
                  </span>
                  <div style={{ marginTop: "0.3rem" }}>
                    <a
                      href={activeBug.sheet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{
                        fontSize: "0.785rem",
                        color: "#10b981",
                        borderColor: "rgba(16, 185, 129, 0.4)",
                        background: "rgba(16, 185, 129, 0.08)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                      }}
                    >
                      <Icon name="sheet" size={13} color="#10b981" />
                      <span>Open Live Sheet</span>
                      <Icon name="externalLink" size={11} color="#10b981" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 700 }}>
                Description & Reproduction Steps
              </span>
              <div
                style={{
                  marginTop: "0.35rem",
                  padding: "1rem",
                  background: "var(--bg-surface-elevated)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.875rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {activeBug.description || "No description provided."}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ManagerBugs;
