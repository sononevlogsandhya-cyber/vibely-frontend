import React, { useState } from "react";
import api from "../../api/axios";

export default function Security({ summary, refresh }) {
  const [step, setStep] = useState("idle"); // idle | setup | confirm | codes
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState([]);
  const [disablePassword, setDisablePassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function startSetup() {
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/account/2fa/setup");
      setQrDataUrl(res.data.qrDataUrl);
      setManualKey(res.data.manualEntryKey);
      setStep("setup");
    } catch (err) {
      setError(err.response?.data?.message || "Could not start 2FA setup");
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/account/2fa/confirm", { code });
      setBackupCodes(res.data.backupCodes);
      setStep("codes");
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || "Incorrect code");
    } finally {
      setBusy(false);
    }
  }

  async function disable2fa(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/account/2fa/disable", { password: disablePassword });
      setDisablePassword("");
      setStep("idle");
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || "Could not disable 2FA");
    } finally {
      setBusy(false);
    }
  }

  async function regenerateCodes() {
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/account/2fa/backup-codes/regenerate");
      setBackupCodes(res.data.backupCodes);
      setStep("codes");
    } catch (err) {
      setError(err.response?.data?.message || "Could not regenerate codes");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3>Password & Security</h3>
      {error && <div className="error-banner">{error}</div>}

      <section className="ac-section">
        <h4>Two-factor authentication</h4>
        <p className="ac-hint">
          Add an extra layer of security using an authenticator app (Google Authenticator, Authy, etc).
        </p>

        {summary?.twoFactorEnabled && step === "idle" && (
          <>
            <div className="info-banner">2FA is currently ON for your account.</div>
            <button className="btn-secondary" onClick={regenerateCodes} disabled={busy}>
              Regenerate backup codes
            </button>
            <form onSubmit={disable2fa} className="ac-inline-form">
              <input
                type="password"
                placeholder="Enter password to disable"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                required
              />
              <button className="btn-secondary" disabled={busy}>Disable 2FA</button>
            </form>
          </>
        )}

        {!summary?.twoFactorEnabled && step === "idle" && (
          <button className="btn-primary" onClick={startSetup} disabled={busy}>
            {busy ? "Starting…" : "Set up 2FA"}
          </button>
        )}

        {step === "setup" && (
          <div className="ac-2fa-setup">
            {qrDataUrl && <img src={qrDataUrl} alt="2FA QR code" className="ac-qr" />}
            <p className="ac-hint">Can't scan? Enter this key manually: <code>{manualKey}</code></p>
            <form onSubmit={confirmSetup} className="ac-inline-form">
              <input
                placeholder="6-digit code from your app"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
              <button className="btn-primary" disabled={busy}>Confirm & enable</button>
            </form>
          </div>
        )}

        {step === "codes" && backupCodes.length > 0 && (
          <div className="ac-backup-codes">
            <p className="ac-hint">
              Save these backup codes somewhere safe. Each can be used once if you lose access to your
              authenticator app.
            </p>
            <div className="ac-codes-grid">
              {backupCodes.map((c) => (
                <code key={c}>{c}</code>
              ))}
            </div>
            <button className="btn-secondary" onClick={() => setStep("idle")}>Done</button>
          </div>
        )}
      </section>

      <section className="ac-section">
        <h4>Passkeys</h4>
        <p className="ac-hint">
          Passkey (WebAuthn) sign-in is coming soon — it needs a small browser-side credential API
          integration on top of what's here. 2FA above already gives you strong protection in the
          meantime.
        </p>
      </section>
    </div>
  );
}
