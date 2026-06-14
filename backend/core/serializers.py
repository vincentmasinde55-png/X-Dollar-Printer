from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User, Tick, Trade, MpesaTransaction


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )
    confirm_password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ["id", "email", "username", "phone", "password", "confirm_password"]

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        user = User.objects.create_user(
            email=validated_data["email"],
            username=validated_data["username"],
            phone=validated_data.get("phone", ""),
            password=validated_data["password"],
        )
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(username=attrs["email"], password=attrs["password"])
        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("Account is disabled.")
        attrs["user"] = user
        return attrs


# ---------------------------------------------------------------------------
# User / Profile
# ---------------------------------------------------------------------------

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "username", "phone", "balance", "created_at"]
        read_only_fields = ["id", "email", "balance", "created_at"]


# ---------------------------------------------------------------------------
# Tick
# ---------------------------------------------------------------------------

class TickSerializer(serializers.ModelSerializer):
    last_digit = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tick
        fields = ["id", "symbol", "price", "last_digit", "timestamp"]


# ---------------------------------------------------------------------------
# Trade
# ---------------------------------------------------------------------------

class PlaceTradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trade
        fields = ["trade_type", "barrier", "stake", "duration_ticks"]

    def validate(self, attrs):
        trade_type = attrs.get("trade_type")
        barrier = attrs.get("barrier")

        if trade_type in [Trade.TradeType.OVER, Trade.TradeType.UNDER]:
            if barrier is None:
                raise serializers.ValidationError(
                    {"barrier": "Barrier is required for Over/Under trades."}
                )
            if not (0 <= barrier <= 9):
                raise serializers.ValidationError(
                    {"barrier": "Barrier must be between 0 and 9."}
                )

        if trade_type in [Trade.TradeType.ODD, Trade.TradeType.EVEN]:
            attrs["barrier"] = None

        return attrs

    def validate_stake(self, value):
        user = self.context["request"].user
        if value > user.balance:
            raise serializers.ValidationError("Insufficient balance for this stake.")
        return value


class TradeSerializer(serializers.ModelSerializer):
    entry_price = serializers.DecimalField(
        source="entry_tick.price", max_digits=20, decimal_places=5, read_only=True
    )
    exit_price = serializers.DecimalField(
        source="exit_tick.price", max_digits=20, decimal_places=5,
        read_only=True, allow_null=True
    )
    trade_type_display = serializers.CharField(
        source="get_trade_type_display", read_only=True
    )
    outcome_display = serializers.CharField(
        source="get_outcome_display", read_only=True
    )

    class Meta:
        model = Trade
        fields = [
            "id", "trade_type", "trade_type_display",
            "barrier", "stake", "duration_ticks",
            "payout_multiplier", "payout",
            "entry_price", "exit_price",
            "outcome", "outcome_display",
            "created_at", "resolved_at",
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# M-Pesa
# ---------------------------------------------------------------------------

class DepositSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=10)

    def validate_phone_number(self, value):
        # Normalise to 254XXXXXXXXX format
        value = value.strip().replace(" ", "").replace("+", "")
        if value.startswith("0"):
            value = "254" + value[1:]
        if not value.startswith("254") or len(value) != 12:
            raise serializers.ValidationError(
                "Enter a valid Kenyan phone number (e.g. 0712345678 or 254712345678)."
            )
        return value


class WithdrawSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=10)

    def validate_phone_number(self, value):
        value = value.strip().replace(" ", "").replace("+", "")
        if value.startswith("0"):
            value = "254" + value[1:]
        if not value.startswith("254") or len(value) != 12:
            raise serializers.ValidationError(
                "Enter a valid Kenyan phone number (e.g. 0712345678 or 254712345678)."
            )
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        if attrs["amount"] > user.balance:
            raise serializers.ValidationError({"amount": "Insufficient balance."})
        return attrs


class MpesaTransactionSerializer(serializers.ModelSerializer):
    transaction_type_display = serializers.CharField(
        source="get_transaction_type_display", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )

    class Meta:
        model = MpesaTransaction
        fields = [
            "id", "transaction_type", "transaction_type_display",
            "amount", "phone_number",
            "mpesa_receipt_number",
            "status", "status_display",
            "created_at", "updated_at",
        ]
        read_only_fields = fields


class PaymentStatusSerializer(serializers.ModelSerializer):
    """Lightweight serializer for polling payment status."""
    class Meta:
        model = MpesaTransaction
        fields = ["id", "status", "result_desc", "mpesa_receipt_number", "updated_at"]
        read_only_fields = fields