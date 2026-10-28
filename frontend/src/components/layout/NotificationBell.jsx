import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../../services/notificationService";
import { getTesterProjects } from "../../services/testerService";
import { getProjects } from "../../services/projectService";
import { Icon } from "../common/Icons";
import { Modal } from "../common/Modal";
import { StatusBadge } from "../common/Badge";
import { useToast } from "../../context/ToastContext";
import "./notification.css";

function formatTimeAgo(dateString) {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);

    if (diffSeconds < 60) return "Just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function NotificationBell({ role = "tester" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [isAllProjectsOpen, setIsAllProjectsOpen] = useState(false);
  const [allProjects, setAllProjects] = useState([]);
  const [loadingAllProjects, setLoadingAllProjects] = useState(false);

  const containerRef = useRef(null);
  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleOpenAllProjects = async () => {
    setIsOpen(false);
    setIsAllProjectsOpen(true);
    try {
      setLoadingAllProjects(true);
      const data = role === "manager" ? await getProjects() : await getTesterProjects();
      setAllProjects(Array.isArray(data) ? data : []);
    } catch {
      // Fallback from notification items
      const map = new Map();
      notifications.forEach((n) => {
        if (!map.has(n.project_id)) {
          map.set(n.project_id, {
            id: n.project_id,
            name: n.project_name || n.title,
            description: n.project_description,
            status: n.project_status || "active",
            start_date: n.start_date,
            end_date: n.end_date,
            excel_sheet_url: n.excel_sheet_url,
            open_bugs: n.open_bugs,
            need_retest_bugs: n.need_retest_bugs,
            retested_bugs: n.retested_bugs,
            closed_bugs: n.closed_bugs,
            fixed_bugs: n.fixed_bugs,
            critical_bugs: n.critical_bugs,
          });
        }
      });
      setAllProjects(Array.from(map.values()));
    } finally {
      setLoadingAllProjects(false);
    }
  };

  // Load unread count
  const fetchUnreadCount = async () => {
    try {
      const data = await getUnreadCount();
      if (typeof data?.unread_count === "number") {
        setUnreadCount(data.unread_count);
      }
    } catch (err) {
      // Silently fail for polling
    }
  };

  // Load full notification list
  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await getNotifications();
      if (Array.isArray(data)) {
        setNotifications(data);
        const unread = data.filter((n) => !n.is_read).length;
        setUnreadCount(unread);
      }
    } catch {
      // Ignore background error
    } finally {
      setLoading(false);
    }
  };

  // Poll for new notifications every 8 seconds only when tab is active/visible
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchUnreadCount();
      }
    }, 8000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchUnreadCount();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // When dropdown is opened, load latest notifications
  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle Mark Single Notification As Read
  const handleMarkAsRead = async (notificationId, e) => {
    if (e) e.stopPropagation();
    try {
      await markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      addToast("Notification marked as read.", "info");
    } catch {
      addToast("Failed to update notification.", "error");
    }
  };

  // Handle Mark All As Read
  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      addToast("All notifications marked as read.", "success");
    } catch {
      addToast("Failed to mark all as read.", "error");
    }
  };

  // Handle clicking "Review Task"
  const handleReviewTask = async (notification) => {
    setSelectedNotification(notification);
    setIsOpen(false);

    // If unread, mark it as read automatically upon opening review
    if (!notification.is_read) {
      try {
        await markNotificationAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
        );
        setSelectedNotification({ ...notification, is_read: true });
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Silently continue
      }
    }
  };

  // Open Project in workspace from review modal
  const handleOpenWorkspace = () => {
    const targetPath = role === "tester" ? "/tester/projects" : "/manager/projects";
    setSelectedNotification(null);
    navigate(targetPath);
  };

  return (
    <>
      <div className="notification-bell-container" ref={containerRef}>
        <button
          className={`notification-bell-btn ${isOpen ? "active" : ""}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label="View notifications"
          title={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
        >
          <Icon name="bell" size={18} />
          {unreadCount > 0 && (
            <span className="notification-badge">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="notification-popover" role="region" aria-label="Notifications list">
            {/* Popover Header */}
            <div className="notification-popover-header">
              <div className="notification-header-title">
                <Icon name="bell" size={16} color="var(--primary)" />
                <h4>{role === "manager" ? "Team Notifications" : "Task Notifications"}</h4>
                {unreadCount > 0 && (
                  <span className="unread-count-pill">{unreadCount} new</span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  className="mark-all-read-btn"
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                >
                  <Icon name="checkCheck" size={14} />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* Popover Body List */}
            <div className="notification-popover-body">
              {loading && notifications.length === 0 ? (
                <div className="notification-empty-state">
                  <div className="empty-state-icon">
                    <Icon name="refresh" size={20} className="spinning" />
                  </div>
                  <h5>Loading notifications...</h5>
                </div>
              ) : notifications.length === 0 ? (
                <div className="notification-empty-state">
                  <div className="empty-state-icon">
                    <Icon name="check" size={22} color="var(--success)" />
                  </div>
                  <h5>All caught up!</h5>
                  <p>
                    {role === "manager"
                      ? "When a tester submits a progress update or reports a critical bug, you will be notified here."
                      : "When a manager assigns a new project or task, you will be notified here."}
                  </p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`notification-item-card ${!n.is_read ? "unread" : ""}`}
                  >
                    <div className="notification-item-top">
                      <div className="notification-icon-title-wrap">
                        <div
                          className="notification-type-icon"
                          style={{
                            background:
                              n.type === "critical_bug"
                                ? "rgba(244, 63, 94, 0.15)"
                                : n.type === "progress_update"
                                ? "rgba(6, 182, 212, 0.15)"
                                : undefined,
                          }}
                        >
                          <Icon
                            name={
                              n.type === "critical_bug"
                                ? "alert"
                                : n.type === "progress_update"
                                ? "progress"
                                : "assignment"
                            }
                            size={15}
                            color={
                              n.type === "critical_bug"
                                ? "#f43f5e"
                                : n.type === "progress_update"
                                ? "#06b6d4"
                                : undefined
                            }
                          />
                        </div>
                        <div className="notification-title-block">
                          <span className="notification-title-text">
                            {n.title || (n.project_name ? `Project: ${n.project_name}` : "Notification")}
                          </span>
                          <span className="notification-meta-time">
                            <Icon name="clock" size={11} />
                            <span>{formatTimeAgo(n.created_at)}</span>
                          </span>
                        </div>
                      </div>

                      {!n.is_read && <div className="notification-unread-dot" title="Unread" />}
                    </div>

                    <p className="notification-message-text">{n.message}</p>

                    <div className="notification-item-footer">
                      <div className="notification-project-tag">
                        Status: {n.project_status ? n.project_status.toUpperCase() : "ACTIVE"}
                      </div>

                      <div className="notification-actions-row">
                        {!n.is_read && (
                          <button
                            className="mark-read-quick-btn"
                            onClick={(e) => handleMarkAsRead(n.id, e)}
                            title="Mark as read"
                          >
                            <Icon name="check" size={14} />
                          </button>
                        )}
                        <button
                          className="review-task-btn"
                          onClick={() => handleReviewTask(n)}
                        >
                          <Icon name="eye" size={13} />
                          <span>
                            {n.type === "critical_bug"
                              ? "Review Bug"
                              : n.type === "progress_update"
                              ? "Review Update"
                              : "Review Task"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Popover Footer */}
            <div className="notification-popover-footer">
              <button
                className="view-all-projects-link"
                style={{ background: "none", border: "none", cursor: "pointer" }}
                onClick={handleOpenAllProjects}
              >
                <Icon name="list" size={14} />
                <span>{role === "manager" ? "View all projects" : "View all assigned projects"}</span>
                <Icon name="arrowRight" size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Assigned Task / Project Modal */}
      {selectedNotification && (
        <Modal
          isOpen={Boolean(selectedNotification)}
          onClose={() => setSelectedNotification(null)}
          title={
            selectedNotification.type === "critical_bug"
              ? `Critical Defect Alert: ${selectedNotification.project_name || "Project Details"}`
              : selectedNotification.type === "progress_update"
              ? `Progress Update: ${selectedNotification.project_name || "Project Details"}`
              : `Review Assigned Task: ${selectedNotification.project_name || "Project Details"}`
          }
          maxWidth="640px"
          footer={
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="review-info-label">
                  {selectedNotification.type === "critical_bug"
                    ? "Reported:"
                    : selectedNotification.type === "progress_update"
                    ? "Submitted:"
                    : "Assigned:"}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {formatTimeAgo(selectedNotification.created_at)}
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedNotification(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleOpenWorkspace}
                >
                  <Icon name="projects" size={16} />
                  <span>Go to Project Workspace</span>
                </button>
              </div>
            </div>
          }
        >
          <div className="review-modal-box">
            {/* Banner Alert */}
            <div
              className="review-banner-alert"
              style={
                selectedNotification.type === "critical_bug"
                  ? { borderColor: "rgba(244, 63, 94, 0.4)", background: "rgba(244, 63, 94, 0.08)" }
                  : selectedNotification.type === "progress_update"
                  ? { borderColor: "rgba(6, 182, 212, 0.4)", background: "rgba(6, 182, 212, 0.08)" }
                  : {}
              }
            >
              <div className="icon-wrapper">
                <Icon
                  name={
                    selectedNotification.type === "critical_bug"
                      ? "alert"
                      : selectedNotification.type === "progress_update"
                      ? "progress"
                      : "assignment"
                  }
                  size={18}
                  color={
                    selectedNotification.type === "critical_bug"
                      ? "#f43f5e"
                      : selectedNotification.type === "progress_update"
                      ? "#06b6d4"
                      : undefined
                  }
                />
              </div>
              <div>
                <strong>
                  {selectedNotification.type === "critical_bug"
                    ? "Critical Defect Alert"
                    : selectedNotification.type === "progress_update"
                    ? "Tester Progress Submission"
                    : "Newly Assigned Project Task"}
                </strong>
                <p style={{ margin: "0.2rem 0 0 0", color: "var(--text-secondary)" }}>
                  {selectedNotification.message || "Review project scope, spreadsheet URL, and current bug tally."}
                </p>
              </div>
            </div>

            {/* Project Overview Card */}
            <div className="review-section-card">
              <div className="review-section-header">
                <span className="review-section-title">Project Scope</span>
                <StatusBadge status={selectedNotification.project_status || "active"} />
              </div>
              <div className="review-project-name">{selectedNotification.project_name}</div>
              <p className="review-project-desc">
                {selectedNotification.project_description || "No specific project description was provided. Proceed with standard QA regression and functional testing cycles."}
              </p>
            </div>

            {/* Timeline & Metadata Grid */}
            <div className="review-grid-2col">
              <div className="review-section-card">
                <span className="review-section-title">Testing Timeline</span>
                <div className="review-info-item">
                  <span className="review-info-label">Start Date:</span>
                  <span className="review-info-value">
                    <Icon name="calendar" size={14} color="var(--primary)" />
                    {selectedNotification.start_date ? selectedNotification.start_date : "Flexible / ASAP"}
                  </span>
                </div>
                <div className="review-info-item">
                  <span className="review-info-label">Target Completion:</span>
                  <span className="review-info-value">
                    <Icon name="calendar" size={14} color="var(--warning)" />
                    {selectedNotification.end_date ? selectedNotification.end_date : "Ongoing / Open-ended"}
                  </span>
                </div>
              </div>

              <div className="review-section-card">
                <span className="review-section-title">Assignment Status</span>
                <div className="review-info-item">
                  <span className="review-info-label">Review Status:</span>
                  <span className="review-info-value" style={{ color: "var(--success)" }}>
                    <Icon name="check" size={14} color="var(--success)" />
                    Reviewed & Acknowledged
                  </span>
                </div>
                <div className="review-info-item">
                  <span className="review-info-label">Assignment Type:</span>
                  <span className="review-info-value">
                    <Icon name="shield" size={14} color="var(--accent-cyan)" />
                    QA Lead / Tester
                  </span>
                </div>
              </div>
            </div>

            {/* Live Testing Sheet Link */}
            <div className="review-section-card">
              <div className="review-section-header">
                <span className="review-section-title">Google Sheets / Excel URL</span>
                {selectedNotification.excel_sheet_url && (
                  <a
                    href={selectedNotification.excel_sheet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ padding: "0.25rem 0.65rem", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                  >
                    <span>Open Sheet</span>
                    <Icon name="externalLink" size={13} />
                  </a>
                )}
              </div>

              {selectedNotification.excel_sheet_url ? (
                <div className="sheet-link-box">
                  <span className="sheet-url-text">{selectedNotification.excel_sheet_url}</span>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-faint)", fontStyle: "italic" }}>
                  No external spreadsheet linked yet. You can attach sheets in the project details.
                </p>
              )}
            </div>

            {/* Bug Metrics Tally */}
            <div className="review-section-card">
              <span className="review-section-title">Current Defect Metrics</span>
              <div className="metrics-mini-tally">
                <div className="tally-metric-chip">
                  <span className="tally-metric-num" style={{ color: "#f43f5e" }}>
                    {selectedNotification.open_bugs || 0}
                  </span>
                  <span className="tally-metric-label">Open</span>
                </div>
                <div className="tally-metric-chip">
                  <span className="tally-metric-num" style={{ color: "#f59e0b" }}>
                    {selectedNotification.need_retest_bugs || 0}
                  </span>
                  <span className="tally-metric-label">Need Retest</span>
                </div>
                <div className="tally-metric-chip">
                  <span className="tally-metric-num" style={{ color: "#06b6d4" }}>
                    {selectedNotification.retested_bugs || 0}
                  </span>
                  <span className="tally-metric-label">Retested</span>
                </div>
                <div className="tally-metric-chip">
                  <span className="tally-metric-num" style={{ color: "#10b981" }}>
                    {selectedNotification.closed_bugs || selectedNotification.fixed_bugs || 0}
                  </span>
                  <span className="tally-metric-label">Closed</span>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: All Assigned Projects Simple List */}
      {isAllProjectsOpen && (
        <Modal
          isOpen={isAllProjectsOpen}
          onClose={() => setIsAllProjectsOpen(false)}
          title={role === "manager" ? "All Projects" : "All Assigned Projects"}
          maxWidth="720px"
          footer={
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Total <strong>{allProjects.length}</strong> {role === "manager" ? "project" : "assigned project"}{allProjects.length === 1 ? "" : "s"}
              </span>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAllProjectsOpen(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setIsAllProjectsOpen(false);
                    navigate(role === "tester" ? "/tester/projects" : "/manager/projects");
                  }}
                >
                  <Icon name="projects" size={15} />
                  <span>Open Projects Workspace</span>
                </button>
              </div>
            </div>
          }
        >
          {loadingAllProjects ? (
            <div className="notification-empty-state">
              <div className="empty-state-icon">
                <Icon name="refresh" size={20} className="spinning" />
              </div>
              <h5>Loading all assigned projects...</h5>
            </div>
          ) : allProjects.length === 0 ? (
            <div className="notification-empty-state">
              <div className="empty-state-icon">
                <Icon name="projects" size={24} />
              </div>
              <h5>No assigned projects found</h5>
              <p>You have not been assigned to any testing scopes yet.</p>
            </div>
          ) : (
            <div className="all-projects-simple-list">
              {allProjects.map((p) => (
                <div key={p.id} className="all-projects-list-item">
                  <div className="list-item-left">
                    <div className="table-project-icon">
                      <Icon name="projects" size={16} />
                    </div>
                    <div className="list-item-info">
                      <div className="list-item-title-row">
                        <span className="list-item-name">{p.name}</span>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-faint)",
                            background: "var(--bg-base)",
                            padding: "0.1rem 0.35rem",
                            borderRadius: "var(--radius-sm)",
                          }}
                        >
                          #{p.id}
                        </span>
                        <StatusBadge status={p.status || "active"} />
                      </div>
                      <p className="list-item-desc">
                        {p.description || "No project description provided."}
                      </p>
                      <div className="list-item-meta">
                        <span>
                          <Icon name="calendar" size={12} color="var(--primary)" />{" "}
                          {p.start_date ? p.start_date : "Flexible"} → {p.end_date ? p.end_date : "Open"}
                        </span>
                        <span>
                          <Icon name="bugs" size={12} color="var(--danger)" /> {p.open_bugs || 0} Open •{" "}
                          {p.need_retest_bugs || 0} Retest • {p.closed_bugs || p.fixed_bugs || 0} Closed
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="list-item-right">
                    {p.excel_sheet_url && (
                      <a
                        href={p.excel_sheet_url}
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
                          gap: "0.25rem",
                          textDecoration: "none",
                        }}
                        title="Open Test Sheet"
                      >
                        <span>Sheet</span>
                        <Icon name="externalLink" size={11} color="#10b981" />
                      </a>
                    )}
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setIsAllProjectsOpen(false);
                        setSelectedNotification({
                          id: p.id,
                          project_id: p.id,
                          project_name: p.name,
                          project_description: p.description,
                          project_status: p.status,
                          start_date: p.start_date,
                          end_date: p.end_date,
                          excel_sheet_url: p.excel_sheet_url,
                          open_bugs: p.open_bugs,
                          need_retest_bugs: p.need_retest_bugs,
                          retested_bugs: p.retested_bugs,
                          closed_bugs: p.closed_bugs,
                          fixed_bugs: p.fixed_bugs,
                          critical_bugs: p.critical_bugs,
                          created_at: new Date().toISOString(),
                          message: `Assigned testing project: ${p.name}`,
                          is_read: true,
                        });
                      }}
                      style={{
                        padding: "0.28rem 0.55rem",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title="Review Project Details"
                      aria-label="Review Project Details"
                    >
                      <Icon name="eye" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
