import { useState, useEffect, useCallback } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { getBalance, logoutUser } from "../services/api";

const NAV_LINKS = [
  { to: "/", label: "Trade", icon: "bi-graph-up-arrow" },
  { to: "/wallet", label: "Wallet", icon: "bi-wallet2" },
  { to: "/history", label: "History", icon: "bi-clock-history" },
];

export default function Navbar() {
  const [balance, setBalance] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const fetchBalance = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getBalance();
      setBalance(res.data.balance);
    } catch {
      // silently ignore — interceptor handles 401 redirects
    }
  }, [token]);

  useEffect(() => {
    fetchBalance();
    if (!token) return;
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [fetchBalance, token]);

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      // ignore network errors on logout
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  const formattedBalance =
    balance !== null
      ? Number(balance).toLocaleString("en-KE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "—";

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="navbar__brand" onClick={() => setMenuOpen(false)}>
          <span className="navbar__brand-mark">GD</span>
          <span className="navbar__brand-text">Gadafi Dollar Printer</span>
        </Link>

        {token && (
          <nav className="navbar__links">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  `navbar__link${isActive ? " is-active" : ""}`
                }
              >
                <i className={`bi ${link.icon} navbar__link-icon`} aria-hidden="true" />
                <span>{link.label}</span>
              </NavLink>
            ))}
          </nav>
        )}

        <div className="navbar__right">
          {token ? (
            <>
              <div className="navbar__balance">
                <i className="bi bi-cash-coin navbar__balance-icon" aria-hidden="true" />
                <span className="navbar__balance-currency">KES</span>
                <span className="text-mono">{formattedBalance}</span>
              </div>

              <button
                type="button"
                className="navbar__avatar-btn u-hide-mobile"
                onClick={handleLogout}
                title="Log out"
                aria-label="Log out"
              >
                <i className="bi bi-box-arrow-right" aria-hidden="true" />
              </button>

              <button
                type="button"
                className="navbar__menu-toggle"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Toggle menu"
                aria-expanded={menuOpen}
              >
                <i className={`bi ${menuOpen ? "bi-x-lg" : "bi-list"}`} aria-hidden="true" />
              </button>
            </>
          ) : (
            <div className="row">
              <Link to="/login" className="btn btn--secondary btn--sm">
                Log in
              </Link>
              <Link to="/register" className="btn btn--primary btn--sm">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>

      {token && menuOpen && (
        <nav className="navbar__mobile-menu">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `navbar__link${isActive ? " is-active" : ""}`
              }
              onClick={() => setMenuOpen(false)}
            >
              <i className={`bi ${link.icon} navbar__link-icon`} aria-hidden="true" />
              <span>{link.label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            className="navbar__link navbar__logout"
            onClick={handleLogout}
          >
            <i className="bi bi-box-arrow-right navbar__link-icon" aria-hidden="true" />
            <span>Log out</span>
          </button>
        </nav>
      )}
    </header>
  );
}