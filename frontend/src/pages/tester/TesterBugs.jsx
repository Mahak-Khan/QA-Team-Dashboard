import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getTesterProjects } from "../../services/testerService";
import { updateProjectMetrics } from "../../services/projectService";
import { getBugs, createBug, updateBugStatus, getBugSummary } from "../../services/bugService";
import { Icon } from "../../components/common/Icons";
import { StatusBadge, SeverityBadge } from "../../components/common/Badge";
import { Modal } from "../../components/common/Modal";
import { BarChart } from "../../components/charts/BarChart";
import { useToast } from "../../context/ToastContext";

const statuses = [
  { key: "open", label: "Open", color: "#f43f5e" },
  { key: "need_retest", label: "Need Retest", color: "#f59e0b" },
  { key: "retested", label: "Retested", color: "#06b6d4" },
  { key: "closed", label: "Closed", color: "#10b981" },
];

export function TesterBugs() {
  const [searchParams] = useSearchParams();
  const initialProjectId = searchParams.get("projectId") || "";

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [bugs, setBugs] = useState([]);
  const [bugSummary, setBugSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [sheetViewMode, setSheetViewMode] = useState("cards");

  // Filters for granular bugs
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");

  // Report Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reportProjectId, setReportProjectId] = useState(initialProjectId);
  const [bugTitle, setBugTitle] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [bugSeverity, setBugSeverity] = useState("medium");

  // Inspect Modal
  const [inspectBug, setInspectBug] = useState(null);

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

  const getTesterIdFromToken = () => {
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

  const testerId = getTesterIdFromToken();

  const loadData = async (targetProjId) => {
    try {
      setLoading(true);
      const [projData, summaryData] = await Promise.all([
        getTesterProjects(),
        getBugSummary(),
      ]);
      const validProjs = Array.isArray(projData) ? projData : [];
      setProjects(validProjs);
      setBugSummary(summaryData || {});

      const activeProj = targetProjId || (validProjs.length > 0 ? String(validProjs[0].id) : "");
      if (!selectedProjectId && activeProj) {
        setSelectedProjectId(activeProj);
      }
      if (!reportProjectId && activeProj) {
        setReportProjectId(activeProj);
      }

      // Fetch bugs for tester's projects
      const bugData = await getBugs(activeProj ? Number(activeProj) : undefined);
      setBugs(Array.isArray(bugData) ? bugData : []);
    } catch {
      addToast("Failed to fetch defect records.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(initialProjectId);
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

      addToast("Bug metrics synchronized with live sheet!", "success");
      setProjects((prev) =>
        prev.map((p) => (p.id === tallyProject.id ? { ...p, ...updated } : p))
      );
      setTallyProject(null);

      // Refresh summary
      const newSummary = await getBugSummary();
      setBugSummary(newSummary || {});
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to sync metrics.", "error");
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
      if (inspectBug && inspectBug.id === bugId) {
        setInspectBug((prev) => ({ ...prev, status: newStatus }));
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

  const handleProjectFilterChange = async (newId) => {
    setSelectedProjectId(newId);
    try {
      setLoading(true);
      const bugData = await getBugs(newId ? Number(newId) : undefined);
      setBugs(Array.isArray(bugData) ? bugData : []);
    } catch {
      addToast("Failed to load bugs for selected project.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReportBug = async (e) => {
    e.preventDefault();
    if (!testerId) {
      addToast("Session expired. Please log in again.", "error");
      return;
    }

    if (!reportProjectId) {
      addToast("Please select a project to report this bug against.", "error");
      return;
    }

    if (!bugTitle.trim()) {
      addToast("Bug title is required.", "error");
      return;
    }

    setSubmitting(true);
    try {
      await createBug({
        project_id: Number(reportProjectId),
        reported_by: testerId,
        title: bugTitle.trim(),
        description: bugDescription.trim() || null,
        severity: bugSeverity,
      });

      addToast("Defect reported successfully!", "success");
      setBugTitle("");
      setBugDescription("");
      setBugSeverity("medium");
      setIsModalOpen(false);

      await handleProjectFilterChange(selectedProjectId || reportProjectId);
    } catch (err) {
      addToast(
        err.response?.data?.detail || "Could not report defect.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const totalOpenBugs = Number(bugSummary.open ?? 0);
  const totalNeedRetest = Number(bugSummary.need_retest ?? 0);
  const totalRetested = Number(bugSummary.retested ?? 0);
  const totalClosedBugs = Number(bugSummary.closed ?? 0);
  const totalOverallBugs = Number(bugSummary.total ?? 0);
  const totalCriticalBugs = Number(bugSummary.severities?.critical ?? bugSummary.sheet_metrics?.critical_bugs ?? 0);
  const resolutionRate = totalOverallBugs > 0 ? Math.round(((totalRetested + totalClosedBugs) / totalOverallBugs) * 100) : 0;

  const bugStatusBarChartData = [
    { label: "Open", value: totalOpenBugs, color: "#f43f5e" },
    { label: "Need Retest", value: totalNeedRetest, color: "#f59e0b" },
    { label: "Retested", value: totalRetested, color: "#06b6d4" },
    { label: "Closed", value: totalClosedBugs, color: "#10b981" },
    { label: "Critical", value: totalCriticalBugs, color: "#ef4444" },
  ];

  const filteredBugs = bugs.filter((b) => {
    const matchesSearch =
      !search ||
      (b.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (b.description || "").toLowerCase().includes(search.toLowerCase());

    const matchesStatus = !statusFilter || b.status === statusFilter;
    const matchesSeverity =
      !severityFilter ||
      (b.severity || "").toLowerCase() === severityFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <div className="page-header-row">
        <div className="page-title-box">
          <h1>Project Defect Tracking & Live Sheets</h1>
          <p className="page-subtitle">
            Access your active testing spreadsheets, update sheet bug counts, or log specific blocker tickets.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setReportProjectId(selectedProjectId || (projects[0]?.id ? String(projects[0].id) : ""));
            setIsModalOpen(true);
          }}
          disabled={projects.length === 0}
        >
          <Icon name="plus" size={16} />
          <span>Report Blocker</span>
        </button>
      </div>

      {/* Visual Analytics & Defect Status Cards (Dual Grid) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 450px), 1fr))",
          gap: "1.5rem",
          alignItems: "stretch",
        }}
      >
        {/* Left Card: Interactive Bar Graph */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div className="card-header" style={{ marginBottom: "0.5rem" }}>
            <div className="card-title-group">
              <h3>Defect Distribution Graph</h3>
              <p className="card-subtitle">
                Visual status breakdown across live testing sheets & reported defects
              </p>
            </div>
            <div className="stat-card-icon-wrapper info" style={{ width: 34, height: 34 }}>
              <Icon name="trendingUp" size={16} />
            </div>
          </div>

          <div style={{ padding: "0.5rem 0 1rem 0" }}>
            <BarChart data={bugStatusBarChartData} height={205} />
          </div>

          <div
            style={{
              padding: "0.75rem 1rem",
              background: "var(--bg-surface-elevated)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.825rem",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Resolution Rate:</span>
              <strong style={{ color: resolutionRate >= 70 ? "#10b981" : "#f59e0b" }}>
                {resolutionRate}%
              </strong>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Total Scoped Defects:</span>
              <strong style={{ color: "var(--text-main)" }}>
                {totalOverallBugs} Defects
              </strong>
            </div>
          </div>
        </div>

        {/* Right Card: Modern QA Defect Metric Cards Grid */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div className="card-header" style={{ marginBottom: "0.75rem" }}>
            <div className="card-title-group">
              <h3>Defect Status Breakdown</h3>
              <p className="card-subtitle">
                Click any status card below to filter tickets
              </p>
            </div>
            {statusFilter && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setStatusFilter("")}
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
              >
                Clear Filter
              </button>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "0.85rem",
              marginBottom: "0.85rem",
            }}
          >
            {/* Open */}
            <div
              className="stat-metric-card"
              style={{
                padding: "0.95rem 1.1rem",
                cursor: "pointer",
                background: statusFilter === "open" ? "rgba(244, 63, 94, 0.12)" : "var(--bg-surface-elevated)",
                border: statusFilter === "open" ? "1px solid #f43f5e" : "1px solid var(--border-subtle)",
              }}
              onClick={() => setStatusFilter(statusFilter === "open" ? "" : "open")}
            >
              <div className="stat-card-top-row">
                <span className="stat-metric-label" style={{ fontSize: "0.78rem" }}>Open</span>
                <div className="stat-card-icon-wrapper danger" style={{ width: 28, height: 28 }}>
                  <Icon name="alert" size={14} />
                </div>
              </div>
              <div className="stat-metric-value" style={{ fontSize: "1.6rem", color: "#f43f5e" }}>
                {loading ? "—" : totalOpenBugs}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#f43f5e", fontWeight: 600 }}>
                Awaiting Dev Fix
              </div>
            </div>

            {/* Need Retest */}
            <div
              className="stat-metric-card"
              style={{
                padding: "0.95rem 1.1rem",
                cursor: "pointer",
                background: statusFilter === "need_retest" ? "rgba(245, 158, 11, 0.12)" : "var(--bg-surface-elevated)",
                border: statusFilter === "need_retest" ? "1px solid #f59e0b" : "1px solid var(--border-subtle)",
              }}
              onClick={() => setStatusFilter(statusFilter === "need_retest" ? "" : "need_retest")}
            >
              <div className="stat-card-top-row">
                <span className="stat-metric-label" style={{ fontSize: "0.78rem" }}>Need Retest</span>
                <div className="stat-card-icon-wrapper warning" style={{ width: 28, height: 28 }}>
                  <Icon name="refresh" size={14} />
                </div>
              </div>
              <div className="stat-metric-value" style={{ fontSize: "1.6rem", color: "#f59e0b" }}>
                {loading ? "—" : totalNeedRetest}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#f59e0b", fontWeight: 600 }}>
                Ready for QA Retest
              </div>
            </div>

            {/* Retested */}
            <div
              className="stat-metric-card"
              style={{
                padding: "0.95rem 1.1rem",
                cursor: "pointer",
                background: statusFilter === "retested" ? "rgba(6, 182, 212, 0.12)" : "var(--bg-surface-elevated)",
                border: statusFilter === "retested" ? "1px solid #06b6d4" : "1px solid var(--border-subtle)",
              }}
              onClick={() => setStatusFilter(statusFilter === "retested" ? "" : "retested")}
            >
              <div className="stat-card-top-row">
                <span className="stat-metric-label" style={{ fontSize: "0.78rem" }}>Retested</span>
                <div className="stat-card-icon-wrapper cyan" style={{ width: 28, height: 28 }}>
                  <Icon name="check" size={14} />
                </div>
              </div>
              <div className="stat-metric-value" style={{ fontSize: "1.6rem", color: "#06b6d4" }}>
                {loading ? "—" : totalRetested}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#06b6d4", fontWeight: 600 }}>
                Verified Working
              </div>
            </div>

            {/* Closed */}
            <div
              className="stat-metric-card"
              style={{
                padding: "0.95rem 1.1rem",
                cursor: "pointer",
                background: statusFilter === "closed" ? "rgba(16, 185, 129, 0.12)" : "var(--bg-surface-elevated)",
                border: statusFilter === "closed" ? "1px solid #10b981" : "1px solid var(--border-subtle)",
              }}
              onClick={() => setStatusFilter(statusFilter === "closed" ? "" : "closed")}
            >
              <div className="stat-card-top-row">
                <span className="stat-metric-label" style={{ fontSize: "0.78rem" }}>Closed</span>
                <div className="stat-card-icon-wrapper success" style={{ width: 28, height: 28 }}>
                  <Icon name="check" size={14} />
                </div>
              </div>
              <div className="stat-metric-value" style={{ fontSize: "1.6rem", color: "#10b981" }}>
                {loading ? "—" : totalClosedBugs}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#10b981", fontWeight: 600 }}>
                Signed-off by Team
              </div>
            </div>
          </div>

          {/* Bottom Critical strip */}
          <div
            style={{
              padding: "0.7rem 0.95rem",
              borderRadius: "var(--radius-md)",
              background: totalCriticalBugs > 0 ? "rgba(239, 68, 68, 0.12)" : "var(--bg-surface-elevated)",
              border: totalCriticalBugs > 0 ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.825rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <Icon name="alert" size={15} color={totalCriticalBugs > 0 ? "#ef4444" : "var(--text-faint)"} />
              <span style={{ color: totalCriticalBugs > 0 ? "#ef4444" : "var(--text-muted)", fontWeight: 600 }}>
                Critical Blockers:
              </span>
            </div>
            <strong style={{ color: totalCriticalBugs > 0 ? "#ef4444" : "var(--text-main)", fontSize: "0.95rem" }}>
              {totalCriticalBugs} {totalCriticalBugs === 1 ? "Blocker" : "Blockers"}
            </strong>
          </div>
        </div>
      </div>

      {/* Primary Section: Assigned Projects Sheet Matrix */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div className="card-title-group">
            <h3>My Assigned Live Test Sheets & Bug Tallies</h3>
            <p className="card-subtitle">
              Live Google Sheets & Excel workbooks attached to your testing scopes
            </p>
          </div>

          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-mode-btn ${sheetViewMode === "cards" ? "active" : ""}`}
              onClick={() => setSheetViewMode("cards")}
              title="Attractive Cards View"
            >
              <Icon name="grid" size={14} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              className={`view-mode-btn ${sheetViewMode === "table" ? "active" : ""}`}
              onClick={() => setSheetViewMode("table")}
              title="Table View"
            >
              <Icon name="list" size={14} />
              <span>Table</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state-card" style={{ padding: "2rem" }}>
            <p>Loading test sheets...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-state-card" style={{ padding: "2rem" }}>
            <div className="empty-state-icon">
              <Icon name="sheet" size={28} />
            </div>
            <p>No assigned projects found.</p>
          </div>
        ) : sheetViewMode === "cards" ? (
          /* Attractive Project Cards Grid */
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
              gap: "1.25rem",
            }}
          >
            {projects.map((p) => (
              <div
                key={p.id}
                style={{
                  background: "var(--bg-surface-elevated)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "1rem",
                  transition: "all var(--transition-fast)",
                }}
              >
                <div>
                  {/* Card Top: Title, ID, Status */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", minWidth: 0 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "var(--radius-md)",
                          background: "var(--primary-subtle)",
                          color: "var(--primary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          border: "1px solid rgba(99, 102, 241, 0.3)",
                        }}
                      >
                        <Icon name="projects" size={18} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong
                          style={{
                            color: "var(--text-main)",
                            fontSize: "0.98rem",
                            display: "block",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={p.name}
                        >
                          {p.name}
                        </strong>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                          Project #{p.id}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={p.status || "active"} />
                  </div>

                  {/* Spreadsheet Link Button */}
                  <div style={{ marginBottom: "0.85rem" }}>
                    {p.excel_sheet_url ? (
                      <a
                        href={p.excel_sheet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{
                          width: "100%",
                          color: "#10b981",
                          borderColor: "rgba(16, 185, 129, 0.4)",
                          background: "rgba(16, 185, 129, 0.08)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.45rem",
                          fontSize: "0.8rem",
                          padding: "0.45rem 0.75rem",
                          textDecoration: "none",
                        }}
                        title="Open Live Spreadsheet in new tab"
                      >
                        <Icon name="sheet" size={15} color="#10b981" />
                        <span>Open Live Sheet</span>
                        <Icon name="externalLink" size={12} color="#10b981" />
                      </a>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openTallyModal(p)}
                        style={{ width: "100%", fontSize: "0.8rem", padding: "0.45rem", color: "var(--text-muted)" }}
                      >
                        + Attach Spreadsheet Link
                      </button>
                    )}
                  </div>

                  {/* Defect Metrics Chip Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: "0.4rem",
                      textAlign: "center",
                      marginBottom: Number(p.critical_bugs) > 0 ? "0.6rem" : "0",
                    }}
                  >
                    <div style={{ padding: "0.45rem 0.2rem", background: "rgba(244, 63, 94, 0.1)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(244, 63, 94, 0.2)" }}>
                      <span style={{ display: "block", fontSize: "1rem", fontWeight: 700, color: "#f43f5e" }}>
                        {p.open_bugs || 0}
                      </span>
                      <span style={{ fontSize: "0.68rem", color: "#f43f5e", fontWeight: 600 }}>Open</span>
                    </div>

                    <div style={{ padding: "0.45rem 0.2rem", background: "rgba(245, 158, 11, 0.1)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                      <span style={{ display: "block", fontSize: "1rem", fontWeight: 700, color: "#f59e0b" }}>
                        {p.need_retest_bugs || 0}
                      </span>
                      <span style={{ fontSize: "0.68rem", color: "#f59e0b", fontWeight: 600 }}>Retest</span>
                    </div>

                    <div style={{ padding: "0.45rem 0.2rem", background: "rgba(6, 182, 212, 0.1)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(6, 182, 212, 0.2)" }}>
                      <span style={{ display: "block", fontSize: "1rem", fontWeight: 700, color: "#06b6d4" }}>
                        {p.retested_bugs || 0}
                      </span>
                      <span style={{ fontSize: "0.68rem", color: "#06b6d4", fontWeight: 600 }}>Retested</span>
                    </div>

                    <div style={{ padding: "0.45rem 0.2rem", background: "rgba(16, 185, 129, 0.1)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                      <span style={{ display: "block", fontSize: "1rem", fontWeight: 700, color: "#10b981" }}>
                        {p.closed_bugs || p.fixed_bugs || 0}
                      </span>
                      <span style={{ fontSize: "0.68rem", color: "#10b981", fontWeight: 600 }}>Closed</span>
                    </div>
                  </div>

                  {Number(p.critical_bugs) > 0 && (
                    <div
                      style={{
                        padding: "0.35rem 0.65rem",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "0.75rem",
                      }}
                    >
                      <span style={{ color: "#ef4444", fontWeight: 600 }}>Critical Blockers:</span>
                      <strong style={{ color: "#ef4444" }}>{p.critical_bugs}</strong>
                    </div>
                  )}
                </div>

                {/* Card Bottom: Total & Sync Action */}
                <div
                  style={{
                    paddingTop: "0.75rem",
                    borderTop: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    Total: <strong style={{ color: "var(--text-main)" }}>{p.total_bugs || 0} defects</strong>
                  </span>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => openTallyModal(p)}
                    style={{ fontSize: "0.75rem", padding: "0.28rem 0.65rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                  >
                    <Icon name="edit" size={13} />
                    <span>Sync Tally</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View Alternative */
          <div className="table-scroll">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: "20%", whiteSpace: "nowrap", padding: "0.65rem 0.5rem" }}>Project</th>
                  <th style={{ width: "18%", whiteSpace: "nowrap", padding: "0.65rem 0.4rem" }}>Cloud Test Sheet</th>
                  <th style={{ width: "6%", textAlign: "center", whiteSpace: "nowrap", padding: "0.65rem 0.2rem" }}>Open</th>
                  <th style={{ width: "7%", textAlign: "center", whiteSpace: "nowrap", padding: "0.65rem 0.2rem" }}>Retest</th>
                  <th style={{ width: "8%", textAlign: "center", whiteSpace: "nowrap", padding: "0.65rem 0.2rem" }}>Retested</th>
                  <th style={{ width: "7%", textAlign: "center", whiteSpace: "nowrap", padding: "0.65rem 0.2rem" }}>Closed</th>
                  <th style={{ width: "8%", textAlign: "center", whiteSpace: "nowrap", padding: "0.65rem 0.2rem" }}>Critical</th>
                  <th style={{ width: "10%", textAlign: "center", whiteSpace: "nowrap", padding: "0.65rem 0.2rem" }}>Total Bugs</th>
                  <th style={{ width: "16%", textAlign: "right", whiteSpace: "nowrap", padding: "0.65rem 0.4rem" }}>Action</th>
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
                          display: "block",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        ID #{p.id}
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
                          background: "rgba(245, 158, 11, 0.12)",
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
                          background: "rgba(6, 182, 212, 0.12)",
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
                        <span>Sync Tally</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Secondary Section: Logged Tickets Table Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <h3>Individual Defect Tickets</h3>
            <p className="card-subtitle">Detailed issues reported for developer investigation</p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="filter-search-container" style={{ margin: "0.5rem 0 1.25rem 0" }}>
          <div className="search-input-wrapper">
            <span className="search-icon">
              <Icon name="search" size={16} />
            </span>
            <input
              type="text"
              className="search-input-field"
              placeholder="Search defects by title or reproduction steps..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filters-cluster">
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectFilterChange(e.target.value)}
            >
              <option value="">All Assigned Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All QA Statuses</option>
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

            {(search || statusFilter || severityFilter || selectedProjectId) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setSeverityFilter("");
                  handleProjectFilterChange("");
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {filteredBugs.length === 0 ? (
          <div className="empty-state-card" style={{ padding: "2rem" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              {search || statusFilter || severityFilter
                ? "No bugs match your current filter parameters."
                : "No individual defect tickets logged. Bug counts are tracked via the attached live spreadsheets above."}
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: "38%" }}>Defect Summary</th>
                  <th style={{ width: "14%" }}>Severity</th>
                  <th style={{ width: "16%" }}>QA Status</th>
                  <th style={{ width: "18%" }}>Logged Date</th>
                  <th style={{ width: "14%", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredBugs.map((bug) => (
                  <tr key={bug.id}>
                    <td>
                      <div
                        style={{ cursor: "pointer" }}
                        onClick={() => setInspectBug(bug)}
                      >
                        <strong
                          style={{
                            color: "var(--text-main)",
                            fontSize: "0.95rem",
                            display: "block",
                            marginBottom: "0.2rem",
                          }}
                        >
                          {bug.title}
                        </strong>
                        <div
                          style={{
                            fontSize: "0.785rem",
                            color: "var(--text-muted)",
                            maxWidth: 420,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {bug.description || "No description provided."}
                        </div>
                      </div>
                    </td>
                    <td>
                      <SeverityBadge severity={bug.severity} />
                    </td>
                    <td>
                      <select
                        value={bug.status}
                        onChange={(e) => handleStatusChange(bug.id, e.target.value)}
                        style={{
                          padding: "0.3rem 0.6rem",
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
                    <td>
                      {bug.created_at ? (
                        <div style={{ fontSize: "0.785rem", color: "var(--text-faint)", lineHeight: 1.3 }}>
                          <div>{new Date(bug.created_at).toLocaleDateString()}</div>
                          <div style={{ fontSize: "0.7rem", opacity: 0.8 }}>
                            {new Date(bug.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.785rem", color: "var(--text-faint)" }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setInspectBug(bug)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Quick Tally & Sheet Sync */}
      {tallyProject && (
        <Modal
          isOpen={Boolean(tallyProject)}
          onClose={() => setTallyProject(null)}
          title={`Update Sheet Bug Counts: ${tallyProject.name}`}
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
                {tallySubmitting ? "Saving..." : "Save Metrics"}
              </button>
            </>
          }
        >
          <form onSubmit={handleSaveTally} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Update your testing counts directly from your team's live Google Sheet or Excel workbook.
            </p>

            <div className="form-group-block">
              <label htmlFor="t-sheet-url" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Icon name="sheet" size={15} color="#10b981" />
                <span>Cloud Excel / Google Sheets Link</span>
              </label>
              <input
                id="t-sheet-url"
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/... or OneDrive link"
                value={tallySheetUrl}
                onChange={(e) => setTallySheetUrl(e.target.value)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))", gap: "0.65rem", width: "100%", boxSizing: "border-box" }}>
              <div className="form-group-block">
                <label htmlFor="t-open" style={{ color: "#f43f5e", fontWeight: 600, fontSize: "0.75rem" }}>
                  Open
                </label>
                <input
                  id="t-open"
                  type="number"
                  min="0"
                  value={tallyOpen}
                  onChange={(e) => setTallyOpen(e.target.value)}
                  required
                  style={{ padding: "0.55rem 0.65rem" }}
                />
              </div>

              <div className="form-group-block">
                <label htmlFor="t-need-retest" style={{ color: "#f59e0b", fontWeight: 600, fontSize: "0.75rem" }}>
                  Need Retest
                </label>
                <input
                  id="t-need-retest"
                  type="number"
                  min="0"
                  value={tallyNeedRetest}
                  onChange={(e) => setTallyNeedRetest(e.target.value)}
                  required
                  style={{ padding: "0.55rem 0.65rem" }}
                />
              </div>

              <div className="form-group-block">
                <label htmlFor="t-retested" style={{ color: "#06b6d4", fontWeight: 600, fontSize: "0.75rem" }}>
                  Retested
                </label>
                <input
                  id="t-retested"
                  type="number"
                  min="0"
                  value={tallyRetested}
                  onChange={(e) => setTallyRetested(e.target.value)}
                  required
                  style={{ padding: "0.55rem 0.65rem" }}
                />
              </div>

              <div className="form-group-block">
                <label htmlFor="t-closed" style={{ color: "#10b981", fontWeight: 600, fontSize: "0.75rem" }}>
                  Closed
                </label>
                <input
                  id="t-closed"
                  type="number"
                  min="0"
                  value={tallyClosed}
                  onChange={(e) => setTallyClosed(e.target.value)}
                  required
                  style={{ padding: "0.55rem 0.65rem" }}
                />
              </div>
            </div>

            <div className="form-group-block">
              <label htmlFor="t-crit" style={{ color: "#ef4444", fontWeight: 600 }}>
                Critical Blocker Bugs
              </label>
              <input
                id="t-crit"
                type="number"
                min="0"
                value={tallyCritical}
                onChange={(e) => setTallyCritical(e.target.value)}
                required
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Report New Defect */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Report New Defect"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleReportBug}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Report Defect"}
            </button>
          </>
        }
      >
        <form onSubmit={handleReportBug} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="form-group-block">
            <label htmlFor="b-proj">Target Project *</label>
            <select
              id="b-proj"
              value={reportProjectId}
              onChange={(e) => setReportProjectId(e.target.value)}
              required
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group-block">
            <label htmlFor="b-title">Bug Title *</label>
            <input
              id="b-title"
              type="text"
              placeholder="e.g. Broken checkout form validation on Safari"
              maxLength={200}
              value={bugTitle}
              onChange={(e) => setBugTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group-block">
            <label htmlFor="b-sev">Severity Rating</label>
            <select
              id="b-sev"
              value={bugSeverity}
              onChange={(e) => setBugSeverity(e.target.value)}
            >
              <option value="low">Low (Minor cosmetic issue)</option>
              <option value="medium">Medium (Standard defect)</option>
              <option value="high">High (Major function failure)</option>
              <option value="critical">Critical (Crash / Data loss / Blocker)</option>
            </select>
          </div>

          <div className="form-group-block">
            <label htmlFor="b-desc">Description & Steps to Reproduce</label>
            <textarea
              id="b-desc"
              rows={4}
              placeholder="1. Navigate to ...&#10;2. Click on ...&#10;3. Observed error vs Expected behavior..."
              value={bugDescription}
              onChange={(e) => setBugDescription(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* Modal: Inspect Defect */}
      {inspectBug && (
        <Modal
          isOpen={Boolean(inspectBug)}
          onClose={() => setInspectBug(null)}
          title={`Defect #${inspectBug.id} Overview`}
          footer={
            <button className="btn btn-secondary" onClick={() => setInspectBug(null)}>
              Close
            </button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 700 }}>
                Bug Title
              </span>
              <h2 style={{ fontSize: "1.15rem", marginTop: "0.25rem" }}>{inspectBug.title}</h2>
            </div>

            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                  Severity
                </span>
                <div style={{ marginTop: "0.3rem" }}>
                  <SeverityBadge severity={inspectBug.severity} />
                </div>
              </div>

              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                  QA Status
                </span>
                <div style={{ marginTop: "0.3rem" }}>
                  <select
                    value={inspectBug.status}
                    onChange={(e) => handleStatusChange(inspectBug.id, e.target.value)}
                    style={{
                      padding: "0.3rem 0.6rem",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-surface-elevated)",
                      cursor: "pointer",
                    }}
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
                <span style={{ fontSize: "0.75rem", color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                  Logged Date
                </span>
                <div style={{ marginTop: "0.3rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  {inspectBug.created_at ? new Date(inspectBug.created_at).toLocaleString() : "—"}
                </div>
              </div>
            </div>

            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 700 }}>
                Reproduction Steps / Details
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
                {inspectBug.description || "No description provided."}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default TesterBugs;
