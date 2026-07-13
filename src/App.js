import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import Navbar from "./components/Navbar";
import BottomNav from "./components/BottomNav";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Feed from "./pages/Feed";
import Explore from "./pages/Explore";
import Profile from "./pages/Profile";
import Messages from "./pages/Messages";
import Reels from "./pages/Reels";
import Analytics from "./pages/Analytics";
import ForgotPassword from "./pages/ForgotPassword";
import AccountRecovery from "./pages/AccountRecovery";
import AddAccount from "./pages/AddAccount";
import AccountCenter from "./pages/account/AccountCenter";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-state">Loading Vibely…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  React.useEffect(() => {
    const root = document.documentElement;
    const a11y = user?.accessibility;
    root.setAttribute("data-font-size", a11y?.fontSize || "default");
    root.classList.toggle("a11y-high-contrast", !!a11y?.highContrast);
    root.classList.toggle("a11y-reduce-motion", !!a11y?.reduceMotion);
    root.setAttribute("lang", user?.language || "en");
  }, [user?.accessibility, user?.language]);

  if (loading) return <div className="loading-state">Loading Vibely…</div>;

  return (
    <div className="app-shell">
      {user && <Navbar />}
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/register"
          element={user ? <Navigate to="/" replace /> : <Register />}
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/account-recovery" element={<AccountRecovery />} />
        <Route path="/add-account" element={<AddAccount />} />
        <Route
          path="/account-center"
          element={
            <PrivateRoute>
              <AccountCenter />
            </PrivateRoute>
          }
        />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Feed />
            </PrivateRoute>
          }
        />
        <Route
          path="/explore"
          element={
            <PrivateRoute>
              <Explore />
            </PrivateRoute>
          }
        />
        <Route
          path="/profile/:username"
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <PrivateRoute>
              <Messages />
            </PrivateRoute>
          }
        />
        <Route
          path="/reels"
          element={
            <PrivateRoute>
              <Reels />
            </PrivateRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <PrivateRoute>
              <Analytics />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {user && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppRoutes />
      </SocketProvider>
    </AuthProvider>
  );
}
