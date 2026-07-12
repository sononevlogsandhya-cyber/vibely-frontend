import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function AccountRecovery() {
  const navigate = useNavigate();
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestCode(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/account/recovery/start", { email });
      setStep("confirm");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRecovery(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/account/recovery/confirm", { email, code, newPassword });
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.message || "Recovery failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card card">
        <h1>Account recovery</h1>
        <p className="tagline">
          {step === "request"
            ? "Lost access to your 2FA device or email? Start recovery here."
            : "Enter the recovery code sent to your email. This will disable 2FA on your account."}
        </p>

        {error && <div className="error-banner">{error}</div>}

        {step === "request" ? (
          <form onSubmit={requestCode}>
            <div className="field">
              <label>Account email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button className="btn-primary" disabled={busy}>
              {busy ? "Sending…" : "Send recovery code"}
            </button>
          </form>
        ) : (
          <form onSubmit={confirmRecovery}>
            <div className="field">
              <label>Recovery code</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="field">
              <label>New password (optional)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current password"
              />
            </div>
            <button className="btn-primary" disabled={busy}>
              {busy ? "Recovering…" : "Recover account"}
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
