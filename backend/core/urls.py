from django.urls import path
from . import views

urlpatterns = [
    # Auth
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.LogoutView.as_view(), name="logout"),

    # Profile / Balance
    path("profile/", views.ProfileView.as_view(), name="profile"),
    path("balance/", views.BalanceView.as_view(), name="balance"),

    # Tick feed
    path("ticks/", views.TickListView.as_view(), name="tick-list"),
    path("ticks/latest/", views.LatestTickView.as_view(), name="tick-latest"),

    # Trading
    path("trades/place/", views.PlaceTradeView.as_view(), name="trade-place"),
    path("trades/<uuid:trade_id>/resolve/", views.ResolveTradeView.as_view(), name="trade-resolve"),
    path("trades/history/", views.TradeHistoryView.as_view(), name="trade-history"),
    path("trades/active/", views.ActiveTradesView.as_view(), name="trade-active"),

    # M-Pesa Deposit
    path("payment/deposit/", views.DepositView.as_view(), name="deposit"),
    path("payment/callback/", views.MpesaCallbackView.as_view(), name="mpesa-callback"),

    # M-Pesa Withdrawal
    path("payment/withdraw/", views.WithdrawView.as_view(), name="withdraw"),
    path("payment/b2c/result/", views.B2CResultView.as_view(), name="b2c-result"),
    path("payment/b2c/timeout/", views.B2CTimeoutView.as_view(), name="b2c-timeout"),

    # Payment status polling
    path("payment/status/<uuid:transaction_id>/", views.PaymentStatusView.as_view(), name="payment-status"),

    # Transaction history
    path("transactions/", views.TransactionHistoryView.as_view(), name="transaction-history"),
]