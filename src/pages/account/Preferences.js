import React, { useState } from "react";
import api from "../../api/axios";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी (Hindi)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "bn", label: "বাংলা (Bengali)" },
  { code: "gu", label: "ગુજરાતી (Gujarati)" },
  { code: "kn", label: "ಕನ್ನಡ (Kannada)" },
  { code: "ml", label: "മലയാളം (Malayalam)" },
  { code: "pa", label: "ਪੰਜਾਬੀ (Punjabi)" },
  { code: "ur", label: "اردو (Urdu)" },
];

export default function Preferences({ summary, refresh }) {
  return (
    <div>
      <h3>Language & Accessibility</h3>
      <LanguageSection summary={summary} refresh={refresh} />
      <AccessibilitySection summary={summary} refresh={refresh} />
    </div>
  );
}

function LanguageSection({ summary, refresh }) {
  const [language, setLanguage] = useState(summary?.language || "en");
  const [busy, setBusy] = useState(false);

  async function save(e) {
    const value = e.target.value;
    setLanguage(value);
    setBusy(true);
    try {
      await api.put("/account/language", { language: value });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ac-section">
      <h4>Language</h4>
      <select value={language} onChange={save} disabled={busy} className="ac-select">
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
      <p className="ac-hint">
        This sets your preferred language for the interface — great for tier-2/3 city users who are
        more comfortable in a regional language.
      </p>
    </section>
  );
}

function AccessibilitySection({ summary, refresh }) {
  const [settings, setSettings] = useState(
    summary?.accessibility || {
      fontSize: "default",
      highContrast: false,
      reduceMotion: false,
      screenReaderOptimized: false,
    }
  );
  const [busy, setBusy] = useState(false);

  async function update(partial) {
    const next = { ...settings, ...partial };
    setSettings(next);
    setBusy(true);
    try {
      await api.put("/account/accessibility", next);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ac-section">
      <h4>Accessibility</h4>

      <div className="ac-field-row">
        <label>Font size</label>
        <select
          value={settings.fontSize}
          onChange={(e) => update({ fontSize: e.target.value })}
          disabled={busy}
          className="ac-select"
        >
          <option value="small">Small</option>
          <option value="default">Default</option>
          <option value="large">Large</option>
          <option value="xlarge">Extra large</option>
        </select>
      </div>

      <label className="ac-toggle-row">
        <input
          type="checkbox"
          checked={settings.highContrast}
          onChange={(e) => update({ highContrast: e.target.checked })}
          disabled={busy}
        />
        High contrast mode
      </label>

      <label className="ac-toggle-row">
        <input
          type="checkbox"
          checked={settings.reduceMotion}
          onChange={(e) => update({ reduceMotion: e.target.checked })}
          disabled={busy}
        />
        Reduce motion / animations
      </label>

      <label className="ac-toggle-row">
        <input
          type="checkbox"
          checked={settings.screenReaderOptimized}
          onChange={(e) => update({ screenReaderOptimized: e.target.checked })}
          disabled={busy}
        />
        Optimize for screen readers
      </label>
    </section>
  );
}
