import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../../services/authService";
import { Icon } from "../../components/common/Icons";
import "./login.css";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginUser(email.trim().toLowerCase(), password);

      sessionStorage.setItem("access_token", data.access_token);
      sessionStorage.setItem("role", data.role);

      if (data.role === "manager") {
        navigate("/manager", { replace: true });
      } else {
        navigate("/tester", { replace: true });
      }
    } catch (err) {
      setError(
        err.response?.data?.detail || "Authentication failed. Check your email & password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-viewport">
      {/* Dynamic Animated Ambient Glow Orbs */}
      <div className="ambient-glow-mesh" aria-hidden="true">
        <div className="glow-orb glow-orb-1" />
        <div className="glow-orb glow-orb-2" />
        <div className="glow-orb glow-orb-3" />
      </div>

      {/* Subtle Perspective Digital Grid */}
      <div className="login-grid-pattern" aria-hidden="true" />

      {/* Main Centered Glassmorphic Portal Card */}
      <div className="login-portal-card">
        {/* Brand Header */}
        <div className="portal-brand-header">
          <div className="portal-brand-icon">Q</div>
          <h1>QualityHub</h1>
          <p>Sign in to your QA management workspace</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="portal-form">
          {error && (
            <div className="portal-error-banner" role="alert">
              <Icon name="alert" size={16} color="#f43f5e" />
              <span>{error}</span>
            </div>
          )}

          <div className="form-field-group">
            <label className="form-field-label" htmlFor="portal-email">
              Work Email
            </label>
            <div className="field-input-box">
              <input
                id="portal-email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <span className="field-leading-icon">
                <Icon name="mail" size={16} />
              </span>
            </div>
          </div>

          <div className="form-field-group">
            <label className="form-field-label" htmlFor="portal-pass">
              Password
            </label>
            <div className="field-input-box">
              <input
                id="portal-pass"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span className="field-leading-icon">
                <Icon name="lock" size={16} />
              </span>
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="portal-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="submit-spinner-ring" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In to QualityHub</span>
                <Icon name="arrowRight" size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer Status Strip */}
        <div className="portal-footer-strip">
          <div className="status-online-pill">
            <span className="pulse-dot-online" />
            <span>System Online</span>
          </div>
          <span>256-Bit SSL • RBAC Secured</span>
        </div>
      </div>
    </div>
  );
}

export default Login;
