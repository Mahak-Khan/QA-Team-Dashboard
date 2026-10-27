import React, { useEffect, useState } from "react";
import {
  getProjects,
  createProject,
  updateProjectStatus,
  deleteProject,
  updateProjectMetrics,
} from "../../services/projectService";
import { Icon } from "../../components/common/Icons";
import { Modal } from "../../components/common/Modal";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { useToast } from "../../context/ToastContext";

export function ManagerProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State for New Project
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [excelSheetUrl, setExcelSheetUrl] = useState("");
  const [openBugs, setOpenBugs] = useState(0);
  const [needRetestBugs, setNeedRetestBugs] = useState(0);
  const [retestedBugs, setRetestedBugs] = useState(0);
  const [closedBugs, setClosedBugs] = useState(0);
  const [criticalBugs, setCriticalBugs] = useState(0);

  // Quick Tally & Sheet Modal State
  const [tallyProject, setTallyProject] = useState(null);
  const [tallySheetUrl, setTallySheetUrl] = useState("");
  const [tallyOpen, setTallyOpen] = useState(0);
  const [tallyNeedRetest, setTallyNeedRetest] = useState(0);
  const [tallyRetested, setTallyRetested] = useState(0);
  const [tallyClosed, setTallyClosed] = useState(0);
  const [tallyCritical, setTallyCritical] = useState(0);
  const [tallySubmitting, setTallySubmitting] = useState(false);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { addToast } = useToast();

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await getProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      addToast("Failed to fetch projects list.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast("Project name is required.", "error");
      return;
    }

    if (startDate && endDate && endDate < startDate) {
      addToast("End date cannot be earlier than start date.", "error");
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

      await createProject({
        name: name.trim(),
        description: description.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        excel_sheet_url: excelSheetUrl.trim() || null,
        open_bugs: openCount,
        need_retest_bugs: needRetestCount,
        retested_bugs: retestedCount,
        closed_bugs: closedCount,
        critical_bugs: critCount,
        total_bugs: totalCount,
      });

      addToast("Project created with test sheet link and QA metrics!", "success");
      setName("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setExcelSheetUrl("");
      setOpenBugs(0);
      setNeedRetestBugs(0);
      setRetestedBugs(0);
      setClosedBugs(0);
      setCriticalBugs(0);
      setIsModalOpen(false);
      await loadProjects();
    } catch (err) {
      addToast(err.response?.data?.detail || "Could not create project.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (projectId, newStatus) => {
    try {
      await updateProjectStatus(projectId, newStatus);
      addToast("Project status updated!", "success");
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, status: newStatus } : p))
      );
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to update project status.", "error");
    }
  };

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

      addToast("Project live sheet and bug metrics synchronized!", "success");
      setProjects((prev) =>
        prev.map((p) => (p.id === tallyProject.id ? { ...p, ...updated } : p))
      );
      setTallyProject(null);
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to synchronize metrics.", "error");
    } finally {
      setTallySubmitting(false);
    }
  };

  const handleDelete = (projectId, projectName) => {
    setDeleteTarget({ id: projectId, name: projectName });
  };

  const confirmDeleteProject = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProject(deleteTarget.id);
      addToast("Project deleted successfully.", "success");
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to delete project.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(search.toLowerCase()) ||
      (project.description &&
        project.description.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus =
      !statusFilter || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header Row */}
      <div className="page-header-row">
        <div className="page-title-box">
          <h1>Project Portfolio & Test Workbooks</h1>
          <p className="page-subtitle">
            Manage your QA projects, synchronize live test sheets, and monitor active defect counts.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setName("");
            setDescription("");
            setStartDate("");
            setEndDate("");
            setExcelSheetUrl("");
            setOpenBugs(0);
            setNeedRetestBugs(0);
            setRetestedBugs(0);
            setClosedBugs(0);
            setCriticalBugs(0);
            setIsModalOpen(true);
          }}
        >
          <Icon name="plus" size={16} />
          <span>New Project</span>
        </button>
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
            placeholder="Search projects by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filters-cluster">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
          </select>

          {(search || statusFilter) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="empty-state-card">
          <p>Loading projects...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="card empty-state-card">
          <div className="empty-state-icon">
            <Icon name="projects" size={28} />
          </div>
          <h3>{search || statusFilter ? "No matching projects" : "No projects created yet"}</h3>
          <p>
            {search || statusFilter
              ? "Try adjusting your search or status filter."
              : "Click the New Project button above to set up your first QA tracking workspace."}
          </p>
          {!search && !statusFilter && (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <Icon name="plus" size={16} />
              <span>Create Project</span>
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
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
                {/* Header row with Project Icon and Status */}
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
                      width: 38,
                      height: 38,
                      borderRadius: "var(--radius-md)",
                      background: "var(--primary-subtle)",
                      color: "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid rgba(99, 102, 241, 0.25)",
                    }}
                  >
                    <Icon name="projects" size={19} />
                  </div>

                  <select
                    value={project.status || "active"}
                    onChange={(e) => handleStatusChange(project.id, e.target.value)}
                    style={{
                      padding: "0.25rem 0.65rem",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      borderRadius: "var(--radius-full)",
                      background:
                        project.status === "completed"
                          ? "var(--success-subtle)"
                          : project.status === "on_hold"
                          ? "var(--warning-subtle)"
                          : "var(--primary-subtle)",
                      color:
                        project.status === "completed"
                          ? "var(--success)"
                          : project.status === "on_hold"
                          ? "var(--warning)"
                          : "var(--primary)",
                      border: "1px solid var(--border-subtle)",
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
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

                {/* Cloud Excel Sheet Link Section */}
                <div
                  style={{
                    padding: "0.75rem",
                    background: "var(--bg-surface-elevated)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "1rem",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "var(--radius-sm)",
                        background: project.excel_sheet_url ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)",
                        color: project.excel_sheet_url ? "#10b981" : "var(--text-faint)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="sheet" size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 700 }}>
                        Live Test Sheet
                      </div>
                      <div
                        style={{
                          fontSize: "0.825rem",
                          color: project.excel_sheet_url ? "var(--text-main)" : "var(--text-faint)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {project.excel_sheet_url ? "Cloud Excel / Google Sheet" : "No sheet attached yet"}
                      </div>
                    </div>
                  </div>

                  {project.excel_sheet_url ? (
                    <a
                      href={project.excel_sheet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{
                        padding: "0.3rem 0.65rem",
                        fontSize: "0.75rem",
                        color: "#10b981",
                        borderColor: "rgba(16, 185, 129, 0.4)",
                        background: "rgba(16, 185, 129, 0.08)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        textDecoration: "none",
                        flexShrink: 0,
                      }}
                      title="Open spreadsheet in new browser tab"
                    >
                      <span>Open Sheet</span>
                      <Icon name="externalLink" size={12} color="#10b981" />
                    </a>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openTallyModal(project)}
                      style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem", flexShrink: 0 }}
                    >
                      + Attach
                    </button>
                  )}
                </div>

                {/* Bug Metrics Row: 4 Real QA Statuses */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.6rem 0.75rem",
                    background: "rgba(255, 255, 255, 0.02)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px dashed var(--border-subtle)",
                    marginBottom: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                    <span
                      style={{
                        padding: "0.18rem 0.45rem",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(244, 63, 94, 0.12)",
                        color: "#f43f5e",
                        border: "1px solid rgba(244, 63, 94, 0.25)",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                      }}
                    >
                      <strong>{project.open_bugs || 0}</strong> Open
                    </span>
                    <span
                      style={{
                        padding: "0.18rem 0.45rem",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(245, 158, 11, 0.12)",
                        color: "#f59e0b",
                        border: "1px solid rgba(245, 158, 11, 0.25)",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                      }}
                    >
                      <strong>{project.need_retest_bugs || 0}</strong> Need Retest
                    </span>
                    <span
                      style={{
                        padding: "0.18rem 0.45rem",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(6, 182, 212, 0.12)",
                        color: "#06b6d4",
                        border: "1px solid rgba(6, 182, 212, 0.25)",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                      }}
                    >
                      <strong>{project.retested_bugs || 0}</strong> Retested
                    </span>
                    <span
                      style={{
                        padding: "0.18rem 0.45rem",
                        borderRadius: "var(--radius-sm)",
                        background: "rgba(16, 185, 129, 0.12)",
                        color: "#10b981",
                        border: "1px solid rgba(16, 185, 129, 0.25)",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                      }}
                    >
                      <strong>{project.closed_bugs || project.fixed_bugs || 0}</strong> Closed
                    </span>
                    {Number(project.critical_bugs) > 0 && (
                      <span
                        style={{
                          padding: "0.18rem 0.45rem",
                          borderRadius: "var(--radius-sm)",
                          background: "rgba(239, 68, 68, 0.2)",
                          color: "#ef4444",
                          border: "1px solid rgba(239, 68, 68, 0.4)",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                        }}
                      >
                        <strong>{project.critical_bugs}</strong> Crit
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => openTallyModal(project)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      padding: "0.25rem 0.55rem",
                      fontSize: "0.75rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      flexShrink: 0,
                    }}
                    title="Quickly adjust bug tallies from your Excel sheet"
                  >
                    <Icon name="edit" size={12} />
                    <span>Sync</span>
                  </button>
                </div>
              </div>

              {/* Card Footer: dates, ID and delete */}
              <div
                style={{
                  borderTop: "1px solid var(--border-subtle)",
                  paddingTop: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.785rem",
                  color: "var(--text-faint)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Icon name="calendar" size={13} />
                  <span>
                    {project.start_date ? project.start_date : "Flexible"}
                    {project.end_date ? ` → ${project.end_date}` : ""}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
                  <button
                    onClick={() => handleDelete(project.id, project.name)}
                    style={{
                      color: "var(--text-faint)",
                      padding: "2px 4px",
                      borderRadius: "var(--radius-sm)",
                    }}
                    title="Delete project"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create New Project */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New QA Project"
        maxWidth="580px"
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
              onClick={handleCreateProject}
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create Project"}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateProject} style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%", maxWidth: "100%", boxSizing: "border-box", overflowX: "hidden" }}>
          <div className="form-group-block">
            <label htmlFor="proj-name">Project Name *</label>
            <input
              id="proj-name"
              type="text"
              placeholder="e.g. Core Checkout & Payment Gateway Redesign"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group-block">
            <label htmlFor="proj-desc">Description</label>
            <textarea
              id="proj-desc"
              rows={3}
              placeholder="Summary of the scope, test boundaries, environment URLs..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Cloud Excel Link */}
          <div className="form-group-block">
            <label htmlFor="proj-sheet" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Icon name="sheet" size={15} color="#10b981" />
              <span>Live Cloud Excel / Google Sheets URL</span>
            </label>
            <input
              id="proj-sheet"
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/... or OneDrive link"
              value={excelSheetUrl}
              onChange={(e) => setExcelSheetUrl(e.target.value)}
            />
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              The cloud sheet that your QA team actively updates during testing cycles.
            </span>
          </div>

          {/* Initial QA Status Bug Counts */}
          <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>
              Initial Bug Tallies (from Cloud Sheet)
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))", gap: "0.65rem", width: "100%", boxSizing: "border-box" }}>
              <div className="form-group-block">
                <label htmlFor="proj-open" style={{ color: "#f43f5e", fontSize: "0.75rem", fontWeight: 600 }}>Open</label>
                <input
                  id="proj-open"
                  type="number"
                  min="0"
                  value={openBugs}
                  onChange={(e) => setOpenBugs(e.target.value)}
                  style={{ padding: "0.55rem 0.65rem" }}
                />
              </div>
              <div className="form-group-block">
                <label htmlFor="proj-need-retest" style={{ color: "#f59e0b", fontSize: "0.75rem", fontWeight: 600 }}>Need Retest</label>
                <input
                  id="proj-need-retest"
                  type="number"
                  min="0"
                  value={needRetestBugs}
                  onChange={(e) => setNeedRetestBugs(e.target.value)}
                  style={{ padding: "0.55rem 0.65rem" }}
                />
              </div>
              <div className="form-group-block">
                <label htmlFor="proj-retested" style={{ color: "#06b6d4", fontSize: "0.75rem", fontWeight: 600 }}>Retested</label>
                <input
                  id="proj-retested"
                  type="number"
                  min="0"
                  value={retestedBugs}
                  onChange={(e) => setRetestedBugs(e.target.value)}
                  style={{ padding: "0.55rem 0.65rem" }}
                />
              </div>
              <div className="form-group-block">
                <label htmlFor="proj-closed" style={{ color: "#10b981", fontSize: "0.75rem", fontWeight: 600 }}>Closed</label>
                <input
                  id="proj-closed"
                  type="number"
                  min="0"
                  value={closedBugs}
                  onChange={(e) => setClosedBugs(e.target.value)}
                  style={{ padding: "0.55rem 0.65rem" }}
                />
              </div>
            </div>
          </div>

          <div className="form-group-block">
            <label htmlFor="proj-crit" style={{ color: "#ef4444", fontSize: "0.8rem", fontWeight: 600 }}>Critical Blockers</label>
            <input
              id="proj-crit"
              type="number"
              min="0"
              value={criticalBugs}
              onChange={(e) => setCriticalBugs(e.target.value)}
              style={{ padding: "0.55rem 0.75rem" }}
            />
          </div>

          <div className="form-row-2col">
            <div className="form-group-block">
              <label htmlFor="proj-start">Start Date</label>
              <input
                id="proj-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group-block">
              <label htmlFor="proj-end">Target End Date</label>
              <input
                id="proj-end"
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal: Quick Tally & Sheet Sync */}
      {tallyProject && (
        <Modal
          isOpen={Boolean(tallyProject)}
          onClose={() => setTallyProject(null)}
          title={`Sync Bug Metrics: ${tallyProject.name}`}
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
                {tallySubmitting ? "Saving..." : "Save & Sync Metrics"}
              </button>
            </>
          }
        >
          <form onSubmit={handleSaveTally} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Update the current QA status bug tally directly from your team's live cloud spreadsheet.
            </p>

            <div className="form-group-block">
              <label htmlFor="tally-sheet" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Icon name="sheet" size={15} color="#10b981" />
                <span>Cloud Excel / Google Sheets URL</span>
              </label>
              <input
                id="tally-sheet"
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/... or Microsoft 365 link"
                value={tallySheetUrl}
                onChange={(e) => setTallySheetUrl(e.target.value)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))", gap: "0.65rem", width: "100%", boxSizing: "border-box" }}>
              <div className="form-group-block">
                <label htmlFor="tally-open" style={{ color: "#f43f5e", fontWeight: 600, fontSize: "0.75rem" }}>
                  Open
                </label>
                <input
                  id="tally-open"
                  type="number"
                  min="0"
                  value={tallyOpen}
                  onChange={(e) => setTallyOpen(e.target.value)}
                  required
                  style={{ padding: "0.55rem 0.65rem" }}
                />
              </div>

              <div className="form-group-block">
                <label htmlFor="tally-need-retest" style={{ color: "#f59e0b", fontWeight: 600, fontSize: "0.75rem" }}>
                  Need Retest
                </label>
                <input
                  id="tally-need-retest"
                  type="number"
                  min="0"
                  value={tallyNeedRetest}
                  onChange={(e) => setTallyNeedRetest(e.target.value)}
                  required
                  style={{ padding: "0.55rem 0.65rem" }}
                />
              </div>

              <div className="form-group-block">
                <label htmlFor="tally-retested" style={{ color: "#06b6d4", fontWeight: 600, fontSize: "0.75rem" }}>
                  Retested
                </label>
                <input
                  id="tally-retested"
                  type="number"
                  min="0"
                  value={tallyRetested}
                  onChange={(e) => setTallyRetested(e.target.value)}
                  required
                  style={{ padding: "0.55rem 0.65rem" }}
                />
              </div>

              <div className="form-group-block">
                <label htmlFor="tally-closed" style={{ color: "#10b981", fontWeight: 600, fontSize: "0.75rem" }}>
                  Closed
                </label>
                <input
                  id="tally-closed"
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
              <label htmlFor="tally-crit" style={{ color: "#ef4444", fontWeight: 600, fontSize: "0.8rem" }}>
                Critical Blocker Bugs
              </label>
              <input
                id="tally-crit"
                type="number"
                min="0"
                value={tallyCritical}
                onChange={(e) => setTallyCritical(e.target.value)}
                required
              />
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

      {/* User-friendly Alert / Confirmation Modal for Project Deletion */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDeleteProject}
        title="Delete QA Project?"
        message="Are you sure you want to permanently delete this project workspace?"
        itemName={deleteTarget ? `${deleteTarget.name} (Project #${deleteTarget.id})` : ""}
        note="This action is irreversible. Associated defect records, sprint history, and tester assignments under this workspace will be removed."
        confirmText="Yes, Delete"
        cancelText="No, Cancel"
        loading={deleting}
      />
    </div>
  );
}

export default ManagerProjects;
