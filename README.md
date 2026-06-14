# X Dollar Printer

A binary trading platform clone built with Django REST Framework and React Vite. Users can trade binary options (Odd/Even, Over/Under), deposit and withdraw via M-Pesa, and monitor live chart activity.

---

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [Trading Types](#trading-types)
- [M-Pesa Integration](#mpesa-integration)
- [Pages and Components](#pages-and-components)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

### Backend (Django REST API)

- User registration and login with token authentication
- Binary trading — Odd/Even, Over/Under
- Place trades and view trade history
- Real-time tick/price data endpoint for chart feeds
- M-Pesa STK Push deposit
- M-Pesa withdrawal (B2C)
- Wallet balance management
- Transaction history
- Single Django app — one `models.py`, `serializers.py`, `views.py`

### Frontend (React Vite)

- Responsive on all screen sizes
- Login and registration pages
- Homepage with live chart (active graph)
- Trading panel — select trade type, amount, duration
- Wallet page — balance, deposit, withdraw
- Trade history page
- Bootstrap Icons throughout
- Axios-based API service layer

---

## Technology Stack

### Backend

| Component | Details |
|-----------|---------|
| Python | 3.10+ |
| Django | 4.2+ |
| Django REST Framework | 3.14+ |
| Django CORS Headers | Latest |
| Database | SQLite (development) |
| Auth | Token Authentication |
| Payments | M-Pesa Daraja API |

### Frontend

| Component | Details |
|-----------|---------|
| Framework | React 18 + Vite |
| Language | JavaScript (JSX) |
| Styling | CSS + Bootstrap Icons |
| Charts | Lightweight Charts (TradingView) |
| HTTP | Axios |
| Routing | React Router DOM v6 |

---

## Project Structure

```
gadafi_dollar_printer/
│
├── backend/
│   ├── core/                        # Single Django application
│   │   ├── migrations/
│   │   ├── __init__.py
│   │   ├── models.py                # All models
│   │   ├── serializers.py           # All serializers
│   │   ├── views.py                 # All views
│   │   └── urls.py                  # App-level URLs
│   ├── gadafi_dollar_printer/       # Django project config
│   │   ├── __init__.py
│   │   ├── settings.py
│   │   ├── urls.py                  # Main URL conf
│   │   └── wsgi.py
│   ├── manage.py
│   ├── requirements.txt
│   └── .env                         # Backend environment variables
│
└── frontend/
    ├── public/
    │   └── index.html               # SEO meta, Bootstrap Icons CDN
    ├── src/
    │   ├── services/
    │   │   └── api.js               # Axios instance + all API calls
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── TradePanel.jsx
    │   │   ├── LiveChart.jsx
    │   │   ├── WalletCard.jsx
    │   │   ├── TradeHistory.jsx
    │   │   └── ProtectedRoute.jsx
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── Homepage.jsx
    │   │   ├── Wallet.jsx
    │   │   └── History.jsx
    │   ├── App.jsx                  # Routes
    │   └── main.jsx                 # React entry point
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Prerequisites

### Backend

- Python 3.10+
- pip
- M-Pesa Daraja API credentials (Safaricom Developer Portal)

### Frontend

- Node.js 18+
- npm or yarn

---

## Installation and Setup

### Backend Setup

1. Navigate to the backend directory:

```bash
cd backend
```

2. Create and activate a virtual environment:

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Create a `.env` file in the `backend/` directory:

```env
SECRET_KEY=your-django-secret-key
DEBUG=True

# M-Pesa Daraja credentials
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback/
MPESA_B2C_SHORTCODE=your_b2c_shortcode
MPESA_B2C_INITIATOR=your_initiator
MPESA_B2C_SECURITY_CREDENTIAL=your_security_credential
```

5. Apply migrations:

```bash
python manage.py makemigrations
python manage.py migrate
```

6. Create a superuser (optional):

```bash
python manage.py createsuperuser
```

7. Start the development server:

```bash
python manage.py runserver
```

Backend available at `http://localhost:8000/`.

### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in `frontend/`:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

4. Start the development server:

```bash
npm run dev
```

Frontend available at `http://localhost:5173/`.

---

## Running the Application

### Terminal 1 — Backend

```bash
cd backend
source venv/bin/activate   # or venv\Scripts\activate on Windows
python manage.py runserver
```

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/register/` | Register new user | No |
| POST | `/api/login/` | Login and receive token | No |
| POST | `/api/logout/` | Logout | Yes |

### User

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/profile/` | Get user profile | Yes |
| GET | `/api/balance/` | Get wallet balance | Yes |

### Trading

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/trade/place/` | Place a trade | Yes |
| GET | `/api/trade/history/` | User trade history | Yes |
| GET | `/api/trade/active/` | Active/open trades | Yes |
| GET | `/api/ticks/` | Latest tick prices (chart feed) | Yes |

### Wallet / M-Pesa

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/deposit/mpesa/` | STK Push deposit | Yes |
| POST | `/api/withdraw/mpesa/` | M-Pesa withdrawal (B2C) | Yes |
| POST | `/api/mpesa/callback/` | M-Pesa payment callback | No |
| GET | `/api/transactions/` | Transaction history | Yes |

---

## Trading Types

All trades are binary — fixed outcome, fixed duration.

| Trade Type | Description |
|------------|-------------|
| Odd | Predict the last digit of the tick will be odd (1,3,5,7,9) |
| Even | Predict the last digit of the tick will be even (0,2,4,6,8) |
| Over | Predict the last digit will be over a chosen barrier (e.g. over 4) |
| Under | Predict the last digit will be under a chosen barrier (e.g. under 5) |

### Trade Lifecycle

```
Place Trade  →  Tick resolves  →  Win / Loss determined  →  Balance updated
```

Trade duration is set in ticks. Minimum stake is KES 10.

---

## M-Pesa Integration

Payments are handled through the Safaricom Daraja API.

### Deposit (STK Push)

1. User enters phone number and amount on the Wallet page
2. Backend sends an STK Push request to Daraja
3. User receives a prompt on their phone
4. User enters M-Pesa PIN
5. Daraja calls the callback URL
6. Backend confirms payment and credits the wallet

### Withdrawal (B2C)

1. User enters phone number and amount
2. Backend sends a B2C payment request
3. Funds are sent to the user's M-Pesa number
4. Wallet balance is debited on success

### Callback URL

The M-Pesa callback must be a publicly accessible HTTPS URL. During development, use a tunnel service:

```bash
# Using ngrok
ngrok http 8000
# Copy the HTTPS URL and set as MPESA_CALLBACK_URL in .env
```

---

## Pages and Components

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Email and password login |
| Register | `/register` | New account registration |
| Homepage | `/` | Live chart + trade panel |
| Wallet | `/wallet` | Balance, deposit, withdraw |
| History | `/history` | Trade and transaction history |

### Components

| Component | Description |
|-----------|-------------|
| `Navbar.jsx` | Top navigation with balance display and logout |
| `LiveChart.jsx` | Real-time tick chart using Lightweight Charts |
| `TradePanel.jsx` | Trade type selector, stake input, duration, place button |
| `WalletCard.jsx` | Balance card with deposit and withdraw forms |
| `TradeHistory.jsx` | Table of past trades with win/loss indicators |
| `ProtectedRoute.jsx` | Redirects unauthenticated users to login |

---

## Models Overview

All models live in `core/models.py`.

```
User (AbstractUser)
  - email, phone, balance

Trade
  - user, trade_type (ODD/EVEN/OVER/UNDER)
  - barrier, stake, duration_ticks
  - entry_tick, exit_tick
  - outcome (WIN/LOSS/PENDING)
  - payout, created_at

Tick
  - symbol, price, timestamp

Transaction
  - user, transaction_type (DEPOSIT/WITHDRAWAL)
  - amount, phone_number
  - mpesa_ref, status, created_at
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Django secret key |
| `DEBUG` | True in development |
| `MPESA_CONSUMER_KEY` | Daraja API consumer key |
| `MPESA_CONSUMER_SECRET` | Daraja API consumer secret |
| `MPESA_SHORTCODE` | M-Pesa till/paybill number |
| `MPESA_PASSKEY` | Daraja passkey |
| `MPESA_CALLBACK_URL` | Public HTTPS callback URL |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend API base URL |

---

## Requirements

### `backend/requirements.txt`

```
Django>=4.2
djangorestframework>=3.14
django-cors-headers
python-decouple
requests
```

---

## Troubleshooting

**CORS errors in the browser**

Ensure `django-cors-headers` is installed and `CORS_ALLOWED_ORIGINS` in `settings.py` includes `http://localhost:5173`.

**M-Pesa STK Push not arriving**

- Confirm credentials in `.env` are correct
- Ensure the callback URL is HTTPS and publicly reachable
- Use the Safaricom sandbox environment for testing (`https://sandbox.safaricom.co.ke`)

**Chart not loading**

Ensure the `/api/ticks/` endpoint is returning data. Seed a few tick records via the Django admin or a management command.

**Token authentication failing**

Include the token in every authenticated request header:

```
Authorization: Token your_token_here
```

**Port conflicts**

```bash
# Backend on a different port
python manage.py runserver 8001

# Update frontend .env
VITE_API_BASE_URL=http://localhost:8001/api
```

---

## Quick Start

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.