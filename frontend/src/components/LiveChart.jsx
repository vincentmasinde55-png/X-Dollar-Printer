import { useEffect, useRef, useState, useCallback } from "react";
import { getTicks, getLatestTick } from "../services/api";

const SYMBOL = "R_100";
const POLL_INTERVAL_MS = 1000;
const MAX_POINTS = 60;

export default function LiveChart({ onLatestTick }) {
  const canvasRef = useRef(null);
  const [ticks, setTicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flashClass, setFlashClass] = useState("");
  const lastPriceRef = useRef(null);

  // Initial load of recent ticks
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getTicks(SYMBOL, MAX_POINTS);
        if (mounted) {
          const ordered = [...res.data].reverse();
          setTicks(ordered);
          if (ordered.length) {
            lastPriceRef.current = Number(ordered[ordered.length - 1].price);
          }
        }
      } catch {
        // ignore — polling will retry
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Poll for the latest tick
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await getLatestTick(SYMBOL);
        const tick = res.data;

        setTicks((prev) => {
          if (prev.length && prev[prev.length - 1].id === tick.id) {
            return prev;
          }
          const next = [...prev, tick];
          return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
        });

        const newPrice = Number(tick.price);
        if (lastPriceRef.current !== null) {
          if (newPrice > lastPriceRef.current) setFlashClass("flash-up");
          else if (newPrice < lastPriceRef.current) setFlashClass("flash-down");
        }
        lastPriceRef.current = newPrice;

        if (onLatestTick) onLatestTick(tick);
        setLoading(false);
      } catch {
        // ignore — try again next tick
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [onLatestTick]);

  // Draw the chart whenever ticks change
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || ticks.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const prices = ticks.map((t) => Number(t.price));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const padding = 16;
    const w = rect.width - padding * 2;
    const h = rect.height - padding * 2;

    const points = prices.map((price, i) => {
      const x = padding + (i / (prices.length - 1)) * w;
      const y = padding + h - ((price - min) / range) * h;
      return [x, y];
    });

    // Gradient fill under the line
    const gradient = ctx.createLinearGradient(0, padding, 0, padding + h);
    const isUp = prices[prices.length - 1] >= prices[0];
    const lineColor = isUp ? "#00d68f" : "#ff4757";
    gradient.addColorStop(0, isUp ? "rgba(0, 214, 143, 0.18)" : "rgba(255, 71, 87, 0.18)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.beginPath();
    ctx.moveTo(points[0][0], padding + h);
    points.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(points[points.length - 1][0], padding + h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    points.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Latest point dot
    const [lastX, lastY] = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
    ctx.fillStyle = isUp ? "rgba(0, 214, 143, 0.25)" : "rgba(255, 71, 87, 0.25)";
    ctx.fill();
  }, [ticks]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  // Clear flash animation class after it plays
  useEffect(() => {
    if (!flashClass) return;
    const timeout = setTimeout(() => setFlashClass(""), 600);
    return () => clearTimeout(timeout);
  }, [flashClass]);

  const latest = ticks[ticks.length - 1];
  const latestPrice = latest ? Number(latest.price).toFixed(5) : "—.-----";
  const latestDigit = latest ? latest.last_digit : null;
  const isEven = latestDigit !== null && latestDigit % 2 === 0;

  return (
    <section className="live-chart">
      <div className="live-chart__header">
        <div className="live-chart__symbol">
          <span className="live-chart__symbol-name">Volatility 100 Index</span>
          <span className="live-chart__live-badge">
            <span className="live-chart__live-dot" aria-hidden="true" />
            Live
          </span>
        </div>

        <div className="live-chart__price">
          <span className={`live-chart__price-value text-mono ${flashClass}`}>
            {latestPrice}
          </span>
          {latestDigit !== null && (
            <span
              className={`live-chart__last-digit ${
                isEven ? "live-chart__last-digit--even" : "live-chart__last-digit--odd"
              }`}
              title={isEven ? "Last digit is even" : "Last digit is odd"}
            >
              {latestDigit}
            </span>
          )}
        </div>
      </div>

      <div className="live-chart__body">
        {loading ? (
          <div className="live-chart__loading">
            <div className="spinner" aria-hidden="true" />
            <span>Connecting to price feed…</span>
          </div>
        ) : (
          <>
            <div className="live-chart__canvas-wrap">
              <canvas
                ref={canvasRef}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </div>

            <div className="live-chart__digit-strip">
              {ticks.slice(-20).map((tick, idx, arr) => {
                const digit = tick.last_digit;
                const even = digit % 2 === 0;
                const isLatest = idx === arr.length - 1;
                return (
                  <span
                    key={tick.id ?? `${tick.timestamp}-${idx}`}
                    className={`live-chart__digit-pill ${
                      even ? "live-chart__digit-pill--even" : "live-chart__digit-pill--odd"
                    } ${isLatest ? "live-chart__digit-pill--latest" : ""}`}
                  >
                    {digit}
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}