import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTesterProjects } from "../../services/testerService";
import { updateProjectMetrics } from "../../services/projectService";
import { Icon } from "../../components/common/Icons";
import { StatusBadge } from "../../components/common/Badge";
import { Modal } from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";

export function TesterProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [reviewProject, setReviewProject] = useState(null);

  // Quick Sync Modal
  const [tallyProject, setTallyProject] = useState(null);
  const [tallySheetUrl, setTallySheetUrl] = useState("");
  const [tallyOpen, setTallyOpen] = useState(0);
  const [tallyNeedRetest, setTallyNeedRetest] = useState(0);
  const [tallyRetested, setTallyRetested] = useState(0);
  const [tallyClosed, setTallyClosed] = useState(0);
  const [tallyCritical, setTallyCritical] = useState(0);
  const [tallySubmitting, setTallySubmitting] = useState(false);

  const { addToast } = useToast();

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await getTesterProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      addToast("Failed to fetch assigned projects.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
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
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to update metrics.", "error");
    } finally {
      setTallySubmitting(false);
    }
  };

  const filteredProjects = projects.filter(
    (p) =>
      (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <div className="page-header-row">
        <div className="page-title-box">
          <h1>My Assigned Projects</h1>
          <p className="page-subtitle">
            All active QA scopes designated to your profile. Access live testing sheets and report progress.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-search-container">
        <div className="search-input-wrapper">
          <span className="search-icon">
            <Icon name="search" size={16} />
          </span>
          <input
            type="text"
            className="search-input-field"
            placeholder="Search assigned projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filters-cluster">
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
              title="Simple List View"
            >
              <Icon name="list" size={15} />
              <span>Simple List</span>
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
              title="Card Grid View"
            >
              <Icon name="grid" size={15} />
              <span>Grid</span>
            </button>
          </div>

          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Showing <strong>{filteredProjects.length}</strong> of {projects.length} projects
          </span>
          {search && (
            <button className="btn btn-secondary btn-sm" onClick={() => setSearch("")}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="empty-state-card">
          <p>Loading assigned projects...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="card empty-state-card">
          <div className="empty-state-icon">
            <Icon name="projects" size={28} />
          </div>
          <h3>{search ? "No matching projects found" : "No projects assigned yet"}</h3>
          <p>
            {search
              ? "Try adjusting your search criteria."
              : "Check back later or ask your QA Manager to assign you to an active project."}
          </p>
        </div>
      ) : viewMode === "list" ? (
        /* Simple List View */
        <div className="table-container-card">
          <div className="table-scroll">
            <table className="custom-table" style={{ minWidth: "880px" }}>
              <thead>
                <tr>
                  <th style={{ width: "23%" }}>Assigned Project</th>
                  <th style={{ width: "9%" }}>Status</th>
                  <th style={{ width: "13%" }}>QA Timeline</th>
                  <th style={{ width: "11%" }}>Testing Sheet</th>
                  <th style={{ width: "30%" }}>Defect Tally</th>
                  <th style={{ width: "14%", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <tr key={project.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div className="table-project-icon">
                          <Icon name="projects" size={16} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                            <strong style={{ color: "var(--text-main)", fontSize: "0.95rem" }}>
                              {project.name}
                            </strong>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                fontFamily: "var(--font-mono)",
                                color: "var(--text-faint)",
                                background: "var(--bg-surface-elevated)",
                                padding: "0.1rem 0.35rem",
                                borderRadius: "var(--radius-sm)",
                              }}
                            >
                              #{project.id}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: "0.78rem",
                              color: "var(--text-muted)",
                              maxWidth: "280px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {project.description || "No description provided."}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={project.status || "active"} />
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem", color: "var(--text-main)" }}>
                          <Icon name="calendar" size={12} color="var(--primary)" />
                          <span>{project.start_date ? project.start_date : "Flexible"}</span>
                        </div>
                        {project.end_date && (
                          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", paddingLeft: "1rem" }}>
                            to {project.end_date}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {project.excel_sheet_url ? (
                        <a
                          href={project.excel_sheet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{
                            padding: "0.22rem 0.55rem",
                            fontSize: "0.74rem",
                            color: "#10b981",
                            borderColor: "rgba(16, 185, 129, 0.4)",
                            background: "rgba(16, 185, 129, 0.08)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span>Open Sheet</span>
                          <Icon name="externalLink" size={11} color="#10b981" />
                        </a>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openTallyModal(project)}
                          style={{ fontSize: "0.74rem", padding: "0.22rem 0.55rem", whiteSpace: "nowrap" }}
                        >
                          + Link Sheet
                        </button>
                      )}
                    </td>
                    <td style={{ verticalAlign: "middle" }}>
                      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "nowrap" }}>
                        <span className="badge-chip open" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                          {project.open_bugs || 0} Open
                        </span>
                        <span className="badge-chip retest" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                          {project.need_retest_bugs || 0} Retest
                        </span>
                        <span className="badge-chip closed" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                          {project.closed_bugs || project.fixed_bugs || 0} Closed
                        </span>
                        {Number(project.critical_bugs) > 0 && (
                          <span className="badge-chip crit" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                            {project.critical_bugs} Crit
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: "0.35rem", whiteSpace: "nowrap" }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setReviewProject(project)}
                          title="Review Project Details"
                          aria-label="Review Project Details"
                          style={{
                            padding: "0.3rem 0.55rem",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Icon name="eye" size={14} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openTallyModal(project)}
                          title="Quick Sync Live Counts"
                          aria-label="Quick Sync Live Counts"
                          style={{
                            padding: "0.3rem 0.55rem",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Icon name="refresh" size={13} />
                        </button>
                        <Link
                          to={`/tester/bugs?projectId=${project.id}`}
                          className="btn btn-primary btn-sm"
                          title="View Bugs"
                          aria-label="View Bugs"
                          style={{
                            padding: "0.3rem 0.6rem",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Icon name="bugs" size={13} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card Grid View */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
            gap: "1.5rem",
          }}
        >
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "1.25rem",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "var(--radius-md)",
                      background: "var(--accent-cyan-subtle)",
                      color: "var(--accent-cyan)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid rgba(6, 182, 212, 0.25)",
                    }}
                  >
                    <Icon name="projects" size={18} />
                  </div>
                  <StatusBadge status={project.status || "active"} />
                </div>

                <h3 style={{ fontSize: "1.2rem", marginBottom: "0.4rem" }}>
                  {project.name}
                </h3>

                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--text-muted)",
                    lineHeight: 1.5,
                    marginBottom: "1rem",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {project.description || "No project description provided."}
                </p>

                {/* Live Sheet Banner */}
                <div
                  style={{
                    padding: "0.7rem 0.85rem",
                    background: "var(--bg-surface-elevated)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "0.85rem",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "var(--radius-sm)",
                        background: project.excel_sheet_url ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)",
                        color: project.excel_sheet_url ? "#10b981" : "var(--text-faint)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="sheet" size={14} />
                    </div>
                    <span style={{ fontSize: "0.8rem", color: project.excel_sheet_url ? "var(--text-main)" : "var(--text-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {project.excel_sheet_url ? "Live QA Test Sheet" : "No sheet attached"}
                    </span>
                  </div>

                  {project.excel_sheet_url ? (
                    <a
                      href={project.excel_sheet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{
                        padding: "0.25rem 0.6rem",
                        fontSize: "0.75rem",
                        color: "#10b981",
                        borderColor: "rgba(16, 185, 129, 0.4)",
                        background: "rgba(16, 185, 129, 0.08)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        textDecoration: "none",
                        flexShrink: 0,
                      }}
                    >
                      <span>Open Sheet</span>
                      <Icon name="externalLink" size={11} color="#10b981" />
                    </a>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openTallyModal(project)}
                      style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                    >
                      + Link
                    </button>
                  )}
                </div>

                {/* Bug Counts Row: 4 Real QA Statuses */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.55rem 0.75rem",
                    background: "rgba(255, 255, 255, 0.02)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px dashed var(--border-subtle)",
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                    <span
                      style={{
                        padding: "0.15rem 0.4rem",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(244, 63, 94, 0.12)",
                        color: "#f43f5e",
                        border: "1px solid rgba(244, 63, 94, 0.25)",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                      }}
                    >
                      {project.open_bugs || 0} Open
                    </span>
                    <span
                      style={{
                        padding: "0.15rem 0.4rem",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(245, 158, 11, 0.12)",
                        color: "#f59e0b",
                        border: "1px solid rgba(245, 158, 11, 0.25)",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                      }}
                    >
                      {project.need_retest_bugs || 0} Need Retest
                    </span>
                    <span
                      style={{
                        padding: "0.15rem 0.4rem",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(6, 182, 212, 0.12)",
                        color: "#06b6d4",
                        border: "1px solid rgba(6, 182, 212, 0.25)",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                      }}
                    >
                      {project.retested_bugs || 0} Retested
                    </span>
                    <span
                      style={{
                        padding: "0.15rem 0.4rem",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(16, 185, 129, 0.12)",
                        color: "#10b981",
                        border: "1px solid rgba(16, 185, 129, 0.25)",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                      }}
                    >
                      {project.closed_bugs || project.fixed_bugs || 0} Closed
                    </span>
                    {Number(project.critical_bugs) > 0 && (
                      <span
                        style={{
                          padding: "0.15rem 0.4rem",
                          borderRadius: "var(--radius-sm)",
                          background: "rgba(239, 68, 68, 0.2)",
                          color: "#ef4444",
                          border: "1px solid rgba(239, 68, 68, 0.4)",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                        }}
                      >
                        {project.critical_bugs} Crit
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => openTallyModal(project)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                    title="Update live sheet counts"
                  >
                    Sync
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "0.38rem 0.5rem",
                    fontSize: "0.78rem",
                    gap: "0.35rem",
                    justifyContent: "center",
                    whiteSpace: "nowrap",
                  }}
                  onClick={() => setReviewProject(project)}
                >
                  <Icon name="eye" size={13} />
                  <span>Review</span>
                </button>
                <Link
                  to={`/tester/progress?projectId=${project.id}`}
                  className="btn btn-primary btn-sm"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "0.38rem 0.5rem",
                    fontSize: "0.78rem",
                    gap: "0.35rem",
                    justifyContent: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Icon name="progress" size={13} />
                  <span>Progress</span>
                </Link>
                <Link
                  to={`/tester/bugs?projectId=${project.id}`}
                  className="btn btn-secondary btn-sm"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "0.38rem 0.5rem",
                    fontSize: "0.78rem",
                    gap: "0.35rem",
                    justifyContent: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Icon name="bugs" size={13} />
                  <span>Bugs</span>
                </Link>
              </div>

              {/* Card Footer */}
              <div
                style={{
                  borderTop: "1px solid var(--border-subtle)",
                  paddingTop: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                  color: "var(--text-faint)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Icon name="calendar" size={14} />
                  <span>
                    {project.start_date ? project.start_date : "Flexible"}
                    {project.end_date ? ` → ${project.end_date}` : ""}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    background: "var(--bg-surface-elevated)",
                    padding: "0.15rem 0.45rem",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  ID #{project.id}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Quick Tally & Sheet Sync */}
      {tallyProject && (
        <Modal
          isOpen={Boolean(tallyProject)}
          onClose={() => setTallyProject(null)}
          title={`Sync Live Bug Counts: ${tallyProject.name}`}
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
              Update your testing counts directly from your team's live Google Sheet or Excel.
            </p>

            <div className="form-group-block">
              <label htmlFor="tally-tester-sheet" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Icon name="sheet" size={15} color="#10b981" />
                <span>Cloud Excel / Google Sheets Link</span>
              </label>
              <input
                id="tally-tester-sheet"
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/... or OneDrive link"
                value={tallySheetUrl}
                onChange={(e) => setTallySheetUrl(e.target.value)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.6rem" }}>
              <div className="form-group-block">
                <label htmlFor="tally-tester-open" style={{ color: "#f43f5e", fontWeight: 600, fontSize: "0.75rem" }}>
                  Open
                </label>
                <input
                  id="tally-tester-open"
                  type="number"
                  min="0"
                  value={tallyOpen}
                  onChange={(e) => setTallyOpen(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-block">
                <label htmlFor="tally-tester-need-retest" style={{ color: "#f59e0b", fontWeight: 600, fontSize: "0.75rem" }}>
                  Need Retest
                </label>
                <input
                  id="tally-tester-need-retest"
                  type="number"
                  min="0"
                  value={tallyNeedRetest}
                  onChange={(e) => setTallyNeedRetest(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-block">
                <label htmlFor="tally-tester-retested" style={{ color: "#06b6d4", fontWeight: 600, fontSize: "0.75rem" }}>
                  Retested
                </label>
                <input
                  id="tally-tester-retested"
                  type="number"
                  min="0"
                  value={tallyRetested}
                  onChange={(e) => setTallyRetested(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-block">
                <label htmlFor="tally-tester-closed" style={{ color: "#10b981", fontWeight: 600, fontSize: "0.75rem" }}>
                  Closed
                </label>
                <input
                  id="tally-tester-closed"
                  type="number"
                  min="0"
                  value={tallyClosed}
                  onChange={(e) => setTallyClosed(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group-block">
              <label htmlFor="tally-tester-crit" style={{ color: "#ef4444", fontWeight: 600, fontSize: "0.8rem" }}>
                Critical Blocker Bugs
              </label>
              <input
                id="tally-tester-crit"
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

      {/* Modal: Review Assigned Project Scope & Details */}
      {reviewProject && (
        <Modal
          isOpen={Boolean(reviewProject)}
          onClose={() => setReviewProject(null)}
          title={`Review Assigned Project: ${reviewProject.name}`}
          maxWidth="640px"
          footer={
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="review-info-label">Project ID:</span>
                <span style={{ fontSize: "0.85rem", color: "var(--text-main)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                  #{reviewProject.id}
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setReviewProject(null)}
                >
                  Close
                </button>
                <Link
                  to={`/tester/bugs?projectId=${reviewProject.id}`}
                  className="btn btn-primary"
                  onClick={() => setReviewProject(null)}
                >
                  <Icon name="bugs" size={16} />
                  <span>View Project Bugs</span>
                </Link>
              </div>
            </div>
          }
        >
          <div className="review-modal-box">
            {/* Project Overview Card */}
            <div className="review-section-card">
              <div className="review-section-header">
                <span className="review-section-title">Project Scope</span>
                <StatusBadge status={reviewProject.status || "active"} />
              </div>
              <div className="review-project-name">{reviewProject.name}</div>
              <p className="review-project-desc">
                {reviewProject.description || "No project description provided. Proceed with standard regression testing cycles and functional defect logging."}
              </p>
            </div>

            {/* Timeline & Assignment Details */}
            <div className="review-grid-2col">
              <div className="review-section-card">
                <span className="review-section-title">Testing Timeline</span>
                <div className="review-info-item">
                  <span className="review-info-label">Start Date:</span>
                  <span className="review-info-value">
                    <Icon name="calendar" size={14} color="var(--primary)" />
                    {reviewProject.start_date ? reviewProject.start_date : "Flexible / Immediate"}
                  </span>
                </div>
                <div className="review-info-item">
                  <span className="review-info-label">Target Completion:</span>
                  <span className="review-info-value">
                    <Icon name="calendar" size={14} color="var(--warning)" />
                    {reviewProject.end_date ? reviewProject.end_date : "Ongoing / Open"}
                  </span>
                </div>
              </div>

              <div className="review-section-card">
                <span className="review-section-title">Assignment Scope</span>
                <div className="review-info-item">
                  <span className="review-info-label">Role:</span>
                  <span className="review-info-value">
                    <Icon name="shield" size={14} color="var(--accent-cyan)" />
                    Assigned QA Tester
                  </span>
                </div>
                <div className="review-info-item">
                  <span className="review-info-label">Status:</span>
                  <span className="review-info-value" style={{ color: "var(--success)" }}>
                    <Icon name="check" size={14} color="var(--success)" />
                    Active Assignment
                  </span>
                </div>
              </div>
            </div>

            {/* Live Testing Sheet Link */}
            <div className="review-section-card">
              <div className="review-section-header">
                <span className="review-section-title">Live QA Sheet URL</span>
                {reviewProject.excel_sheet_url && (
                  <a
                    href={reviewProject.excel_sheet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{
                      padding: "0.25rem 0.65rem",
                      fontSize: "0.75rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      color: "#10b981",
                      borderColor: "rgba(16, 185, 129, 0.4)",
                    }}
                  >
                    <span>Open Live Sheet</span>
                    <Icon name="externalLink" size={13} color="#10b981" />
                  </a>
                )}
              </div>

              {reviewProject.excel_sheet_url ? (
                <div className="sheet-link-box">
                  <span className="sheet-url-text">{reviewProject.excel_sheet_url}</span>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-faint)", fontStyle: "italic" }}>
                  No Google Sheet or Excel link attached yet. Use the Sync button to attach one.
                </p>
              )}
            </div>

            {/* Defect Metrics Tally */}
            <div className="review-section-card">
              <span className="review-section-title">Current Defect Metrics</span>
              <div className="metrics-mini-tally">
                <div className="tally-metric-chip">
                  <span className="tally-metric-num" style={{ color: "#f43f5e" }}>
                    {reviewProject.open_bugs || 0}
                  </span>
                  <span className="tally-metric-label">Open</span>
                </div>
                <div className="tally-metric-chip">
                  <span className="tally-metric-num" style={{ color: "#f59e0b" }}>
                    {reviewProject.need_retest_bugs || 0}
                  </span>
                  <span className="tally-metric-label">Need Retest</span>
                </div>
                <div className="tally-metric-chip">
                  <span className="tally-metric-num" style={{ color: "#06b6d4" }}>
                    {reviewProject.retested_bugs || 0}
                  </span>
                  <span className="tally-metric-label">Retested</span>
                </div>
                <div className="tally-metric-chip">
                  <span className="tally-metric-num" style={{ color: "#10b981" }}>
                    {reviewProject.closed_bugs || reviewProject.fixed_bugs || 0}
                  </span>
                  <span className="tally-metric-label">Closed</span>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default TesterProjects;
