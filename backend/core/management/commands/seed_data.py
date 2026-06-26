"""
Management command to seed the database with demo data:
  - A handful of test users with wallet balances
  - A simulated tick history for the R_100 synthetic index
  - Some resolved and pending trades for the demo user
  - Sample M-Pesa deposit/withdrawal transactions

Usage:
    python manage.py seed_data
    python manage.py seed_data --flush      # wipe existing seeded data first
    python manage.py seed_data --ticks 500  # control how many ticks to generate
"""

import random
from decimal import Decimal, ROUND_DOWN

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import MpesaTransaction, Tick, Trade, User


DEMO_USERS = [
    {
        "username": "demo_trader",
        "email": "demo@optafx.test",
        "phone": "254712345678",
        "password": "DemoPass123!",
        "balance": Decimal("5000.00"),
    },
    {
        "username": "jane_doe",
        "email": "jane@optafx.test",
        "phone": "254722334455",
        "password": "DemoPass123!",
        "balance": Decimal("1500.00"),
    },
    {
        "username": "kim_otieno",
        "email": "kim@optafx.test",
        "phone": "254733445566",
        "password": "DemoPass123!",
        "balance": Decimal("250.00"),
    },
]

SYMBOL = "R_100"
BASE_PRICE = Decimal("100000.00000")
TICK_STEP = Decimal("0.50000")  # max absolute movement per tick


class Command(BaseCommand):
    help = "Seed the database with demo users, ticks, trades, and M-Pesa transactions."

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete existing seeded ticks, trades, transactions and demo users first.",
        )
        parser.add_argument(
            "--ticks",
            type=int,
            default=300,
            help="Number of ticks to generate for the price feed (default: 300).",
        )

    def handle(self, *args, **options):
        flush = options["flush"]
        tick_count = options["ticks"]

        if flush:
            self._flush()

        with transaction.atomic():
            users = self._seed_users()
            ticks = self._seed_ticks(tick_count)
            self._seed_trades(users, ticks)
            self._seed_mpesa_transactions(users)

        self.stdout.write(self.style.SUCCESS("Database seeded successfully."))
        self.stdout.write("")
        self.stdout.write("Demo logins (email / password):")
        for u in DEMO_USERS:
            self.stdout.write(f"  {u['email']} / {u['password']}")

    # -----------------------------------------------------------------
    # Flush
    # -----------------------------------------------------------------
    def _flush(self):
        self.stdout.write("Flushing existing seeded data…")

        emails = [u["email"] for u in DEMO_USERS]
        existing_users = User.objects.filter(email__in=emails)

        Trade.objects.filter(user__in=existing_users).delete()
        MpesaTransaction.objects.filter(user__in=existing_users).delete()
        Tick.objects.filter(symbol=SYMBOL).delete()
        existing_users.delete()

        self.stdout.write(self.style.WARNING("  Removed previous seed data."))

    # -----------------------------------------------------------------
    # Users
    # -----------------------------------------------------------------
    def _seed_users(self):
        self.stdout.write("Seeding users…")
        users = []

        for data in DEMO_USERS:
            user, created = User.objects.get_or_create(
                email=data["email"],
                defaults={
                    "username": data["username"],
                    "phone": data["phone"],
                    "balance": data["balance"],
                },
            )
            if created:
                user.set_password(data["password"])
                user.save(update_fields=["password"])
                self.stdout.write(f"  Created user {user.email}")
            else:
                # Keep balance in sync with seed config when re-running
                user.balance = data["balance"]
                user.phone = data["phone"]
                user.save(update_fields=["balance", "phone", "updated_at"])
                self.stdout.write(f"  Updated user {user.email}")

            users.append(user)

        return users

    # -----------------------------------------------------------------
    # Ticks
    # -----------------------------------------------------------------
    def _seed_ticks(self, count):
        self.stdout.write(f"Seeding {count} ticks for {SYMBOL}…")

        existing = Tick.objects.filter(symbol=SYMBOL).count()
        if existing >= count:
            self.stdout.write(
                f"  {existing} ticks already exist for {SYMBOL}; skipping generation."
            )
            return list(Tick.objects.filter(symbol=SYMBOL)[:50])

        price = BASE_PRICE
        ticks_to_create = []
        now = timezone.now()

        for i in range(count):
            # Random walk: small up/down movement each tick
            step = Decimal(random.uniform(-1, 1)).quantize(
                TICK_STEP, rounding=ROUND_DOWN
            ) * (TICK_STEP / TICK_STEP)
            movement = (Decimal(random.uniform(-1, 1)) * TICK_STEP).quantize(
                Decimal("0.00001")
            )
            price = (price + movement).quantize(Decimal("0.00001"))
            if price <= 0:
                price = BASE_PRICE

            ticks_to_create.append(
                Tick(
                    symbol=SYMBOL,
                    price=price,
                    # Spread timestamps a couple of seconds apart, oldest first.
                    # auto_now_add overrides this on save(), so we bulk_create
                    # and patch timestamps afterwards.
                    timestamp=now,
                )
            )

        created_ticks = Tick.objects.bulk_create(ticks_to_create)

        # bulk_create bypasses auto_now_add in some backends, so backfill
        # timestamps explicitly with a gentle spread (1 tick ≈ 2 seconds apart).
        for idx, tick in enumerate(created_ticks):
            tick.timestamp = now - timezone.timedelta(seconds=(len(created_ticks) - idx) * 2)
        Tick.objects.bulk_update(created_ticks, ["timestamp"])

        self.stdout.write(self.style.SUCCESS(f"  Created {len(created_ticks)} ticks."))

        # Return newest-first (matches model Meta.ordering) for use in trades
        return list(Tick.objects.filter(symbol=SYMBOL).order_by("-timestamp")[:50])

    # -----------------------------------------------------------------
    # Trades
    # -----------------------------------------------------------------
    def _seed_trades(self, users, recent_ticks):
        self.stdout.write("Seeding sample trades…")

        if len(recent_ticks) < 2:
            self.stdout.write(
                self.style.WARNING("  Not enough ticks to create sample trades; skipping.")
            )
            return

        demo_user = users[0]

        # Already has trades? skip to keep command idempotent-ish
        if Trade.objects.filter(user=demo_user).exists():
            self.stdout.write("  Demo user already has trades; skipping.")
            return

        sample_specs = [
            # (trade_type, barrier, stake, outcome)
            (Trade.TradeType.EVEN, None, Decimal("50.00"), Trade.Outcome.WIN),
            (Trade.TradeType.ODD, None, Decimal("100.00"), Trade.Outcome.LOSS),
            (Trade.TradeType.OVER, 4, Decimal("75.00"), Trade.Outcome.WIN),
            (Trade.TradeType.UNDER, 5, Decimal("25.00"), Trade.Outcome.LOSS),
            (Trade.TradeType.EVEN, None, Decimal("10.00"), Trade.Outcome.PENDING),
        ]

        entry_tick = recent_ticks[-1]
        exit_tick = recent_ticks[-2] if len(recent_ticks) > 1 else recent_ticks[-1]

        created = 0
        for trade_type, barrier, stake, outcome in sample_specs:
            trade = Trade(
                user=demo_user,
                trade_type=trade_type,
                barrier=barrier,
                stake=stake,
                duration_ticks=5,
                entry_tick=entry_tick,
            )

            if outcome == Trade.Outcome.PENDING:
                trade.outcome = Trade.Outcome.PENDING
            else:
                trade.exit_tick = exit_tick
                trade.outcome = outcome
                trade.resolved_at = timezone.now()
                if outcome == Trade.Outcome.WIN:
                    trade.payout = (stake * trade.payout_multiplier).quantize(Decimal("0.01"))
                else:
                    trade.payout = Decimal("0.00")

            trade.save()
            created += 1

        self.stdout.write(self.style.SUCCESS(f"  Created {created} trades for {demo_user.email}."))

    # -----------------------------------------------------------------
    # M-Pesa Transactions
    # -----------------------------------------------------------------
    def _seed_mpesa_transactions(self, users):
        self.stdout.write("Seeding M-Pesa transactions…")

        demo_user = users[0]

        if MpesaTransaction.objects.filter(user=demo_user).exists():
            self.stdout.write("  Demo user already has transactions; skipping.")
            return

        sample_specs = [
            (
                MpesaTransaction.TransactionType.DEPOSIT,
                Decimal("1000.00"),
                MpesaTransaction.Status.COMPLETED,
                "QFL7XXXX01",
            ),
            (
                MpesaTransaction.TransactionType.DEPOSIT,
                Decimal("500.00"),
                MpesaTransaction.Status.COMPLETED,
                "QFL7XXXX02",
            ),
            (
                MpesaTransaction.TransactionType.WITHDRAWAL,
                Decimal("200.00"),
                MpesaTransaction.Status.COMPLETED,
                "QFL7XXXX03",
            ),
            (
                MpesaTransaction.TransactionType.DEPOSIT,
                Decimal("300.00"),
                MpesaTransaction.Status.PENDING,
                "",
            ),
            (
                MpesaTransaction.TransactionType.WITHDRAWAL,
                Decimal("150.00"),
                MpesaTransaction.Status.FAILED,
                "",
            ),
        ]

        created = 0
        for tx_type, amount, status, receipt in sample_specs:
            tx = MpesaTransaction(
                user=demo_user,
                transaction_type=tx_type,
                amount=amount,
                phone_number=demo_user.phone,
                status=status,
                mpesa_receipt_number=receipt,
                checkout_request_id=f"ws_CO_{random.randint(10**10, 10**11 - 1)}"
                if tx_type == MpesaTransaction.TransactionType.DEPOSIT
                else "",
                conversation_id=f"AG_{random.randint(10**8, 10**9 - 1)}"
                if tx_type == MpesaTransaction.TransactionType.WITHDRAWAL
                else "",
                result_desc="Demo seeded transaction."
                if status != MpesaTransaction.Status.PENDING
                else "",
            )
            tx.save()
            created += 1

        self.stdout.write(
            self.style.SUCCESS(f"  Created {created} M-Pesa transactions for {demo_user.email}.")
        )
