import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getStoredAccounts, switchToAccount, removeAccount } from "../../utils/accounts";

export default function SwitchAccounts() {
  const { user, switchAccount } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState(getStoredAccounts());

  function handleSwitch(userId) {
    if (userId === user._id) return;
    const found = switchToAccount(userId);
    if (found) {
      switchAccount(found.token, found.user);
      navigate("/");
    }
  }

  function handleRemove(userId) {
    removeAccount(userId);
    setAccounts(getStoredAccounts());
  }

  return (
    <div>
      <h3>Switch Accounts</h3>
      <p className="ac-hint">
        Vibely remembers every account you've logged into on this device, so you can switch instantly
        without typing your password again — just like Instagram's "Add account".
      </p>

      <div className="ac-account-list">
        {accounts.map((a) => (
          <div key={a.user._id} className="ac-session-row">
            <div className="ac-account-info">
              <img
                src={a.user.avatar || "/default-avatar.png"}
                alt={a.user.username}
                className="ac-account-avatar"
              />
              <div>
                <div className="ac-session-device">
                  @{a.user.username} {a.user._id === user._id && <span className="ac-badge">Active</span>}
                </div>
                <div className="ac-hint">{a.user.name}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {a.user._id !== user._id && (
                <button className="btn-secondary" onClick={() => handleSwitch(a.user._id)}>
                  Switch
                </button>
              )}
              <button className="btn-secondary" onClick={() => handleRemove(a.user._id)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="btn-primary" onClick={() => navigate("/add-account")}>
        + Add another account
      </button>
    </div>
  );
}
