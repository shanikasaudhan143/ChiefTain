import React, { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = "http://localhost:8000"; // keep in sync with your backend

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });
}

export default function PaymentPage() {
  const [bookingId, setBookingId] = useState("");
  const [creating, setCreating] = useState(false);
  const [order, setOrder] = useState(null);
  const [keyId, setKeyId] = useState("");
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    loadRazorpay()
      .then(() => setSdkReady(true))
      .catch(() =>
        alert("Could not load Razorpay. Check your network/adblock.")
      );
  }, []);

  const createOrder = async () => {
    if (!bookingId.trim()) return alert("Enter a Booking ID first.");
    setCreating(true);
    try {
      const { data } = await axios.post(
        `${API_BASE}/booking/${bookingId}/create-order`
      );
      setOrder(data.order);
      setKeyId(data.key_id);
      alert(`Order created: ${data.order.id}`);
    } catch (e) {
      console.error(e);
      alert(
        e?.response?.data?.detail || "Failed to create order. Check backend logs."
      );
    } finally {
      setCreating(false);
    }
  };

  const payNow = async () => {
    if (!order || !keyId) return alert("Create an order first.");
    if (!sdkReady || !window.Razorpay)
      return alert("Razorpay SDK not loaded yet.");

    const rzp = new window.Razorpay({
      key: keyId,
      order_id: order.id, // razorpay_order_id
      name: "The Grand Palace Hotel",
      description: "Room booking payment",
      handler: async function (resp) {
        // Success handler
        try {
          await axios.post(`${API_BASE}/booking/payment/verify`, {
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          });
          alert("✅ Payment verified! Booking confirmed.");
        } catch (e) {
          console.error(e);
          alert(
            e?.response?.data?.detail ||
              "Verification failed. See server logs for details."
          );
        }
      },
      prefill: {
        name: "Guest",
        email: "guest@example.com",
      },
      notes: { booking_id: bookingId },
      theme: { color: "#3399cc" },
      modal: {
        ondismiss: function () {
          alert("❌ Payment cancelled by user.");
        },
      },
    });

    rzp.open();
  };

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", fontFamily: "system-ui" }}>
      <h2>Payment</h2>
      <p>
        Enter a <b>Booking ID</b> (from your bookings table) and proceed.
      </p>

      <input
        style={{ width: "100%", padding: 10, marginBottom: 12 }}
        placeholder="Booking ID (uuid)"
        value={bookingId}
        onChange={(e) => setBookingId(e.target.value)}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={createOrder} disabled={creating}>
          {creating ? "Creating…" : "Create Order"}
        </button>
        <button onClick={payNow} disabled={!order || !keyId || !sdkReady}>
          Pay Now
        </button>
      </div>

      {order && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: "#f6f8fa",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          <div>
            <b>Order ID:</b> {order.id}
          </div>
          <div>
            <b>Amount:</b> ₹{(order.amount / 100).toFixed(2)} {order.currency}
          </div>
          <div>
            <b>Status:</b> {order.status || "created"}
          </div>
        </div>
      )}
    </div>
  );
}
