# Updated `app/routers/booking.py`

import logging
import re
from datetime import datetime
from fastapi import APIRouter, Query, HTTPException
from typing import Optional

from app.schemas import BookingRequest
from app.supabase_client import supabase
from app.email_utils import send_booking_email

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/booking",
    tags=["booking"]
)

# --------------------
# Helpers
# --------------------

def parse_date(date_str: str) -> datetime.date:
    return datetime.strptime(date_str, "%Y-%m-%d").date()

def is_valid_email(email: str) -> bool:
    return re.match(r"[^@]+@[^@]+\.[^@]+", email) is not None

def nights(ci: str, co: str) -> int:
    try:
        d1 = parse_date(ci)
        d2 = parse_date(co)
        return max(1, (d2 - d1).days)
    except Exception:
        return 1

# --------------------
# Routes
# --------------------

@router.post("/")
async def create_booking(req: BookingRequest):
    """Create a booking as PENDING + initialize payment fields.
    Now returns the inserted booking row (incl. id) so frontend can start payment.
    """
    logger.info(f"🔹 Received booking request: {req.dict()}")

    if not is_valid_email(req.user_id):
        logger.warning("❌ Invalid email format")
        raise HTTPException(status_code=400, detail="Invalid email format.")

    # Capacity check against confirmed bookings of the same room_type
    existing = (
        supabase.table("bookings").select("*")
        .eq("room_type", req.room_type).eq("status", "confirmed").execute()
    )
    logger.info(f"🔍 Existing confirmed bookings: {len(existing.data)}")

    overlap_count = 0
    for b in existing.data:
        if not (req.check_out < b["check_in"] or req.check_in > b["check_out"]):
            overlap_count += 1

    room_limits = {"Deluxe": 10, "Suite": 20, "Standard": 30}
    room_limit = room_limits.get(req.room_type, 0)

    if overlap_count >= room_limit:
        logger.warning(
            f"⚠️ Booking conflict: {overlap_count} overlapping bookings found for {req.room_type}"
        )
        availability = check_availability(req.check_in, req.check_out)
        return {
            "message": f"No available {req.room_type} rooms for these dates.",
            "available_rooms": availability,
        }

    # --------------------
    # 💰 Pricing (per-night base × nights)
    # --------------------
    base = {"Standard": 1500_00, "Deluxe": 2500_00, "Suite": 4000_00}  # paise/night
    num_nights = nights(req.check_in, req.check_out)
    amount_paise = base.get(req.room_type, 1500_00) * num_nights
    currency = "INR"

    confirmation = (
        f"Booking request for {req.name}, {req.room_type} room from "
        f"{req.check_in} to {req.check_out}."
    )

    insert_res = supabase.table("bookings").insert({
        "user_id": req.user_id,
        "name": req.name,
        "room_type": req.room_type,
        "check_in": req.check_in,
        "check_out": req.check_out,
        "confirmation": confirmation,
        "status": "pending",
        # payment fields
        "amount_paise": amount_paise,
        "currency": currency,
        "payment_status": "init",
    }).execute()

    row = (insert_res.data or [None])[0]
    if not row:
        raise HTTPException(status_code=500, detail="Failed to create booking")

    logger.info("✅ Booking request inserted as 'pending' with pricing & payment init")
    return {"message": "Booking request submitted!", "booking": row}


@router.get("/")
async def get_bookings():
    data = supabase.table("bookings").select("*").order("created_at").execute()
    logger.info(f"📦 Returning {len(data.data)} bookings")
    return {"bookings": data.data}


@router.patch("/{booking_id}/status")
async def update_booking_status(booking_id: str, status: str):
    logger.info(f"🔄 Updating booking {booking_id} to status '{status}'")

    data = supabase.table("bookings").select("*").eq("id", booking_id).single().execute()
    booking = data.data

    if not booking:
        logger.error(f"❌ Booking ID {booking_id} not found")
        return {"message": "Booking not found"}

    if status == "confirmed":
        logger.info("📧 Sending confirmation email")
        email_content = f"""
        <p>Dear {booking['name']},</p>
        <p>Your booking has been confirmed!</p>
        <p><strong>Room:</strong> {booking['room_type']}<br>
        <strong>Dates:</strong> {booking['check_in']} to {booking['check_out']}</p>
        """
        send_booking_email(
            to_email=booking["user_id"],
            subject="Booking Confirmed",
            content=email_content,
        )
    elif status == "rejected":
        logger.info("📧 Sending rejection email")
        email_content = f"""
        <p>Dear {booking['name']},</p>
        <p>Unfortunately, we do not have availability for the requested dates.</p>
        <p>Please consider booking different dates. We apologize for the inconvenience.</p>
        """
        send_booking_email(
            to_email=booking["user_id"],
            subject="Booking Not Available",
            content=email_content,
        )

    supabase.table("bookings").update({"status": status}).eq("id", booking_id).execute()
    logger.info(f"✅ Booking {booking_id} updated to '{status}'")

    return {"message": f"Booking marked as {status}"}


@router.get("/availability/")
def check_availability(
    check_in: str = Query(...),
    check_out: str = Query(...),
    room_type: Optional[str] = None,
):
    logger.info(f"📅 Checking availability from {check_in} to {check_out}")

    existing = supabase.table("bookings").select("*").eq("status", "confirmed").execute()
    logger.info(f"🔍 Fetched {len(existing.data)} confirmed bookings")

    room_counts = {"Deluxe": 10, "Suite": 20, "Standard": 30}

    user_check_in = parse_date(check_in)
    user_check_out = parse_date(check_out)

    for b in existing.data:
        b_check_in = parse_date(b["check_in"])
        b_check_out = parse_date(b["check_out"])

        if not (user_check_out <= b_check_in or user_check_in > b_check_out):
            rt = b["room_type"]
            if rt in room_counts:
                room_counts[rt] = max(0, room_counts[rt] - 1)

    logger.info(f"✅ Final room availability: {room_counts}")
    return {rt: room_counts[rt] for rt in room_counts} if not room_type else {room_type: room_counts.get(room_type, 0)}


@router.delete("/{booking_id}")
async def delete_booking(booking_id: str):
    supabase.table("bookings").delete().eq("id", booking_id).execute()
    logger.info(f"🗑️ Deleted booking {booking_id}")
    return {"message": "Booking deleted"}