import React, { useEffect, useState, useRef } from "react";
import { Icon } from "../common/Icons";
import { Modal } from "../common/Modal";
import { ContributionHeatmap } from "../activity/ContributionHeatmap";
import {
  getActivityPulse,
  getRecentActivities,
  getTeamActivityOverview,
} from "../../services/activityService";
import { getTesters } from "../../services/teamService";
import "../activity/activity.css";

function formatTimeAgo(dateString) {
  if (!dateString) return "Never";
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
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export function ActivityTracker({ role = "tester" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("pulse"); // "pulse" | "team" | "feed"
  const [loading, setLoading] = useState(false);

  // Pulse & Heatmap state
  const [pulseData, setPulseData] = useState(null);
  const [selectedTesterId, setSelectedTesterId] = useState("");
  const [daysPeriod, setDaysPeriod] = useState(365);
  const [testersList, setTestersList] = useState([]);

  // Team Overview state (manager)
  const [teamOverview, setTeamOverview] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Recent Feed state
  const [recentActivities, setRecentActivities] = useState([]);
  const [feedFilter, setFeedFilter] = useState("all");
  const [loadingFeed, setLoadingFeed] = useState(false);

  // Quick streak badge on topbar icon
  const [myStreak, setMyStreak] = useState(0);

  // Load basic streak on mount
  useEffect(() => {
    let isMounted = true;
    getActivityPulse(null, 30)
      .then((data) => {
        if (isMounted && data?.summary) {
          setMyStreak(data.summary.current_streak || 0);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // When modal opens or filters change, load the active tab's data safely with cancellation guard
  useEffect(() => {
    if (!isOpen) return;
    let isCurrent = true;

    if (role === "manager" && testersList.length === 0) {
      getTesters()
        .then((data) => {
          if (isCurrent && Array.isArray(data)) setTestersList(data);
        })
        .catch(() => {});
    }

    if (activeTab === "pulse") {
      setLoading(true);
      const targetId = selectedTesterId ? Number(selectedTesterId) : null;
      getActivityPulse(targetId, daysPeriod)
        .then((data) => {
          if (isCurrent) setPulseData(data);
        })
        .catch(() => {})
        .finally(() => {
          if (isCurrent) setLoading(false);
        });
    } else if (activeTab === "team" && role === "manager") {
      setLoadingTeam(true);
      getTeamActivityOverview()
        .then((data) => {
          if (isCurrent) setTeamOverview(Array.isArray(data) ? data : []);
        })
        .catch(() => {})
        .finally(() => {
          if (isCurrent) setLoadingTeam(false);
        });
    } else if (activeTab === "feed") {
      setLoadingFeed(true);
      const targetId = selectedTesterId ? Number(selectedTesterId) : null;
      getRecentActivities(targetId, 80)
        .then((data) => {
          if (isCurrent) setRecentActivities(Array.isArray(data) ? data : []);
        })
        .catch(() => {})
        .finally(() => {
          if (isCurrent) setLoadingFeed(false);
        });
    }

    return () => {
      isCurrent = false;
    };
  }, [isOpen, activeTab, selectedTesterId, daysPeriod, role]);

  const handleInspectTester = (testerId) => {
    setSelectedTesterId(String(testerId));
    setActiveTab("pulse");
  };

  // Filter feed activities
  const filteredFeed = recentActivities.filter((act) => {
    if (feedFilter === "all") return true;
    if (feedFilter === "bugs") return act.action_type === "bug_reported";
    if (feedFilter === "status")
      return act.action_type === "bug_status_updated" || act.action_type === "bug_updated";
    if (feedFilter === "progress") return act.action_type === "progress_submitted";
    if (feedFilter === "login") return act.action_type === "session_login";
    return true;
  });

  return (
    <>
      <button
        className={`activity-bell-btn ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen(true)}
        aria-label="View testing activity pulse"
        title="Testing Activity Pulse & Contribution Heatmap"
      >
        <Icon name="activity" size={18} />
        {myStreak > 0 && (
          <span className="activity-streak-pill" title={`🔥 Current streak: ${myStreak} day${myStreak === 1 ? "" : "s"}`}>
            🔥{myStreak}
          </span>
        )}
      </button>

      {isOpen && (
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Testing Pulse & Contribution Matrix"
          maxWidth="980px"
          footer={
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {role === "manager"
                  ? "Track tester presence, daily QA activity, and verified contributions."
                  : "Your daily QA testing streak and contribution record."}
              </span>
              <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(false)}>
                Close
              </button>
            </div>
          }
        >
          <div className="activity-modal-content">
            {/* Tabs Header */}
            <div className="activity-modal-tabs">
              <button
                className={`activity-tab-btn ${activeTab === "pulse" ? "active" : ""}`}
                onClick={() => setActiveTab("pulse")}
              >
                <Icon name="activity" size={15} />
                <span>Contribution Pulse & Heatmap</span>
              </button>

              {role === "manager" && (
                <button
                  className={`activity-tab-btn ${activeTab === "team" ? "active" : ""}`}
                  onClick={() => setActiveTab("team")}
                >
                  <Icon name="team" size={15} />
                  <span>Team Work Oversight</span>
                </button>
              )}

              <button
                className={`activity-tab-btn ${activeTab === "feed" ? "active" : ""}`}
                onClick={() => setActiveTab("feed")}
              >
                <Icon name="list" size={15} />
                <span>Recent Activity Feed</span>
              </button>
            </div>

            {/* TAB 1: PULSE & HEATMAP */}
            {activeTab === "pulse" && (
              <>
                {/* Manager Selector / Filter Bar */}
                {role === "manager" && (
                  <div className="activity-filter-bar">
                    <div className="activity-selector-wrap">
                      <label style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        Inspect Tester:
                      </label>
                      <select
                        className="activity-select-input"
                        value={selectedTesterId}
                        onChange={(e) => setSelectedTesterId(e.target.value)}
                      >
                        <option value="">All Testers (Team Aggregate)</option>
                        {testersList.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="activity-selector-wrap">
                      <label style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        Period:
                      </label>
                      <select
                        className="activity-select-input"
                        value={daysPeriod}
                        onChange={(e) => setDaysPeriod(Number(e.target.value))}
                      >
                        <option value={365}>Last 1 Year (365 Days)</option>
                        <option value={180}>Last 6 Months (180 Days)</option>
                        <option value={90}>Last 3 Months (90 Days)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Metrics Summary Grid */}
                {pulseData?.summary && (
                  <div className="activity-metrics-grid">
                    <div className="activity-stat-card">
                      <span className="activity-stat-value">
                        {pulseData.summary.total_contributions}
                      </span>
                      <span className="activity-stat-label">Total Contributions</span>
                    </div>

                    <div className="activity-stat-card">
                      <span className="activity-stat-value" style={{ color: "#f59e0b" }}>
                        🔥 {pulseData.summary.current_streak} {pulseData.summary.current_streak === 1 ? "Day" : "Days"}
                      </span>
                      <span className="activity-stat-label">Active Streak</span>
                    </div>

                    <div className="activity-stat-card">
                      <span className="activity-stat-value">
                        {pulseData.summary.longest_streak} Days
                      </span>
                      <span className="activity-stat-label">Longest Streak</span>
                    </div>

                    <div className="activity-stat-card">
                      <span className="activity-stat-value" style={{ color: "#f43f5e" }}>
                        {pulseData.summary.bugs_reported}
                      </span>
                      <span className="activity-stat-label">Defects Logged</span>
                    </div>

                    <div className="activity-stat-card">
                      <span className="activity-stat-value" style={{ color: "#06b6d4" }}>
                        {pulseData.summary.status_updates}
                      </span>
                      <span className="activity-stat-label">Retested / Updated</span>
                    </div>

                    <div className="activity-stat-card">
                      <span className="activity-stat-value" style={{ color: "#10b981" }}>
                        {pulseData.summary.progress_updates}
                      </span>
                      <span className="activity-stat-label">Progress Updates</span>
                    </div>
                  </div>
                )}

                {/* Contribution Heatmap Grid */}
                {loading ? (
                  <div className="notification-empty-state">
                    <Icon name="refresh" size={24} className="spinning" />
                    <h5>Loading contribution heatmap...</h5>
                  </div>
                ) : (
                  <ContributionHeatmap
                    heatmapData={pulseData?.heatmap || []}
                    totalContributions={pulseData?.summary?.total_contributions || 0}
                    periodLabel={daysPeriod === 365 ? "the last year" : `the last ${daysPeriod} days`}
                  />
                )}
              </>
            )}

            {/* TAB 2: TEAM OVERVIEW (MANAGER ONLY) */}
            {activeTab === "team" && role === "manager" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                  Real-time status of all testers, whether they performed any QA work today, their current streaks, and recent actions.
                </p>

                {loadingTeam ? (
                  <div className="notification-empty-state">
                    <Icon name="refresh" size={24} className="spinning" />
                    <h5>Loading team activity overview...</h5>
                  </div>
                ) : teamOverview.length === 0 ? (
                  <div className="notification-empty-state">
                    <Icon name="team" size={24} />
                    <h5>No testers registered in team</h5>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="team-activity-table">
                      <thead>
                        <tr>
                          <th>Tester Name</th>
                          <th>Today's Status</th>
                          <th>Streak</th>
                          <th>Year Actions</th>
                          <th>Last Active</th>
                          <th>Recent Action</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamOverview.map((tester) => (
                          <tr key={tester.id}>
                            <td>
                              <div className="tester-name-cell">
                                <span
                                  className={`tester-status-dot ${tester.active_today ? "active" : "inactive"}`}
                                  title={tester.active_today ? "Active today" : "No activity today yet"}
                                />
                                <div>
                                  <strong>{tester.name}</strong>
                                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                    {tester.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              {tester.active_today ? (
                                <span style={{ color: "#10b981", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                                  <Icon name="check" size={13} color="#10b981" />
                                  Active Today
                                </span>
                              ) : (
                                <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                                  No work yet
                                </span>
                              )}
                            </td>
                            <td>
                              <span style={{ color: tester.current_streak > 0 ? "#f59e0b" : "var(--text-muted)", fontWeight: 600 }}>
                                {tester.current_streak > 0 ? `🔥 ${tester.current_streak}d` : "0d"}
                              </span>
                            </td>
                            <td>
                              <strong>{tester.total_contributions_year}</strong>
                            </td>
                            <td style={{ fontSize: "0.78rem" }}>
                              {formatTimeAgo(tester.last_active_at)}
                            </td>
                            <td style={{ fontSize: "0.78rem", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tester.recent_action}>
                              {tester.recent_action}
                            </td>
                            <td>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleInspectTester(tester.id)}
                                style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                              >
                                <Icon name="eye" size={12} />
                                <span>Heatmap</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: RECENT ACTIVITY FEED */}
            {activeTab === "feed" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {/* Filter Chips */}
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {[
                    { id: "all", label: "All Actions" },
                    { id: "bugs", label: "🐞 Defects Logged" },
                    { id: "status", label: "🔄 Retests & Status" },
                    { id: "progress", label: "📋 Progress Updates" },
                    { id: "login", label: "🔑 Sessions" },
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      onClick={() => setFeedFilter(chip.id)}
                      className={`btn btn-sm ${feedFilter === chip.id ? "btn-primary" : "btn-secondary"}`}
                      style={{ padding: "0.22rem 0.6rem", fontSize: "0.75rem" }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {loadingFeed ? (
                  <div className="notification-empty-state">
                    <Icon name="refresh" size={24} className="spinning" />
                    <h5>Loading recent activity stream...</h5>
                  </div>
                ) : filteredFeed.length === 0 ? (
                  <div className="notification-empty-state">
                    <Icon name="activity" size={24} />
                    <h5>No activity entries found</h5>
                    <p>Actions will appear here as tests are executed and defects are reported.</p>
                  </div>
                ) : (
                  <div className="activity-feed-list">
                    {filteredFeed.map((item) => (
                      <div key={item.id} className="activity-feed-item">
                        <div className={`activity-item-icon ${item.action_type}`}>
                          <Icon
                            name={
                              item.action_type === "bug_reported"
                                ? "bugs"
                                : item.action_type === "progress_submitted"
                                ? "progress"
                                : item.action_type === "session_login"
                                ? "shield"
                                : "checkCheck"
                            }
                            size={16}
                          />
                        </div>

                        <div className="activity-feed-content">
                          <div className="activity-feed-top">
                            <span className="activity-feed-title">{item.title}</span>
                            <span className="activity-feed-time">
                              {formatTimeAgo(item.created_at)}
                            </span>
                          </div>

                          {item.description && (
                            <p className="activity-feed-desc">{item.description}</p>
                          )}

                          <div className="activity-feed-user-tag">
                            <span>By: <strong>{item.user_name || "QA Tester"}</strong></span>
                            {item.project_name && <span>• Project: {item.project_name}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
