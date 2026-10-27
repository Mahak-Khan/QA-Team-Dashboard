import React, { createContext, useContext, useState, useCallback } from "react";
import { Icon } from "../components/common/Icons";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "success", duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-pill ${toast.type}`}>
            <span style={{ display: "flex", alignItems: "center" }}>
              {toast.type === "success" ? (
                <Icon name="check" size={16} color="#10b981" />
              ) : (
                <Icon name="alert" size={16} color="#f43f5e" />
              )}
            </span>
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{ color: "var(--text-faint)", padding: "2px", display: "flex" }}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      addToast: (msg) => console.log(msg),
      removeToast: () => {}
    };
  }
  return context;
};
