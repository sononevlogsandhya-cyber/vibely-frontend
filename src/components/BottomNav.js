import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Compass, Film, MessageCircle } from "lucide-react";
import { mediaUrl } from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function BottomNav() {
  const { user } = useAuth();
  const location = useLocation();

  function isActive(path) {
    return location.pathname === path;
  }

  return (
    <nav className="bottom-nav">
      <Link to="/" className={`bottom-nav-item ${isActive("/") ? "active" : ""}`}>
        <Home size={24} strokeWidth={isActive("/") ? 2.4 : 1.8} />
      </Link>
      <Link
        to="/explore"
        className={`bottom-nav-item ${isActive("/explore") ? "active" : ""}`}
      >
        <Compass size={24} strokeWidth={isActive("/explore") ? 2.4 : 1.8} />
      </Link>
      <Link
        to="/reels"
        className={`bottom-nav-item ${isActive("/reels") ? "active" : ""}`}
      >
        <Film size={24} strokeWidth={isActive("/reels") ? 2.4 : 1.8} />
      </Link>
      <Link
        to="/messages"
        className={`bottom-nav-item ${isActive("/messages") ? "active" : ""}`}
      >
        <MessageCircle size={24} strokeWidth={isActive("/messages") ? 2.4 : 1.8} />
      </Link>
      <Link
        to={`/profile/${user.username}`}
        className={`bottom-nav-item ${
          isActive(`/profile/${user.username}`) ? "active" : ""
        }`}
      >
        <img
          className="bottom-nav-avatar"
          src={
            user.avatar
              ? `${mediaUrl(user.avatar)}`
              : "https://api.dicebear.com/7.x/initials/svg?seed=" + user.username
          }
          alt="me"
        />
      </Link>
    </nav>
  );
}
