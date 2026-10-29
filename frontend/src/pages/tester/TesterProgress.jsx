import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getTesterProjects, saveProjectUpdate, getProjectUpdates } from "../../services/testerService";
import { Icon } from "../../components/common/Icons";
import { ProgressRing } from "../../components/charts/ProgressRing";
import { useToast } from "../../context/ToastContext";

export function TesterProgress() {
  const [searchParams] = useSearchParams();
  const initialProjectId = searchParams.get("projectId") || "";

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [sprintName, setSprintName] = useState("");
  const [progress, setProgress] = useState(50);
  const [remarks, setRemarks] = useState("");
  const [excelSheetUrl, setExcelSheetUrl] = useState("");
  const [openBugs, setOpenBugs] = useState(0);
  const [needRetestBugs, setNeedRetestBugs] = useState(0);
  const [retestedBugs, setRetestedBugs] = useState(0);
  const [closedBugs, setClosedBugs] = useState(0);
  const [criticalBugs, setCriticalBugs] = useState(0);

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  const loadHistory = async (pId) => {
    if (!pId) {
      setHistory([]);
      return;
    }
    try {
      const data = await getProjectUpdates(Number(pId));
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    }
  };

  const syncProjectFields = (pId, list = projects) => {
    const selected = list.find((p) => String(p.id) === String(pId));
    if (selected) {
      setExcelSheetUrl(selected.excel_sheet_url || "");
      setOpenBugs(selected.open_bugs || 0);
      setNeedRetestBugs(selected.need_retest_bugs || 0);
      setRetestedBugs(selected.retested_bugs || 0);
      setClosedBugs(selected.closed_bugs || selected.fixed_bugs || 0);
      setCriticalBugs(selected.critical_bugs || 0);
    }
  };

  useEffect(() => {
    async function loadProjects() {
      try {
        setLoading(true);
        const data = await getTesterProjects();
        const validList = Array.isArray(data) ? data : [];
        setProjects(validList);

        const targetId = projectId || (validList.length > 0 ? String(validList[0].id) : "");
        if (targetId) {
          setProjectId(targetId);
          syncProjectFields(targetId, validList);
          await loadHistory(targetId);
        }
      } catch {
        addToast("Failed to load assigned projects.", "error");
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, []);

  const handleProjectChange = async (e) => {
    const selected = e.target.value;
    setProjectId(selected);
    syncProjectFields(selected);
    await loadHistory(selected);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!testerId) {
      addToast("Session expired or invalid. Please sign in again.", "error");
      return;
    }

    if (!projectId) {
      addToast("Please select a project to update.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const openCount = Number(openBugs) || 0;
      const needRetestCount = Number(needRetestBugs) || 0;
      const retestedCount = Number(retestedBugs) || 0;
      const closedCount = Number(closedBugs) || 0;
      const critCount = Number(criticalBugs) || 0;
      const totalCount = openCount + needRetestCount + retestedCount + closedCount;

      await saveProjectUpdate(Number(projectId), {
        tester_id: testerId,
        sprint_name: sprintName.trim() || "Active Sprint",
        progress: Number(progress),
        remarks: remarks.trim() || null,
        excel_sheet_url: excelSheetUrl.trim() || null,
        open_bugs: openCount,
        need_retest_bugs: needRetestCount,
        retested_bugs: retestedCount,
        closed_bugs: closedCount,
        critical_bugs: critCount,
      });

      addToast("Sprint progress & live sheet metrics recorded!", "success");
      setRemarks("");

      // Update project in local state
      setProjects((prev) =>
        prev.map((p) =>
          String(p.id) === String(projectId)
            ? {
                ...p,
                excel_sheet_url: excelSheetUrl.trim() || null,
                open_bugs: openCount,
                need_retest_bugs: needRetestCount,
                retested_bugs: retestedCount,
                closed_bugs: closedCount,
                critical_bugs: critCount,
                total_bugs: totalCount,
              }
            : p
        )
      );

      await loadHistory(projectId);
    } catch (err) {
      addToast(
        err.response?.data?.detail || "Could not save project progress.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProject = projects.find((p) => String(p.id) === String(projectId));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <div className="page-header-row">
        <div className="page-title-box">
          <h1>Update Sprint Progress</h1>
          <p className="page-subtitle">
            Log current execution percentage, synchronize live sheet defect numbers, and publish sprint notes.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="empty-state-card">
          <p>Loading projects & history...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="card empty-state-card">
          <div className="empty-state-icon">
            <Icon name="progress" size={28} />
          </div>
          <h3>No assigned projects available</h3>
          <p>You need to be assigned to at least one project by your QA Manager to log sprint progress.</p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1.75rem", alignItems: "start" }}>
            {/* Main Form */}
            <div className="card">
              <div className="card-header">
                <div className="card-title-group">
                  <h3>Sprint Progress & Sheet Sync</h3>
                  <p className="card-subtitle">Broadcast your milestone to your QA Manager in real-time</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div className="form-group-block">
                  <label htmlFor="p-select">Assigned Project *</label>
                  <select
                    id="p-select"
                    value={projectId}
                    onChange={handleProjectChange}
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
                  <label htmlFor="p-sprint">Sprint / Milestone Tag</label>
                  <input
                    id="p-sprint"
                    type="text"
                    placeholder="e.g. Sprint 24.2 - Regression Pass, Smoke Phase 1"
                    value={sprintName}
                    onChange={(e) => setSprintName(e.target.value)}
                  />
                </div>

                {/* Cloud Sheet Link */}
                <div className="form-group-block">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <label htmlFor="p-sheet" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Icon name="sheet" size={15} color="#10b981" />
                      <span>Live Google Sheet / Excel Link</span>
                    </label>
                    {excelSheetUrl && (
                      <a
                        href={excelSheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "0.75rem", color: "#10b981", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                      >
                        <span>Test Link ↗</span>
                      </a>
                    )}
                  </div>
                  <input
                    id="p-sheet"
                    type="url"
                    placeholder="https://docs.google.com/spreadsheets/d/... or OneDrive link"
                    value={excelSheetUrl}
                    onChange={(e) => setExcelSheetUrl(e.target.value)}
                  />
                </div>

                {/* Live Bug Tallies from Sheet: 4 Real QA Statuses */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
                    Current QA Bug Tallies (from your sheet)
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.6rem" }}>
                    <div className="form-group-block">
                      <label htmlFor="p-open" style={{ color: "#f43f5e", fontSize: "0.75rem", fontWeight: 600 }}>Open</label>
                      <input
                        id="p-open"
                        type="number"
                        min="0"
                        value={openBugs}
                        onChange={(e) => setOpenBugs(e.target.value)}
                      />
                    </div>
                    <div className="form-group-block">
                      <label htmlFor="p-need-retest" style={{ color: "#f59e0b", fontSize: "0.75rem", fontWeight: 600 }}>Need Retest</label>
                      <input
                        id="p-need-retest"
                        type="number"
                        min="0"
                        value={needRetestBugs}
                        onChange={(e) => setNeedRetestBugs(e.target.value)}
                      />
                    </div>
                    <div className="form-group-block">
                      <label htmlFor="p-retested" style={{ color: "#06b6d4", fontSize: "0.75rem", fontWeight: 600 }}>Retested</label>
                      <input
                        id="p-retested"
                        type="number"
                        min="0"
                        value={retestedBugs}
                        onChange={(e) => setRetestedBugs(e.target.value)}
                      />
                    </div>
                    <div className="form-group-block">
                      <label htmlFor="p-closed" style={{ color: "#10b981", fontSize: "0.75rem", fontWeight: 600 }}>Closed</label>
                      <input
                        id="p-closed"
                        type="number"
                        min="0"
                        value={closedBugs}
                        onChange={(e) => setClosedBugs(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group-block" style={{ marginTop: "0.4rem" }}>
                    <label htmlFor="p-crit" style={{ color: "#ef4444", fontSize: "0.75rem", fontWeight: 600 }}>Critical Blockers</label>
                    <input
                      id="p-crit"
                      type="number"
                      min="0"
                      value={criticalBugs}
                      onChange={(e) => setCriticalBugs(e.target.value)}
                    />
                  </div>
                </div>

                {/* Slider & Value Display */}
                <div className="form-group-block">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                    <label htmlFor="prog-slider">Execution Completion</label>
                    <strong style={{ fontSize: "1.25rem", color: "var(--primary)", fontFamily: "var(--font-heading)" }}>
                      {progress}%
                    </strong>
                  </div>
                  <input
                    id="prog-slider"
                    type="range"
                    min="0"
                    max="100"
                    value={progress}
                    onChange={(e) => setProgress(Number(e.target.value))}
                    style={{
                      width: "100%",
                      accentColor: "var(--primary)",
                      cursor: "pointer",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-faint)", marginTop: "0.25rem" }}>
                    <span>0% (Kickoff)</span>
                    <span>50% (In Flight)</span>
                    <span>100% (Sign-off)</span>
                  </div>
                </div>

                <div className="form-group-block">
                  <label htmlFor="p-remarks">Testing Remarks & Observations</label>
                  <textarea
                    id="p-remarks"
                    rows={3}
                    placeholder="Detail test coverage, blockers, environment stability, or next steps..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !projectId}
                  style={{ marginTop: "0.5rem" }}
                >
                  <Icon name="check" size={16} />
                  <span>{submitting ? "Saving Update..." : "Record Sprint Progress"}</span>
                </button>
              </form>
            </div>

            {/* Project Context & Progress Gauge */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "1.25rem" }}>
                <div className="card-header" style={{ width: "100%", marginBottom: 0 }}>
                  <div className="card-title-group" style={{ textAlign: "left" }}>
                    <h3>Completion Meter</h3>
                    <p className="card-subtitle">Visual milestone gauge</p>
                  </div>
                </div>

                <ProgressRing
                  progress={progress}
                  size={160}
                  strokeWidth={16}
                  color="#6366f1"
                  subtitle="Milestone"
                />

                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: 260 }}>
                  {progress === 100
                    ? "🎉 All test cases passed and sprint ready for deployment!"
                    : progress > 50
                    ? "Execution on track and past halfway mark."
                    : "Sprint in initial validation and test case authoring."}
                </div>
              </div>

              {selectedProject && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title-group">
                      <h3>Project Details</h3>
                      <p className="card-subtitle">Selected scope metadata</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", fontSize: "0.85rem" }}>
                    <div>
                      <span style={{ color: "var(--text-faint)", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700 }}>
                        Project Title
                      </span>
                      <strong style={{ display: "block", color: "var(--text-main)", marginTop: "2px" }}>
                        {selectedProject.name}
                      </strong>
                    </div>

                    {selectedProject.excel_sheet_url && (
                      <div>
                        <span style={{ color: "var(--text-faint)", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700 }}>
                          Live Cloud Sheet
                        </span>
                        <div style={{ marginTop: "0.3rem" }}>
                          <a
                            href={selectedProject.excel_sheet_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              color: "#10b981",
                              fontSize: "0.825rem",
                              fontWeight: 600,
                            }}
                          >
                            <Icon name="sheet" size={14} color="#10b981" />
                            <span>Open Cloud Spreadsheet</span>
                            <Icon name="externalLink" size={12} color="#10b981" />
                          </a>
                        </div>
                      </div>
                    )}

                    <div>
                      <span style={{ color: "var(--text-faint)", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700 }}>
                        Timeline
                      </span>
                      <div style={{ color: "var(--text-secondary)", marginTop: "2px" }}>
                        {selectedProject.start_date || "Flexible start"} → {selectedProject.end_date || "Ongoing"}
                      </div>
                    </div>

                    <div>
                      <span style={{ color: "var(--text-faint)", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700 }}>
                        Scope Description
                      </span>
                      <div style={{ color: "var(--text-muted)", marginTop: "2px", lineHeight: 1.5 }}>
                        {selectedProject.description || "No description provided."}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Historical Updates Timeline Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title-group">
                <h3>Sprint Milestone History</h3>
                <p className="card-subtitle">Previous updates logged for {selectedProject ? selectedProject.name : "selected project"}</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => loadHistory(projectId)}>
                <Icon name="refresh" size={14} />
                <span>Refresh Logs</span>
              </button>
            </div>

            {history.length === 0 ? (
              <p style={{ color: "var(--text-faint)", fontSize: "0.85rem", padding: "1.5rem 0", textAlign: "center" }}>
                No previous progress logs found for this project.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="custom-table" style={{ minWidth: "850px" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "18%" }}>Sprint Name</th>
                      <th style={{ width: "14%" }}>Completion</th>
                      <th style={{ width: "26%" }}>Sheet Bug Tallies</th>
                      <th style={{ width: "12%" }}>Test Sheet</th>
                      <th style={{ width: "16%" }}>Remarks</th>
                      <th style={{ width: "14%" }}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td>
                          <strong style={{ color: "var(--text-main)" }}>{h.sprint_name}</strong>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-faint)" }}>
                            By {h.tester_name}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div style={{ width: 80, height: 6, background: "var(--border-default)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                              <div
                                style={{
                                  width: `${h.progress}%`,
                                  height: "100%",
                                  background: h.progress >= 100 ? "var(--success)" : "var(--primary)",
                                }}
                              />
                            </div>
                            <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>{h.progress}%</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                            <span style={{ padding: "0.15rem 0.4rem", borderRadius: "var(--radius-sm)", background: "rgba(244, 63, 94, 0.12)", color: "#f43f5e", fontSize: "0.75rem" }}>
                              {h.open_bugs || 0} Open
                            </span>
                            <span style={{ padding: "0.15rem 0.4rem", borderRadius: "var(--radius-sm)", background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", fontSize: "0.75rem" }}>
                              {h.need_retest_bugs || 0} Retest
                            </span>
                            <span style={{ padding: "0.15rem 0.4rem", borderRadius: "var(--radius-sm)", background: "rgba(6, 182, 212, 0.12)", color: "#06b6d4", fontSize: "0.75rem" }}>
                              {h.retested_bugs || 0} Retested
                            </span>
                            <span style={{ padding: "0.15rem 0.4rem", borderRadius: "var(--radius-sm)", background: "rgba(16, 185, 129, 0.12)", color: "#10b981", fontSize: "0.75rem" }}>
                              {h.closed_bugs || h.fixed_bugs || 0} Closed
                            </span>
                            {Number(h.critical_bugs) > 0 && (
                              <span style={{ padding: "0.15rem 0.4rem", borderRadius: "var(--radius-sm)", background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", fontSize: "0.75rem" }}>
                                {h.critical_bugs} Crit
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {h.excel_sheet_url ? (
                            <a
                              href={h.excel_sheet_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", color: "#10b981", fontSize: "0.8rem", fontWeight: 600 }}
                            >
                              <Icon name="sheet" size={13} color="#10b981" />
                              <span>View Sheet</span>
                              <Icon name="externalLink" size={10} color="#10b981" />
                            </a>
                          ) : (
                            <span style={{ color: "var(--text-faint)", fontSize: "0.8rem" }}>—</span>
                          )}
                        </td>
                        <td style={{ minWidth: 0, overflow: "hidden" }}>
                          <span
                            style={{
                              fontSize: "0.85rem",
                              color: h.remarks ? "var(--text-secondary)" : "var(--text-faint)",
                              fontStyle: h.remarks ? "normal" : "italic",
                              maxWidth: "100%",
                              display: "block",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={h.remarks || "No remarks"}
                          >
                            {h.remarks || "No remarks"}
                          </span>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-main)", whiteSpace: "nowrap" }}>
                              {h.updated_at
                                ? new Date(h.updated_at).toLocaleDateString(undefined, {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "—"}
                            </span>
                            {h.updated_at && (
                              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                {new Date(h.updated_at).toLocaleTimeString(undefined, {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default TesterProgress;
