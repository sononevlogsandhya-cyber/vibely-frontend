import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import ksLogo from "../assets/ks-logo.png";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ emailOrUsername: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // 2FA challenge state
  const [challengeToken, setChallengeToken] = useState(null);
  const [twoFaCode, setTwoFaCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/auth/login", form);
      if (res.data.twoFactorRequired) {
        setChallengeToken(res.data.challengeToken);
      } else {
        login(res.data.token, res.data.user);
        navigate("/");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify2fa(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/auth/login/verify-2fa", {
        challengeToken,
        code: twoFaCode,
        isBackupCode: useBackupCode,
      });
      login(res.data.token, res.data.user);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  if (challengeToken) {
    return (
      <div className="auth-container">
        <div className="auth-card card">
          <h1>Vibely</h1>
          <p className="tagline">Enter your two-factor authentication code</p>

          {error && <div className="error-banner">{error}</div>}

          <form onSubmit={handleVerify2fa}>
            <div className="field">
              <label>{useBackupCode ? "Backup code" : "6-digit code"}</label>
              <input
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.target.value)}
                placeholder={useBackupCode ? "XXXXX-XXXXX" : "123456"}
                required
                autoFocus
              />
            </div>
            <button className="btn-primary" disabled={busy}>
              {busy ? "Verifying…" : "Verify"}
            </button>
          </form>

          <div className="switch-link">
            <button
              type="button"
              className="link-btn"
              onClick={() => setUseBackupCode((v) => !v)}
            >
              {useBackupCode ? "Use authenticator app instead" : "Use a backup code instead"}
            </button>
          </div>
          <div className="switch-link">
            <button type="button" className="link-btn" onClick={() => setChallengeToken(null)}>
              ← Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card card">
        <h1>Vibely</h1>
        <p className="tagline">Share your moments. Feel the vibe.</p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email or username</label>
            <input
              value={form.emailOrUsername}
              onChange={(e) => setForm({ ...form, emailOrUsername: e.target.value })}
              required
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
          <div className="switch-link" style={{ textAlign: "right", marginBottom: 12 }}>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
          <button className="btn-primary" disabled={busy}>
            {busy ? "Logging in…" : "Log In"}
          </button>
        </form>

        <div className="switch-link">
          Don't have an account? <Link to="/register"><b>Sign up</b></Link>
        </div>
        <div className="switch-link">
          <Link to="/account-recovery">Can't access your account?</Link>
        </div>

        <div className="ks-branding">
          <img src={ksLogo} alt="KS" className="ks-badge" />
          <span>Powered by KS Technologies Group</span>
        </div>
      </div>
    </div>
  );
}
