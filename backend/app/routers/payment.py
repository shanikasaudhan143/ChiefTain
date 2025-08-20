# app/routers/payments.py
from fastapi import APIRouter, HTTPException, Request
from app.supabase_client import supabase
import os, razorpay, hmac, hashlib, json
from app.email_utils import send_booking_email
router = APIRouter(prefix="/booking", tags=["payments"])

key_id = os.getenv("RAZORPAY_KEY_ID")
key_secret = os.getenv("RAZORPAY_KEY_SECRET")
client = razorpay.Client(auth=(key_id, key_secret))

@router.post("/{booking_id}/create-order")
async def create_order(booking_id: str):
    # Fetch booking (ensure still pending & stock ok)
    b = supabase.table("bookings").select("*").eq("id", booking_id).single().execute().data
    if not b:
        raise HTTPException(404, "Booking not found")
    if b["payment_status"] not in ("init", "failed"):
        raise HTTPException(400, "Payment already initiated")

    amount = int(b["amount_paise"] or 0)
    if amount <= 0:
        raise HTTPException(400, "Booking amount is zero/invalid")

    order = client.order.create({
        "amount": amount,           # in paise
        "currency": b.get("currency", "INR"),
        "receipt": f"bk_{booking_id}",
        "payment_capture": 1        # auto-capture
    })

    # persist order id
    supabase.table("bookings").update({
        "payment_order_id": order["id"],
        "payment_status": "created"
    }).eq("id", booking_id).execute()

    # optional: ledger row
    supabase.table("payments").insert({
        "booking_id": booking_id,
        "order_id": order["id"],
        "amount_paise": amount,
        "currency": b.get("currency", "INR"),
        "status": "created",
        "raw_payload": order
    }).execute()

    return {"key_id": key_id, "order": order}  # frontend needs key_id + order.id

@router.post("/payment/verify")
async def verify_payment(payload: dict):
    # payload contains: razorpay_order_id, razorpay_payment_id, razorpay_signature
    order_id = payload.get("razorpay_order_id")
    payment_id = payload.get("razorpay_payment_id")
    signature = payload.get("razorpay_signature")

    if not (order_id and payment_id and signature):
        raise HTTPException(400, "Missing payment fields")

    # Verify HMAC SHA256
    body = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(key_secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        # log failed attempt
        supabase.table("payments").insert({
            "order_id": order_id, "payment_id": payment_id,
            "signature": signature, "status": "failed", "raw_payload": payload, "amount_paise": 0, "currency": "INR"
        }).execute()
        raise HTTPException(400, "Invalid signature")

    # Find booking by order_id
    bk = supabase.table("bookings").select("*").eq("payment_order_id", order_id).single().execute().data
    if not bk:
        raise HTTPException(404, "Booking not found for order")

    # Update booking as paid + confirm room
    supabase.table("bookings").update({
        "payment_status": "paid",
        "payment_id": payment_id,
        "status": "confirmed"  # you already email on confirm in booking.py
    }).eq("id", bk["id"]).execute()
    
    try:
        email_content = f"""
        <p>Dear {bk['name']},</p>
        <p>Your booking has been confirmed!</p>
        <p><strong>Room:</strong> {bk['room_type']}<br>
        <strong>Dates:</strong> {bk['check_in']} to {bk['check_out']}</p>
        """
        send_booking_email(
            to_email=bk["user_id"],
            subject="Booking Confirmed",
            content=email_content
        )
    except Exception as e:
        # don't fail payment verify if email provider hiccups; just log it
        # (replace print with your logger if you have one)
        print(f"Email send failed for booking {bk['id']}: {e}")
        
    # Ledger
    supabase.table("payments").insert({
        "booking_id": bk["id"],
        "order_id": order_id,
        "payment_id": payment_id,
        "signature": signature,
        "status": "captured",
        "amount_paise": bk.get("amount_paise", 0),
        "currency": bk.get("currency", "INR"),
        "raw_payload": payload
    }).execute()

    return {"ok": True}

@router.post("/webhook/razorpay")
async def razorpay_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(400, "Bad signature")

    evt = await request.json()
    # Upsert payments row and adjust booking/payment_status based on evt["event"]
    # ...
    return {"ok": True}
