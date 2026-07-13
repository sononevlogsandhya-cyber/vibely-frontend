import React, { useEffect, useState } from "react";
import api from "../../api/axios";

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/account/sessions");
      setSessions(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load sessions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function revoke(id) {
    setBusyId(id);
    try {
      await api.delete(`/account/sessions/${id}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not log out device");
    } finally {
      setBusyId(null);
    }
  }

  async function logoutOthers() {
    setBusyId("others");
    try {
      await api.post("/account/sessions/logout-others");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not log out other devices");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div className="loading-state">Loading login activity…</div>;

  return (
    <div>
      <h3>Login Activity & Devices</h3>
      {error && <div className="error-banner">{error}</div>}

      <button className="btn-secondary" onClick={logoutOthers} disabled={busyId === "others"}>
        {busyId === "others" ? "Logging out…" : "Log out all other devices"}
      </button>

      <div className="ac-session-list">
        {sessions.filter((s) => !s.revoked).map((s) => (
          <div key={s._id} className="ac-session-row">
            <div>
              <div className="ac-session-device">
                {s.deviceLabel} {s.isCurrent && <span className="ac-badge">This device</span>}
              </div>
              <div className="ac-hint">
                {s.ip || "Unknown IP"} · Last active {new Date(s.lastActiveAt).toLocaleString()}
              </div>
              <div className="ac-hint">First login {new Date(s.createdAt).toLocaleString()}</div>
            </div>
            {!s.isCurrent && (
              <button
                className="btn-secondary"
                onClick={() => revoke(s._id)}
                disabled={busyId === s._id}
              >
                {busyId === s._id ? "…" : "Log out"}
              </button>
            )}
          </div>
        ))}
        {sessions.filter((s) => !s.revoked).length === 0 && (
          <p className="ac-hint">No active sessions found.</p>
        )}
      </div>
    </div>
  );
}
