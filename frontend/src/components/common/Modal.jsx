import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icons";

export function Modal({ isOpen, onClose, title, children, footer, maxWidth = "600px" }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog-box"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button
            onClick={onClose}
            style={{
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px",
              borderRadius: "var(--radius-sm)",
              transition: "background var(--transition-fast)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            aria-label="Close dialog"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
