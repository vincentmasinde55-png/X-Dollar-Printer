import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/api";

const initialForm = {
  username: "",
  email: "",
  phone: "",
  password: "",
  confirm_password: "",
};

export default function Register() {
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (form.password !== form.confirm_password) {
      setFieldErrors({ confirm_password: "Passwords do not match." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await registerUser(form);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/", { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        const errors = {};
        Object.entries(data).forEach(([key, value]) => {
          errors[key] = Array.isArray(value) ? value[0] : value;
        });
        setFieldErrors(errors);
        if (errors.password && typeof errors.password === "object") {
          errors.password = errors.password[0] || "Invalid password.";
        }
      } else {
        setError("Could not create your account. Please try again.");
      }
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

        <h1 className="heading-2 auth-card__heading">Create your account</h1>
        <p className="auth-card__subheading">
          Sign up to start trading synthetic indices with M-Pesa.
        </p>

        {error && (
          <div className="auth-card__alert">
            <i className="bi bi-exclamation-circle auth-card__alert-icon" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form className="auth-card__form" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field__label" htmlFor="username">
              Username
            </label>
            <div className="input--icon-wrap">
              <i className="bi bi-person input-icon" aria-hidden="true" />
              <input
                id="username"
                type="text"
                className={`input ${fieldErrors.username ? "has-error" : ""}`}
                placeholder="trader_jane"
                value={form.username}
                onChange={handleChange("username")}
                autoComplete="username"
                required
              />
            </div>
            {fieldErrors.username && (
              <span className="field__error">{fieldErrors.username}</span>
            )}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="email">
              Email address
            </label>
            <div className="input--icon-wrap">
              <i className="bi bi-envelope input-icon" aria-hidden="true" />
              <input
                id="email"
                type="email"
                className={`input ${fieldErrors.email ? "has-error" : ""}`}
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange("email")}
                autoComplete="email"
                required
              />
            </div>
            {fieldErrors.email && <span className="field__error">{fieldErrors.email}</span>}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="phone">
              Phone number
            </label>
            <div className="input--icon-wrap">
              <i className="bi bi-phone input-icon" aria-hidden="true" />
              <input
                id="phone"
                type="tel"
                className={`input ${fieldErrors.phone ? "has-error" : ""}`}
                placeholder="0712345678"
                value={form.phone}
                onChange={handleChange("phone")}
                autoComplete="tel"
                required
              />
            </div>
            {fieldErrors.phone && <span className="field__error">{fieldErrors.phone}</span>}
          </div>

          <div className="auth-card__row">
            <div className="field">
              <label className="field__label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className={`input ${fieldErrors.password ? "has-error" : ""}`}
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange("password")}
                autoComplete="new-password"
                required
              />
              {fieldErrors.password && (
                <span className="field__error">{fieldErrors.password}</span>
              )}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="confirm_password">
                Confirm password
              </label>
              <input
                id="confirm_password"
                type="password"
                className={`input ${fieldErrors.confirm_password ? "has-error" : ""}`}
                placeholder="••••••••"
                value={form.confirm_password}
                onChange={handleChange("confirm_password")}
                autoComplete="new-password"
                required
              />
              {fieldErrors.confirm_password && (
                <span className="field__error">{fieldErrors.confirm_password}</span>
              )}
            </div>
          </div>

          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="auth-card__footer">
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}