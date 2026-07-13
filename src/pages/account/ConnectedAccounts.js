import React, { useState } from "react";
import api from "../../api/axios";

export default function ConnectedAccounts({ summary, refresh }) {
  return (
    <div>
      <h3>Connected Accounts</h3>
      <p className="ac-hint">
        This mirrors Meta's "Accounts Center" concept — one place to manage accounts connected to
        Vibely. Real Facebook/Threads login requires your own Meta Developer App (App ID + Secret,
        OAuth redirect approved by Meta). The buttons below are wired to save the connection once
        that OAuth handshake completes on the frontend — for now they demonstrate the connect/disconnect
        flow with placeholder data.
      </p>

      <FacebookCard summary={summary} refresh={refresh} />
      <ThreadsCard summary={summary} refresh={refresh} />
    </div>
  );
}

function FacebookCard({ summary, refresh }) {
  const [busy, setBusy] = useState(false);
  const connected = summary?.connectedAccounts?.facebook?.connected;

  async function connect() {
    setBusy(true);
    try {
      // TODO: replace with real Facebook Login SDK flow, then send the
      // returned facebookId/name here instead of placeholder values.
      await api.post("/account/connected/facebook", {
        facebookId: "demo_fb_id",
        name: "Facebook Account",
      });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await api.delete("/account/connected/facebook");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ac-section">
      <h4>Facebook</h4>
      {connected ? (
        <>
          <div className="info-banner">Connected ✅</div>
          <button className="btn-secondary" onClick={disconnect} disabled={busy}>Disconnect</button>
        </>
      ) : (
        <button className="btn-primary" onClick={connect} disabled={busy}>Connect Facebook</button>
      )}
    </section>
  );
}

function ThreadsCard({ summary, refresh }) {
  const [busy, setBusy] = useState(false);
  const connected = summary?.connectedAccounts?.threads?.connected;

  async function connect() {
    setBusy(true);
    try {
      await api.post("/account/connected/threads", {
        threadsId: "demo_threads_id",
        name: "Threads Account",
      });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await api.delete("/account/connected/threads");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ac-section">
      <h4>Threads</h4>
      {connected ? (
        <>
          <div className="info-banner">Connected ✅</div>
          <button className="btn-secondary" onClick={disconnect} disabled={busy}>Disconnect</button>
        </>
      ) : (
        <button className="btn-primary" onClick={connect} disabled={busy}>Connect Threads</button>
      )}
    </section>
  );
}
