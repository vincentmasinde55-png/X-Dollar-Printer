import { useState, useEffect, useMemo } from "react";
import { getTradeHistory } from "../services/api";

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "WIN", label: "Wins" },
  { value: "LOSS", label: "Losses" },
  { value: "PENDING", label: "Pending" },
];

const PAGE_SIZE = 10;

export default function TradeHistory() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getTradeHistory();
        if (mounted) setTrades(res.data);
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "ALL") return trades;
    return trades.filter((t) => t.outcome === filter);
  }, [trades, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFilter = (value) => {
    setFilter(value);
    setPage(1);
  };

  const formatDate = (iso) =>
    new Date(iso).toLocaleString("en-KE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatMoney = (value) =>
    Number(value ?? 0).toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const renderTypeLabel = (trade) => {
    const base = trade.trade_type_display;
    if (trade.barrier !== null && trade.barrier !== undefined) {
      return `${base} ${trade.barrier}`;
    }
    return base;
  };

  if (loading) {
    return (
      <div className="table-card">
        <div className="table-card__header">
          <span className="card__title">Trade history</span>
        </div>
        <div className="stack" style={{ padding: "var(--space-5)" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton skeleton--text" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="table-card">
      <div className="table-card__header">
        <span className="card__title">Trade history</span>
        <div className="table-card__filters">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`chip ${filter === f.value ? "is-selected" : ""}`}
              onClick={() => handleFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <i className="bi bi-clipboard-data empty-state__icon" aria-hidden="true" />
          <span className="empty-state__title">No trades yet</span>
          <span className="empty-state__text">
            Trades you place will show up here with their outcome and payout.
          </span>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Stake</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>Payout</th>
                  <th>Outcome</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((trade) => (
                  <tr key={trade.id}>
                    <td>{renderTypeLabel(trade)}</td>
                    <td className="text-mono">KES {formatMoney(trade.stake)}</td>
                    <td className="text-mono">
                      {trade.entry_price ? Number(trade.entry_price).toFixed(5) : "—"}
                    </td>
                    <td className="text-mono">
                      {trade.exit_price ? Number(trade.exit_price).toFixed(5) : "—"}
                    </td>
                    <td className="text-mono">
                      {trade.outcome === "WIN" ? (
                        <span className="text-up">KES {formatMoney(trade.payout)}</span>
                      ) : trade.outcome === "LOSS" ? (
                        <span className="text-down">KES 0.00</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className={`badge badge--${trade.outcome.toLowerCase()}`}>
                        <span className="badge__dot" aria-hidden="true" />
                        {trade.outcome_display}
                      </span>
                    </td>
                    <td className="text-muted">{formatDate(trade.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="history-card-list">
            {paged.map((trade) => (
              <div className="history-card-item" key={trade.id}>
                <div className="history-card-item__top">
                  <span className="card__title" style={{ fontSize: "var(--fs-base)" }}>
                    {renderTypeLabel(trade)}
                  </span>
                  <span className={`badge badge--${trade.outcome.toLowerCase()}`}>
                    <span className="badge__dot" aria-hidden="true" />
                    {trade.outcome_display}
                  </span>
                </div>
                <div className="history-card-item__row">
                  <span className="history-card-item__label">Stake</span>
                  <span className="text-mono">KES {formatMoney(trade.stake)}</span>
                </div>
                <div className="history-card-item__row">
                  <span className="history-card-item__label">Entry / Exit</span>
                  <span className="text-mono">
                    {trade.entry_price ? Number(trade.entry_price).toFixed(5) : "—"} /{" "}
                    {trade.exit_price ? Number(trade.exit_price).toFixed(5) : "—"}
                  </span>
                </div>
                <div className="history-card-item__row">
                  <span className="history-card-item__label">Payout</span>
                  <span
                    className={`text-mono ${
                      trade.outcome === "WIN" ? "text-up" : trade.outcome === "LOSS" ? "text-down" : ""
                    }`}
                  >
                    KES {formatMoney(trade.payout)}
                  </span>
                </div>
                <div className="history-card-item__row">
                  <span className="history-card-item__label">Date</span>
                  <span className="text-muted">{formatDate(trade.created_at)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pagination">
            <span className="pagination__info">
              Page {page} of {totalPages} · {filtered.length} trade
              {filtered.length !== 1 ? "s" : ""}
            </span>
            <div className="pagination__controls">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}