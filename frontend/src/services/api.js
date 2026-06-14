import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const registerUser = (data) => api.post("/register/", data);

export const loginUser = (data) => api.post("/login/", data);

export const logoutUser = () => api.post("/logout/");

// ---------------------------------------------------------------------------
// Profile / Balance
// ---------------------------------------------------------------------------

export const getProfile = () => api.get("/profile/");

export const updateProfile = (data) => api.patch("/profile/", data);

export const getBalance = () => api.get("/balance/");

// ---------------------------------------------------------------------------
// Tick Feed
// ---------------------------------------------------------------------------

export const getTicks = (symbol = "R_100", limit = 100) =>
  api.get("/ticks/", { params: { symbol, limit } });

export const getLatestTick = (symbol = "R_100") =>
  api.get("/ticks/latest/", { params: { symbol } });

// ---------------------------------------------------------------------------
// Trading
// ---------------------------------------------------------------------------

export const placeTrade = (data) => api.post("/trades/place/", data);

export const resolveTrade = (tradeId, data = {}) =>
  api.post(`/trades/${tradeId}/resolve/`, data);

export const getTradeHistory = () => api.get("/trades/history/");

export const getActiveTrades = () => api.get("/trades/active/");

// ---------------------------------------------------------------------------
// M-Pesa — Deposit / Withdraw
// ---------------------------------------------------------------------------

export const depositFunds = (data) => api.post("/payment/deposit/", data);

export const withdrawFunds = (data) => api.post("/payment/withdraw/", data);

export const getPaymentStatus = (transactionId) =>
  api.get(`/payment/status/${transactionId}/`);

// ---------------------------------------------------------------------------
// Transaction History
// ---------------------------------------------------------------------------

export const getTransactionHistory = () => api.get("/transactions/");

export default api;