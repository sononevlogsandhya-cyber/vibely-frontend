import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import Security from "./Security";
import Sessions from "./Sessions";
import Verification from "./Verification";
import SwitchAccounts from "./SwitchAccounts";
import Preferences from "./Preferences";
import ConnectedAccounts from "./ConnectedAccounts";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "security", label: "Password & Security" },
  { key: "verification", label: "Verification" },
  { key: "sessions", label: "Login Activity & Devices" },
  { key: "accounts", label: "Switch Accounts" },
  { key: "connected", label: "Connected Accounts" },
  { key: "preferences", label: "Language & Accessibility" },
];

export default function AccountCenter() {
  const [tab, setTab] = useState("overview");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadSummary() {
    try {
      const res = await api.get("/account");
      setSummary(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  return (
    <div className="account-center">
      <div className="account-center-sidebar">
        <h2>Account Center</h2>
        <p className="ac-subtitle">Manage your login, security, and account preferences</p>
        <nav className="ac-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`ac-tab-btn ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="account-center-content card">
        {loading ? (
          <div className="loading-state">Loading account center…</div>
        ) : (
          <>
            {tab === "overview" && <Overview summary={summary} onNavigate={setTab} />}
            {tab === "security" && <Security summary={summary} refresh={loadSummary} />}
            {tab === "verification" && <Verification summary={summary} refresh={loadSummary} />}
            {tab === "sessions" && <Sessions />}
            {tab === "accounts" && <SwitchAccounts />}
            {tab === "connected" && <ConnectedAccounts summary={summary} refresh={loadSummary} />}
            {tab === "preferences" && <Preferences summary={summary} refresh={loadSummary} />}
          </>
        )}
      </div>
    </div>
  );
}

function Overview({ summary, onNavigate }) {
  if (!summary) return null;
  const rows = [
    {
      label: "Email verification",
      value: summary.emailVerified ? "Verified ✅" : "Not verified",
      action: () => onNavigate("verification"),
    },
    {
      label: "Phone verification",
      value: summary.phoneVerified ? "Verified ✅" : "Not verified",
      action: () => onNavigate("verification"),
    },
    {
      label: "Two-factor authentication",
      value: summary.twoFactorEnabled ? "On" : "Off",
      action: () => onNavigate("security"),
    },
    {
      label: "Active sessions",
      value: `${summary.activeSessionCount} device(s)`,
      action: () => onNavigate("sessions"),
    },
    {
      label: "Identity verification",
      value: summary.identityVerification?.status || "not_started",
      action: () => onNavigate("verification"),
    },
  ];
  return (
    <div>
      <h3>Overview</h3>
      <div className="ac-overview-grid">
        {rows.map((r) => (
          <button key={r.label} className="ac-overview-row" onClick={r.action}>
            <span>{r.label}</span>
            <span className="ac-overview-value">{r.value} ›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
