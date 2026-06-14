import { useState, useEffect, useCallback, useRef } from "react";
import {
  getBalance,
  depositFunds,
  withdrawFunds,
  getPaymentStatus,
} from "../services/api";

const QUICK_AMOUNTS = [50, 100, 250, 500, 1000, 2500];
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 120000;

export default function WalletCard() {
  const [balance, setBalance] = useState(null);
  const [mode, setMode] = useState("deposit"); // 'deposit' | 'withdraw'
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(null); // { id, status, result_desc }
  const pollRef = useRef(null);
  const pollStartRef = useRef(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await getBalance();
      setBalance(res.data.balance);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = (transactionId) => {
    pollStartRef.current = Date.now();
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await getPaymentStatus(transactionId);
        setStatus(res.data);
        setBalance(res.data.balance);

        const done = res.data.status === "COMPLETED" || res.data.status === "FAILED";
        const timedOut = Date.now() - pollStartRef.current > POLL_TIMEOUT_MS;

        if (done || timedOut) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          if (timedOut && !done) {
            setStatus((prev) => ({ ...prev, status: "PENDING", result_desc: "Still waiting for M-Pesa confirmation." }));
          }
        }
      } catch {
        // ignore transient errors
      }
    }, POLL_INTERVAL_MS);
  };

  const normalisePhone = (value) => {
    let v = value.trim().replace(/\s+/g, "").replace("+", "");
    if (v.startsWith("0")) v = "254" + v.slice(1);
    return v;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount < 10) {
      setError("Enter an amount of at least KES 10.");
      return;
    }

    const normalisedPhone = normalisePhone(phone);
    if (!/^254\d{9}$/.test(normalisedPhone)) {
      setError("Enter a valid Kenyan phone number, e.g. 0712345678.");
      return;
    }

    if (mode === "withdraw" && balance !== null && numericAmount > balance) {
      setError("Insufficient balance for this withdrawal.");
      return;
    }

    setSubmitting(true);
    setStatus(null);

    try {
      const payload = { phone_number: normalisedPhone, amount: numericAmount };
      const res =
        mode === "deposit" ? await depositFunds(payload) : await withdrawFunds(payload);

      setStatus({
        id: res.data.transaction_id,
        status: "PENDING",
        result_desc:
          mode === "deposit"
            ? "STK push sent. Enter your M-Pesa PIN on your phone."
            : "Withdrawal initiated. Funds will arrive shortly.",
      });

      if (mode === "withdraw" && res.data.balance !== undefined) {
        setBalance(res.data.balance);
      }

      startPolling(res.data.transaction_id);
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.amount?.[0] ||
        err.response?.data?.phone_number?.[0] ||
        "Something went wrong. Please try again.";
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setStatus(null);
    setAmount("");
  };

  const formattedBalance =
    balance !== null
      ? Number(balance).toLocaleString("en-KE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "—";

  const statusVariant = status
    ? status.status === "COMPLETED"
      ? "completed"
      : status.status === "FAILED" || status.status === "CANCELLED"
      ? "failed"
      : "pending"
    : null;

  const statusIcon =
    statusVariant === "completed"
      ? "bi-check-circle"
      : statusVariant === "failed"
      ? "bi-x-circle"
      : "bi-hourglass-split";

  const statusTitle =
    statusVariant === "completed"
      ? "Payment confirmed"
      : statusVariant === "failed"
      ? "Payment failed"
      : "Waiting for M-Pesa…";

  return (
    <div className="wallet-grid">
      <div className="wallet-card">
        <div className="wallet-card__label">Available balance</div>
        <div className="wallet-card__balance">
          <span className="wallet-card__currency">KES</span>
          <span className="wallet-card__amount text-mono">{formattedBalance}</span>
        </div>

        <div className="wallet-card__actions">
          <button
            type="button"
            className="btn btn--up"
            onClick={() => switchMode("deposit")}
          >
            <i className="bi bi-download" aria-hidden="true" />
            Deposit
          </button>
          <button
            type="button"
            className="btn btn--down"
            onClick={() => switchMode("withdraw")}
          >
            <i className="bi bi-upload" aria-hidden="true" />
            Withdraw
          </button>
        </div>
      </div>

      <div className="card">
        <div className="wallet-form-tabs">
          <button
            type="button"
            className={`wallet-form-tab is-deposit ${mode === "deposit" ? "is-active" : ""}`}
            onClick={() => switchMode("deposit")}
          >
            <i className="bi bi-download" aria-hidden="true" />
            Deposit via M-Pesa
          </button>
          <button
            type="button"
            className={`wallet-form-tab is-withdraw ${mode === "withdraw" ? "is-active" : ""}`}
            onClick={() => switchMode("withdraw")}
          >
            <i className="bi bi-upload" aria-hidden="true" />
            Withdraw to M-Pesa
          </button>
        </div>

        {status && (
          <div className={`payment-status payment-status--${statusVariant}`}>
            <span className="payment-status__icon">
              <i className={`bi ${statusIcon}`} aria-hidden="true" />
            </span>
            <div className="payment-status__text">
              <span className="payment-status__title">{statusTitle}</span>
              <span className="payment-status__desc">{status.result_desc}</span>
            </div>
          </div>
        )}

        <form className="stack" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field__label" htmlFor="phone">
              M-Pesa phone number
            </label>
            <div className="input--icon-wrap">
              <i className="bi bi-phone input-icon" aria-hidden="true" />
              <input
                id="phone"
                type="tel"
                className="input"
                placeholder="0712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <span className="field__hint">Format: 07XXXXXXXX or 254XXXXXXXXX.</span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="amount">
              Amount (KES)
            </label>
            <div className="input-suffix-wrap">
              <input
                id="amount"
                type="number"
                inputMode="decimal"
                min="10"
                step="10"
                className="input"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <span className="input-suffix">KES</span>
            </div>

            <div className="chip-row u-mt-2">
              {QUICK_AMOUNTS.map((value) => (
                <button
                  type="button"
                  key={value}
                  className={`chip ${Number(amount) === value ? "is-selected" : ""}`}
                  onClick={() => setAmount(String(value))}
                >
                  {value.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="alert alert--error">
              <i className="bi bi-exclamation-circle" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className={`btn btn--block btn--lg ${mode === "deposit" ? "btn--up" : "btn--down"}`}
            disabled={submitting}
          >
            {submitting
              ? "Processing…"
              : mode === "deposit"
              ? "Send STK push"
              : "Withdraw funds"}
          </button>
        </form>
      </div>
    </div>
  );
}