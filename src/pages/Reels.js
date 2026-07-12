import React, { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Trash2, Play } from "lucide-react";
import api, { mediaUrl } from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import CreateReel from "../components/CreateReel";

function ReelItem({ reel, onDeleted }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const videoRef = useRef(null);
  const [liked, setLiked] = useState(reel.likes.includes(user._id));
  const [likeCount, setLikeCount] = useState(reel.likes.length);
  const [comments, setComments] = useState(reel.comments || []);
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
          setPlaying(true);
        } else {
          video.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const room = `reel-${reel._id}`;
    socket.emit("join-room", room);

    function onUpdated({ reelId, likes }) {
      if (reelId !== reel._id) return;
      setLikeCount(likes.length);
      setLiked(likes.includes(user._id));
    }
    function onCommentAdded({ reelId, comments: newComments }) {
      if (reelId !== reel._id) return;
      setComments(newComments);
    }

    socket.on("reel-updated", onUpdated);
    socket.on("reel-comment-added", onCommentAdded);

    return () => {
      socket.emit("leave-room", room);
      socket.off("reel-updated", onUpdated);
      socket.off("reel-comment-added", onCommentAdded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, reel._id]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  async function toggleLike() {
    setLiked((p) => !p);
    setLikeCount((p) => (liked ? p - 1 : p + 1));
    try {
      await api.put(`/reels/${reel._id}/like`);
    } catch (err) {
      setLiked((p) => !p);
      setLikeCount((p) => (liked ? p + 1 : p - 1));
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const res = await api.post(`/reels/${reel._id}/comment`, { text: commentText });
      setComments(res.data);
      setCommentText("");
    } catch (err) {
      // ignore
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this reel?")) return;
    try {
      await api.delete(`/reels/${reel._id}`);
      onDeleted(reel._id);
    } catch (err) {
      // ignore
    }
  }

  return (
    <div className="reel-item">
      <video
        ref={videoRef}
        src={`${mediaUrl(reel.video)}`}
        loop
        muted
        playsInline
        onClick={togglePlay}
        className="reel-video"
      />
      {!playing && <Play className="reel-play-icon" size={54} fill="#fff" strokeWidth={0} />}

      <div className="reel-overlay">
        <div className="reel-user-row">
          <img
            className="avatar avatar-sm"
            src={
              reel.user.avatar
                ? `${mediaUrl(reel.user.avatar)}`
                : "https://api.dicebear.com/7.x/initials/svg?seed=" + reel.user.username
            }
            alt=""
          />
          <span className="reel-username">{reel.user.username}</span>
          {reel.user._id === user._id && (
            <button className="reel-delete-btn" onClick={handleDelete}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
        {reel.caption && <div className="reel-caption">{reel.caption}</div>}
      </div>

      <div className="reel-side-actions">
        <button className={`reel-action-btn ${liked ? "liked" : ""}`} onClick={toggleLike}>
          <Heart size={26} fill={liked ? "currentColor" : "none"} strokeWidth={1.8} />
          <span>{likeCount}</span>
        </button>
        <button className="reel-action-btn" onClick={() => setShowComments((p) => !p)}>
          <MessageCircle size={26} strokeWidth={1.8} />
          <span>{comments.length}</span>
        </button>
      </div>

      {showComments && (
        <div className="reel-comments-panel card">
          <div className="reel-comments-list">
            {comments.length === 0 ? (
              <div className="notif-empty">No comments yet.</div>
            ) : (
              comments.map((c) => (
                <div className="comment-row" key={c._id}>
                  <b>{c.user?.username || "user"}</b>
                  {c.text}
                </div>
              ))
            )}
          </div>
          <form className="add-comment-row" onSubmit={submitComment}>
            <input
              placeholder="Add a comment…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button type="submit" disabled={!commentText.trim()}>
              Post
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function Reels() {
  const { socket } = useSocket();
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api
      .get("/reels/feed")
      .then((res) => setReels(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!socket) return;
    function onNewReel(reel) {
      setReels((prev) => [reel, ...prev]);
    }
    socket.on("new-reel", onNewReel);
    return () => socket.off("new-reel", onNewReel);
  }, [socket]);

  function handleDeleted(id) {
    setReels((prev) => prev.filter((r) => r._id !== id));
  }

  function handleCreated(reel) {
    setReels((prev) => [reel, ...prev]);
    setUploading(false);
  }

  if (loading) return <div className="loading-state">Loading reels…</div>;

  return (
    <div className="reels-page">
      <button className="reel-upload-fab" onClick={() => setUploading(true)} title="New reel">
        🎥+
      </button>

      {reels.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🎬</div>
          <p>No reels yet. Tap the button to upload the first one!</p>
        </div>
      ) : (
        <div className="reels-feed">
          {reels.map((reel) => (
            <ReelItem key={reel._id} reel={reel} onDeleted={handleDeleted} />
          ))}
        </div>
      )}

      {uploading && (
        <CreateReel onClose={() => setUploading(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
