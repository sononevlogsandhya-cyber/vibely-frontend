// Manages a list of logged-in accounts on this device (Instagram-style
// "Add account" / "Switch accounts"). Each entry keeps its own token so the
// user never has to re-enter a password to switch back.

const ACCOUNTS_KEY = "vibely_accounts"; // [{ token, user }]
const ACTIVE_TOKEN_KEY = "vibely_token"; // kept for backward-compat w/ AuthContext + axios

function getStoredAccounts() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

/** Adds a new account or refreshes an existing one's token/user data, and makes it active */
function addOrUpdateAccount(token, user) {
  const accounts = getStoredAccounts();
  const idx = accounts.findIndex((a) => a.user._id === user._id);
  const entry = { token, user };
  if (idx >= 0) accounts[idx] = entry;
  else accounts.push(entry);
  saveStoredAccounts(accounts);
  localStorage.setItem(ACTIVE_TOKEN_KEY, token);
}

/** Switches the active session to an already-logged-in account. Returns { token, user } or null */
function switchToAccount(userId) {
  const accounts = getStoredAccounts();
  const found = accounts.find((a) => a.user._id === userId);
  if (!found) return null;
  localStorage.setItem(ACTIVE_TOKEN_KEY, found.token);
  return found;
}

/** Removes an account from the device entirely (used on logout) */
function removeAccount(userId) {
  const accounts = getStoredAccounts().filter((a) => a.user._id !== userId);
  saveStoredAccounts(accounts);

  // If we just removed the active account, fall back to another stored one if present
  const activeToken = localStorage.getItem(ACTIVE_TOKEN_KEY);
  const stillActiveElsewhere = accounts.some((a) => a.token === activeToken);
  if (!stillActiveElsewhere) {
    if (accounts.length > 0) {
      localStorage.setItem(ACTIVE_TOKEN_KEY, accounts[0].token);
      return accounts[0]; // caller should treat this as the new active account
    }
    localStorage.removeItem(ACTIVE_TOKEN_KEY);
  }
  return null;
}

function getActiveUserId() {
  const accounts = getStoredAccounts();
  const activeToken = localStorage.getItem(ACTIVE_TOKEN_KEY);
  const match = accounts.find((a) => a.token === activeToken);
  return match ? match.user._id : null;
}

export { getStoredAccounts, addOrUpdateAccount, switchToAccount, removeAccount, getActiveUserId };
