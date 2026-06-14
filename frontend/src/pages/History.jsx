import { useState, useEffect, useMemo } from "react";
import { getTransactionHistory } from "../services/api";
import TradeHistory from "../components/TradeHistory.jsx";

const TX_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "DEPOSIT", label: "Deposits" },
  { value: "WITHDRAWAL", label: "Withdrawals" },
];

const PAGE_SIZE = 10;

function TransactionHistory() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getTransactionHistory();
        if (mounted) setTransactions(res.data);
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
    if (filter === "ALL") return transactions;
    return transactions.filter((t) => t.transaction_type === filter);
  }, [transactions, filter]);

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

  if (loading) {
    return (
      <div className="table-card">
        <div className="table-card__header">
          <span className="card__title">M-Pesa transactions</span>
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
        <span className="card__title">M-Pesa transactions</span>
        <div className="table-card__filters">
          {TX_FILTERS.map((f) => (
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
          <i className="bi bi-receipt empty-state__icon" aria-hidden="true" />
          <span className="empty-state__title">No transactions yet</span>
          <span className="empty-state__text">
            Deposits and withdrawals you make via M-Pesa will appear here.
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
                  <th>Amount</th>
                  <th>Phone</th>
                  <th>Receipt</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <span className={`badge badge--${tx.transaction_type.toLowerCase()}`}>
                        <span className="badge__dot" aria-hidden="true" />
                        {tx.transaction_type_display}
                      </span>
                    </td>
                    <td className="text-mono">KES {formatMoney(tx.amount)}</td>
                    <td className="text-mono">{tx.phone_number}</td>
                    <td className="text-mono">{tx.mpesa_receipt_number || "—"}</td>
                    <td>
                      <span className={`badge badge--${tx.status.toLowerCase()}`}>
                        <span className="badge__dot" aria-hidden="true" />
                        {tx.status_display}
                      </span>
                    </td>
                    <td className="text-muted">{formatDate(tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="history-card-list">
            {paged.map((tx) => (
              <div className="history-card-item" key={tx.id}>
                <div className="history-card-item__top">
                  <span className={`badge badge--${tx.transaction_type.toLowerCase()}`}>
                    <span className="badge__dot" aria-hidden="true" />
                    {tx.transaction_type_display}
                  </span>
                  <span className={`badge badge--${tx.status.toLowerCase()}`}>
                    <span className="badge__dot" aria-hidden="true" />
                    {tx.status_display}
                  </span>
                </div>
                <div className="history-card-item__row">
                  <span className="history-card-item__label">Amount</span>
                  <span className="text-mono">KES {formatMoney(tx.amount)}</span>
                </div>
                <div className="history-card-item__row">
                  <span className="history-card-item__label">Phone</span>
                  <span className="text-mono">{tx.phone_number}</span>
                </div>
                <div className="history-card-item__row">
                  <span className="history-card-item__label">Receipt</span>
                  <span className="text-mono">{tx.mpesa_receipt_number || "—"}</span>
                </div>
                <div className="history-card-item__row">
                  <span className="history-card-item__label">Date</span>
                  <span className="text-muted">{formatDate(tx.created_at)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pagination">
            <span className="pagination__info">
              Page {page} of {totalPages} · {filtered.length} transaction
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

export default function History() {
  const [tab, setTab] = useState("trades"); // 'trades' | 'transactions'

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__title">
          <h1 className="heading-1">History</h1>
          <p className="text-muted">
            Review your past trades and M-Pesa transactions.
          </p>
        </div>
      </div>

      <div className="wallet-form-tabs u-mb-4" style={{ maxWidth: "360px" }}>
        <button
          type="button"
          className={`wallet-form-tab ${tab === "trades" ? "is-active" : ""}`}
          onClick={() => setTab("trades")}
        >
          <i className="bi bi-graph-up-arrow" aria-hidden="true" />
          Trades
        </button>
        <button
          type="button"
          className={`wallet-form-tab ${tab === "transactions" ? "is-active" : ""}`}
          onClick={() => setTab("transactions")}
        >
          <i className="bi bi-receipt" aria-hidden="true" />
          M-Pesa
        </button>
      </div>

      {tab === "trades" ? <TradeHistory /> : <TransactionHistory />}
    </div>
  );
}