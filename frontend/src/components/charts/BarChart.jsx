import React, { useState } from "react";

export function BarChart({
  data = [],
  height = 200,
  barRadius = 6,
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const maxValue = Math.max(...data.map((d) => Number(d.value) || 0), 1);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "1.25rem",
          height,
          paddingTop: "24px",
          borderBottom: "1px solid var(--border-subtle)",
          position: "relative",
        }}
      >
        {/* Subtle grid line at 50% and 100% */}
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 0,
            right: 0,
            borderTop: "1px dashed rgba(255, 255, 255, 0.05)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: `${(height + 24) / 2}px`,
            left: 0,
            right: 0,
            borderTop: "1px dashed rgba(255, 255, 255, 0.05)",
          }}
        />

        {data.map((item, idx) => {
          const val = Number(item.value) || 0;
          const heightPercent = Math.max((val / maxValue) * 100, 4);
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={item.label}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                height: "100%",
                justifyContent: "flex-end",
                position: "relative",
                cursor: "pointer",
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Tooltip value */}
              <div
                style={{
                  position: "absolute",
                  top: `calc(${100 - heightPercent}% - 26px)`,
                  padding: "0.2rem 0.5rem",
                  borderRadius: "var(--radius-sm)",
                  background: isHovered ? item.color : "var(--bg-surface-elevated)",
                  color: isHovered ? "#fff" : "var(--text-secondary)",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  boxShadow: isHovered ? `0 0 12px ${item.color}` : "none",
                  transition: "all 0.2s ease",
                  transform: isHovered ? "scale(1.1)" : "scale(1)",
                  zIndex: 10,
                }}
              >
                {val}
              </div>

              {/* Bar Fill */}
              <div
                style={{
                  width: "100%",
                  maxWidth: "42px",
                  height: `${heightPercent}%`,
                  borderRadius: `${barRadius}px ${barRadius}px 2px 2px`,
                  background: `linear-gradient(180deg, ${item.color}, ${item.color}88)`,
                  boxShadow: isHovered
                    ? `0 0 20px ${item.color}aa, inset 0 1px 0 rgba(255,255,255,0.4)`
                    : "inset 0 1px 0 rgba(255,255,255,0.2)",
                  transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  transformOrigin: "bottom",
                  transform: isHovered ? "scaleY(1.02) scaleX(1.05)" : "scale(1)",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Bar X-axis Labels */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1.25rem" }}>
        {data.map((item, idx) => (
          <div
            key={item.label}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: "0.785rem",
              fontWeight: hoveredIdx === idx ? 700 : 500,
              color: hoveredIdx === idx ? "var(--text-main)" : "var(--text-muted)",
              transition: "color 0.15s ease",
            }}
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
