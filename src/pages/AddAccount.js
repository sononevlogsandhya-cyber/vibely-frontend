import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function AddAccount() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ emailOrUsername: "", password: "" });
  const [challengeToken, setChallengeToken] = useState(null);
  const [twoFaCode, setTwoFaCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/auth/login", form);
      if (res.data.twoFactorRequired) {
        setChallengeToken(res.data.challengeToken);
      } else {
        login(res.data.token, res.data.user); // adds this account to the device's account list
        navigate("/");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify2fa(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/auth/login/verify-2fa", { challengeToken, code: twoFaCode });
      login(res.data.token, res.data.user);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card card">
        <h1>Add account</h1>
        <p className="tagline">Log into another Vibely account without logging out of this one</p>

        {error && <div className="error-banner">{error}</div>}

        {challengeToken ? (
          <form onSubmit={handleVerify2fa}>
            <div className="field">
              <label>6-digit code</label>
              <input value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value)} required autoFocus />
            </div>
            <button className="btn-primary" disabled={busy}>{busy ? "Verifying…" : "Verify"}</button>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email or username</label>
              <input
                value={form.emailOrUsername}
                onChange={(e) => setForm({ ...form, emailOrUsername: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <button className="btn-primary" disabled={busy}>{busy ? "Logging in…" : "Log In"}</button>
          </form>
        )}

        <div className="switch-link">
          <button type="button" className="link-btn" onClick={() => navigate(-1)}>
            ← Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
