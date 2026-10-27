import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTesterProjects } from "../../services/testerService";
import { getBugs, getBugSummary } from "../../services/bugService";
import { Icon } from "../../components/common/Icons";
import { StatusBadge, SeverityBadge } from "../../components/common/Badge";

export function TesterOverview() {
  const [projects, setProjects] = useState([]);
  const [bugs, setBugs] = useState([]);
  const [bugSummary, setBugSummary] = useState({});
  const [loading, setLoading] = useState(true);

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
          <Link to="/tester/bugs" className="btn btn-primary">
            <Icon name="sheet" size={16} />
            <span>Test Sheets & Bugs</span>
          </Link>
        </div>
      </div>

      {/* Stats Grid: The 4 Real QA Statuses */}
      <div className="stats-grid-container" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {projects.slice(0, 3).map((p) => (
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

      {/* Recent Defects List */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <h3>Recent Project Defects</h3>
            <p className="card-subtitle">Latest reported blocker issues in your assigned projects</p>
          </div>
          <Link to="/tester/bugs" className="btn btn-secondary btn-sm">
            <span>All Bugs & Sheets</span>
            <Icon name="arrowRight" size={14} />
          </Link>
        </div>

        {bugs.length === 0 ? (
          <div className="empty-state-card" style={{ padding: "2rem" }}>
            <div className="empty-state-icon">
              <Icon name="check" size={24} />
            </div>
            <p>No individual defect tickets logged. Defect tracking is active in attached live spreadsheets above.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: "42%" }}>Defect Title</th>
                  <th style={{ width: "18%" }}>Severity</th>
                  <th style={{ width: "20%" }}>QA Status</th>
                  <th style={{ width: "20%" }}>Logged Date</th>
                </tr>
              </thead>
              <tbody>
                {bugs.slice(0, 5).map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong style={{ color: "var(--text-main)" }}>{b.title}</strong>
                      {b.description && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", maxWidth: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {b.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <SeverityBadge severity={b.severity} />
                    </td>
                    <td>
                      <StatusBadge status={b.status} />
                    </td>
                    <td>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-faint)" }}>
                        {b.created_at ? new Date(b.created_at).toLocaleDateString() : "—"}
                      </span>
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

export default TesterOverview;
