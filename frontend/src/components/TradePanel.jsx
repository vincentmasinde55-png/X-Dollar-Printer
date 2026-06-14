import { useState, useEffect, useCallback } from "react";
import {
  placeTrade,
  resolveTrade,
  getActiveTrades,
  getLatestTick,
} from "../services/api";

const STAKE_STEP = 10;
const MIN_STAKE = 10;
const PAYOUT_MULTIPLIER = 1.95;

const TRADE_GROUPS = {
  oddeven: [
    { value: "ODD", label: "Odd", icon: "bi-dice-3", variant: "down" },
    { value: "EVEN", label: "Even", icon: "bi-dice-5", variant: "up" },
  ],
  overunder: [
    { value: "UNDER", label: "Under", icon: "bi-arrow-down-short", variant: "down" },
    { value: "OVER", label: "Over", icon: "bi-arrow-up-short", variant: "up" },
  ],
};

export default function TradePanel({ onTradePlaced, balance }) {
  const [tab, setTab] = useState("oddeven"); // 'oddeven' | 'overunder'
  const [tradeType, setTradeType] = useState("EVEN");
  const [barrier, setBarrier] = useState(5);
  const [stake, setStake] = useState(10);
  const [duration, setDuration] = useState(5);
  const [activeTrades, setActiveTrades] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const switchTab = (next) => {
    setTab(next);
    setTradeType(next === "oddeven" ? "EVEN" : "OVER");
    setError("");
    setSuccess("");
  };

  const fetchActiveTrades = useCallback(async () => {
    try {
      const res = await getActiveTrades();
      setActiveTrades(res.data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchActiveTrades();
    const interval = setInterval(fetchActiveTrades, 5000);
    return () => clearInterval(interval);
  }, [fetchActiveTrades]);

  // Auto-resolve pending trades against the latest tick once their
  // duration_ticks have likely elapsed. Lightweight client-side poller.
  useEffect(() => {
    if (!activeTrades.length) return;
    const interval = setInterval(async () => {
      try {
        const latest = await getLatestTick();
        for (const trade of activeTrades) {
          await resolveTrade(trade.id, { exit_tick_id: latest.data.id }).catch(() => {});
        }
        fetchActiveTrades();
      } catch {
        // ignore
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [activeTrades, fetchActiveTrades]);

  const adjustStake = (delta) => {
    setStake((prev) => {
      const next = Number(prev) + delta;
      return next < MIN_STAKE ? MIN_STAKE : Math.round(next * 100) / 100;
    });
  };

  const handleStakeInput = (e) => {
    const value = e.target.value;
    if (value === "") {
      setStake("");
      return;
    }
    const num = Number(value);
    if (!Number.isNaN(num)) setStake(num);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const numericStake = Number(stake);
    if (!numericStake || numericStake < MIN_STAKE) {
      setError(`Minimum stake is KES ${MIN_STAKE.toFixed(2)}.`);
      return;
    }
    if (balance !== null && numericStake > balance) {
      setError("Insufficient balance for this stake.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        trade_type: tradeType,
        stake: numericStake,
        duration_ticks: duration,
      };
      if (tab === "overunder") {
        payload.barrier = barrier;
      }

      const res = await placeTrade(payload);
      setSuccess("Trade placed successfully.");
      fetchActiveTrades();
      if (onTradePlaced) onTradePlaced(res.data);
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.stake?.[0] ||
        err.response?.data?.barrier?.[0] ||
        "Could not place trade. Please try again.";
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const potentialPayout = (Number(stake) || 0) * PAYOUT_MULTIPLIER;

  return (
    <div className="stack">
      <form className="trade-panel" onSubmit={handleSubmit}>
        <div className="trade-panel__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "oddeven"}
            className={`trade-panel__tab ${tab === "oddeven" ? "is-active" : ""}`}
            onClick={() => switchTab("oddeven")}
          >
            Odd / Even
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "overunder"}
            className={`trade-panel__tab ${tab === "overunder" ? "is-active" : ""}`}
            onClick={() => switchTab("overunder")}
          >
            Over / Under
          </button>
        </div>

        <div>
          <div className="trade-panel__section-label">
            <span>Prediction</span>
          </div>
          <div className="btn-toggle-group">
            {TRADE_GROUPS[tab].map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`btn-toggle ${
                  tradeType === opt.value
                    ? opt.variant === "up"
                      ? "is-active-up"
                      : "is-active-down"
                    : ""
                }`}
                onClick={() => setTradeType(opt.value)}
              >
                <i className={`bi ${opt.icon} btn-toggle__icon`} aria-hidden="true" />
                <span className="btn-toggle__label">{opt.label}</span>
                {tab === "overunder" && (
                  <span className="btn-toggle__sub">than {barrier}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {tab === "overunder" && (
          <div>
            <div className="trade-panel__section-label">
              <span>Barrier digit</span>
            </div>
            <div className="trade-panel__barrier">
              <span className="trade-panel__barrier-display text-mono">{barrier}</span>
              <input
                type="range"
                min="0"
                max="9"
                step="1"
                value={barrier}
                onChange={(e) => setBarrier(Number(e.target.value))}
                className="trade-panel__barrier-slider"
                aria-label="Barrier digit"
              />
            </div>
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="stake">
            Stake (KES)
          </label>
          <div className="stepper">
            <button
              type="button"
              className="stepper__btn"
              onClick={() => adjustStake(-STAKE_STEP)}
              disabled={Number(stake) <= MIN_STAKE}
              aria-label="Decrease stake"
            >
              −
            </button>
            <input
              id="stake"
              type="number"
              inputMode="decimal"
              min={MIN_STAKE}
              step={STAKE_STEP}
              className="stepper__input"
              value={stake}
              onChange={handleStakeInput}
            />
            <button
              type="button"
              className="stepper__btn"
              onClick={() => adjustStake(STAKE_STEP)}
              aria-label="Increase stake"
            >
              +
            </button>
          </div>
          <span className="field__hint">Minimum stake KES {MIN_STAKE.toFixed(2)}.</span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="duration">
            Duration (ticks)
          </label>
          <select
            id="duration"
            className="select"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {[1, 3, 5, 10, 15, 20].map((n) => (
              <option key={n} value={n}>
                {n} tick{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="trade-panel__summary">
          <div className="trade-panel__summary-row">
            <span className="text-muted">Stake</span>
            <span className="trade-panel__summary-value">
              KES {(Number(stake) || 0).toFixed(2)}
            </span>
          </div>
          <div className="trade-panel__summary-row">
            <span className="text-muted">Payout multiplier</span>
            <span className="trade-panel__summary-value">{PAYOUT_MULTIPLIER}x</span>
          </div>
          <div className="trade-panel__summary-row trade-panel__summary-row--total">
            <span>Potential payout</span>
            <span className="trade-panel__summary-value text-up">
              KES {potentialPayout.toFixed(2)}
            </span>
          </div>
        </div>

        {error && (
          <div className="trade-panel__error">
            <i className="bi bi-exclamation-circle" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="trade-panel__success">
            <i className="bi bi-check-circle" aria-hidden="true" />
            <span>{success}</span>
          </div>
        )}

        <button
          type="submit"
          className={`btn btn--block btn--lg trade-panel__submit ${
            tradeType === "EVEN" || tradeType === "OVER" ? "btn--up" : "btn--down"
          }`}
          disabled={submitting}
        >
          {submitting ? "Placing trade…" : `Place trade — ${tradeType}`}
        </button>
      </form>

      <div className="card">
        <div className="card__header">
          <div className="card__title-row">
            <span className="card__icon card__icon--blue">
              <i className="bi bi-hourglass-split" aria-hidden="true" />
            </span>
            <span className="card__title">Active trades</span>
          </div>
        </div>

        {activeTrades.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-inboxes empty-state__icon" aria-hidden="true" />
            <span className="empty-state__title">No open trades</span>
            <span className="empty-state__text">
              Trades you place will appear here until they resolve.
            </span>
          </div>
        ) : (
          <div className="active-trades">
            {activeTrades.map((trade) => (
              <div className="active-trade-item" key={trade.id}>
                <span
                  className={`active-trade-item__badge active-trade-item__badge--${trade.trade_type.toLowerCase()}`}
                >
                  {trade.trade_type === "ODD" || trade.trade_type === "EVEN"
                    ? trade.trade_type[0]
                    : trade.barrier}
                </span>
                <div className="active-trade-item__details">
                  <span className="active-trade-item__type">
                    {trade.trade_type_display}
                    {trade.barrier !== null && trade.barrier !== undefined
                      ? ` ${trade.barrier}`
                      : ""}
                  </span>
                  <span className="active-trade-item__meta">
                    {trade.duration_ticks} ticks · entry {Number(trade.entry_price).toFixed(5)}
                  </span>
                </div>
                <div className="stack" style={{ gap: "4px", alignItems: "flex-end" }}>
                  <span className="active-trade-item__stake">
                    KES {Number(trade.stake).toFixed(2)}
                  </span>
                  <span className="active-trade-item__status">
                    <i className="bi bi-hourglass-split" aria-hidden="true" />
                    Pending
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}