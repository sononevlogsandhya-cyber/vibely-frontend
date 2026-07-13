import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("request"); // request -> reset
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestCode(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/account/password/forgot", { email });
      setMessage(res.data.message);
      setStep("reset");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/account/password/reset", { email, code, newPassword });
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.message || "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card card">
        <h1>Reset password</h1>
        <p className="tagline">
          {step === "request"
            ? "Enter your email and we'll send you a reset code"
            : "Enter the code from your email and choose a new password"}
        </p>

        {error && <div className="error-banner">{error}</div>}
        {message && step === "reset" && <div className="info-banner">{message}</div>}

        {step === "request" ? (
          <form onSubmit={requestCode}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button className="btn-primary" disabled={busy}>
              {busy ? "Sending…" : "Send reset code"}
            </button>
          </form>
        ) : (
          <form onSubmit={resetPassword}>
            <div className="field">
              <label>Reset code</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="field">
              <label>New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <button className="btn-primary" disabled={busy}>
              {busy ? "Resetting…" : "Reset password"}
            </button>
          </form>
        )}

        <div className="switch-link">
          <Link to="/login">← Back to login</Link>
        </div>
      </div>
    </div>
  );
}
