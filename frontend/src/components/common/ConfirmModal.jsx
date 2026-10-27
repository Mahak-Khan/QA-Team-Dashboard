import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icons";

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Deletion",
  message = "Are you sure you want to proceed with this deletion?",
  itemName = "",
  note = "",
  confirmText = "Yes, Delete",
  cancelText = "No, Cancel",
  isDestructive = true,
  loading = false,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, loading]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={() => {
        if (!loading) onClose();
      }}
      style={{
        zIndex: 120,
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="modal-dialog-box"
        style={{
          maxWidth: "460px",
          border: isDestructive ? "1px solid rgba(244, 63, 94, 0.35)" : "1px solid var(--border-bright)",
          boxShadow: isDestructive ? "0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(244, 63, 94, 0.15)" : "0 20px 50px rgba(0, 0, 0, 0.6)",
          padding: "1.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          position: "relative",
          animation: "scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        {/* Top Header with Icon and Close Button */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: isDestructive ? "rgba(244, 63, 94, 0.14)" : "rgba(99, 102, 241, 0.14)",
                border: isDestructive ? "1px solid rgba(244, 63, 94, 0.3)" : "1px solid rgba(99, 102, 241, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isDestructive ? "#f43f5e" : "var(--primary)",
                boxShadow: isDestructive ? "0 0 16px rgba(244, 63, 94, 0.2)" : "0 0 16px rgba(99, 102, 241, 0.2)",
                flexShrink: 0,
              }}
            >
              <Icon name={isDestructive ? "trash" : "alert"} size={22} />
            </div>

            <div>
              <h3
                id="confirm-dialog-title"
                style={{
                  margin: 0,
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "var(--text-main)",
                }}
              >
                {title}
              </h3>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Verification Required
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: loading ? "not-allowed" : "pointer",
              padding: "4px",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color var(--transition-fast)",
            }}
            aria-label="Close modal"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.925rem",
              lineHeight: 1.5,
              color: "var(--text-main)",
            }}
          >
            {message}
          </p>

          {itemName && (
            <div
              style={{
                background: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "0.6rem 0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "var(--text-main)",
              }}
            >
              <Icon name="shield" size={15} color="var(--primary)" />
              <span style={{ wordBreak: "break-all" }}>{itemName}</span>
            </div>
          )}

          {note && (
            <div
              style={{
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                borderRadius: "var(--radius-md)",
                padding: "0.65rem 0.85rem",
                fontSize: "0.825rem",
                lineHeight: 1.45,
                color: "#f59e0b",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
              }}
            >
              <span style={{ flexShrink: 0, marginTop: "1px" }}>
                <Icon name="alert" size={14} color="#f59e0b" />
              </span>
              <span>{note}</span>
            </div>
          )}
        </div>

        {/* Modal Action Buttons: Yes / No */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.75rem",
            marginTop: "0.5rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
            style={{
              minWidth: "90px",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
            }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            className="btn"
            onClick={onConfirm}
            disabled={loading}
            style={{
              minWidth: "120px",
              padding: "0.5rem 1.15rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              background: isDestructive
                ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                : "var(--primary)",
              color: "#ffffff",
              border: "none",
              boxShadow: isDestructive
                ? "0 4px 14px rgba(239, 68, 68, 0.35)"
                : "var(--shadow-primary)",
              opacity: loading ? 0.75 : 1,
              cursor: loading ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.45rem",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
          >
            {loading ? (
              <>
                <Icon name="refresh" size={15} className="spinner" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Icon name={isDestructive ? "trash" : "check"} size={15} />
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
