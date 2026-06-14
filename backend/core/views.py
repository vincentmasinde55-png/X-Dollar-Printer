import base64
import logging
import requests
from datetime import datetime
from decimal import Decimal

from decouple import config
from django.utils import timezone
from django.db import transaction as db_transaction
from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import MpesaTransaction, Tick, Trade, User
from .serializers import (
    DepositSerializer,
    LoginSerializer,
    MpesaTransactionSerializer,
    PaymentStatusSerializer,
    PlaceTradeSerializer,
    RegisterSerializer,
    TickSerializer,
    TradeSerializer,
    UserSerializer,
    WithdrawSerializer,
)

logger = logging.getLogger(__name__)


# ===========================================================================
# M-Pesa Daraja helpers
# ===========================================================================

def _daraja_token():
    """Fetch a short-lived OAuth access token from Daraja."""
    consumer_key = config("MPESA_CONSUMER_KEY")
    consumer_secret = config("MPESA_CONSUMER_SECRET")
    url = config(
        "MPESA_AUTH_URL",
        default="https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    )
    credentials = base64.b64encode(
        f"{consumer_key}:{consumer_secret}".encode()
    ).decode()
    response = requests.get(
        url, headers={"Authorization": f"Basic {credentials}"}, timeout=10
    )
    response.raise_for_status()
    return response.json()["access_token"]


def _stk_password():
    """Generate the base64-encoded STK Push password."""
    shortcode = config("MPESA_SHORTCODE")
    passkey = config("MPESA_PASSKEY")
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    raw = f"{shortcode}{passkey}{timestamp}"
    return base64.b64encode(raw.encode()).decode(), timestamp


def _initiate_stk_push(phone_number, amount, account_reference, transaction_desc):
    """
    Send an STK Push request to Daraja.
    Returns the full Daraja JSON response.
    """
    token = _daraja_token()
    password, timestamp = _stk_password()
    shortcode = config("MPESA_SHORTCODE")
    callback_url = config("MPESA_CALLBACK_URL")

    url = config(
        "MPESA_STK_URL",
        default="https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    )
    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(amount),          # Daraja requires an integer
        "PartyA": phone_number,
        "PartyB": shortcode,
        "PhoneNumber": phone_number,
        "CallBackURL": callback_url,
        "AccountReference": account_reference,
        "TransactionDesc": transaction_desc,
    }
    response = requests.post(
        url,
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def _initiate_b2c(phone_number, amount, occasion="Withdrawal"):
    """
    Send a B2C payment request to Daraja.
    Returns the full Daraja JSON response.
    """
    token = _daraja_token()
    url = config(
        "MPESA_B2C_URL",
        default="https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest",
    )
    payload = {
        "InitiatorName": config("MPESA_B2C_INITIATOR"),
        "SecurityCredential": config("MPESA_B2C_SECURITY_CREDENTIAL"),
        "CommandID": "BusinessPayment",
        "Amount": int(amount),
        "PartyA": config("MPESA_B2C_SHORTCODE"),
        "PartyB": phone_number,
        "Remarks": occasion,
        "QueueTimeOutURL": config("MPESA_B2C_TIMEOUT_URL", default=config("MPESA_CALLBACK_URL")),
        "ResultURL": config("MPESA_B2C_RESULT_URL", default=config("MPESA_CALLBACK_URL").rstrip("/") + "/b2c/"),
        "Occasion": occasion,
    }
    response = requests.post(
        url,
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


# ===========================================================================
# Auth Views
# ===========================================================================

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, _ = Token.objects.get_or_create(user=user)
            return Response(
                {
                    "message": "Account created successfully.",
                    "token": token.key,
                    "user": UserSerializer(user).data,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data["user"]
            token, _ = Token.objects.get_or_create(user=user)
            return Response(
                {
                    "token": token.key,
                    "user": UserSerializer(user).data,
                }
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.user.auth_token.delete()
        return Response({"message": "Logged out successfully."})


# ===========================================================================
# Profile / Balance
# ===========================================================================

class ProfileView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BalanceView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        request.user.refresh_from_db()
        return Response({"balance": request.user.balance})


# ===========================================================================
# Tick Feed — used by the live chart
# ===========================================================================

class TickListView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Return the latest N ticks for a given symbol.
        Query params:
          symbol  — default R_100
          limit   — default 100, max 500
        """
        symbol = request.query_params.get("symbol", "R_100")
        try:
            limit = min(int(request.query_params.get("limit", 100)), 500)
        except ValueError:
            limit = 100

        ticks = Tick.objects.filter(symbol=symbol)[:limit]
        return Response(TickSerializer(ticks, many=True).data)


class LatestTickView(APIView):
    """Single latest tick — polled by the frontend every second."""
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        symbol = request.query_params.get("symbol", "R_100")
        tick = Tick.objects.filter(symbol=symbol).first()
        if not tick:
            return Response({"detail": "No tick data available."}, status=404)
        return Response(TickSerializer(tick).data)


# ===========================================================================
# Trading
# ===========================================================================

class PlaceTradeView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    @db_transaction.atomic
    def post(self, request):
        serializer = PlaceTradeSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        data = serializer.validated_data
        stake = data["stake"]

        # Get the latest tick as the entry tick
        symbol = request.data.get("symbol", "R_100")
        entry_tick = Tick.objects.filter(symbol=symbol).first()
        if not entry_tick:
            return Response(
                {"detail": "No price data available. Cannot place trade."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Debit stake immediately
        user.debit(stake)

        trade = Trade.objects.create(
            user=user,
            trade_type=data["trade_type"],
            barrier=data.get("barrier"),
            stake=stake,
            duration_ticks=data.get("duration_ticks", 5),
            entry_tick=entry_tick,
        )

        return Response(
            {
                "message": "Trade placed successfully.",
                "trade": TradeSerializer(trade).data,
                "balance": user.balance,
            },
            status=status.HTTP_201_CREATED,
        )


class ResolveTradeView(APIView):
    """
    Called by the frontend after the required number of ticks have passed.
    The frontend tracks elapsed ticks and calls this endpoint with the
    exit tick id to settle the trade.
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    @db_transaction.atomic
    def post(self, request, trade_id):
        try:
            trade = Trade.objects.select_for_update().get(
                id=trade_id, user=request.user, outcome=Trade.Outcome.PENDING
            )
        except Trade.DoesNotExist:
            return Response(
                {"detail": "Trade not found or already resolved."},
                status=status.HTTP_404_NOT_FOUND,
            )

        tick_id = request.data.get("exit_tick_id")
        if not tick_id:
            # Auto-resolve against the latest tick if no tick id provided
            exit_tick = Tick.objects.filter(
                symbol=trade.entry_tick.symbol if trade.entry_tick else "R_100"
            ).first()
        else:
            try:
                exit_tick = Tick.objects.get(id=tick_id)
            except Tick.DoesNotExist:
                return Response(
                    {"detail": "Exit tick not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        trade.resolve(exit_tick)
        request.user.refresh_from_db()

        return Response(
            {
                "trade": TradeSerializer(trade).data,
                "balance": request.user.balance,
            }
        )


class TradeHistoryView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        trades = Trade.objects.filter(user=request.user).select_related(
            "entry_tick", "exit_tick"
        )
        return Response(TradeSerializer(trades, many=True).data)


class ActiveTradesView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        trades = Trade.objects.filter(
            user=request.user, outcome=Trade.Outcome.PENDING
        ).select_related("entry_tick")
        return Response(TradeSerializer(trades, many=True).data)


# ===========================================================================
# M-Pesa — Deposit (STK Push)
# ===========================================================================

class DepositView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = DepositSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        phone_number = serializer.validated_data["phone_number"]
        amount = serializer.validated_data["amount"]

        # Create a PENDING transaction record before calling Daraja
        mpesa_tx = MpesaTransaction.objects.create(
            user=request.user,
            transaction_type=MpesaTransaction.TransactionType.DEPOSIT,
            amount=amount,
            phone_number=phone_number,
            status=MpesaTransaction.Status.PENDING,
        )

        try:
            daraja_response = _initiate_stk_push(
                phone_number=phone_number,
                amount=amount,
                account_reference=f"GDP-{request.user.id}",
                transaction_desc="Gadafi Dollar Printer Deposit",
            )
        except requests.RequestException as exc:
            mpesa_tx.mark_failed(result_desc=str(exc))
            logger.error("STK Push failed for user %s: %s", request.user.email, exc)
            return Response(
                {"detail": "Could not reach M-Pesa. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        response_code = daraja_response.get("ResponseCode", "1")
        if response_code != "0":
            error_msg = daraja_response.get("ResponseDescription", "STK Push failed.")
            mpesa_tx.mark_failed(result_code=response_code, result_desc=error_msg)
            return Response({"detail": error_msg}, status=status.HTTP_400_BAD_REQUEST)

        # Save Daraja identifiers for callback matching
        mpesa_tx.merchant_request_id = daraja_response.get("MerchantRequestID", "")
        mpesa_tx.checkout_request_id = daraja_response.get("CheckoutRequestID", "")
        mpesa_tx.save(update_fields=["merchant_request_id", "checkout_request_id", "updated_at"])

        return Response(
            {
                "message": "STK Push sent. Enter your M-Pesa PIN on your phone.",
                "transaction_id": str(mpesa_tx.id),
                "checkout_request_id": mpesa_tx.checkout_request_id,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class MpesaCallbackView(APIView):
    """
    Daraja STK Push callback (deposit confirmation).
    Safaricom calls this URL after the user completes or cancels the prompt.
    No authentication — Daraja calls this directly.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            body = request.data.get("Body", {})
            stk_callback = body.get("stkCallback", {})
            checkout_request_id = stk_callback.get("CheckoutRequestID", "")
            result_code = str(stk_callback.get("ResultCode", "1"))
            result_desc = stk_callback.get("ResultDesc", "")

            mpesa_tx = MpesaTransaction.objects.get(
                checkout_request_id=checkout_request_id,
                transaction_type=MpesaTransaction.TransactionType.DEPOSIT,
            )

            if result_code == "0":
                # Successful payment — extract receipt number
                callback_metadata = stk_callback.get("CallbackMetadata", {})
                items = callback_metadata.get("Item", [])
                receipt = next(
                    (i["Value"] for i in items if i.get("Name") == "MpesaReceiptNumber"),
                    "",
                )
                mpesa_tx.mark_completed(receipt_number=receipt)
                logger.info(
                    "Deposit completed: %s | receipt: %s", checkout_request_id, receipt
                )
            else:
                mpesa_tx.mark_failed(result_code=result_code, result_desc=result_desc)
                logger.warning(
                    "Deposit failed: %s | code: %s | %s",
                    checkout_request_id, result_code, result_desc,
                )

        except MpesaTransaction.DoesNotExist:
            logger.error(
                "Callback received for unknown CheckoutRequestID: %s", checkout_request_id
            )
        except Exception as exc:
            logger.exception("Unexpected error in M-Pesa callback: %s", exc)

        # Always return 200 to Daraja — they retry on non-200
        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})


# ===========================================================================
# M-Pesa — Withdrawal (B2C)
# ===========================================================================

class WithdrawView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    @db_transaction.atomic
    def post(self, request):
        serializer = WithdrawSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        phone_number = serializer.validated_data["phone_number"]
        amount = serializer.validated_data["amount"]

        # Debit wallet immediately; refunded in mark_failed() if B2C fails
        request.user.debit(amount)

        mpesa_tx = MpesaTransaction.objects.create(
            user=request.user,
            transaction_type=MpesaTransaction.TransactionType.WITHDRAWAL,
            amount=amount,
            phone_number=phone_number,
            status=MpesaTransaction.Status.PENDING,
        )

        try:
            daraja_response = _initiate_b2c(
                phone_number=phone_number,
                amount=amount,
                occasion="Gadafi Dollar Printer Withdrawal",
            )
        except requests.RequestException as exc:
            mpesa_tx.mark_failed(result_desc=str(exc))
            logger.error("B2C failed for user %s: %s", request.user.email, exc)
            return Response(
                {"detail": "Could not reach M-Pesa. Your balance has been refunded."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        response_code = daraja_response.get("ResponseCode", "1")
        if response_code != "0":
            error_msg = daraja_response.get("ResponseDescription", "B2C request failed.")
            mpesa_tx.mark_failed(result_code=response_code, result_desc=error_msg)
            return Response({"detail": error_msg}, status=status.HTTP_400_BAD_REQUEST)

        mpesa_tx.conversation_id = daraja_response.get("ConversationID", "")
        mpesa_tx.originator_conversation_id = daraja_response.get(
            "OriginatorConversationID", ""
        )
        mpesa_tx.save(
            update_fields=["conversation_id", "originator_conversation_id", "updated_at"]
        )

        request.user.refresh_from_db()
        return Response(
            {
                "message": "Withdrawal initiated. Funds will arrive shortly.",
                "transaction_id": str(mpesa_tx.id),
                "balance": request.user.balance,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class B2CResultView(APIView):
    """
    Daraja B2C result callback (withdrawal confirmation).
    No authentication — Daraja calls this directly.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            result = request.data.get("Result", {})
            result_code = str(result.get("ResultCode", "1"))
            result_desc = result.get("ResultDesc", "")
            conversation_id = result.get("ConversationID", "")

            mpesa_tx = MpesaTransaction.objects.get(conversation_id=conversation_id)

            if result_code == "0":
                # Extract receipt from ResultParameters
                params = result.get("ResultParameters", {}).get("ResultParameter", [])
                receipt = next(
                    (p["Value"] for p in params if p.get("Key") == "TransactionReceipt"),
                    "",
                )
                mpesa_tx.mark_completed(receipt_number=receipt)
                logger.info(
                    "Withdrawal completed: %s | receipt: %s", conversation_id, receipt
                )
            else:
                mpesa_tx.mark_failed(result_code=result_code, result_desc=result_desc)
                logger.warning(
                    "Withdrawal failed: %s | code: %s | %s",
                    conversation_id, result_code, result_desc,
                )

        except MpesaTransaction.DoesNotExist:
            logger.error(
                "B2C result for unknown ConversationID: %s", conversation_id
            )
        except Exception as exc:
            logger.exception("Unexpected error in B2C result callback: %s", exc)

        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})


class B2CTimeoutView(APIView):
    """
    Daraja B2C queue timeout callback.
    Marks the transaction as failed and refunds the wallet.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            result = request.data.get("Result", {})
            conversation_id = result.get("ConversationID", "")
            mpesa_tx = MpesaTransaction.objects.get(conversation_id=conversation_id)
            mpesa_tx.mark_failed(
                result_code="408",
                result_desc="B2C request timed out in Daraja queue.",
            )
            logger.warning("B2C timeout for ConversationID: %s", conversation_id)
        except MpesaTransaction.DoesNotExist:
            logger.error(
                "B2C timeout for unknown ConversationID: %s",
                request.data.get("Result", {}).get("ConversationID", "unknown"),
            )
        except Exception as exc:
            logger.exception("Unexpected error in B2C timeout: %s", exc)

        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})


# ===========================================================================
# Payment Status Polling
# ===========================================================================

class PaymentStatusView(APIView):
    """
    Frontend polls this endpoint after initiating a deposit or withdrawal
    to check whether the transaction has been confirmed or failed.

    GET /api/payment/status/<transaction_id>/
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, transaction_id):
        try:
            tx = MpesaTransaction.objects.get(
                id=transaction_id, user=request.user
            )
        except MpesaTransaction.DoesNotExist:
            return Response(
                {"detail": "Transaction not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        request.user.refresh_from_db()
        return Response(
            {
                **PaymentStatusSerializer(tx).data,
                "balance": request.user.balance,
            }
        )


# ===========================================================================
# Transaction History
# ===========================================================================

class TransactionHistoryView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        transactions = MpesaTransaction.objects.filter(user=request.user)
        return Response(MpesaTransactionSerializer(transactions, many=True).data)