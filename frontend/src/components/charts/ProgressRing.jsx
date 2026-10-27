import React from "react";

export function ProgressRing({
  progress = 0,
  size = 120,
  strokeWidth = 12,
  color = "#6366f1",
  trackColor = "rgba(255, 255, 255, 0.06)",
  subtitle = "Completed",
}) {
  const normalized = Math.min(100, Math.max(0, Number(progress) || 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalized / 100) * circumference;

  return (
    <div style={{ position: "relative", width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "50% 50%",
            transition: "stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
            filter: `drop-shadow(0 0 8px ${color}88)`,
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontSize: size > 100 ? "1.45rem" : "1.1rem",
            fontWeight: 800,
            fontFamily: "var(--font-heading)",
            color: "var(--text-main)",
            lineHeight: 1,
          }}
        >
          {normalized}%
        </span>
        {subtitle && size > 100 && (
          <span
            style={{
              fontSize: "0.68rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 600,
              marginTop: "2px",
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
