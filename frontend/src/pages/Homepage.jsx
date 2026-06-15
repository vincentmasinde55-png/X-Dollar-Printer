import { useState, useEffect, useCallback } from "react";
import { getBalance, getTradeHistory } from "../services/api";
import LiveChart from "../components/LiveChart.jsx";
import TradePanel from "../components/TradePanel.jsx";

export default function Homepage() {
  const [balance, setBalance] = useState(null);
  const [stats, setStats] = useState({ wins: 0, losses: 0, pending: 0, totalStaked: 0 });
  const [resultToast, setResultToast] = useState(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await getBalance();
      setBalance(Number(res.data.balance));
    } catch {
      // ignore
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await getTradeHistory();
      const trades = res.data;
      const wins = trades.filter((t) => t.outcome === "WIN").length;
      const losses = trades.filter((t) => t.outcome === "LOSS").length;
      const pending = trades.filter((t) => t.outcome === "PENDING").length;
      const totalStaked = trades.reduce((sum, t) => sum + Number(t.stake), 0);
      setStats({ wins, losses, pending, totalStaked });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchBalance();
    fetchStats();
    const interval = setInterval(() => {
      fetchBalance();
      fetchStats();
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchBalance, fetchStats]);

  const handleTradePlaced = () => {
    fetchBalance();
    fetchStats();
  };

  useEffect(() => {
    if (!resultToast) return;
    const timeout = setTimeout(() => setResultToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [resultToast]);

  const formattedBalance =
    balance !== null
      ? balance.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "—";

  const winRate =
    stats.wins + stats.losses > 0
      ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(0)
      : "—";

  return (
    <div className="trading-layout">
      <div className="trading-layout__top">
        <div className="stat-tile">
          <span className="card__icon card__icon--up stat-tile__icon">
            <i className="bi bi-wallet2" aria-hidden="true" />
          </span>
          <div className="stat-tile__content">
            <span className="stat-tile__label">Balance</span>
            <span className="stat-tile__value">KES {formattedBalance}</span>
          </div>
        </div>

        <div className="stat-tile">
          <span className="card__icon card__icon--up stat-tile__icon">
            <i className="bi bi-trophy" aria-hidden="true" />
          </span>
          <div className="stat-tile__content">
            <span className="stat-tile__label">Win rate</span>
            <span className="stat-tile__value">{winRate}%</span>
            <span className="stat-tile__sub">
              {stats.wins} win{stats.wins !== 1 ? "s" : ""} · {stats.losses} loss
              {stats.losses !== 1 ? "es" : ""}
            </span>
          </div>
        </div>

        <div className="stat-tile">
          <span className="card__icon card__icon--blue stat-tile__icon">
            <i className="bi bi-hourglass-split" aria-hidden="true" />
          </span>
          <div className="stat-tile__content">
            <span className="stat-tile__label">Pending trades</span>
            <span className="stat-tile__value">{stats.pending}</span>
          </div>
        </div>

        <div className="stat-tile">
          <span className="card__icon card__icon--brand stat-tile__icon">
            <i className="bi bi-cash-stack" aria-hidden="true" />
          </span>
          <div className="stat-tile__content">
            <span className="stat-tile__label">Total staked</span>
            <span className="stat-tile__value">
              KES{" "}
              {stats.totalStaked.toLocaleString("en-KE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="trading-layout__body">
        <div className="trading-layout__chart-col">
          <LiveChart />
        </div>
        <div className="trading-layout__side-col">
          <TradePanel balance={balance} onTradePlaced={handleTradePlaced} />
        </div>
      </div>

      {resultToast && (
        <div className="toast-stack">
          <div className={`toast toast--${resultToast.type}`}>
            <i
              className={`bi ${resultToast.type === "success" ? "bi-check-circle" : "bi-info-circle"}`}
              aria-hidden="true"
            />
            <span>{resultToast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}