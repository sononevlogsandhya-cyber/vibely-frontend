import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";
import { addOrUpdateAccount, removeAccount } from "../utils/accounts";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("vibely_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("vibely_token");
      })
      .finally(() => setLoading(false));
  }, []);

  function login(token, userData) {
    localStorage.setItem("vibely_token", token);
    addOrUpdateAccount(token, userData); // also registers this login for account switching
    setUser(userData);
  }

  /** Switch to an already-logged-in account without re-entering a password */
  function switchAccount(token, userData) {
    localStorage.setItem("vibely_token", token);
    setUser(userData);
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // even if the network call fails, still clear the local session
    }
    const fallback = user ? removeAccount(user._id) : null;
    if (fallback) {
      // another account was still logged in on this device — switch to it
      setUser(fallback.user);
    } else {
      localStorage.removeItem("vibely_token");
      setUser(null);
    }
  }

  function updateUser(partial) {
    setUser((prev) => ({ ...prev, ...partial }));
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, switchAccount, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
