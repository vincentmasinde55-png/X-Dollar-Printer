from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from decimal import Decimal
import uuid


class User(AbstractUser):
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15)
    balance = models.DecimalField(
        max_digits=12, decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))]
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username", "phone"]

    def __str__(self):
        return f"{self.email} — KES {self.balance}"

    def credit(self, amount):
        """Add funds to wallet."""
        amount = Decimal(str(amount))
        if amount <= 0:
            raise ValueError("Credit amount must be positive.")
        self.balance += amount
        self.save(update_fields=["balance", "updated_at"])

    def debit(self, amount):
        """Remove funds from wallet."""
        amount = Decimal(str(amount))
        if amount <= 0:
            raise ValueError("Debit amount must be positive.")
        if amount > self.balance:
            raise ValueError("Insufficient balance.")
        self.balance -= amount
        self.save(update_fields=["balance", "updated_at"])


# ---------------------------------------------------------------------------
# Tick — price feed for charts and trade resolution
# ---------------------------------------------------------------------------

class Tick(models.Model):
    symbol = models.CharField(max_length=20, default="R_100")
    price = models.DecimalField(max_digits=20, decimal_places=5)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["symbol", "-timestamp"]),
        ]

    def __str__(self):
        return f"{self.symbol} @ {self.price} — {self.timestamp}"

    @property
    def last_digit(self):
        """Return the last digit of the price (used for Odd/Even/Over/Under)."""
        price_str = f"{self.price:.5f}".replace(".", "")
        return int(price_str[-1])


# ---------------------------------------------------------------------------
# Trade
# ---------------------------------------------------------------------------

class Trade(models.Model):
    class TradeType(models.TextChoices):
        ODD = "ODD", "Odd"
        EVEN = "EVEN", "Even"
        OVER = "OVER", "Over"
        UNDER = "UNDER", "Under"

    class Outcome(models.TextChoices):
        PENDING = "PENDING", "Pending"
        WIN = "WIN", "Win"
        LOSS = "LOSS", "Loss"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="trades")
    trade_type = models.CharField(max_length=10, choices=TradeType.choices)

    # Barrier is only relevant for OVER / UNDER trades (0-9)
    barrier = models.PositiveSmallIntegerField(null=True, blank=True)

    stake = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal("10.00"))]
    )
    duration_ticks = models.PositiveSmallIntegerField(default=5)
    payout_multiplier = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("1.95")
    )
    payout = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True
    )

    entry_tick = models.ForeignKey(
        Tick, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="entry_trades"
    )
    exit_tick = models.ForeignKey(
        Tick, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="exit_trades"
    )

    outcome = models.CharField(
        max_length=10,
        choices=Outcome.choices,
        default=Outcome.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email} | {self.trade_type} | {self.outcome} | KES {self.stake}"

    def resolve(self, exit_tick):
        """
        Resolve the trade against the exit tick.
        Credits wallet on win, does nothing on loss (stake already debited at placement).
        """
        from django.utils import timezone

        self.exit_tick = exit_tick
        digit = exit_tick.last_digit
        won = False

        if self.trade_type == self.TradeType.ODD:
            won = digit % 2 != 0
        elif self.trade_type == self.TradeType.EVEN:
            won = digit % 2 == 0
        elif self.trade_type == self.TradeType.OVER:
            won = digit > (self.barrier or 4)
        elif self.trade_type == self.TradeType.UNDER:
            won = digit < (self.barrier or 5)

        if won:
            self.outcome = self.Outcome.WIN
            self.payout = (self.stake * self.payout_multiplier).quantize(Decimal("0.01"))
            self.user.credit(self.payout)
        else:
            self.outcome = self.Outcome.LOSS
            self.payout = Decimal("0.00")

        self.resolved_at = timezone.now()
        self.save(update_fields=["exit_tick", "outcome", "payout", "resolved_at"])


# ---------------------------------------------------------------------------
# M-Pesa Transaction
# ---------------------------------------------------------------------------

class MpesaTransaction(models.Model):
    class TransactionType(models.TextChoices):
        DEPOSIT = "DEPOSIT", "Deposit"
        WITHDRAWAL = "WITHDRAWAL", "Withdrawal"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"
        CANCELLED = "CANCELLED", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="mpesa_transactions"
    )
    transaction_type = models.CharField(
        max_length=15, choices=TransactionType.choices
    )
    amount = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal("10.00"))]
    )
    phone_number = models.CharField(max_length=15)

    # Daraja request identifiers
    merchant_request_id = models.CharField(max_length=100, blank=True)
    checkout_request_id = models.CharField(max_length=100, blank=True, db_index=True)

    # Daraja callback / confirmation fields
    mpesa_receipt_number = models.CharField(max_length=50, blank=True)
    result_code = models.CharField(max_length=10, blank=True)
    result_desc = models.TextField(blank=True)

    # B2C specific
    conversation_id = models.CharField(max_length=100, blank=True, db_index=True)
    originator_conversation_id = models.CharField(max_length=100, blank=True)

    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"{self.transaction_type} | {self.phone_number} | "
            f"KES {self.amount} | {self.status}"
        )

    def mark_completed(self, receipt_number=""):
        """Mark as completed and credit/debit wallet."""
        self.status = self.Status.COMPLETED
        self.mpesa_receipt_number = receipt_number
        self.save(update_fields=["status", "mpesa_receipt_number", "updated_at"])

        if self.transaction_type == self.TransactionType.DEPOSIT:
            self.user.credit(self.amount)
        # Withdrawal wallet debit happens at request time; nothing to do here.

    def mark_failed(self, result_code="", result_desc=""):
        """Mark as failed and refund wallet for withdrawals."""
        self.status = self.Status.FAILED
        self.result_code = result_code
        self.result_desc = result_desc
        self.save(update_fields=["status", "result_code", "result_desc", "updated_at"])

        # Refund the wallet if a withdrawal failed after the debit
        if self.transaction_type == self.TransactionType.WITHDRAWAL:
            self.user.credit(self.amount)