import React from "react";
import { useTheme } from "../../context/ThemeContext";
import { Icon } from "../common/Icons";

export function ThemeToggle({ className = "", compact = false }) {
  const { theme, toggleTheme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className={`theme-toggle-switch ${isDark ? "theme-dark" : "theme-light"} ${className}`}
      role="group"
      aria-label="Theme mode toggle"
      title={isDark ? "Dark Mode (Classic Blue) active - Click to switch to Light" : "Light Mode active - Click to switch to Dark (Classic Blue)"}
    >
      <button
        type="button"
        className={`theme-option-btn ${!isDark ? "active light" : ""}`}
        onClick={() => setTheme("light")}
        aria-pressed={!isDark}
        title="Light Mode (Eye-friendly Slate Canvas)"
      >
        <Icon name="sun" size={compact ? 14 : 16} />
      </button>

      <button
        type="button"
        className={`theme-option-btn ${isDark ? "active dark" : ""}`}
        onClick={() => setTheme("dark")}
        aria-pressed={isDark}
        title="Dark Mode (Classic Blue Theme)"
      >
        <Icon name="moon" size={compact ? 14 : 16} />
      </button>
    </div>
  );
}
