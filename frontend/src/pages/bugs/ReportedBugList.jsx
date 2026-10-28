import React, { useEffect, useState, useMemo } from "react";
import {
  getBugs,
  createBug,
  updateBug,
  updateBugStatus,
  deleteBug,
} from "../../services/bugService";
import { getProjects } from "../../services/projectService";
import { getTesterProjects } from "../../services/testerService";
import { getTesters } from "../../services/teamService";
import { Icon } from "../../components/common/Icons";
import { StatusBadge, SeverityBadge, IssueTypeBadge } from "../../components/common/Badge";
import { Modal } from "../../components/common/Modal";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { useToast } from "../../context/ToastContext";

const STATUSES = [
  { key: "open", label: "Open", color: "#f43f5e" },
  { key: "need_retest", label: "Need to be Retest", color: "#f59e0b" },
  { key: "retested", label: "Retested", color: "#06b6d4" },
  { key: "closed", label: "Closed", color: "#10b981" },
];

const SEVERITIES = [
  { key: "critical", label: "Critical", color: "#ef4444" },
  { key: "high", label: "High", color: "#f97316" },
  { key: "medium", label: "Medium", color: "#eab308" },
  { key: "low", label: "Low", color: "#3b82f6" },
];

function getUserIdFromToken() {
  try {
    const token = sessionStorage.getItem("access_token");
    if (!token) return null;
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    return Number(payload.sub) || null;
  } catch {
    return null;
  }
}

function formatDateTime(isoString) {
  if (!isoString) return { date: "—", time: "", relative: "" };
  try {
    const d = new Date(isoString);
    const date = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Relative time
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = "";
    if (diffMins < 2) relative = "Just now";
    else if (diffMins < 60) relative = `${diffMins}m ago`;
    else if (diffHours < 24) relative = `${diffHours}h ago`;
    else if (diffDays === 1) relative = "Yesterday";
    else if (diffDays < 7) relative = `${diffDays}d ago`;

    return { date, time, relative };
  } catch {
    return { date: "—", time: "", relative: "" };
  }
}

export function ReportedBugList({ role = "manager" }) {
  const currentUserId = getUserIdFromToken();
  const { addToast } = useToast();

  const [bugs, setBugs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [testers, setTesters] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [categoryToggle, setCategoryToggle] = useState("all"); // 'all' | 'bug' | 'requirement_change'
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [testerFilter, setTesterFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("all"); // 'all' | 'today' | 'week' | 'month'

  // Inspect Modal
  const [activeBug, setActiveBug] = useState(null);

  // Create / Report Modal
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportType, setReportType] = useState("bug"); // 'bug' or 'requirement_change'
  const [reportProjectId, setReportProjectId] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportSeverity, setReportSeverity] = useState("medium");
  const [reportSheetUrl, setReportSheetUrl] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  // Edit Modal
  const [editBug, setEditBug] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSeverity, setEditSeverity] = useState("medium");
  const [editStatus, setEditStatus] = useState("open");
  const [editCategory, setEditCategory] = useState("bug");
  const [editSheetUrl, setEditSheetUrl] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Delete Confirmation Modal
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);

      const [bugsData, projsData, testersData] = await Promise.all([
        getBugs(),
        role === "manager" ? getProjects() : getTesterProjects(),
        getTesters().catch(() => []),
      ]);

      const loadedBugs = Array.isArray(bugsData) ? bugsData : [];
      const loadedProjs = Array.isArray(projsData) ? projsData : [];
      const loadedTesters = Array.isArray(testersData) ? testersData : [];

      setBugs(loadedBugs);
      setProjects(loadedProjs);
      setTesters(loadedTesters);

      if (loadedProjs.length > 0 && !reportProjectId) {
        setReportProjectId(String(loadedProjs[0].id));
      }
    } catch {
      addToast("Failed to fetch defect records.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [role]);

  // Handle Quick Status Change
  const handleStatusChange = async (bugId, newStatus) => {
    try {
      await updateBugStatus(bugId, newStatus);
      const displayLabel = STATUSES.find((s) => s.key === newStatus)?.label || newStatus;
      addToast(`Defect #${bugId} marked as ${displayLabel}.`, "success");

      setBugs((prev) =>
        prev.map((b) => (b.id === bugId ? { ...b, status: newStatus } : b))
      );
      if (activeBug && activeBug.id === bugId) {
        setActiveBug((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to update status.", "error");
    }
  };

  // Open Edit Modal
  const openEditModal = (bug) => {
    setEditBug(bug);
    setEditTitle(bug.title || "");
    setEditDescription(bug.description || "");
    setEditSeverity(bug.severity || "medium");
    setEditStatus(bug.status || "open");
    setEditCategory(bug.category || "bug");
    setEditSheetUrl(bug.sheet_url || "");
  };

  // Submit Edit
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editBug) return;
    if (!editTitle.trim()) {
      addToast("Title is required", "error");
      return;
    }

    try {
      setSubmittingEdit(true);
      const updated = await updateBug(editBug.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        severity: editSeverity,
        status: editStatus,
        category: editCategory,
        sheet_url: editSheetUrl.trim() || null,
      });

      addToast("Issue details and linked sheet updated successfully!", "success");
      setBugs((prev) =>
        prev.map((b) => (b.id === editBug.id ? { ...b, ...updated } : b))
      );
      if (activeBug && activeBug.id === editBug.id) {
        setActiveBug((prev) => ({ ...prev, ...updated }));
      }
      setEditBug(null);
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to update defect details.", "error");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Submit New Report
  const handleCreateReport = async (e) => {
    e.preventDefault();
    if (!reportProjectId) {
      addToast("Please select a project", "error");
      return;
    }
    if (!reportTitle.trim()) {
      addToast("Defect title is required", "error");
      return;
    }

    try {
      setSubmittingReport(true);
      const newBug = await createBug({
        project_id: Number(reportProjectId),
        reported_by: currentUserId || 1,
        title: reportTitle.trim(),
        description: reportDescription.trim() || null,
        severity: reportSeverity,
        category: reportType,
        sheet_url: reportSheetUrl.trim() || null,
      });

      addToast(
        reportType === "requirement_change"
          ? "Requirement change logged successfully!"
          : "Bug defect reported with linked sheet successfully!",
        "success"
      );

      setBugs((prev) => [newBug, ...prev]);
      setIsReportOpen(false);
      setReportTitle("");
      setReportDescription("");
      setReportSeverity("medium");
      setReportType("bug");
      setReportSheetUrl("");
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to create defect ticket.", "error");
    } finally {
      setSubmittingReport(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      setDeleting(true);
      await deleteBug(deleteCandidate.id);
      addToast(`Defect #${deleteCandidate.id} deleted successfully.`, "success");
      setBugs((prev) => prev.filter((b) => b.id !== deleteCandidate.id));
      if (activeBug && activeBug.id === deleteCandidate.id) {
        setActiveBug(null);
      }
      setDeleteCandidate(null);
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to delete defect.", "error");
    } finally {
      setDeleting(false);
    }
  };

  // Aggregate stats across all bugs (Single-pass O(N) memoized accumulator)
  const {
    totalReported,
    bugsOnlyCount,
    reqChangeCount,
    openCount,
    needRetestCount,
    retestedCount,
    closedCount,
    criticalCount,
  } = useMemo(() => {
    let bugsOnly = 0;
    let reqChange = 0;
    let open = 0;
    let needRetest = 0;
    let retested = 0;
    let closed = 0;
    let critical = 0;

    for (let i = 0; i < bugs.length; i++) {
      const b = bugs[i];
      if ((b.category || "bug") === "bug") bugsOnly++;
      if (b.category === "requirement_change") reqChange++;

      if (b.status === "open") open++;
      else if (b.status === "need_retest") needRetest++;
      else if (b.status === "retested") retested++;
      else if (b.status === "closed") closed++;

      if ((b.severity || "").toLowerCase() === "critical") critical++;
    }

    return {
      totalReported: bugs.length,
      bugsOnlyCount: bugsOnly,
      reqChangeCount: reqChange,
      openCount: open,
      needRetestCount: needRetest,
      retestedCount: retested,
      closedCount: closed,
      criticalCount: critical,
    };
  }, [bugs]);

  // Derive unique testers from loaded bugs (in case /team/testers doesn't return everyone)
  const availableTesters = useMemo(() => {
    const map = new Map();
    testers.forEach((t) => {
      map.set(t.id, { id: t.id, name: t.name, email: t.email });
    });
    bugs.forEach((b) => {
      if (b.reported_by && !map.has(b.reported_by)) {
        map.set(b.reported_by, {
          id: b.reported_by,
          name: b.reporter_name || `Tester #${b.reported_by}`,
          email: b.reporter_email || "",
        });
      }
    });
    return Array.from(map.values());
  }, [testers, bugs]);

  // Filtered bug tickets list
  const filteredBugs = useMemo(() => {
    return bugs.filter((bug) => {
      // Category Toggle
      if (categoryToggle === "bug" && (bug.category || "bug") !== "bug") return false;
      if (categoryToggle === "requirement_change" && bug.category !== "requirement_change") return false;

      // Search (title, description, project name, reporter name)
      if (search) {
        const query = search.toLowerCase();
        const titleMatch = (bug.title || "").toLowerCase().includes(query);
        const descMatch = (bug.description || "").toLowerCase().includes(query);
        const projMatch = (bug.project_name || "").toLowerCase().includes(query);
        const repMatch = (bug.reporter_name || "").toLowerCase().includes(query);
        const idMatch = `#${bug.id}`.includes(query) || String(bug.id) === query;
        if (!titleMatch && !descMatch && !projMatch && !repMatch && !idMatch) {
          return false;
        }
      }

      // Project Filter
      if (projectFilter && String(bug.project_id) !== projectFilter) {
        return false;
      }

      // Tester Filter
      if (testerFilter && String(bug.reported_by) !== testerFilter) {
        return false;
      }

      // Status Filter
      if (statusFilter && bug.status !== statusFilter) {
        return false;
      }

      // Severity Filter
      if (severityFilter && (bug.severity || "").toLowerCase() !== severityFilter.toLowerCase()) {
        return false;
      }

      // Date Range Filter (Today, Last 7 Days, Last 30 Days)
      if (dateFilter && dateFilter !== "all") {
        const d = new Date(bug.updated_at || bug.created_at);
        const now = new Date();
        if (dateFilter === "today") {
          const isToday =
            d.getDate() === now.getDate() &&
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (dateFilter === "week") {
          const diffDays = (now - d) / (1000 * 60 * 60 * 24);
          if (diffDays > 7) return false;
        } else if (dateFilter === "month") {
          const diffDays = (now - d) / (1000 * 60 * 60 * 24);
          if (diffDays > 30) return false;
        }
      }

      return true;
    });
  }, [bugs, categoryToggle, search, projectFilter, testerFilter, statusFilter, severityFilter, dateFilter]);

  const hasActiveFilters =
    categoryToggle !== "all" ||
    search !== "" ||
    projectFilter !== "" ||
    testerFilter !== "" ||
    statusFilter !== "" ||
    severityFilter !== "" ||
    dateFilter !== "all";

  const clearAllFilters = () => {
    setCategoryToggle("all");
    setSearch("");
    setProjectFilter("");
    setTesterFilter("");
    setStatusFilter("");
    setSeverityFilter("");
    setDateFilter("all");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Page Header */}
      <div className="page-header-row">
        <div className="page-title-box">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-md)",
                background: "linear-gradient(135deg, rgba(244, 63, 94, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)",
                border: "1px solid rgba(168, 85, 247, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#c084fc",
              }}
            >
              <Icon name="bugs" size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.65rem", margin: 0 }}>Reported Defect & Requirement Log</h1>
              <p className="page-subtitle" style={{ margin: "0.2rem 0 0 0" }}>
                Dedicated repository for logging defects, recording requirement alterations, and tracking QA retests.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary"
            onClick={loadData}
            title="Refresh defect log"
          >
            <Icon name="refresh" size={16} />
            <span>Refresh</span>
          </button>

          <button
            className="btn btn-primary"
            onClick={() => setIsReportOpen(true)}
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
              boxShadow: "0 4px 18px rgba(139, 92, 246, 0.35)",
              border: "none",
            }}
          >
            <Icon name="plus" size={16} />
            <span>+ Report Defect / Change</span>
          </button>
        </div>
      </div>

      {/* Aggregate KPI Badges Strip (Exact QA Status Lifecycle) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 155px), 1fr))",
          gap: "1rem",
        }}
      >
        {/* Total Tracked */}
        <div
          className="stat-metric-card"
          style={{
            padding: "1.1rem 1.25rem",
            cursor: "pointer",
            border: (!statusFilter && !severityFilter) ? "1px solid rgba(99, 102, 241, 0.5)" : undefined,
          }}
          onClick={() => {
            setStatusFilter("");
            setSeverityFilter("");
          }}
          title="Click to view all reported tickets"
        >
          <div className="stat-card-top-row">
            <span className="stat-metric-label">Total Tracked</span>
            <div className="stat-card-icon-wrapper indigo" style={{ width: 34, height: 34 }}>
              <Icon name="bugs" size={16} />
            </div>
          </div>
          <div className="stat-metric-value" style={{ fontSize: "1.75rem" }}>
            {loading ? "—" : totalReported}
          </div>
          <div className="stat-metric-footer">
            <span style={{ color: "var(--text-muted)" }}>Individual Bug Tickets</span>
          </div>
        </div>

        {/* Open */}
        <div
          className="stat-metric-card"
          style={{
            padding: "1.1rem 1.25rem",
            cursor: "pointer",
            border: statusFilter === "open" ? "1px solid #f43f5e" : undefined,
            background: statusFilter === "open" ? "rgba(244, 63, 94, 0.12)" : undefined,
          }}
          onClick={() => setStatusFilter(statusFilter === "open" ? "" : "open")}
          title="Click to filter Open defects"
        >
          <div className="stat-card-top-row">
            <span className="stat-metric-label">Open</span>
            <div className="stat-card-icon-wrapper danger" style={{ width: 34, height: 34 }}>
              <Icon name="alert" size={16} />
            </div>
          </div>
          <div className="stat-metric-value" style={{ fontSize: "1.75rem", color: "#f43f5e" }}>
            {loading ? "—" : openCount}
          </div>
          <div className="stat-metric-footer">
            <span style={{ color: "#f43f5e", fontWeight: 600 }}>Awaiting Dev Fix</span>
          </div>
        </div>

        {/* Need Retest */}
        <div
          className="stat-metric-card"
          style={{
            padding: "1.1rem 1.25rem",
            cursor: "pointer",
            border: statusFilter === "need_retest" ? "1px solid #f59e0b" : undefined,
            background: statusFilter === "need_retest" ? "rgba(245, 158, 11, 0.12)" : undefined,
          }}
          onClick={() => setStatusFilter(statusFilter === "need_retest" ? "" : "need_retest")}
          title="Click to filter Need Retest defects"
        >
          <div className="stat-card-top-row">
            <span className="stat-metric-label">Need Retest</span>
            <div className="stat-card-icon-wrapper warning" style={{ width: 34, height: 34 }}>
              <Icon name="refresh" size={16} />
            </div>
          </div>
          <div className="stat-metric-value" style={{ fontSize: "1.75rem", color: "#f59e0b" }}>
            {loading ? "—" : needRetestCount}
          </div>
          <div className="stat-metric-footer">
            <span style={{ color: "#f59e0b", fontWeight: 600 }}>Ready for QA Retest</span>
          </div>
        </div>

        {/* Retested */}
        <div
          className="stat-metric-card"
          style={{
            padding: "1.1rem 1.25rem",
            cursor: "pointer",
            border: statusFilter === "retested" ? "1px solid #06b6d4" : undefined,
            background: statusFilter === "retested" ? "rgba(6, 182, 212, 0.12)" : undefined,
          }}
          onClick={() => setStatusFilter(statusFilter === "retested" ? "" : "retested")}
          title="Click to filter Retested defects"
        >
          <div className="stat-card-top-row">
            <span className="stat-metric-label">Retested</span>
            <div className="stat-card-icon-wrapper cyan" style={{ width: 34, height: 34 }}>
              <Icon name="check" size={16} />
            </div>
          </div>
          <div className="stat-metric-value" style={{ fontSize: "1.75rem", color: "#06b6d4" }}>
            {loading ? "—" : retestedCount}
          </div>
          <div className="stat-metric-footer">
            <span style={{ color: "#06b6d4", fontWeight: 600 }}>Verified Working</span>
          </div>
        </div>

        {/* Closed */}
        <div
          className="stat-metric-card"
          style={{
            padding: "1.1rem 1.25rem",
            cursor: "pointer",
            border: statusFilter === "closed" ? "1px solid #10b981" : undefined,
            background: statusFilter === "closed" ? "rgba(16, 185, 129, 0.12)" : undefined,
          }}
          onClick={() => setStatusFilter(statusFilter === "closed" ? "" : "closed")}
          title="Click to filter Closed defects"
        >
          <div className="stat-card-top-row">
            <span className="stat-metric-label">Closed</span>
            <div className="stat-card-icon-wrapper success" style={{ width: 34, height: 34 }}>
              <Icon name="check" size={16} />
            </div>
          </div>
          <div className="stat-metric-value" style={{ fontSize: "1.75rem", color: "#10b981" }}>
            {loading ? "—" : closedCount}
          </div>
          <div className="stat-metric-footer">
            <span style={{ color: "#10b981", fontWeight: 600 }}>Signed-off by Team</span>
          </div>
        </div>

        {/* Critical Priority */}
        <div
          className="stat-metric-card"
          style={{
            padding: "1.1rem 1.25rem",
            cursor: "pointer",
            border: severityFilter === "critical" ? "1px solid #ef4444" : undefined,
            background: severityFilter === "critical" ? "rgba(239, 68, 68, 0.12)" : undefined,
          }}
          onClick={() => setSeverityFilter(severityFilter === "critical" ? "" : "critical")}
          title="Click to filter Critical escalations"
        >
          <div className="stat-card-top-row">
            <span className="stat-metric-label">Critical</span>
            <div className="stat-card-icon-wrapper danger" style={{ width: 34, height: 34 }}>
              <Icon name="alert" size={16} />
            </div>
          </div>
          <div className="stat-metric-value" style={{ fontSize: "1.75rem", color: "#ef4444" }}>
            {loading ? "—" : criticalCount}
          </div>
          <div className="stat-metric-footer">
            <span style={{ color: "#ef4444", fontWeight: 600 }}>Blocker Escalations</span>
          </div>
        </div>
      </div>

      {/* Main Card: Defect Repository with Prominent Toggle Bar & Filters */}
      <div className="card">
        <div className="card-header" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div className="card-title-group" style={{ minWidth: 280 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap", margin: 0 }}>
              <span>Stored Defect & Requirement Tickets</span>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "0.2rem 0.65rem",
                  borderRadius: "9999px",
                  background: "var(--bg-surface-elevated)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-subtle)",
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  alignItems: "center",
                  flexShrink: 0,
                  lineHeight: 1.2,
                }}
              >
                {filteredBugs.length} showing
              </span>
            </h3>
            <p className="card-subtitle" style={{ marginTop: "0.25rem" }}>
              Granular bug lifecycle management, verified tester attributions, and exact reported timestamps.
            </p>
          </div>

          {/* Prominent Segmented Toggle Bar for Bugs vs Requirement Changed */}
          <div className="segmented-toggle-bar">
            <button
              type="button"
              className={`segmented-toggle-btn ${categoryToggle === "all" ? "active" : ""}`}
              onClick={() => setCategoryToggle("all")}
            >
              <span>All Logged Items</span>
              <span className="segmented-badge-pill">{totalReported}</span>
            </button>

            <button
              type="button"
              className={`segmented-toggle-btn bugs-only ${categoryToggle === "bug" ? "active" : ""}`}
              onClick={() => setCategoryToggle("bug")}
            >
              <Icon name="bugs" size={14} />
              <span>Bugs Only</span>
              <span className="segmented-badge-pill">{bugsOnlyCount}</span>
            </button>

            <button
              type="button"
              className={`segmented-toggle-btn req-only ${categoryToggle === "requirement_change" ? "active" : ""}`}
              onClick={() => setCategoryToggle("requirement_change")}
            >
              <Icon name="gitBranch" size={14} />
              <span>Requirement Changed</span>
              <span className="segmented-badge-pill">{reqChangeCount}</span>
            </button>
          </div>
        </div>

        {/* Multi-Filter Bar: Project, Tester, Severity, Status, Live Search */}
        <div className="filter-search-container" style={{ margin: "0.75rem 0 1.25rem 0", flexWrap: "wrap" }}>
          {/* Live Search */}
          <div className="search-input-wrapper" style={{ minWidth: 260, flex: "1 1 260px" }}>
            <span className="search-icon">
              <Icon name="search" size={16} />
            </span>
            <input
              type="text"
              className="search-input-field"
              placeholder="Search by defect title, description, #ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filters-cluster" style={{ flexWrap: "wrap" }}>
            {/* Project Filter */}
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              title="Filter by Project"
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Tester Filter */}
            <select
              value={testerFilter}
              onChange={(e) => setTesterFilter(e.target.value)}
              title="Filter by Reporter / Tester"
            >
              <option value="">All Testers / Reporters</option>
              {availableTesters.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name || `Tester #${t.id}`}
                </option>
              ))}
            </select>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              title="Filter by Severity"
            >
              <option value="">All Severities</option>
              {SEVERITIES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              title="Filter by Status"
            >
              <option value="">All Statuses</option>
              {STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>

            {/* Date Range Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              title="Filter by Activity Date"
            >
              <option value="all">All Dates</option>
              <option value="today">Today Only</option>
              <option value="week">Past 7 Days</option>
              <option value="month">Past 30 Days</option>
            </select>

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={clearAllFilters}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  color: "#f43f5e",
                  borderColor: "rgba(244, 63, 94, 0.4)",
                  background: "rgba(244, 63, 94, 0.08)",
                }}
              >
                <Icon name="x" size={13} />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabular Defect Rows with exact Reported Date & Time */}
        {loading ? (
          <div className="empty-state-card" style={{ padding: "3rem 2rem" }}>
            <div className="spinner" style={{ width: 28, height: 28, margin: "0 auto 1rem auto" }} />
            <p>Loading defect and requirement logs...</p>
          </div>
        ) : filteredBugs.length === 0 ? (
          <div className="empty-state-card" style={{ padding: "3rem 2rem" }}>
            <div
              className="empty-state-icon"
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "rgba(99, 102, 241, 0.1)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem auto",
              }}
            >
              <Icon name="bugs" size={28} />
            </div>
            <h4 style={{ margin: "0 0 0.5rem 0", color: "var(--text-main)" }}>No Defect Records Found</h4>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", maxWidth: 440, margin: "0 auto 1.25rem auto" }}>
              {hasActiveFilters
                ? "No reported tickets match your active filter criteria. Try adjusting or clearing your filters."
                : "No reported defects or requirement changes have been logged yet. Click below to record the first one."}
            </p>
            {hasActiveFilters ? (
              <button className="btn btn-secondary btn-sm" onClick={clearAllFilters}>
                Reset All Filters
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => setIsReportOpen(true)}>
                + Log First Defect / Change
              </button>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="custom-table" style={{ minWidth: "1060px" }}>
              <thead>
                <tr>
                  <th style={{ minWidth: "260px", padding: "0.75rem 0.75rem" }}>Defect Summary</th>
                  <th style={{ minWidth: "135px", padding: "0.75rem 0.6rem", whiteSpace: "nowrap" }}>Issue Type</th>
                  <th style={{ minWidth: "130px", padding: "0.75rem 0.6rem" }}>Project</th>
                  <th style={{ minWidth: "155px", padding: "0.75rem 0.6rem" }}>Reported By</th>
                  <th style={{ minWidth: "100px", padding: "0.75rem 0.6rem", whiteSpace: "nowrap" }}>Severity</th>
                  <th style={{ minWidth: "135px", padding: "0.75rem 0.6rem", whiteSpace: "nowrap" }}>QA Status</th>
                  <th style={{ minWidth: "125px", padding: "0.75rem 0.6rem", whiteSpace: "nowrap" }}>Linked Sheet</th>
                  <th style={{ minWidth: "170px", padding: "0.75rem 0.6rem", whiteSpace: "nowrap" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                      <Icon name="clock" size={13} color="var(--text-muted)" />
                      <span>Reported Date & Time</span>
                    </div>
                  </th>
                  <th style={{ minWidth: "125px", textAlign: "right", padding: "0.75rem 0.75rem", whiteSpace: "nowrap" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBugs.map((bug) => {
                  const dt = formatDateTime(bug.created_at);
                  const isReporter = currentUserId && bug.reported_by === currentUserId;
                  const canDelete = role === "manager" || isReporter;

                  return (
                    <tr key={bug.id} style={{ transition: "background 0.15s ease" }}>
                      {/* Defect Summary */}
                      <td style={{ padding: "0.75rem 0.75rem" }}>
                        <div
                          style={{ cursor: "pointer" }}
                          onClick={() => setActiveBug(bug)}
                          title="Click to inspect full details"
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
                                fontWeight: 600,
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
                                marginTop: "0.25rem",
                                paddingLeft: "0.2rem",
                              }}
                            >
                              {bug.description}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Issue Type (Defect vs Requirement Change) */}
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <IssueTypeBadge category={bug.category} />
                      </td>

                      {/* Project */}
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <strong
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--text-main)",
                            display: "block",
                            maxWidth: 160,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={bug.project_name || `Project #${bug.project_id}`}
                        >
                          {bug.project_name || `Project #${bug.project_id}`}
                        </strong>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-faint)" }}>
                          ID #{bug.project_id}
                        </span>
                      </td>

                      {/* Reported By */}
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                          <div
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: "50%",
                              background: "rgba(99, 102, 241, 0.15)",
                              border: "1px solid rgba(99, 102, 241, 0.3)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              color: "var(--primary)",
                              flexShrink: 0,
                            }}
                          >
                            {(bug.reporter_name || "T")[0].toUpperCase()}
                          </div>
                          <div style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis" }}>
                            <div
                              style={{
                                fontSize: "0.825rem",
                                fontWeight: 600,
                                color: "var(--text-main)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={bug.reporter_name || "QA Tester"}
                            >
                              {bug.reporter_name || `Tester #${bug.reported_by}`}
                            </div>
                            {bug.reporter_email && (
                              <div
                                style={{
                                  fontSize: "0.7rem",
                                  color: "var(--text-faint)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                                title={bug.reporter_email}
                              >
                                {bug.reporter_email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Severity */}
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <SeverityBadge severity={bug.severity} />
                      </td>

                      {/* QA Status with Inline Select */}
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        <select
                          value={bug.status}
                          onChange={(e) => handleStatusChange(bug.id, e.target.value)}
                          style={{
                            padding: "0.3rem 0.55rem",
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
                          {STATUSES.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Linked Sheet Option */}
                      <td style={{ padding: "0.75rem 0.5rem" }}>
                        {bug.sheet_url ? (
                          <a
                            href={bug.sheet_url}
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
                              padding: "0.2rem 0.5rem",
                              borderRadius: "var(--radius-sm)",
                              background: "rgba(16, 185, 129, 0.1)",
                              border: "1px solid rgba(16, 185, 129, 0.25)",
                            }}
                            title="Open attached test sheet in new tab"
                          >
                            <Icon name="sheet" size={12} color="#10b981" />
                            <span>Sheet</span>
                            <Icon name="externalLink" size={10} color="#10b981" />
                          </a>
                        ) : (
                          <span style={{ color: "var(--text-faint)", fontSize: "0.75rem" }}>—</span>
                        )}
                      </td>

                      {/* Reported Date & Time */}
                      <td style={{ padding: "0.75rem 0.6rem", whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: "0.825rem", color: "var(--text-main)", fontWeight: 600, whiteSpace: "nowrap" }}>
                          {dt.date}
                        </div>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.45rem",
                            fontSize: "0.725rem",
                            color: "var(--text-muted)",
                            marginTop: "0.2rem",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span style={{ whiteSpace: "nowrap" }}>{dt.time}</span>
                          {dt.relative && (
                            <span
                              style={{
                                padding: "0.12rem 0.4rem",
                                borderRadius: "var(--radius-sm)",
                                background: "rgba(255, 255, 255, 0.06)",
                                color: "var(--text-faint)",
                                fontSize: "0.7rem",
                                whiteSpace: "nowrap",
                                display: "inline-block",
                              }}
                            >
                              {dt.relative}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Row Actions */}
                      <td style={{ textAlign: "right", whiteSpace: "nowrap", padding: "0.75rem 0.75rem" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setActiveBug(bug)}
                            style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem" }}
                            title="Inspect details"
                          >
                            Inspect
                          </button>

                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEditModal(bug)}
                            style={{ padding: "0.25rem 0.45rem", fontSize: "0.75rem" }}
                            title="Edit defect"
                          >
                            <Icon name="edit" size={13} />
                          </button>

                          {canDelete && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setDeleteCandidate(bug)}
                              style={{
                                padding: "0.25rem 0.45rem",
                                fontSize: "0.75rem",
                                color: "#f43f5e",
                                borderColor: "rgba(244, 63, 94, 0.3)",
                              }}
                              title="Delete defect ticket"
                            >
                              <Icon name="trash" size={13} />
                            </button>
                          )}
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

      {/* Modal 1: Report New Defect / Requirement Change */}
      <Modal
        isOpen={isReportOpen}
        onClose={() => !submittingReport && setIsReportOpen(false)}
        title="Report Defect or Requirement Change"
      >
        <form onSubmit={handleCreateReport} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Issue Type Selector (Bug vs Requirement Change) */}
          <div className="form-group">
            <label className="form-label" style={{ marginBottom: "0.5rem" }}>
              Issue Classification
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div
                style={{
                  padding: "0.85rem",
                  borderRadius: "var(--radius-md)",
                  border:
                    reportType === "bug"
                      ? "2px solid #f43f5e"
                      : "1px solid var(--border-color)",
                  background:
                    reportType === "bug"
                      ? "rgba(244, 63, 94, 0.1)"
                      : "var(--bg-surface-elevated)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onClick={() => setReportType("bug")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                  <Icon name="bugs" size={16} color="#f43f5e" />
                  <strong style={{ color: "var(--text-main)", fontSize: "0.9rem" }}>Software Defect</strong>
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Code bug, functional glitch, crash, or unexpected behavior.
                </span>
              </div>

              <div
                style={{
                  padding: "0.85rem",
                  borderRadius: "var(--radius-md)",
                  border:
                    reportType === "requirement_change"
                      ? "2px solid #a855f7"
                      : "1px solid var(--border-color)",
                  background:
                    reportType === "requirement_change"
                      ? "rgba(168, 85, 247, 0.12)"
                      : "var(--bg-surface-elevated)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onClick={() => setReportType("requirement_change")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                  <Icon name="gitBranch" size={16} color="#c084fc" />
                  <strong style={{ color: "var(--text-main)", fontSize: "0.9rem" }}>Requirement Change</strong>
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Client altered specifications, workflow adjustment, or scope change.
                </span>
              </div>
            </div>
          </div>

          {/* Project & Severity in a 2-column grid */}
          <div className="form-grid-2col">
            <div className="form-group">
              <label className="form-label" htmlFor="report-project">
                Associated Project *
              </label>
              <select
                id="report-project"
                value={reportProjectId}
                onChange={(e) => setReportProjectId(e.target.value)}
                required
              >
                <option value="" disabled>Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="report-severity">
                Severity Level *
              </label>
              <select
                id="report-severity"
                value={reportSeverity}
                onChange={(e) => setReportSeverity(e.target.value)}
              >
                <option value="low">Low (Cosmetic, minor typo)</option>
                <option value="medium">Medium (Normal defect / partial block)</option>
                <option value="high">High (Major feature broken, workaround exists)</option>
                <option value="critical">Critical (System crash, blocker, instant alert sent)</option>
              </select>
            </div>
          </div>

          {/* Defect Title */}
          <div className="form-group">
            <label className="form-label" htmlFor="report-title">
              {reportType === "requirement_change" ? "Requirement Title *" : "Defect Summary / Title *"}
            </label>
            <input
              id="report-title"
              type="text"
              placeholder={
                reportType === "requirement_change"
                  ? "e.g., Client requested payment flow redirect changes"
                  : "e.g., Checkout modal crashes on zero cart items"
              }
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              required
            />
          </div>

          {/* Description & Reproduction Steps */}
          <div className="form-group">
            <label className="form-label" htmlFor="report-desc">
              {reportType === "requirement_change"
                ? "Changed Specification & Scope Details"
                : "Description & Reproduction Steps"}
            </label>
            <textarea
              id="report-desc"
              rows={4}
              placeholder={
                reportType === "requirement_change"
                  ? "Specify what changed in the client requirement, who authorized it, and the new expected behavior..."
                  : "Steps to reproduce:\n1. Open dashboard\n2. Click on submit button\n3. Observe error trace..."
              }
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
            />
          </div>

          {/* Link Sheet Option */}
          <div className="form-group">
            <label className="form-label" htmlFor="report-sheet-url" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Icon name="sheet" size={14} color="#10b981" />
              <span>Link a Sheet / Test Run URL (Optional)</span>
            </label>
            <input
              id="report-sheet-url"
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/... (Google Sheet or Excel URL)"
              value={reportSheetUrl}
              onChange={(e) => setReportSheetUrl(e.target.value)}
            />
            <span style={{ fontSize: "0.72rem", color: "var(--text-faint)", marginTop: "0.2rem", display: "block" }}>
              Attach a Google Sheet or Excel workbook link for defect logs, test execution matrix, or reproduction steps.
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsReportOpen(false)}
              disabled={submittingReport}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submittingReport}
              style={{
                background:
                  reportType === "requirement_change"
                    ? "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)"
                    : "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
              }}
            >
              {submittingReport ? (
                <>
                  <Icon name="refresh" size={14} className="spinner" />
                  <span>Logging...</span>
                </>
              ) : (
                <>
                  <Icon name="check" size={14} />
                  <span>{reportType === "requirement_change" ? "Save Requirement Change" : "Log Defect Ticket"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Edit Defect / Requirement Details */}
      <Modal
        isOpen={Boolean(editBug)}
        onClose={() => !submittingEdit && setEditBug(null)}
        title={`Edit Defect #${editBug?.id}`}
      >
        <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Classification Switch */}
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

          {/* Title */}
          <div className="form-group">
            <label className="form-label" htmlFor="edit-title">
              Title *
            </label>
            <input
              id="edit-title"
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Brief summary of the issue..."
              required
            />
          </div>

          <div className="form-grid-2col">
            {/* Severity */}
            <div className="form-group">
              <label className="form-label" htmlFor="edit-severity">
                Severity Level
              </label>
              <select
                id="edit-severity"
                value={editSeverity}
                onChange={(e) => setEditSeverity(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {/* QA Status */}
            <div className="form-group">
              <label className="form-label" htmlFor="edit-status">
                QA Status
              </label>
              <select
                id="edit-status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label" htmlFor="edit-desc">
              Description / Notes / Reproduction Details
            </label>
            <textarea
              id="edit-desc"
              rows={4}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Describe reproduction steps, expected behavior, or notes..."
            />
          </div>

          {/* Link Sheet Option */}
          <div className="form-group">
            <label className="form-label" htmlFor="edit-sheet-url" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Icon name="sheet" size={14} color="#10b981" />
              <span>Link a Sheet / Test Run URL (Optional)</span>
            </label>
            <input
              id="edit-sheet-url"
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/... (Google Sheet or Excel URL)"
              value={editSheetUrl}
              onChange={(e) => setEditSheetUrl(e.target.value)}
            />
          </div>

          {/* Actions */}
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

      {/* Modal 3: Inspect / Full Details View */}
      {activeBug && (
        <Modal
          isOpen={Boolean(activeBug)}
          onClose={() => setActiveBug(null)}
          title={`Defect Inspection #${activeBug.id}`}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Header info bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.5rem",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <IssueTypeBadge category={activeBug.category} />
                <SeverityBadge severity={activeBug.severity} />
                <StatusBadge status={activeBug.status} />
              </div>

              <div style={{ fontSize: "0.785rem", color: "var(--text-muted)" }}>
                ID #{activeBug.id}
              </div>
            </div>

            {/* Title */}
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                Defect Title
              </span>
              <h3 style={{ margin: "0.25rem 0 0 0", color: "var(--text-main)", fontSize: "1.15rem" }}>
                {activeBug.title}
              </h3>
            </div>

            {/* Context Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>
                  Project
                </span>
                <strong style={{ fontSize: "0.9rem", color: "var(--text-main)" }}>
                  {activeBug.project_name || `Project #${activeBug.project_id}`}
                </strong>
              </div>

              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>
                  Reported By
                </span>
                <strong style={{ fontSize: "0.9rem", color: "var(--text-main)" }}>
                  {activeBug.reporter_name || `Tester #${activeBug.reported_by}`}
                </strong>
                {activeBug.reporter_email && (
                  <span style={{ fontSize: "0.72rem", color: "var(--text-faint)", display: "block" }}>
                    {activeBug.reporter_email}
                  </span>
                )}
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>
                  Exact Reported Timestamp
                </span>
                <span style={{ fontSize: "0.85rem", color: "var(--text-main)" }}>
                  {formatDateTime(activeBug.created_at).date} at {formatDateTime(activeBug.created_at).time}
                  {formatDateTime(activeBug.created_at).relative && (
                    <span style={{ marginLeft: "0.5rem", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                      ({formatDateTime(activeBug.created_at).relative})
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Linked Sheet Option */}
            {activeBug.sheet_url && (
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                  Linked Cloud Sheet / Workbook
                </span>
                <div style={{ marginTop: "0.35rem" }}>
                  <a
                    href={activeBug.sheet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.45rem",
                      color: "#10b981",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      textDecoration: "none",
                      background: "rgba(16, 185, 129, 0.1)",
                      padding: "0.45rem 0.85rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                    }}
                  >
                    <Icon name="sheet" size={15} color="#10b981" />
                    <span>Open Linked Google Sheet / Test Matrix</span>
                    <Icon name="externalLink" size={12} color="#10b981" />
                  </a>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                {activeBug.category === "requirement_change" ? "Specification Details" : "Reproduction Steps & Description"}
              </span>
              <div
                style={{
                  marginTop: "0.4rem",
                  padding: "1rem",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-surface-elevated)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "0.875rem",
                  lineHeight: 1.6,
                  color: "var(--text-main)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: "260px",
                  overflowY: "auto",
                }}
              >
                {activeBug.description || "No description provided."}
              </div>
            </div>

            {/* Status Change Buttons */}
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>
                Transition QA Status
              </span>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {STATUSES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`btn btn-sm ${activeBug.status === s.key ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => handleStatusChange(activeBug.id, s.key)}
                    style={{
                      borderColor: activeBug.status === s.key ? undefined : s.color,
                      fontSize: "0.775rem",
                    }}
                  >
                    {activeBug.status === s.key && <Icon name="check" size={12} />}
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.75rem", borderTop: "1px solid var(--border-subtle)" }}>
              <div>
                {(role === "manager" || (currentUserId && activeBug.reported_by === currentUserId)) && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const b = activeBug;
                      setActiveBug(null);
                      setDeleteCandidate(b);
                    }}
                    style={{ color: "#f43f5e", borderColor: "rgba(244, 63, 94, 0.3)" }}
                  >
                    <Icon name="trash" size={13} />
                    <span>Delete Defect</span>
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const b = activeBug;
                    setActiveBug(null);
                    openEditModal(b);
                  }}
                >
                  <Icon name="edit" size={13} />
                  <span>Edit</span>
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveBug(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal 4: Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteCandidate)}
        onClose={() => !deleting && setDeleteCandidate(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Defect Ticket"
        message={`Are you sure you want to permanently delete defect ticket #${deleteCandidate?.id}?`}
        itemName={deleteCandidate?.title}
        note="This action cannot be undone. Defect metrics and retest logs will be updated."
        confirmText="Yes, Delete Ticket"
        loading={deleting}
      />
    </div>
  );
}
