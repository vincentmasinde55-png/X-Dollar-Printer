import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { loginUser } from "../services/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await loginUser({ email, password });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const detail =
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.detail ||
        "Invalid email or password.";
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <span className="auth-card__brand-mark">GD</span>
          <span className="auth-card__brand-text">Gadafi Dollar Printer</span>
        </div>

        <h1 className="heading-2 auth-card__heading">Welcome back</h1>
        <p className="auth-card__subheading">
          Log in to access your wallet and start trading.
        </p>

        {error && (
          <div className="auth-card__alert">
            <i className="bi bi-exclamation-circle auth-card__alert-icon" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form className="auth-card__form" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field__label" htmlFor="email">
              Email address
            </label>
            <div className="input--icon-wrap">
              <i className="bi bi-envelope input-icon" aria-hidden="true" />
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="password">
              Password
            </label>
            <div className="input--icon-wrap">
              <i className="bi bi-lock input-icon" aria-hidden="true" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={{ paddingRight: "var(--space-12)" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: "var(--space-4)",
                  background: "transparent",
                  border: "none",
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} aria-hidden="true" />
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={submitting}>
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>

        <div className="auth-card__footer">
          Don&apos;t have an account? <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
}