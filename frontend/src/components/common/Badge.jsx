import React from "react";

export function Badge({ variant = "default", children, className = "" }) {
  const normalizedVariant = String(variant).toLowerCase().replace(/[\s-]+/g, "_");
  return (
    <span className={`badge badge-${normalizedVariant} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const labels = {
    open: "Open",
    need_retest: "Need to be Retest",
    need_to_be_retest: "Need to be Retest",
    "need to be retest": "Need to be Retest",
    retested: "Retested",
    closed: "Closed",
    active: "Active",
    completed: "Completed",
    on_hold: "On Hold",
  };

  return (
    <Badge variant={status}>
      <span className="pulse-indicator" style={{ width: 6, height: 6 }} />
      {labels[status] || status}
    </Badge>
  );
}

export function SeverityBadge({ severity }) {
  return (
    <Badge variant={severity}>
      {severity}
    </Badge>
  );
}
