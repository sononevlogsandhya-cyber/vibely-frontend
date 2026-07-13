import React, { useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import api, { mediaUrl } from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function FollowListModal({ title, users, onClose }) {
  const { user: me } = useAuth();
  const myFollowingIds = (me.following || []).map((id) => (id?._id ? id._id : id));
  const [following, setFollowing] = useState(new Set(users.filter((u) => myFollowingIds.includes(u._id)).map((u) => u._id)));
  const [busy, setBusy] = useState(null);

  async function toggleFollow(u) {
    setBusy(u._id);
    try {
      await api.put(`/users/${u._id}/follow`);
      setFollowing((prev) => {
        const next = new Set(prev);
        next.has(u._id) ? next.delete(u._id) : next.add(u._id);
        return next;
      });
    } catch (err) {
      // ignore
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="post-modal-overlay" onClick={onClose}>
      <div className="follow-list-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="share-sheet-header">
          <span>{title}</span>
          <button className="icon-action-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {users.length === 0 ? (
          <div className="empty-state" style={{ padding: 20 }}>
            <p>No one here yet.</p>
          </div>
        ) : (
          <div className="share-sheet-user-list">
            {users.map((u) => (
              <div className="share-sheet-user-row" key={u._id}>
                <Link to={`/profile/${u.username}`} onClick={onClose} style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
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
                </Link>
                {u._id !== me._id && (
                  <button
                    className={`btn-secondary ${following.has(u._id) ? "following" : ""}`}
                    disabled={busy === u._id}
                    onClick={() => toggleFollow(u)}
                  >
                    {following.has(u._id) ? "Following" : "Follow"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
