import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProjects } from "../../services/projectService";
import { getProjectProgress } from "../../services/managerService";
import { getTesters } from "../../services/teamService";
import { getBugs, getBugSummary } from "../../services/bugService";
import { Icon } from "../../components/common/Icons";
import { DonutChart } from "../../components/charts/DonutChart";
import { BarChart } from "../../components/charts/BarChart";
import { ProgressRing } from "../../components/charts/ProgressRing";

export function ManagerOverview() {
  const [projects, setProjects] = useState([]);
  const [testers, setTesters] = useState([]);
  const [bugs, setBugs] = useState([]);
  const [bugSummary, setBugSummary] = useState({});
  const [progressData, setProgressData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter 1: Person / Tester Filter State
  const [selectedTesterId, setSelectedTesterId] = useState("");
  // Filter 2: Project Filter State
  const [selectedProjectId, setSelectedProjectId] = useState("");

  // Available projects to populate Filter 2 dropdown (depends on selected tester)
  const [availableProjects, setAvailableProjects] = useState([]);

  // Fetch available projects for Filter 2 whenever selectedTesterId changes
  useEffect(() => {
    let isMounted = true;
    const fetchAvailableProjects = async () => {
      try {
        const targetTesterId = selectedTesterId ? Number(selectedTesterId) : undefined;
        // Fetch projects for this tester, or all projects if no tester selected
        const data = await getProjects(targetTesterId);
        if (isMounted && Array.isArray(data)) {
          setAvailableProjects(data);
        }
      } catch (err) {
        console.error("Failed to load available projects for filter", err);
      }
    };
    fetchAvailableProjects();
    return () => {
      isMounted = false;
    };
  }, [selectedTesterId]);

  // Load dashboard metrics whenever selectedTesterId or selectedProjectId changes
  const loadData = async (testerIdFilter, projectIdFilter) => {
    try {
      setLoading(true);
      const targetTesterId = testerIdFilter ? Number(testerIdFilter) : undefined;
      const targetProjectId = projectIdFilter ? Number(projectIdFilter) : undefined;

      const [projRes, testRes, bugRes, sumRes, progRes] = await Promise.allSettled([
        getProjects(targetTesterId, targetProjectId),
        getTesters(),
        getBugs(targetProjectId, targetTesterId),
        getBugSummary(targetTesterId, targetProjectId),
        getProjectProgress(targetTesterId, targetProjectId),
      ]);

      if (projRes.status === "fulfilled" && Array.isArray(projRes.value)) setProjects(projRes.value);
      if (testRes.status === "fulfilled" && Array.isArray(testRes.value)) setTesters(testRes.value);
      if (bugRes.status === "fulfilled" && Array.isArray(bugRes.value)) setBugs(bugRes.value);
      if (sumRes.status === "fulfilled" && sumRes.value) setBugSummary(sumRes.value);
      if (progRes.status === "fulfilled" && Array.isArray(progRes.value)) setProgressData(progRes.value);
    } catch (err) {
      console.error("Failed to load dashboard metrics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedTesterId, selectedProjectId);
  }, [selectedTesterId, selectedProjectId]);

  const handleTesterFilterChange = (newTesterId) => {
    setSelectedTesterId(newTesterId);
    // When switching tester, reset project selection to "" (All Assigned Projects)
    setSelectedProjectId("");
  };

  const handleProjectFilterChange = (newProjectId) => {
    setSelectedProjectId(newProjectId);
  };

  const handleResetFilters = () => {
    setSelectedTesterId("");
    setSelectedProjectId("");
  };

  const activeTester = testers.find((t) => String(t.id) === String(selectedTesterId));
  const activeProject = availableProjects.find((p) => String(p.id) === String(selectedProjectId));
  const isFiltered = Boolean(selectedTesterId || selectedProjectId);

  const totalBugs = Number(bugSummary.total ?? bugs.length);
  const openBugs = Number(bugSummary.open ?? 0);
  const needRetestBugs = Number(bugSummary.need_retest ?? 0);
  const retestedBugs = Number(bugSummary.retested ?? 0);
  const closedBugs = Number(bugSummary.closed ?? 0);

  const averageProgress = progressData.length
    ? Math.round(
        progressData.reduce((sum, item) => sum + Number(item.progress || 0), 0) /
          progressData.length
      )
    : 0;

  // Donut data for the 4 real QA statuses
  const bugStatusChartData = [
    { label: "Open", value: openBugs, color: "#f43f5e" },
    { label: "Need Retest", value: needRetestBugs, color: "#f59e0b" },
    { label: "Retested", value: retestedBugs, color: "#06b6d4" },
    { label: "Closed", value: closedBugs, color: "#10b981" },
  ];

  // Severity breakdown data for BarChart
  const sheetCritical = Number(bugSummary.severities?.critical ?? 0);
  const severityCounts = {
    critical: Math.max(bugs.filter((b) => (b.severity || "").toLowerCase() === "critical").length, sheetCritical),
    high: bugs.filter((b) => (b.severity || "").toLowerCase() === "high").length,
    medium: bugs.filter((b) => (b.severity || "").toLowerCase() === "medium").length,
    low: bugs.filter((b) => (b.severity || "").toLowerCase() === "low").length,
  };

  const bugSeverityChartData = [
    { label: "Critical", value: severityCounts.critical, color: "#ef4444" },
    { label: "High", value: severityCounts.high, color: "#f97316" },
    { label: "Medium", value: severityCounts.medium, color: "#eab308" },
    { label: "Low", value: severityCounts.low, color: "#3b82f6" },
  ];

  // Dynamic Subtitle based on scope
  const getScopeSubtitle = () => {
    if (activeTester && activeProject) {
      return `Focused QA metrics and sprint performance for ${activeTester.name} on ${activeProject.name}.`;
    }
    if (activeTester) {
      return `Individual progress & defect metrics for ${activeTester.name} across all assigned projects (${availableProjects.length} projects).`;
    }
    if (activeProject) {
      return `Consolidated defect analytics and team progress on ${activeProject.name}.`;
    }
    return "Real-time quality metrics, connected cloud spreadsheets, and defect analytics across all projects.";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Top Header */}
      <div className="page-header-row">
        <div className="page-title-box">
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
            <h1>Executive QA Dashboard</h1>
            {isFiltered && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.2rem 0.65rem",
                  borderRadius: "var(--radius-full)",
                  background: "rgba(99, 102, 241, 0.15)",
                  color: "var(--primary)",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)" }} />
                Filtered View
              </span>
            )}
          </div>
          <p className="page-subtitle">{getScopeSubtitle()}</p>
        </div>

        <div className="header-action-group">
          <Link to="/manager/projects" className="btn btn-secondary">
            <Icon name="projects" size={16} />
            <span>Manage Projects</span>
          </Link>
          <Link to="/manager/bugs" className="btn btn-primary">
            <Icon name="sheet" size={16} />
            <span>Test Sheets & Bugs</span>
          </Link>
        </div>
      </div>

      {/* Two-Tier Dual Filter Control Bar */}
      <div
        className="card"
        style={{
          padding: "1rem 1.25rem",
          background: "var(--bg-surface-elevated)",
          border: isFiltered ? "1px solid rgba(99, 102, 241, 0.45)" : "1px solid var(--border-subtle)",
          boxShadow: isFiltered ? "0 0 25px rgba(99, 102, 241, 0.12)" : "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {/* Scope Status & Active Badges Row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.85rem",
            paddingBottom: "0.75rem",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0, flex: "1 1 240px" }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "var(--radius-md)",
                background: isFiltered ? "var(--primary-subtle)" : "rgba(255, 255, 255, 0.05)",
                color: isFiltered ? "var(--primary)" : "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: isFiltered ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid var(--border-subtle)",
                flexShrink: 0,
              }}
            >
              <Icon name="filter" size={18} />
            </div>
            <div>
              <div style={{ fontSize: "0.725rem", color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em" }}>
                Active Dashboard Scope
              </div>
              <div style={{ fontSize: "0.925rem", color: "var(--text-main)", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                {activeTester ? (
                  <span style={{ color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                    <span>{activeTester.name}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400 }}>({activeTester.email})</span>
                  </span>
                ) : (
                  <span>All Team Members (Overall)</span>
                )}

                <span style={{ color: "var(--text-faint)" }}>•</span>

                {activeProject ? (
                  <span style={{ color: "var(--accent-cyan)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                    <span>{activeProject.name}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400 }}>(ID #{activeProject.id})</span>
                  </span>
                ) : (
                  <span style={{ color: "var(--text-secondary)" }}>
                    {activeTester ? `All Assigned Projects (${availableProjects.length})` : `All Projects (${availableProjects.length})`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Reset to Organization Overall */}
          {isFiltered && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleResetFilters}
              style={{
                fontSize: "0.8rem",
                padding: "0.4rem 0.85rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                borderColor: "rgba(99, 102, 241, 0.4)",
              }}
            >
              <Icon name="refresh" size={13} />
              <span>Reset to Overall</span>
            </button>
          )}
        </div>

        {/* Dual Select Filters Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
            gap: "1.25rem",
            alignItems: "center",
          }}
        >
          {/* Filter 1: Select Person / Tester */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <label
              htmlFor="member-filter-select"
              style={{
                fontSize: "0.785rem",
                color: selectedTesterId ? "var(--primary)" : "var(--text-muted)",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Icon name="team" size={14} color={selectedTesterId ? "var(--primary)" : "var(--text-muted)"} />
              <span>Filter By Person (Tester):</span>
            </label>
            <select
              id="member-filter-select"
              value={selectedTesterId}
              onChange={(e) => handleTesterFilterChange(e.target.value)}
              style={{
                padding: "0.55rem 0.95rem",
                fontSize: "0.865rem",
                fontWeight: 600,
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-surface)",
                border: selectedTesterId ? "1px solid var(--primary)" : "1px solid var(--border-subtle)",
                color: "var(--text-main)",
                cursor: "pointer",
                width: "100%",
                outline: "none",
                boxShadow: selectedTesterId ? "0 0 0 1px var(--primary)" : "none",
              }}
            >
              <option value="">All Team Members (Overall Progress)</option>
              {testers.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name} ({t.email})
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: Select Project */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <label
              htmlFor="project-filter-select"
              style={{
                fontSize: "0.785rem",
                color: selectedProjectId ? "var(--accent-cyan)" : "var(--text-muted)",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Icon name="projects" size={14} color={selectedProjectId ? "var(--accent-cyan)" : "var(--text-muted)"} />
              <span>
                {selectedTesterId
                  ? `Select Project Assigned to ${activeTester ? activeTester.name : "Tester"}:`
                  : "Filter By Project:"}
              </span>
            </label>
            <select
              id="project-filter-select"
              value={selectedProjectId}
              onChange={(e) => handleProjectFilterChange(e.target.value)}
              disabled={selectedTesterId && availableProjects.length === 0}
              style={{
                padding: "0.55rem 0.95rem",
                fontSize: "0.865rem",
                fontWeight: 600,
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-surface)",
                border: selectedProjectId
                  ? "1px solid var(--accent-cyan)"
                  : selectedTesterId && availableProjects.length === 0
                  ? "1px dashed var(--border-subtle)"
                  : "1px solid var(--border-subtle)",
                color: "var(--text-main)",
                cursor: selectedTesterId && availableProjects.length === 0 ? "not-allowed" : "pointer",
                width: "100%",
                outline: "none",
                opacity: selectedTesterId && availableProjects.length === 0 ? 0.6 : 1,
                boxShadow: selectedProjectId ? "0 0 0 1px var(--accent-cyan)" : "none",
              }}
            >
              {selectedTesterId ? (
                <>
                  <option value="">
                    All Assigned Projects ({availableProjects.length} assigned)
                  </option>
                  {availableProjects.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} {p.status ? `• ${p.status.toUpperCase()}` : ""}
                    </option>
                  ))}
                  {availableProjects.length === 0 && (
                    <option value="" disabled>
                      No projects currently assigned to this tester
                    </option>
                  )}
                </>
              ) : (
                <>
                  <option value="">
                    All Projects ({availableProjects.length} total)
                  </option>
                  {availableProjects.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} {p.status ? `• ${p.status.toUpperCase()}` : ""}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid-container">
        <div className="stat-metric-card">
          <div className="stat-card-top-row">
            <span className="stat-metric-label">
              {activeProject
                ? "Selected Project"
                : activeTester
                ? "Assigned Projects"
                : "Active Projects"}
            </span>
            <div className="stat-card-icon-wrapper indigo">
              <Icon name="projects" size={20} />
            </div>
          </div>
          <div className="stat-metric-value">{loading ? "—" : projects.length}</div>
          <div className="stat-metric-footer">
            <Icon name="check" size={13} color="#10b981" />
            <span>
              {activeTester && activeProject
                ? `Assigned to ${activeTester.name}`
                : activeTester
                ? `Assigned to ${activeTester.name}`
                : activeProject
                ? `Active in workspace`
                : "Under quality assurance"}
            </span>
          </div>
        </div>

        <div className="stat-metric-card">
          <div className="stat-card-top-row">
            <span className="stat-metric-label">Open (Dev Fix)</span>
            <div className="stat-card-icon-wrapper danger">
              <Icon name="alert" size={20} />
            </div>
          </div>
          <div className="stat-metric-value" style={{ color: "#f43f5e" }}>{loading ? "—" : openBugs}</div>
          <div className="stat-metric-footer">
            <span style={{ color: "#f43f5e", fontWeight: 700 }}>{openBugs}</span>
            <span>
              {activeTester && activeProject
                ? `on ${activeProject.name} (${activeTester.name})`
                : activeTester
                ? `in ${activeTester.name}'s scope`
                : activeProject
                ? `in ${activeProject.name}`
                : "awaiting fix"}
            </span>
          </div>
        </div>

        <div className="stat-metric-card">
          <div className="stat-card-top-row">
            <span className="stat-metric-label">Need Retest (QA)</span>
            <div className="stat-card-icon-wrapper warning">
              <Icon name="refresh" size={20} />
            </div>
          </div>
          <div className="stat-metric-value" style={{ color: "#f59e0b" }}>{loading ? "—" : needRetestBugs}</div>
          <div className="stat-metric-footer">
            <span style={{ color: "#f59e0b", fontWeight: 700 }}>Ready</span>
            <span>
              {activeTester && activeProject
                ? `for ${activeTester.name} on ${activeProject.name}`
                : activeTester
                ? `for ${activeTester.name} to re-verify`
                : "for tester re-verification"}
            </span>
          </div>
        </div>

        <div className="stat-metric-card">
          <div className="stat-card-top-row">
            <span className="stat-metric-label">
              {activeTester && activeProject
                ? `${activeTester.name}'s Progress`
                : activeTester
                ? `${activeTester.name}'s Progress`
                : activeProject
                ? `${activeProject.name} Progress`
                : "Overall QA Progress"}
            </span>
            <div className="stat-card-icon-wrapper success">
              <Icon name="trendingUp" size={20} />
            </div>
          </div>
          <div className="stat-metric-value">{loading ? "—" : `${averageProgress}%`}</div>
          <div className="stat-metric-footer">
            <Icon name="activity" size={13} color="#10b981" />
            <span>
              {activeTester && activeProject
                ? `Sprint completion for ${activeProject.name}`
                : activeTester
                ? `Across ${projects.length} assigned project${projects.length === 1 ? "" : "s"}`
                : activeProject
                ? `Sprint milestone progress`
                : "Across all active assignments"}
            </span>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "1.5rem" }}>
        {/* Status Distribution Donut */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>Defect QA Status Breakdown</h3>
              <p className="card-subtitle">
                {activeTester && activeProject
                  ? `QA lifecycle stages for ${activeTester.name} on ${activeProject.name}`
                  : activeTester
                  ? `QA lifecycle stages for ${activeTester.name}'s assigned projects`
                  : activeProject
                  ? `QA lifecycle stages for ${activeProject.name}`
                  : "Distribution by the 4 QA lifecycle stages"}
              </p>
            </div>
            <div className="stat-card-icon-wrapper danger" style={{ width: 34, height: 34 }}>
              <Icon name="bugs" size={16} />
            </div>
          </div>

          <div style={{ padding: "0.5rem 0" }}>
            <DonutChart
              data={bugStatusChartData}
              centerTitle={
                activeTester && activeProject
                  ? activeProject.name
                  : activeTester
                  ? activeTester.name
                  : activeProject
                  ? activeProject.name
                  : "Total Issues"
              }
            />
          </div>
        </div>

        {/* Severity Bar Chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>Severity Analysis</h3>
              <p className="card-subtitle">
                {activeTester && activeProject
                  ? `Impact categorization for ${activeTester.name} on ${activeProject.name}`
                  : activeTester
                  ? `Impact categorization in ${activeTester.name}'s scopes`
                  : activeProject
                  ? `Impact categorization on ${activeProject.name}`
                  : "Impact categorization across active defects"}
              </p>
            </div>
            <div className="stat-card-icon-wrapper warning" style={{ width: 34, height: 34 }}>
              <Icon name="alert" size={16} />
            </div>
          </div>

          <div style={{ padding: "0.5rem 0" }}>
            <BarChart data={bugSeverityChartData} height={200} />
          </div>

          <div
            style={{
              marginTop: "1.25rem",
              padding: "0.85rem 1rem",
              background: "var(--bg-surface-elevated)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.85rem",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>Critical Blockers:</span>
            <strong style={{ color: severityCounts.critical > 0 ? "#f43f5e" : "#10b981", fontSize: "1rem" }}>
              {severityCounts.critical} {severityCounts.critical === 1 ? "Blocker" : "Blockers"}
            </strong>
          </div>
        </div>

        {/* Team Progress Gauge & Velocity */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <h3>
                {activeTester && activeProject
                  ? `${activeTester.name}'s Execution Rate`
                  : activeTester
                  ? `${activeTester.name}'s Execution Rate`
                  : activeProject
                  ? `${activeProject.name} Execution Rate`
                  : "Sprint Execution Rate"}
              </h3>
              <p className="card-subtitle">
                {activeTester && activeProject
                  ? `Delivery completion on ${activeProject.name}`
                  : activeTester
                  ? `Delivery completion for ${activeTester.name}`
                  : activeProject
                  ? `Sprint delivery completion`
                  : "Aggregate tester progress & delivery"}
              </p>
            </div>
            <div className="stat-card-icon-wrapper success" style={{ width: 34, height: 34 }}>
              <Icon name="progress" size={16} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem 0" }}>
            <ProgressRing
              progress={averageProgress}
              size={150}
              strokeWidth={14}
              color="#10b981"
              subtitle={
                activeTester && activeProject
                  ? "Sprint Progress"
                  : activeTester
                  ? "Member Progress"
                  : activeProject
                  ? "Project Progress"
                  : "Average Completion"
              }
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginTop: "0.5rem" }}>
            <span style={{ fontSize: "0.785rem", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
              {activeTester && activeProject
                ? `${activeTester.name}'s Updates for ${activeProject.name}`
                : activeTester
                ? `${activeTester.name}'s Recent Updates`
                : activeProject
                ? `Recent Updates for ${activeProject.name}`
                : "Recent Project Updates"}
            </span>
            {progressData.slice(0, 3).map((item, idx) => (
              <div
                key={`${item.project_id}-${idx}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.55rem 0.75rem",
                  background: "var(--bg-surface-elevated)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.825rem",
                }}
              >
                <div>
                  <strong style={{ color: "var(--text-main)" }}>{item.project_name}</strong>
                  <div style={{ fontSize: "0.725rem", color: "var(--text-muted)" }}>
                    {item.tester_name} • {item.sprint_name}
                  </div>
                </div>
                <span style={{ fontWeight: 700, color: "var(--primary)" }}>{item.progress}%</span>
              </div>
            ))}
            {progressData.length === 0 && (
              <p style={{ fontSize: "0.825rem", color: "var(--text-faint)", textAlign: "center", padding: "1rem" }}>
                {activeTester && activeProject
                  ? `No sprint milestone updates logged by ${activeTester.name} on ${activeProject.name} yet.`
                  : activeTester
                  ? `No sprint milestone updates logged by ${activeTester.name} yet.`
                  : activeProject
                  ? `No sprint milestone updates logged for ${activeProject.name} yet.`
                  : "No sprint updates logged yet."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Live QA Project Test Sheets Preview */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <h3>
              {activeTester && activeProject
                ? `${activeTester.name}'s Test Sheet for ${activeProject.name}`
                : activeTester
                ? `${activeTester.name}'s Assigned Project Test Sheets`
                : activeProject
                ? `${activeProject.name} Live Test Sheet`
                : "Live QA Project Test Sheets"}
            </h3>
            <p className="card-subtitle">
              {activeTester && activeProject
                ? `Direct workbook link and defect matrix for ${activeProject.name}`
                : activeTester
                ? `Workbooks and Google Sheets designated to ${activeTester.name}`
                : activeProject
                ? `Direct access to cloud spreadsheet for ${activeProject.name}`
                : "Direct access to team Google Sheets and Excel workbooks"}
            </p>
          </div>
          <Link
            to={activeProject ? `/manager/bugs?projectId=${activeProject.id}` : "/manager/bugs"}
            className="btn btn-secondary btn-sm"
          >
            <span>View Full Bug Matrix</span>
            <Icon name="arrowRight" size={14} />
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state-card" style={{ padding: "2rem" }}>
            <p>
              {activeTester && activeProject
                ? `No project record found for ${activeProject.name} assigned to ${activeTester.name}.`
                : activeTester
                ? `No projects currently assigned to ${activeTester.name}.`
                : activeProject
                ? `Project #${activeProject.id} not found.`
                : "No projects created yet."}
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: "26%" }}>Project Name</th>
                  <th style={{ width: "20%" }}>Cloud Spreadsheet</th>
                  <th style={{ width: "8%", textAlign: "center" }}>Open</th>
                  <th style={{ width: "10%", textAlign: "center" }}>Need Retest</th>
                  <th style={{ width: "9%", textAlign: "center" }}>Retested</th>
                  <th style={{ width: "8%", textAlign: "center" }}>Closed</th>
                  <th style={{ width: "8%", textAlign: "center" }}>Critical</th>
                  <th style={{ width: "11%", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {projects.slice(0, 8).map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong style={{ color: "var(--text-main)", display: "block" }}>{p.name}</strong>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>
                        ID #{p.id} • {p.status}
                      </div>
                    </td>
                    <td>
                      {p.excel_sheet_url ? (
                        <a
                          href={p.excel_sheet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            color: "#10b981",
                            fontSize: "0.785rem",
                            fontWeight: 600,
                            textDecoration: "none",
                            maxWidth: "100%",
                          }}
                        >
                          <Icon name="sheet" size={13} color="#10b981" />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Live Sheet</span>
                          <Icon name="externalLink" size={10} color="#10b981" />
                        </a>
                      ) : (
                        <span style={{ color: "var(--text-faint)", fontSize: "0.75rem" }}>No sheet attached</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ color: "#f43f5e", fontWeight: 700 }}>{p.open_bugs || 0}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ color: "#f59e0b", fontWeight: 700 }}>{p.need_retest_bugs || 0}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ color: "#06b6d4", fontWeight: 700 }}>{p.retested_bugs || 0}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ color: "#10b981", fontWeight: 700 }}>{p.closed_bugs || p.fixed_bugs || 0}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ color: Number(p.critical_bugs) > 0 ? "#ef4444" : "var(--text-faint)", fontWeight: Number(p.critical_bugs) > 0 ? 700 : 400 }}>
                        {p.critical_bugs || 0}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link to={`/manager/bugs?projectId=${p.id}`} className="btn btn-secondary btn-sm" style={{ fontSize: "0.72rem", padding: "0.3rem 0.55rem" }}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ManagerOverview;
