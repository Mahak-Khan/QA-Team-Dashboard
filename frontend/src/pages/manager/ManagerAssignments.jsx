import React, { useEffect, useState } from "react";
import { getProjects } from "../../services/projectService";
import { getTesters, assignTester } from "../../services/teamService";
import { getProjectProgress } from "../../services/managerService";
import { Icon } from "../../components/common/Icons";
import { Modal } from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";

export function ManagerAssignments() {
  const [projects, setProjects] = useState([]);
  const [testers, setTesters] = useState([]);
  const [progressData, setProgressData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [projectFilter, setProjectFilter] = useState("");
  const [testerFilter, setTesterFilter] = useState("");
  const [search, setSearch] = useState("");

  // Assign Form
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedTester, setSelectedTester] = useState("");

  const { addToast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [projData, testerData, progData] = await Promise.all([
        getProjects(),
        getTesters(),
        getProjectProgress(),
      ]);
      setProjects(Array.isArray(projData) ? projData : []);
      setTesters(Array.isArray(testerData) ? testerData : []);
      setProgressData(Array.isArray(progData) ? progData : []);
    } catch {
      addToast("Failed to load assignment data.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedProject || !selectedTester) {
      addToast("Please select both a project and a tester.", "error");
      return;
    }

    setSubmitting(true);
    try {
      await assignTester(selectedProject, selectedTester);
      addToast("Tester assigned successfully!", "success");
      setSelectedProject("");
      setSelectedTester("");
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      addToast(
        err.response?.data?.detail || "Tester could not be assigned.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Progress Data
  const filteredProgress = progressData.filter((item) => {
    const matchesProj = !projectFilter || String(item.project_id) === projectFilter;
    const matchesTester = !testerFilter || String(item.tester_id) === testerFilter;
    const matchesSearch =
      !search ||
      (item.project_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.tester_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.sprint_name || "").toLowerCase().includes(search.toLowerCase());

    return matchesProj && matchesTester && matchesSearch;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header Row */}
      <div className="page-header-row">
        <div className="page-title-box">
          <h1>Work Allocation & Sprints</h1>
          <p className="page-subtitle">
            Assign QA testers to initiatives and inspect real-time sprint execution.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Icon name="assignment" size={16} />
          <span>Assign Tester</span>
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
            placeholder="Search by project, tester, or sprint..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filters-cluster">
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

          <select
            value={testerFilter}
            onChange={(e) => setTesterFilter(e.target.value)}
          >
            <option value="">All Testers</option>
            {testers.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </select>

          {(projectFilter || testerFilter || search) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setProjectFilter("");
                setTesterFilter("");
                setSearch("");
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Assignments Table Card */}
      <div className="table-container-card">
        {loading ? (
          <div className="empty-state-card">
            <p>Loading assignments and sprint progress...</p>
          </div>
        ) : filteredProgress.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-state-icon">
              <Icon name="assignment" size={28} />
            </div>
            <h3>No assignments found</h3>
            <p>
              {projectFilter || testerFilter || search
                ? "No records match the current filter criteria."
                : "Assign a tester to a project to start tracking testing progress."}
            </p>
            {!projectFilter && !testerFilter && !search && (
              <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                <Icon name="plus" size={16} />
                <span>Create First Assignment</span>
              </button>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="custom-table" style={{ minWidth: "850px" }}>
              <thead>
                <tr>
                  <th style={{ width: "18%" }}>Project Name</th>
                  <th style={{ width: "18%" }}>Assigned QA Tester</th>
                  <th style={{ width: "12%" }}>Current Sprint</th>
                  <th style={{ width: "16%" }}>Testing Progress</th>
                  <th style={{ width: "20%" }}>Remarks / Status</th>
                  <th style={{ width: "16%" }}>Last Update</th>
                </tr>
              </thead>
              <tbody>
                {filteredProgress.map((item, idx) => (
                  <tr key={`${item.project_id}-${item.tester_id}-${idx}`}>
                    <td style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <strong
                          style={{
                            color: "var(--text-main)",
                            fontSize: "0.95rem",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={item.project_name}
                        >
                          {item.project_name}
                        </strong>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-faint)" }}>
                          Project #{item.project_id}
                        </span>
                      </div>
                    </td>
                    <td style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", minWidth: 0 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "var(--radius-full)",
                            background: "linear-gradient(135deg, #6366f1, #a855f7)",
                            color: "#fff",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {(item.tester_name || "T").charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0, overflow: "hidden" }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: "var(--text-main)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={item.tester_name}
                          >
                            {item.tester_name}
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={item.tester_email}
                          >
                            {item.tester_email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          background: "var(--bg-surface-elevated)",
                          padding: "0.25rem 0.65rem",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        {item.sprint_name || "Not started"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div
                          style={{
                            flex: 1,
                            height: 7,
                            background: "rgba(255, 255, 255, 0.08)",
                            borderRadius: "var(--radius-full)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(0, Number(item.progress || 0)))}%`,
                              height: "100%",
                              background:
                                Number(item.progress) >= 100
                                  ? "var(--success)"
                                  : "linear-gradient(90deg, #6366f1, #06b6d4)",
                              borderRadius: "var(--radius-full)",
                              boxShadow: "0 0 10px rgba(99, 102, 241, 0.5)",
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                        <strong style={{ fontSize: "0.85rem", color: "var(--text-main)", minWidth: 36 }}>
                          {item.progress || 0}%
                        </strong>
                      </div>
                    </td>
                    <td style={{ minWidth: 0, overflow: "hidden" }}>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          color: item.remarks ? "var(--text-secondary)" : "var(--text-faint)",
                          fontStyle: item.remarks ? "normal" : "italic",
                          maxWidth: "100%",
                          display: "block",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={item.remarks || "No remarks logged"}
                      >
                        {item.remarks || "No remarks logged"}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-main)", whiteSpace: "nowrap" }}>
                          {item.updated_at
                            ? new Date(item.updated_at).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "Never"}
                        </span>
                        {item.updated_at && (
                          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                            {new Date(item.updated_at).toLocaleTimeString(undefined, {
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

      {/* Modal: Assign Tester */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Assign Tester to Project"
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
              onClick={handleAssign}
              disabled={submitting || !selectedProject || !selectedTester}
            >
              {submitting ? "Assigning..." : "Assign Tester"}
            </button>
          </>
        }
      >
        <form onSubmit={handleAssign} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="form-group-block">
            <label htmlFor="assign-p">Select Project *</label>
            <select
              id="assign-p"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              required
            >
              <option value="">Choose a project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group-block">
            <label htmlFor="assign-t">Select QA Tester *</label>
            <select
              id="assign-t"
              value={selectedTester}
              onChange={(e) => setSelectedTester(e.target.value)}
              required
            >
              <option value="">Choose a tester...</option>
              {testers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.email})
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ManagerAssignments;
