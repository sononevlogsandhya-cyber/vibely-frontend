import React, { useState } from "react";
import api from "../../api/axios";

export default function Verification({ summary, refresh }) {
  return (
    <div>
      <h3>Verification</h3>
      <EmailVerify summary={summary} refresh={refresh} />
      <PhoneVerify summary={summary} refresh={refresh} />
      <BirthdayVerify summary={summary} refresh={refresh} />
      <IdentityVerify summary={summary} refresh={refresh} />
    </div>
  );
}

function EmailVerify({ summary, refresh }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setError("");
    try {
      await api.post("/account/verify-email/send");
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || "Could not send code");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/account/verify-email/confirm", { code });
      setSent(false);
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || "Incorrect code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ac-section">
      <h4>Email verification</h4>
      {error && <div className="error-banner">{error}</div>}
      {summary?.emailVerified ? (
        <div className="info-banner">Your email is verified ✅</div>
      ) : sent ? (
        <form onSubmit={confirm} className="ac-inline-form">
          <input placeholder="Enter code from email" value={code} onChange={(e) => setCode(e.target.value)} required />
          <button className="btn-primary" disabled={busy}>Confirm</button>
        </form>
      ) : (
        <button className="btn-primary" onClick={send} disabled={busy}>
          {busy ? "Sending…" : "Send verification code"}
        </button>
      )}
    </section>
  );
}

function PhoneVerify({ summary, refresh }) {
  const [phone, setPhone] = useState(summary?.phone || "");
  const [gmail, setGmail] = useState(summary?.phoneVerifyGmail || "");
  const [sent, setSent] = useState(false);
  const [smsNote, setSmsNote] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/account/verify-phone/send", { phone, gmail });
      setSmsNote(res.data.message);
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || "Could not send code");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/account/verify-phone/confirm", { code });
      setSent(false);
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || "Incorrect code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ac-section">
      <h4>Phone verification</h4>
      {error && <div className="error-banner">{error}</div>}
      {summary?.phoneVerified ? (
        <div className="info-banner">Your phone number is verified ✅</div>
      ) : sent ? (
        <>
          <p className="ac-hint">{smsNote}</p>
          <form onSubmit={confirm} className="ac-inline-form">
            <input placeholder="Enter code" value={code} onChange={(e) => setCode(e.target.value)} required />
            <button className="btn-primary" disabled={busy}>Confirm</button>
          </form>
        </>
      ) : (
        <form onSubmit={send} className="ac-inline-form">
          <input
            placeholder="+91 9XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="yourname@gmail.com"
            value={gmail}
            onChange={(e) => setGmail(e.target.value)}
          />
          <button className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send code"}</button>
        </form>
      )}
      <p className="ac-hint">
        Note: SMS provider isn't configured yet, so the code goes to the Gmail address above
        (or your account email if you leave it blank).
      </p>
    </section>
  );
}

function BirthdayVerify({ summary, refresh }) {
  const [birthday, setBirthday] = useState(
    summary?.birthday ? summary.birthday.slice(0, 10) : ""
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/account/verify-birthday", { birthday });
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save birthday");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ac-section">
      <h4>Birthday</h4>
      {error && <div className="error-banner">{error}</div>}
      {summary?.birthdayVerified ? (
        <div className="info-banner">Birthday on file ✅</div>
      ) : (
        <form onSubmit={submit} className="ac-inline-form">
          <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} required />
          <button className="btn-primary" disabled={busy}>Save</button>
        </form>
      )}
    </section>
  );
}

function IdentityVerify({ summary, refresh }) {
  const [documentType, setDocumentType] = useState("aadhaar");
  const [documentNumber, setDocumentNumber] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/account/verify-identity/submit", { documentType, documentNumber });
      setDocumentNumber("");
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  const status = summary?.identityVerification?.status || "not_started";

  return (
    <section className="ac-section">
      <h4>Identity verification</h4>
      {error && <div className="error-banner">{error}</div>}
      {status === "verified" && <div className="info-banner">Identity verified ✅</div>}
      {status === "pending" && <div className="info-banner">Submission under review ⏳</div>}
      {(status === "not_started" || status === "rejected") && (
        <form onSubmit={submit} className="ac-inline-form">
          <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
            <option value="aadhaar">Aadhaar</option>
            <option value="pan">PAN</option>
            <option value="passport">Passport</option>
            <option value="driving_license">Driving Licence</option>
          </select>
          <input
            placeholder="Document number"
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value)}
            required
          />
          <button className="btn-primary" disabled={busy}>Submit</button>
        </form>
      )}
      <p className="ac-hint">
        Real ID verification needs a KYC vendor (e.g. DigiLocker/Signzy). This stores your submission
        for manual review until that integration is wired up.
      </p>
    </section>
  );
}
