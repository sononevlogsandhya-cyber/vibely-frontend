import React, { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { BarChart3, MapPin, Bookmark, Grid3x3, Layers } from "lucide-react";
import api, { mediaUrl } from "../api/axios";
import { useAuth } from "../context/AuthContext";
import PostModal from "../components/PostModal";
import FollowListModal from "../components/FollowListModal";

export default function Profile() {
  const { username } = useParams();
  const { user: me, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [tab, setTab] = useState("posts");
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", bio: "", city: "", skills: "", interests: "" });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [openPost, setOpenPost] = useState(null);
  const [followListModal, setFollowListModal] = useState(null); // "followers" | "following" | null
  const fileInputRef = useRef(null);

  const isOwnProfile = me.username === username;

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/users/${username}`);
      setProfile(res.data);
      setEditForm({
        name: res.data.name,
        bio: res.data.bio || "",
        city: res.data.city || "",
        skills: (res.data.skills || []).join(", "),
        interests: (res.data.interests || []).join(", "),
      });
      const postsRes = await api.get(`/posts/user/${res.data._id}`);
      setPosts(postsRes.data);

      if (me.username === username) {
        const analyticsRes = await api.get("/users/me/analytics");
        setBadges(analyticsRes.data.badges);
      }
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function loadSaved() {
    try {
      const res = await api.get("/posts/me/saved");
      setSavedPosts(res.data);
    } catch (err) {
      // ignore
    }
  }

  useEffect(() => {
    load();
    setTab("posts");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  useEffect(() => {
    if (tab === "saved" && isOwnProfile) loadSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function toggleFollow() {
    try {
      await api.put(`/users/${profile._id}/follow`);
      load();
    } catch (err) {
      // ignore
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("name", editForm.name);
      formData.append("bio", editForm.bio);
      formData.append("city", editForm.city);
      formData.append("skills", editForm.skills);
      formData.append("interests", editForm.interests);
      if (avatarFile) formData.append("avatar", avatarFile);
      const res = await api.put("/users/me/update", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      updateUser({
        name: res.data.name,
        bio: res.data.bio,
        avatar: res.data.avatar,
        city: res.data.city,
        skills: res.data.skills,
        interests: res.data.interests,
      });
      setEditing(false);
      setAvatarFile(null);
      setAvatarPreview(null);
      load();
    } catch (err) {
      // ignore
    }
  }

  function handlePostDeleted(id) {
    setPosts((prev) => prev.filter((p) => p._id !== id));
    setSavedPosts((prev) => prev.filter((p) => p._id !== id));
  }

  if (loading) return <div className="loading-state">Loading profile…</div>;
  if (!profile) return <div className="empty-state">User not found.</div>;

  const isFollowing = profile.followers?.some((f) => f._id === me._id);
  const gridPosts = tab === "saved" ? savedPosts : posts;

  return (
    <div className="main-container">
      <div className="profile-header">
        <span className="vibe-ring">
          <span className="vibe-ring-inner">
            <img
              className="avatar avatar-lg"
              src={
                avatarPreview ||
                (profile.avatar
                  ? `${mediaUrl(profile.avatar)}`
                  : "https://api.dicebear.com/7.x/initials/svg?seed=" + profile.username)
              }
              alt={profile.username}
            />
          </span>
        </span>

        <div className="profile-info">
          <h2>@{profile.username}</h2>
          <div style={{ fontWeight: 600, color: "var(--muted)" }}>{profile.name}</div>
          {profile.city && (
            <div className="profile-city">
              <MapPin size={13} /> {profile.city}
            </div>
          )}

          <div className="profile-stats">
            <div><b>{posts.length}</b>posts</div>
            <div className="stat-clickable" onClick={() => profile.followers?.length > 0 && setFollowListModal("followers")}>
              <b>{profile.followers?.length || 0}</b>followers
            </div>
            <div className="stat-clickable" onClick={() => profile.following?.length > 0 && setFollowListModal("following")}>
              <b>{profile.following?.length || 0}</b>following
            </div>
          </div>

          <div className="profile-bio">{profile.bio}</div>

          {profile.skills?.length > 0 && (
            <div className="profile-tags">
              {profile.skills.map((s) => (
                <span key={s} className="tag-pill skill-pill">{s}</span>
              ))}
            </div>
          )}

          <div className="profile-actions-row">
            {isOwnProfile ? (
              <>
                <button className="btn-secondary" onClick={() => setEditing((p) => !p)}>
                  {editing ? "Cancel" : "Edit profile"}
                </button>
                <Link to="/analytics" className="btn-secondary analytics-link-btn">
                  <BarChart3 size={15} /> Analytics
                </Link>
              </>
            ) : (
              <button
                className={`btn-secondary ${isFollowing ? "following" : ""}`}
                onClick={toggleFollow}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            )}
          </div>

          {badges.length > 0 && (
            <div className="badges-row">
              {badges.map((b) => (
                <div className="badge-chip" key={b.id} title={b.label}>
                  <span className="badge-icon">{b.icon}</span>
                  <span>{b.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <form className="card" style={{ padding: 20, marginBottom: 20 }} onSubmit={saveProfile}>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <img
              className="avatar avatar-lg"
              style={{ margin: "0 auto 10px", cursor: "pointer" }}
              src={
                avatarPreview ||
                (profile.avatar
                  ? `${mediaUrl(profile.avatar)}`
                  : "https://api.dicebear.com/7.x/initials/svg?seed=" + profile.username)
              }
              alt="avatar preview"
              onClick={() => fileInputRef.current.click()}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files[0];
                if (f) {
                  setAvatarFile(f);
                  setAvatarPreview(URL.createObjectURL(f));
                }
              }}
            />
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Click photo to change</div>
          </div>

          <div className="field">
            <label>Name</label>
            <input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Bio</label>
            <textarea
              rows={2}
              maxLength={150}
              value={editForm.bio}
              onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
            />
          </div>
          <div className="field">
            <label>City</label>
            <input
              placeholder="e.g. Mumbai"
              value={editForm.city}
              onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Skills (comma separated)</label>
            <input
              placeholder="e.g. Photography, Design, Cooking"
              value={editForm.skills}
              onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Interests (comma separated — used for your Interest feed)</label>
            <input
              placeholder="e.g. travel, fitness, tech"
              value={editForm.interests}
              onChange={(e) => setEditForm({ ...editForm, interests: e.target.value })}
            />
          </div>
          <button className="btn-primary">Save changes</button>
        </form>
      )}

      {isOwnProfile && (
        <div className="profile-grid-tabs">
          <button className={`profile-grid-tab ${tab === "posts" ? "active" : ""}`} onClick={() => setTab("posts")}>
            <Grid3x3 size={15} /> Posts
          </button>
          <button className={`profile-grid-tab ${tab === "saved" ? "active" : ""}`} onClick={() => setTab("saved")}>
            <Bookmark size={15} /> Saved
          </button>
        </div>
      )}

      {gridPosts.length === 0 ? (
        <div className="empty-state">
          <div className="icon">{tab === "saved" ? "🔖" : "📸"}</div>
          <p>{tab === "saved" ? "No saved posts yet." : "No posts yet."}</p>
        </div>
      ) : (
        <div className="post-grid">
          {gridPosts.map((p) => {
            const imgs = p.images && p.images.length > 0 ? p.images : p.image ? [p.image] : [];
            return (
              <div className="post-grid-item" key={p._id} onClick={() => setOpenPost(p)}>
                <img src={`${mediaUrl(imgs[0])}`} alt="post" />
                {imgs.length > 1 && <Layers size={16} className="post-grid-multi-icon" />}
              </div>
            );
          })}
        </div>
      )}

      {openPost && (
        <PostModal post={openPost} onClose={() => setOpenPost(null)} onDeleted={handlePostDeleted} />
      )}

      {followListModal && (
        <FollowListModal
          title={followListModal === "followers" ? "Followers" : "Following"}
          users={followListModal === "followers" ? profile.followers : profile.following}
          onClose={() => setFollowListModal(null)}
        />
      )}
    </div>
  );
}
