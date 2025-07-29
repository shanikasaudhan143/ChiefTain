import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  FaConciergeBell,
  FaBed,
  FaSmile,
  FaCheck,
  FaTrash,
  FaTimes,
  FaSpinner,
  FaRegClock
} from "react-icons/fa";
import "./AdminDashboard.css";

// const API_BASE = "http://localhost:8000";  
const API_BASE = "https://chieftrain.onrender.com"
export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState("requests");
  const [requests, setRequests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [aiSentiment, setAiSentiment] = useState({
    top_positive: [],
    top_negative: [],
    top_neutral: [],
  });

  // loading flags
  const [isRequestsLoading, setIsRequestsLoading]   = useState(false);
  const [isBookingsLoading, setIsBookingsLoading]   = useState(false);
  const [isSentimentsLoading, setIsSentimentsLoading] = useState(false);
  // tracks room‐request actions by id: 'resolving' or 'deleting'
  const [loadingRequests, setLoadingRequests] = useState({});
  // tracks booking actions by id: 'confirming', 'rejecting', or 'deleting'
  const [loadingBookings, setLoadingBookings] = useState({});

  const fetchData = async () => {
    // fetch requests
    setIsRequestsLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/request/`);
      setRequests(data.requests);
    } finally {
      setIsRequestsLoading(false);
    }

    // fetch bookings
    setIsBookingsLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/booking/`);
      setBookings(data.bookings);
    } finally {
      setIsBookingsLoading(false);
    }

    // fetch sentiments
    setIsSentimentsLoading(true);
    try {
      const { data } = await axios.get(
        `${API_BASE}/chat/sentiment-summary-ai`
      );
      setAiSentiment(data);
    } finally {
      setIsSentimentsLoading(false);
    }
  };

  console.log("aiSentiment:", aiSentiment);

  useEffect(() => {
    if (authenticated) fetchData();
  }, [authenticated]);

  const handleLogin = () => {
    if (password === "hotel@123") setAuthenticated(true);
    else alert("Incorrect password");
  };

  const resolveRequest = async (id) => {
  // mark as resolving…
  setLoadingRequests((prev) => ({ ...prev, [id]: "resolving" }));

  await axios.patch(`${API_BASE}/request/${id}/resolve`);
  // update that one item’s status
  setRequests((prev) =>
    prev.map((r) =>
      r.id === id ? { ...r, status: "resolved" } : r
    )
  );

  // clear loading flag
  setLoadingRequests((prev) => {
    const { [id]: _, ...rest } = prev;
    return rest;
  });
};
  const deleteRequest = async (id) => {
    if (window.confirm("Delete this request?")) {
      await axios.delete(`${API_BASE}/request/${id}`);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const updateBooking = async (id, status) => {
  const action = status === "confirmed" ? "confirming" : "rejecting";
  setLoadingBookings((prev) => ({ ...prev, [id]: action }));

  await axios.patch(`${API_BASE}/booking/${id}/status?status=${status}`);
  setBookings((prev) =>
    prev.map((b) =>
      b.id === id ? { ...b, status } : b
    )
  );

  setLoadingBookings((prev) => {
    const { [id]: _, ...rest } = prev;
    return rest;
  });
};

  const deleteBooking = async (id) => {
    if (window.confirm("Delete this booking?")) {
      await axios.delete(`${API_BASE}/booking/${id}`);
      setBookings((prev) => prev.filter((b) => b.id !== id));
    }
  };

  if (!authenticated) {
    return (
      <div className="dashboard dashboard--login">
        <h2>🔒 Admin Login</h2>
        <input
          type="password"
          className="dashboard__input"
          placeholder="Enter admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="dashboard__btn" onClick={handleLogin}>
          Login
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <nav className="dashboard__nav">
        <button
          className={`dashboard__nav-item ${
            activeTab === "requests" ? "active" : ""
          }`}
          onClick={() => setActiveTab("requests")}
        >
          <FaConciergeBell /> Room Service
        </button>
        <button
          className={`dashboard__nav-item ${
            activeTab === "bookings" ? "active" : ""
          }`}
          onClick={() => setActiveTab("bookings")}
        >
          <FaBed /> Bookings
        </button>
        <button
          className={`dashboard__nav-item ${
            activeTab === "sentiments" ? "active" : ""
          }`}
          onClick={() => setActiveTab("sentiments")}
        >
          <FaSmile /> Sentiments
        </button>
      </nav>

      <div className="dashboard__content">
        {/* ROOM SERVICE */}
        {activeTab === "requests" && (
          <>
            {isRequestsLoading ? (
              <div className="dashboard__loading">
                <FaSpinner className="dashboard__loading-icon" /> Loading
                requests…
              </div>
            ) : (
              <table className="dashboard__table">
                <thead>
                  <tr>
                    <th>Room No.</th>
                    <th>Phone</th>
                    <th>Request</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan="5" className="dashboard__empty">
                        No requests.
                      </td>
                    </tr>
                  )}
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td data-label="Room No.">{r.room_number}</td>
                      <td data-label="Phone">{r.phone_number}</td>
                      <td data-label="Request">{r.request}</td>
                      <td data-label="Status">{r.status}</td>
                      <td data-label="Actions">
                        {r.status === "pending" && (
                          <button
                            className="dashboard__btn dashboard__btn--small"
                            onClick={() => resolveRequest(r.id)}
                            disabled={!!loadingRequests[r.id]}
                          >
                            {loadingRequests[r.id] === "resolving" ? "Resolving…" : <><FaCheck/> Resolve</>}
                          </button>
                        )}
                        <button
                          className="dashboard__btn dashboard__btn--danger dashboard__btn--small"
                          onClick={() => deleteRequest(r.id)}
                        >
                          <FaTrash /> 
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* BOOKINGS */}
        {activeTab === "bookings" && (
          <>
            {isBookingsLoading ? (
              <div className="dashboard__loading">
                <FaSpinner className="dashboard__loading-icon" /> Loading
                bookings…
              </div>
            ) : (
              <table className="dashboard__table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Room</th>
                    <th>Dates</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.length === 0 && (
                    <tr>
                      <td colSpan="5" className="dashboard__empty">
                        No bookings.
                      </td>
                    </tr>
                  )}
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td data-label="Email">{b.user_id}</td>
                      <td data-label="Room">{b.room_type}</td>
                      <td data-label="Dates">
                        {b.check_in} ↔ {b.check_out}
                      </td>
                      <td data-label="Status">{b.status}</td>
                      <td data-label="Actions">
                        {b.status === "pending" && (
                          <>
                            <button
                              className="dashboard__btn dashboard__btn--small"
                              onClick={() => updateBooking(b.id, "confirmed")}
                              disabled={!!loadingBookings[b.id]}
                            >
                              {loadingBookings[b.id] === "confirming" ? "Confirming…" : <><FaCheck/> Confirm</>}
                            </button>
                            <button
                              className="dashboard__btn dashboard__btn--warning dashboard__btn--small"
                              onClick={() => updateBooking(b.id, "rejected")}
                              disabled={!!loadingBookings[b.id]}
                            >
                              {loadingBookings[b.id] === "rejecting" ? "Rejecting…" : <><FaTimes/> Reject</>}
                            </button>
                          </>
                        )}
                        <button
                          className="dashboard__btn dashboard__btn--danger dashboard__btn--small"
                          onClick={() => deleteBooking(b.id)}
                        >
                          <FaTrash /> 
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* SENTIMENTS */}
        {activeTab === "sentiments" && (
          <>
            {isSentimentsLoading ? (
              <div className="dashboard__loading">
                <FaSpinner className="dashboard__loading-icon" /> Loading
                sentiments…
              </div>
            ) : (
              <div className="dashboard__cards">
                <div className="dashboard__section-header">
                  <FaSmile /> Guest Sentiment Summary
                </div>
                {["top_positive", "top_negative", "top_neutral"].map((key) => (
                  <div key={key} className="dashboard__card">
                    <div className="dashboard__card-row dashboard__sentiment-header">
                      {key === "top_positive" && " Positive"}
                      {key === "top_negative" && " Negative"}
                      {key === "top_neutral" && " Neutral"}
                    </div>
                    {aiSentiment[key].length === 0 ? (
                      <p className="dashboard__empty">No messages.</p>
                    ) : (
                      aiSentiment[key].map((msg, i) => (
                        <div key={i} className="dashboard__card-row">
                          <FaRegClock className="dashboard__icon-small" />{msg}
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
