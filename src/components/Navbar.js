import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Compass, Film, MessageCircle, Heart, LogOut, Search, Settings } from "lucide-react";
import api, { mediaUrl } from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import logo from "../assets/logo.png";
import ksLogo from "../assets/ks-logo.png";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { liveNotifications, clearLiveNotifications, socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadMessages, setUnreadMessages] = useState(0);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const searchRef = useRef(null);

  useEffect(() => {
    api
      .get("/messages/unread-count")
      .then((res) => setUnreadMessages(res.data.count || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    function onNewMessage() {
      if (!window.location.pathname.startsWith("/messages")) {
        setUnreadMessages((prev) => prev + 1);
      }
    }
    socket.on("new-message", onNewMessage);
    return () => socket.off("new-message", onNewMessage);
  }, [socket]);

  useEffect(() => {
    function onClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setResults([]);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
        setResults(res.data);
      } catch (err) {
        // ignore search errors silently
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  async function openNotifications() {
    setShowNotif((prev) => !prev);
    if (!showNotif) {
      try {
        const res = await api.get("/notifications");
        setNotifications(res.data);
        await api.put("/notifications/read-all");
        clearLiveNotifications();
      } catch (err) {
        // ignore
      }
    }
  }

  const unreadCount = liveNotifications.length;

  function notifText(n) {
    const name = n.sender?.name || n.from?.name || "Someone";
    if (n.type === "like") return `${name} liked your post`;
    if (n.type === "comment") return `${name} commented on your post`;
    if (n.type === "follow") return `${name} started following you`;
    return "";
  }

  function isActive(path) {
    return location.pathname === path;
  }

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="logo-link">
          <img src={logo} alt="Vibely" className="navbar-logo-img" />
          <span className="logo">Vibely</span>
        </Link>

        <div className="search-wrap" ref={searchRef}>
          <Search size={16} className="search-icon" />
          <input
            className="nav-search"
            placeholder="Search people…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {results.length > 0 && (
            <div className="search-results">
              {results.map((u) => (
                <div
                  key={u._id}
                  className="search-result-row"
                  onClick={() => {
                    setQuery("");
                    setResults([]);
                    navigate(`/profile/${u.username}`);
                  }}
                >
                  <img
                    className="avatar avatar-sm"
                    src={
                      u.avatar
                        ? `${mediaUrl(u.avatar)}`
                        : "https://api.dicebear.com/7.x/initials/svg?seed=" + u.username
                    }
                    alt={u.username}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>@{u.username}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="nav-actions" style={{ position: "relative" }}>
          <Link
            to="/explore"
            className={`nav-icon-btn ${isActive("/explore") ? "nav-active" : ""}`}
            title="Explore"
          >
            <Compass size={22} strokeWidth={isActive("/explore") ? 2.4 : 1.8} />
          </Link>

          <Link
            to="/reels"
            className={`nav-icon-btn ${isActive("/reels") ? "nav-active" : ""}`}
            title="Reels"
          >
            <Film size={22} strokeWidth={isActive("/reels") ? 2.4 : 1.8} />
          </Link>

          <Link
            to="/messages"
            className={`nav-icon-btn ${isActive("/messages") ? "nav-active" : ""}`}
            title="Messages"
            onClick={() => setUnreadMessages(0)}
          >
            <MessageCircle size={22} strokeWidth={isActive("/messages") ? 2.4 : 1.8} />
            {unreadMessages > 0 && <span className="notif-dot" />}
          </Link>

          <button className="nav-icon-btn" onClick={openNotifications} title="Notifications">
            <Heart size={22} strokeWidth={showNotif ? 2.4 : 1.8} />
            {unreadCount > 0 && <span className="notif-dot" />}
          </button>

          {showNotif && (
            <div className="notif-panel card">
              {notifications.length === 0 ? (
                <div className="notif-empty">No notifications yet</div>
              ) : (
                notifications.map((n) => (
                  <div key={n._id} className={`notif-row ${!n.read ? "unread" : ""}`}>
                    <img
                      className="avatar avatar-sm"
                      src={
                        n.sender?.avatar
                          ? `${mediaUrl(n.sender.avatar)}`
                          : "https://api.dicebear.com/7.x/initials/svg?seed=" + n.sender?.username
                      }
                      alt=""
                    />
                    <span>{notifText(n)}</span>
                  </div>
                ))
              )}
            </div>
          )}

          <Link to={`/profile/${user.username}`} className="vibe-ring" title="My profile">
            <span className="vibe-ring-inner">
              <img
                className="avatar avatar-sm"
                src={
                  user.avatar
                    ? `${mediaUrl(user.avatar)}`
                    : "https://api.dicebear.com/7.x/initials/svg?seed=" + user.username
                }
                alt={user.username}
              />
            </span>
          </Link>

          <Link to="/account-center" className="nav-icon-btn" title="Account Center">
            <Settings size={19} strokeWidth={1.8} />
          </Link>

          <button className="nav-icon-btn nav-logout-btn" onClick={logout} title="Log out">
            <LogOut size={19} strokeWidth={1.8} />
          </button>
        </div>
      </nav>
      <div className="ks-strip">
        <img src={ksLogo} alt="KS" className="ks-badge ks-badge-sm" />
        <span>Vibely by KS Technologies Group</span>
      </div>
    </>
  );
}
