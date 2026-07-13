import React, { useEffect, useState } from "react";
import { X, Link2, Check } from "lucide-react";
import api, { mediaUrl } from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function ShareSheet({ post, onClose }) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [following, setFollowing] = useState([]);
  const [sentTo, setSentTo] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/users/${user.username}`)
      .then((res) => setFollowing(res.data.following || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user.username]);

  function copyLink() {
    const link = `${window.location.origin}/profile/${post.user.username}?post=${post._id}`;
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function sendToUser(targetUser) {
    try {
      const convo = await api.post("/messages/conversations", { userId: targetUser._id });
      const link = `${window.location.origin}/profile/${post.user.username}?post=${post._id}`;
      await api.post(`/messages/${convo.data._id}`, {
        text: `Check out this post by @${post.user.username}: ${link}`,
      });
      setSentTo((prev) => new Set(prev).add(targetUser._id));
    } catch (err) {
      // ignore
    }
  }

  return (
    <div className="share-sheet-overlay" onClick={onClose}>
      <div className="share-sheet card" onClick={(e) => e.stopPropagation()}>
        <div className="share-sheet-header">
          <span>Share post</span>
          <button className="icon-action-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <button className="share-sheet-copy-row" onClick={copyLink}>
          <span className="share-sheet-copy-icon">{copied ? <Check size={16} /> : <Link2 size={16} />}</span>
          {copied ? "Link copied!" : "Copy link"}
        </button>

        <div className="share-sheet-subtitle">Send to</div>

        {loading ? (
          <div className="empty-state" style={{ padding: 20 }}>Loading…</div>
        ) : following.length === 0 ? (
          <div className="empty-state" style={{ padding: 20 }}>
            <p>Follow people to send posts as a DM.</p>
          </div>
        ) : (
          <div className="share-sheet-user-list">
            {following.map((u) => (
              <div className="share-sheet-user-row" key={u._id}>
                <img
                  className="avatar avatar-sm"
                  src={
                    u.avatar
                      ? `${mediaUrl(u.avatar)}`
                      : "https://api.dicebear.com/7.x/initials/svg?seed=" + u.username
                  }
                  alt={u.username}
                />
                <div className="share-sheet-user-name">
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>@{u.username}</div>
                </div>
                <button
                  className={`btn-secondary ${sentTo.has(u._id) ? "following" : ""}`}
                  disabled={sentTo.has(u._id)}
                  onClick={() => sendToUser(u)}
                >
                  {sentTo.has(u._id) ? "Sent" : "Send"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
