import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  FaComments, FaConciergeBell, FaCalendarAlt, FaArrowLeft, FaMicrophone, FaPaperPlane, FaRobot
} from "react-icons/fa";
import "./Chatbot.css";

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(s);
  });
}

function Chatbot() {
  const [section, setSection] = useState(null);
  const [chatMessages, setChatMessages] = useState([{ from: "bot", text: "How can I help you today?" }]);
  const [currentInput, setCurrentInput] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [requestText, setRequestText] = useState("");
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [roomType, setRoomType] = useState("Deluxe");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState("");
  const [availability, setAvailability] = useState(null);
  const [openFAQ, setOpenFAQ] = useState(null);
  const [isRequestLoading, setIsRequestLoading]   = useState(false);
  const [isBookingLoading, setIsBookingLoading]   = useState(false);
  const [isCheckingLoading, setIsCheckingLoading] = useState(false);
  const [paySummary, setPaySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  // const API_BASE = "http://localhost:8000"; 
  const API_BASE = "https://chieftrain.onrender.com"
  const faqList = [
  { question: "What time is check-in?", answer: "Check-in is at 2 PM." },
  { question: "What time is check-out?", answer: "Check-out is at 11 AM." },
  { question: "Is breakfast free?", answer: "Yes - we offer a complimentary buffet breakfast from 7 AM to 10 AM." },
  { question: "Do you allow pets?", answer: "Sorry, pets are not allowed on the premises." },
  { question: "How do I connect to Wi-Fi?", answer: "Our Wi-Fi is free. Network: “GrandPalaceGuest”, no password required." },
  { question: "Can I request a late check-out?", answer: "Late check-out (until 1 PM) may be available—please ask the front desk the day before departure." },
  { question: "Is parking available?", answer: "Yes, we have secure on-site parking for \$15/day." },
  { question: "Do you offer airport shuttle service?", answer: "Yes—24 hr shuttle to/from XYZ Airport. Please book 4 hours in advance." },
  { question: "What’s your cancellation policy?", answer: "Free cancellation up to 24 hours before arrival; after that we charge one night’s rate." },
  { question: "Are there laundry services?", answer: "Same-day laundry and dry-cleaning are available—drop your items before 9 AM." },
  { question: "Do you have a fitness center?", answer: "Yes, open 24 hours on the 3rd floor—access with your room key." },
  { question: "Can I get an extra bed?", answer: "Yes, roll-away beds are \$25/night—please request at least 12 hours ahead." },
];

  
 // Reset just booking-related UI (form + availability + payment bits)
const resetBookingUI = () => {
  setEmail?.("");             // or setForm({ ...defaults }) if you use a single form object
  setRoomType?.("Deluxe");
  setCheckIn?.("");
  setCheckOut?.("");
  setAvailability?.(null);

  // payment-related
  setPaySummary?.(null);      // hides the Payment Pending / Paid chip
  setBookingSuccess?.("");    // clears “Payment successful!” banner
  setIsBookingLoading?.(false);
  setIsCheckingLoading?.(false);
};

// Reset room-service UI if you have a form there too
const resetRoomServiceUI = () => {
  setRoomNumber?.("");
  setGuestPhone?.("");
  setRoomRequestText?.("");
  setIsRequestLoading?.(false);
  setRequestSuccess?.("");
};

// One entry point you’ll call from back buttons
const goHome = () => {
  // clear Booking UI
  setEmail("");
  setRoomType("Deluxe");
  setCheckIn("");
  setCheckOut("");
  setAvailability(null);
  setPaySummary(null);
  setBookingSuccess("");
  setIsBookingLoading(false);
  setIsCheckingLoading(false);

  // clear Room Service UI
  setRoomNumber("");
  setPhoneNumber("");
  setRequestText("");
  setIsRequestLoading(false);
  setRequestSuccess(false);

  // go to main menu
  setSection(null);
};


   
  useEffect(() => {
    axios.get(`${API_BASE}/chat/ping`)
      .then(() => {
        setLoading(false); // Backend is ready
      })
      .catch((err) => {
        console.error("Backend not ready yet:", err);
        // Retry after short delay
        setTimeout(() => window.location.reload(), 3000);
      });
  }, []);

  if (loading) {
    return (
      <div className="chatbot-loading">
        <div className="spinner"></div>
        <p>Starting the Concierge…</p>
      </div>
    );
  }

  const recognition = "webkitSpeechRecognition" in window ? new window.webkitSpeechRecognition() : null;
  
  const startListening = (setter) => {
    if (!recognition) return alert("Speech Recognition not supported.");
    recognition.lang = "en-US";
    recognition.start();
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setter(transcript);
    };
  };

  const speakResponse = (text) => {
    const synth = window.speechSynthesis;
    synth.speak(new SpeechSynthesisUtterance(text));
  };

  const handleChatSubmit = async () => {
    if (!currentInput.trim()) return;
    const userMessage = { from: "user", text: currentInput };
    setChatMessages((prev) => [...prev, userMessage]);
    setCurrentInput("");
    try {
      const res = await axios.post(`${API_BASE}/chat/`, {
        user_id: email || "guest",
        message: currentInput,
      });

      const botMessage = { from: "bot", text: res.data.response };
      setChatMessages((prev) => [...prev, botMessage]);
      setCurrentInput("");  // clear chat input
    } catch (err) {
      console.error("Chat error:", err);
    }
  };

  const handleRequestSubmit = async () => {
    if (!roomNumber || !phoneNumber || !requestText) {
      alert("Please fill all fields.");
      return;
    }
     setIsRequestLoading(true);

    try {
          await axios.post(`${API_BASE}/request/`, {
            room_number: roomNumber,
            phone_number: phoneNumber,
            request: requestText,
          });
          setRequestSuccess(true);
          // clear inputs
          setRoomNumber("");
          setPhoneNumber("");
          setRequestText("");
        } finally {
          setIsRequestLoading(false);
        }
  };

  // REPLACE your existing handleBookingSubmit with this version
const handleBookingSubmit = async () => {
  if (!email || !checkIn || !checkOut) {
    alert("Please fill all fields.");
    return;
  }
  setIsBookingLoading(true);

  try {
    // 1) Create booking on backend (now returns the row incl. id)
    const bookRes = await axios.post(`${API_BASE}/booking/`, {
      user_id: email,
      name: email,
      room_type: roomType,
      check_in: checkIn,
      check_out: checkOut,
    });
    const booking = bookRes.data?.booking;
    if (!booking?.id) throw new Error("Booking create failed");

    // 2) Create Razorpay order for this booking
    const orderRes = await axios.post(`${API_BASE}/booking/${booking.id}/create-order`);
    const { key_id, order } = orderRes.data;

    // show quick payment summary (optional UI)
    setPaySummary({
      amount: order.amount,
      currency: order.currency,
      orderId: order.id,
    });

    // 3) Ensure Razorpay is loaded
    await loadRazorpay();
    if (!window.Razorpay) throw new Error("Razorpay SDK not available");

    // 4) Open Razorpay Checkout
    const rzp = new window.Razorpay({
      key: key_id,
      order_id: order.id,
      name: "The Grand Palace Hotel",
      description: `Room booking for ${email}`,
      prefill: { name: email, email },
      notes: { booking_id: booking.id },
      handler: async function (resp) {
        // 5) Verify payment server-side
        await axios.post(`${API_BASE}/booking/payment/verify`, {
          razorpay_order_id: resp.razorpay_order_id,
          razorpay_payment_id: resp.razorpay_payment_id,
          razorpay_signature: resp.razorpay_signature,
        });
        setPaySummary((prev) => (prev ? { ...prev, status: "paid" } : prev));
        setBookingSuccess("✅ Payment successful! Your booking is confirmed.");
        // Optionally clear form
        setEmail(""); setRoomType("Deluxe"); setCheckIn(""); setCheckOut("");
        setAvailability(null);
      }
    });

    rzp.open();
  } catch (err) {
    console.error("Book & Pay error:", err);
    alert(err?.response?.data?.detail || err?.message || "Booking/payment failed.");
  } finally {
    setIsBookingLoading(false);
  }
};


  const checkRoomAvailability = async () => {
    if (!checkIn || !checkOut) return alert("Select both check-in & check-out dates.");
    setIsCheckingLoading(true);
    try {
    const res = await axios.get(`${API_BASE}/booking/availability/`, {
      params: { check_in: checkIn, check_out: checkOut }
    });
    setAvailability(res.data);
  } catch (err) {
    console.error("Availability check failed:", err);
    alert("Failed to fetch availability.");
  } finally {
    setIsCheckingLoading(false);
  }
  };

  return (
    <div className="chatbot">
      <h2 className="chatbot__header">
        <FaRobot className="chatbot__msg-icon-header" />
        Hotel Chatbot
      </h2>


      {!section && (
        <div className="chatbot__menu">
          <button onClick={() => setSection("faq")}><FaComments /> Ask a Question</button>
          <button onClick={() => setSection("request")}><FaConciergeBell /> Room Service</button>
          <button onClick={() => setSection("booking")}><FaCalendarAlt /> Book Room</button>
          <button onClick={() => setSection("faqList")}>📋 FAQs</button>
        </div>
      )}

      {section === "faq" && (
        <div className="chatbot__section">
          <div className="chatbot__chat-log">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`chatbot__msg ${msg.from}`}>
                {msg.from === "bot" && <FaRobot className="chatbot__msg-icon" />}
                {msg.text}
              </div>
            ))}
          </div>
          <div className="chatbot__input">
            <input value={currentInput} onChange={(e) => setCurrentInput(e.target.value)} placeholder="Ask something..." />
            <button onClick={handleChatSubmit}><FaPaperPlane /></button>
            <button onClick={() => startListening(setCurrentInput)}><FaMicrophone /></button>
          </div>
          <button onClick={() => setSection(null)}><FaArrowLeft /> Back</button>
        </div>
      )}

      {section === "request" && (
        <div className="chatbot__section">
          <div className="chatbot__booking-fields">
          <input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="Room Number" />
          <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Phone Number" />
          <textarea value={requestText} onChange={(e) => setRequestText(e.target.value)} placeholder="Your Request" />
          </div>
          <div className="chatbot__btn-row">
            <button onClick={handleRequestSubmit} disabled={isRequestLoading}>{isRequestLoading ? "Sending…" : "Send Request"}</button>
            <button onClick={() => startListening(setRequestText)}><FaMicrophone /> Record</button>
          </div>
          <button type="button" className="chatbot__back" onClick={goHome}>
            ← Back
          </button>


          {requestSuccess && <p className="chatbot__success">✅ Request sent!</p>}
        </div>
      )}

      {section === "booking" && (
        <div className="chatbot__section">
          <div className="chatbot__booking-fields">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <select value={roomType} onChange={(e) => setRoomType(e.target.value)}>
            <option value="Deluxe">Deluxe (2500) </option>
            <option value="Suite">Suite (4000)</option>
            <option value="Standard">Standard (1500) </option>
          </select>
          <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
          <div className="chatbot__btn-row">
            <button onClick={checkRoomAvailability} disabled={isCheckingLoading}>{isCheckingLoading ? "Checking…" : "Check Availability"}</button>
           <button onClick={handleBookingSubmit} disabled={isBookingLoading} className="btn btn--primary">
            {isBookingLoading ? "Processing…" : "Book & Pay"}
          </button>
          </div>
          {availability && (
            <ul className="chatbot__availability">
              <li>Deluxe : {availability.Deluxe}</li>
              <li>Suite : {availability.Suite}</li>
              <li>Standard : {availability.Standard}</li>
            </ul>
          )}
          <button type="button" className="chatbot__back" onClick={goHome}>
            ← Back
          </button>


          {bookingSuccess && <p className="chatbot__success">{bookingSuccess}</p>}

         {paySummary && (
            <div className="chatbot__payment-summary">
              <span className={`chip ${paySummary.status === "paid" ? "chip--paid" : "chip--pending"}`}>
                {paySummary.status === "paid" ? "Paid" : "Payment Pending"}
              </span>
              <div className="chatbot__price">
                Amount: ₹{(paySummary.amount / 100).toFixed(2)} {paySummary.currency}
              </div>
              <div className="chatbot__order">Order: {paySummary.orderId}</div>
            </div>
          )}

        </div>
      )}

      {section === "faqList" && (
  <div className="chatbot__section">
    <h3>📋 Frequently Asked Questions</h3>
    <ul className="chatbot__faq-list">
      {faqList.map((faq, idx) => (
        <li
          key={idx}
          className={`chatbot__faq-item ${openFAQ === idx ? "open" : ""}`}
          onClick={() => setOpenFAQ(openFAQ === idx ? null : idx)}
        >
          <div className="chatbot__faq-question">
            Q: {faq.question}
          </div>
          {openFAQ === idx && (
            <div className="chatbot__faq-answer">
              A: {faq.answer}
            </div>
          )}
        </li>
      ))}
    </ul>
    <button onClick={() => setSection(null)}>
      <FaArrowLeft /> Back
    </button>
  </div>
)}

    </div>
  );
}

export default Chatbot;
