import React, { useMemo, useState, useEffect } from "react";
import { Icon } from "../common/Icons";
import { Modal } from "../common/Modal";
import "./activity.css";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = [
  { index: 1, label: "Mon" },
  { index: 3, label: "Wed" },
  { index: 5, label: "Fri" },
];

export function ContributionHeatmap({ heatmapData = [], totalContributions = 0, periodLabel = "the last year" }) {
  const [hoveredDay, setHoveredDay] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Organize days into 7x53 grid (weeks)
  const { weeks, monthLabels } = useMemo(() => {
    if (!heatmapData || heatmapData.length === 0) {
      return { weeks: [], monthLabels: [] };
    }

    const weeksList = [];
    let currentWeek = new Array(7).fill(null);

    // Map each day by Date
    heatmapData.forEach((dayItem) => {
      // Parse YYYY-MM-DD
      const [y, m, d] = dayItem.date.split("-").map(Number);
      const dayDate = new Date(y, m - 1, d);
      const dayOfWeek = dayDate.getDay(); // 0 is Sunday, 6 is Saturday

      // If Sunday and currentWeek has items, push previous week and start new
      if (dayOfWeek === 0 && currentWeek.some((cell) => cell !== null)) {
        weeksList.push(currentWeek);
        currentWeek = new Array(7).fill(null);
      }

      currentWeek[dayOfWeek] = {
        ...dayItem,
        dayOfWeek,
        dateObj: dayDate,
      };
    });

    if (currentWeek.some((cell) => cell !== null)) {
      weeksList.push(currentWeek);
    }

    // Determine month label positions along columns
    const labels = [];
    let lastMonth = -1;

    weeksList.forEach((week, colIdx) => {
      // Find the first valid day in this week
      const firstValidDay = week.find((cell) => cell !== null);
      if (firstValidDay) {
        const m = firstValidDay.dateObj.getMonth();
        // If this week starts a new month and column has enough spacing
        if (m !== lastMonth) {
          labels.push({
            monthIndex: m,
            name: MONTH_NAMES[m],
            colIndex: colIdx,
          });
          lastMonth = m;
        }
      }
    });

    return { weeks: weeksList, monthLabels: labels };
  }, [heatmapData]);

  const handleMouseEnter = (day, e) => {
    if (!day) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredDay(day);
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
  };

  // Auto-hide floating tooltip on any scroll event
  useEffect(() => {
    if (!hoveredDay) return;
    const hideTooltip = () => setHoveredDay(null);
    window.addEventListener("scroll", hideTooltip, true);
    return () => window.removeEventListener("scroll", hideTooltip, true);
  }, [hoveredDay]);

  const formatDateDisplay = (dateStr) => {
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="activity-heatmap-wrapper">
      {/* Heatmap Header */}
      <div className="activity-heatmap-header">
        <div className="activity-total-tally">
          <span className="total-num">{totalContributions}</span>
          <span className="total-label">QA contributions in {periodLabel}</span>
        </div>

        <div className="activity-rules-hint" title="QA contributions include logged bugs, verified retests, and submitted sprint progress.">
          <span>Testing Contribution Activity</span>
        </div>
      </div>

      {/* Grid Container (Scrollable on small screens) */}
      <div className="activity-calendar-scroll">
        <div className="activity-calendar-grid">
          {/* Month labels row */}
          <div className="calendar-month-row">
            <div className="day-axis-spacer" />
            <div className="month-axis-cols">
              {monthLabels.map((lbl, idx) => (
                <span
                  key={`${lbl.name}-${idx}`}
                  className="calendar-month-label"
                  style={{ left: `${lbl.colIndex * 15}px` }}
                >
                  {lbl.name}
                </span>
              ))}
            </div>
          </div>

          {/* Calendar Body: Day labels on left, 7xN cells on right */}
          <div className="calendar-body-row">
            {/* Day of week labels (Mon, Wed, Fri) */}
            <div className="calendar-day-labels">
              <span className="day-axis-label" style={{ top: "0px" }}>Sun</span>
              <span className="day-axis-label" style={{ top: "15px" }}>Mon</span>
              <span className="day-axis-label" style={{ top: "30px" }}>Tue</span>
              <span className="day-axis-label" style={{ top: "45px" }}>Wed</span>
              <span className="day-axis-label" style={{ top: "60px" }}>Thu</span>
              <span className="day-axis-label" style={{ top: "75px" }}>Fri</span>
              <span className="day-axis-label" style={{ top: "90px" }}>Sat</span>
            </div>

            {/* Heatmap Weeks Columns */}
            <div className="calendar-weeks-columns">
              {weeks.map((week, colIdx) => (
                <div key={colIdx} className="calendar-week-col">
                  {week.map((cell, rowIdx) => {
                    if (!cell) {
                      return <div key={rowIdx} className="calendar-cell empty-placeholder" />;
                    }
                    return (
                      <div
                        key={cell.date}
                        className={`calendar-cell level-${cell.level}`}
                        onMouseEnter={(e) => handleMouseEnter(cell, e)}
                        onMouseLeave={handleMouseLeave}
                        aria-label={`${cell.count} QA contributions on ${cell.date}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Legend */}
      <div className="activity-heatmap-footer">
        <div className="activity-legend-explain">
          <button
            type="button"
            className="activity-learn-link-btn"
            onClick={() => setIsGuideOpen(true)}
            title="Click to learn how QA actions, color levels, and streaks are counted"
          >
            <Icon name="activity" size={13} color="#10b981" />
            <span>Learn how QA actions are counted</span>
          </button>
        </div>

        <div className="activity-legend-scale">
          <span className="legend-label">Less</span>
          <div className="calendar-cell level-0" title="0 contributions" />
          <div className="calendar-cell level-1" title="1-2 contributions" />
          <div className="calendar-cell level-2" title="3-5 contributions" />
          <div className="calendar-cell level-3" title="6-9 contributions" />
          <div className="calendar-cell level-4" title="10+ contributions" />
          <span className="legend-label">More</span>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredDay && (
        <div
          className="calendar-tooltip"
          style={{
            position: "fixed",
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
            zIndex: 9999,
          }}
        >
          <div className="tooltip-title">
            <strong>{hoveredDay.count} QA contribution{hoveredDay.count === 1 ? "" : "s"}</strong>
          </div>
          <div className="tooltip-date">{formatDateDisplay(hoveredDay.date)}</div>
          {hoveredDay.count > 0 && (
            <div className="tooltip-breakdown">
              {hoveredDay.bugs_count > 0 && (
                <span className="chip-bug">🐞 {hoveredDay.bugs_count} defect{hoveredDay.bugs_count === 1 ? "" : "s"}</span>
              )}
              {hoveredDay.status_count > 0 && (
                <span className="chip-status">🔄 {hoveredDay.status_count} retest/status</span>
              )}
              {hoveredDay.progress_count > 0 && (
                <span className="chip-progress">📋 {hoveredDay.progress_count} progress</span>
              )}
              {hoveredDay.login_count > 0 && (
                <span className="chip-login">🔑 {hoveredDay.login_count} session</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Learn How QA Actions Are Counted Guide Modal */}
      {isGuideOpen && (
        <Modal
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
          title="How QA Contributions & Streaks Are Counted"
          maxWidth="680px"
          footer={
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Testing Pulse Guidelines • Real-time Automated Tracking
              </span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsGuideOpen(false)}
              >
                Got It
              </button>
            </div>
          }
        >
          <div className="qa-guide-modal-content">
            {/* Hero Banner */}
            <div className="qa-guide-hero">
              <div className="qa-hero-icon-box">
                <Icon name="shield" size={22} color="#10b981" />
              </div>
              <div>
                <h4>Automated & Transparent QA Work Tracking</h4>
                <p>
                  Every real QA action performed in the system is recorded live with its exact timestamp, project scope, and user ID. Here is how your testing pulse and green squares are calculated:
                </p>
              </div>
            </div>

            {/* 4 Core QA Contributions */}
            <div className="qa-guide-section">
              <span className="qa-section-heading">1. Qualifying QA Actions (What turns squares green)</span>
              <div className="qa-actions-grid">
                <div className="qa-action-card">
                  <div className="qa-action-card-header">
                    <span className="qa-action-badge bug">🐞 Defect Reporting</span>
                  </div>
                  <p className="qa-action-card-desc">
                    Logging a software bug, cosmetic defect, or requirement change with repro steps, severity, and test sheets.
                  </p>
                </div>

                <div className="qa-action-card">
                  <div className="qa-action-card-header">
                    <span className="qa-action-badge status">🔄 Retesting & Verification</span>
                  </div>
                  <p className="qa-action-card-desc">
                    Retesting developer bug fixes, verifying resolutions, and transitioning statuses (e.g. <em>need_retest → retested → closed</em>).
                  </p>
                </div>

                <div className="qa-action-card">
                  <div className="qa-action-card-header">
                    <span className="qa-action-badge progress">📋 Sprint & Sheet Updates</span>
                  </div>
                  <p className="qa-action-card-desc">
                    Submitting sprint progress (0–100%), sprint remarks, testing metrics, and linked Excel / Google Sheet URLs.
                  </p>
                </div>

                <div className="qa-action-card">
                  <div className="qa-action-card-header">
                    <span className="qa-action-badge session">🔑 Platform Testing Session</span>
                  </div>
                  <p className="qa-action-card-desc">
                    Daily authenticated login and workspace initiation to review assigned projects and defect tracking queues.
                  </p>
                </div>
              </div>
            </div>

            {/* Color Intensity Scale */}
            <div className="qa-guide-section">
              <span className="qa-section-heading">2. Heatmap Color Levels (Daily Contribution Tally)</span>
              <div className="qa-levels-table">
                <div className="qa-level-row">
                  <div className="calendar-cell level-0" />
                  <span className="qa-level-range">0 actions</span>
                  <span className="qa-level-meaning">No activity recorded for that day (Rest / Off)</span>
                </div>
                <div className="qa-level-row">
                  <div className="calendar-cell level-1" />
                  <span className="qa-level-range">1 – 2 actions</span>
                  <span className="qa-level-meaning">Light testing activity or single task checkpoint</span>
                </div>
                <div className="qa-level-row">
                  <div className="calendar-cell level-2" />
                  <span className="qa-level-range">3 – 5 actions</span>
                  <span className="qa-level-meaning">Steady daily testing, bug logging & retesting</span>
                </div>
                <div className="qa-level-row">
                  <div className="calendar-cell level-3" />
                  <span className="qa-level-range">6 – 9 actions</span>
                  <span className="qa-level-meaning">Active regression cycle, high productivity</span>
                </div>
                <div className="qa-level-row">
                  <div className="calendar-cell level-4" />
                  <span className="qa-level-range">10+ actions</span>
                  <span className="qa-level-meaning">Intensive testing session, major release cycle</span>
                </div>
              </div>
            </div>

            {/* Streaks & Grace Window */}
            <div className="qa-guide-section">
              <span className="qa-section-heading">3. Testing Streaks (🔥) & Grace Period</span>
              <div className="qa-streak-info-box">
                <div className="streak-icon-wrap">🔥</div>
                <div>
                  <strong>Consecutive Daily Testing</strong>
                  <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.8rem", color: "#78350f" }}>
                    Every calendar day you record at least 1 QA action extends your streak. If you were active yesterday, your streak remains active today so you have until midnight to log your day's work without losing your streak.
                  </p>
                </div>
              </div>
            </div>

            {/* Fair Evaluation Callout */}
            <div className="qa-fair-note">
              <Icon name="checkCheck" size={16} color="#10b981" />
              <span>
                <strong>Fair QA Philosophy:</strong> Quality engineering is about verifying stability, not just inflating bug counts. Retesting developer fixes and maintaining testing spreadsheets carry equal weight to new defect reporting.
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
