import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Chatbot from "./Chatbot";
import AdminDashboard from "./AdminDashboard";
import PaymentPage from "./PaymentPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Chatbot />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/payment" element={<PaymentPage/>}/>
      </Routes>
    </Router>
  );
}

export default App;
