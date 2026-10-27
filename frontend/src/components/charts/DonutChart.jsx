import React, { useState } from "react";

export function DonutChart({
  data = [],
  size = 220,
  strokeWidth = 24,
  centerTitle = "Total Bugs",
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  const segments = data.map((item, idx) => {
    const val = Number(item.value) || 0;
    const percent = total > 0 ? (val / total) * 100 : 0;
    const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += percent;

    return {
      ...item,
      percent,
      strokeDasharray,
      strokeDashoffset,
      idx,
    };
  });

  const activeSegment = hoveredIdx !== null ? segments[hoveredIdx] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem", width: "100%" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Base Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth={strokeWidth}
          />
          {/* Segments */}
          {total > 0 &&
            segments.map((seg) => {
              const isHovered = hoveredIdx === seg.idx;
              return (
                <circle
                  key={seg.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                  strokeLinecap="round"
                  style={{
                    transform: "rotate(-90deg)",
                    transformOrigin: "50% 50%",
                    transition: "all 0.25s ease-out",
                    cursor: "pointer",
                    filter: isHovered ? `drop-shadow(0 0 10px ${seg.color})` : "none",
                    opacity: hoveredIdx !== null && !isHovered ? 0.45 : 1,
                  }}
                  onMouseEnter={() => setHoveredIdx(seg.idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })}
        </svg>

        {/* Center Label */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontSize: "1.85rem",
              fontWeight: 800,
              fontFamily: "var(--font-heading)",
              color: activeSegment ? activeSegment.color : "var(--text-main)",
              lineHeight: 1,
              transition: "color 0.2s ease",
            }}
          >
            {activeSegment ? activeSegment.value : total}
          </span>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 600,
              marginTop: "4px",
            }}
          >
            {activeSegment ? activeSegment.label : centerTitle}
          </span>
          {activeSegment && (
            <span
              style={{
                fontSize: "0.7rem",
                color: "var(--text-faint)",
                fontWeight: 500,
              }}
            >
              {activeSegment.percent.toFixed(1)}% of total
            </span>
          )}
        </div>
      </div>

      {/* Legend Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.65rem 1.25rem",
          width: "100%",
          paddingTop: "0.5rem",
        }}
      >
        {segments.map((seg) => (
          <div
            key={seg.label}
            onMouseEnter={() => setHoveredIdx(seg.idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.45rem 0.65rem",
              borderRadius: "var(--radius-sm)",
              background:
                hoveredIdx === seg.idx
                  ? "var(--bg-surface-elevated)"
                  : "transparent",
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: seg.color,
                  boxShadow: `0 0 8px ${seg.color}`,
                }}
              />
              <span style={{ fontSize: "0.825rem", color: "var(--text-secondary)" }}>
                {seg.label}
              </span>
            </div>
            <strong style={{ fontSize: "0.85rem", color: "var(--text-main)" }}>
              {seg.value}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}
