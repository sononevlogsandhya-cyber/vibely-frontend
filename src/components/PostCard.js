import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Flag,
  EyeOff,
  Pin,
  Pencil,
} from "lucide-react";
import api, { mediaUrl } from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import ShareSheet from "./ShareSheet";

const REPORT_REASONS = [
  { key: "spam", label: "Spam" },
  { key: "nudity_or_sexual_activity", label: "Nudity or sexual activity" },
  { key: "hate_speech_or_symbols", label: "Hate speech or symbols" },
  { key: "violence_or_dangerous_orgs", label: "Violence or dangerous organizations" },
  { key: "bullying_or_harassment", label: "Bullying or harassment" },
  { key: "false_information", label: "False information" },
  { key: "scam_or_fraud", label: "Scam or fraud" },
  { key: "intellectual_property", label: "Intellectual property violation" },
  { key: "self_injury", label: "Self-injury" },
  { key: "other", label: "Something else" },
];

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  const units = [
    ["y", 31536000],
    ["mo", 2592000],
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
  ];
  for (const [label, secs] of units) {
    const val = Math.floor(seconds / secs);
    if (val >= 1) return `${val}${label}`;
  }
  return "now";
}

export default function PostCard({ post, onDeleted, autoFocusComments }) {
  const { user, updateUser } = useAuth();
  const { socket } = useSocket();
  const images = post.images && post.images.length > 0 ? post.images : post.image ? [post.image] : [];
  const [liked, setLiked] = useState(post.likes.includes(user._id));
  const [likeCount, setLikeCount] = useState(post.likes.length);
  const [comments, setComments] = useState(post.comments || []);
  const [commentText, setCommentText] = useState("");
  const [showAllComments, setShowAllComments] = useState(!!autoFocusComments);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState((user.savedPosts || []).some((id) => id === post._id || id?._id === post._id));
  const [showBigHeart, setShowBigHeart] = useState(false);
  const [slide, setSlide] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [hidden, setHidden] = useState((user.hiddenPosts || []).some((id) => id === post._id || id?._id === post._id));
  const [reportSent, setReportSent] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // { id, username }
  const [editingComment, setEditingComment] = useState(null); // { id, text }
  const lastTapRef = useRef(0);

  useEffect(() => {
    if (!socket) return;
    const room = `post-${post._id}`;
    socket.emit("join-room", room);

    function onUpdated({ postId, likes }) {
      if (postId !== post._id) return;
      setLikeCount(likes.length);
      setLiked(likes.includes(user._id));
    }
    function onCommentAdded({ postId, comments: newComments }) {
      if (postId !== post._id) return;
      setComments(newComments);
    }
    function onCommentUpdated({ postId, comments: newComments }) {
      if (postId !== post._id) return;
      setComments(newComments);
    }

    socket.on("post-updated", onUpdated);
    socket.on("post-comment-added", onCommentAdded);
    socket.on("post-comment-updated", onCommentUpdated);

    return () => {
      socket.emit("leave-room", room);
      socket.off("post-updated", onUpdated);
      socket.off("post-comment-added", onCommentAdded);
      socket.off("post-comment-updated", onCommentUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, post._id]);

  async function doLike(forceLikeOn) {
    if (forceLikeOn && liked) return; // already liked, double-tap does nothing extra
    setLiked((prev) => (forceLikeOn ? true : !prev));
    setLikeCount((prev) => {
      if (forceLikeOn) return liked ? prev : prev + 1;
      return liked ? prev - 1 : prev + 1;
    });
    try {
      await api.put(`/posts/${post._id}/like`);
    } catch (err) {
      setLiked((prev) => !prev);
      setLikeCount((prev) => (liked ? prev + 1 : prev - 1));
    }
  }

  async function toggleSave() {
    const next = !saved;
    setSaved(next);
    try {
      await api.put(`/posts/${post._id}/save`);
      const current = (user.savedPosts || []).map((id) => (id?._id ? id._id : id));
      const updated = next
        ? [post._id, ...current.filter((id) => id !== post._id)]
        : current.filter((id) => id !== post._id);
      updateUser({ savedPosts: updated });
    } catch (err) {
      setSaved(!next); // revert on failure
    }
  }

  function handleImageTap() {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      doLike(true);
      setShowBigHeart(true);
      setTimeout(() => setShowBigHeart(false), 700);
    }
    lastTapRef.current = now;
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!commentText.trim() || busy) return;
    setBusy(true);
    try {
      const res = await api.post(`/posts/${post._id}/comment`, {
        text: commentText,
        parent: replyTo?.id || null,
      });
      setComments(res.data);
      setCommentText("");
      setReplyTo(null);
    } catch (err) {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this post?")) return;
    try {
      await api.delete(`/posts/${post._id}`);
      onDeleted?.(post._id);
    } catch (err) {
      // ignore
    }
  }

  async function toggleHide(reasonLabel) {
    const next = !hidden;
    setHidden(next);
    setShowMenu(false);
    try {
      await api.put(`/posts/${post._id}/hide`);
      if (next) onDeleted?.(post._id); // drop it out of the feed list right away
    } catch (err) {
      setHidden(!next);
    }
  }

  async function submitReport(reasonKey) {
    try {
      await api.post(`/posts/${post._id}/report`, { reason: reasonKey });
      setReportSent(true);
      setTimeout(() => {
        setShowReport(false);
        onDeleted?.(post._id); // reporting hides it from the feed too
      }, 1200);
    } catch (err) {
      // ignore
    }
  }

  async function toggleCommentLike(commentId) {
    try {
      const res = await api.put(`/posts/${post._id}/comment/${commentId}/like`);
      setComments((prev) =>
        prev.map((c) => (c._id === commentId ? { ...c, likes: res.data.likes } : c))
      );
    } catch (err) {
      // ignore
    }
  }

  async function submitEditComment(e) {
    e.preventDefault();
    if (!editingComment?.text.trim()) return;
    try {
      const res = await api.put(`/posts/${post._id}/comment/${editingComment.id}`, {
        text: editingComment.text,
      });
      setComments(res.data);
      setEditingComment(null);
    } catch (err) {
      // ignore
    }
  }

  async function deleteComment(commentId) {
    if (!window.confirm("Delete this comment?")) return;
    try {
      const res = await api.delete(`/posts/${post._id}/comment/${commentId}`);
      setComments(res.data);
    } catch (err) {
      // ignore
    }
  }

  async function togglePinComment(commentId) {
    try {
      const res = await api.put(`/posts/${post._id}/comment/${commentId}/pin`);
      setComments(res.data);
    } catch (err) {
      // ignore
    }
  }

  const visibleComments = showAllComments ? comments : comments.slice(-2);
  const sortedComments = [...visibleComments].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  if (hidden && !onDeleted) {
    return (
      <div className="post-card card post-card-hidden">
        <EyeOff size={18} />
        <span>Post hidden. You won't see this in your feed.</span>
        <button className="btn-secondary" onClick={() => toggleHide()}>
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className="post-card card">
      <div className="post-header">
        <Link to={`/profile/${post.user.username}`} className="vibe-ring vibe-ring-thin">
          <span className="vibe-ring-inner">
            <img
              className="avatar avatar-sm"
              src={
                post.user.avatar
                  ? `${mediaUrl(post.user.avatar)}`
                  : "https://api.dicebear.com/7.x/initials/svg?seed=" + post.user.username
              }
              alt={post.user.username}
            />
          </span>
        </Link>
        <div>
          <Link to={`/profile/${post.user.username}`} className="who">
            {post.user.username}
          </Link>
          <div className="when">{timeAgo(post.createdAt)} ago</div>
        </div>
        <div className="spacer" />
        <div className="post-menu-wrap">
          <button className="icon-action-btn" onClick={() => setShowMenu((v) => !v)} title="More options">
            <MoreHorizontal size={19} />
          </button>
          {showMenu && (
            <>
              <div className="post-menu-backdrop" onClick={() => setShowMenu(false)} />
              <div className="post-menu-dropdown card">
                {post.user._id === user._id ? (
                  <button
                    className="post-menu-item post-menu-item-danger"
                    onClick={() => {
                      setShowMenu(false);
                      handleDelete();
                    }}
                  >
                    <Trash2 size={16} /> Delete post
                  </button>
                ) : (
                  <>
                    <button className="post-menu-item" onClick={() => toggleHide()}>
                      <EyeOff size={16} /> {hidden ? "Show again" : "Not interested"}
                    </button>
                    <button
                      className="post-menu-item post-menu-item-danger"
                      onClick={() => {
                        setShowMenu(false);
                        setShowReport(true);
                      }}
                    >
                      <Flag size={16} /> Report
                    </button>
                  </>
                )}
                <button
                  className="post-menu-item"
                  onClick={() => {
                    setShowMenu(false);
                    setShowShare(true);
                  }}
                >
                  <Send size={16} /> Copy link / Share
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="post-image-wrap" onClick={handleImageTap}>
        <img src={`${mediaUrl(images[slide])}`} alt="post" draggable={false} />
        {showBigHeart && (
          <Heart className="post-big-heart" size={90} fill="#fff" strokeWidth={0} />
        )}
        {images.length > 1 && (
          <>
            {slide > 0 && (
              <button
                className="carousel-arrow carousel-arrow-left"
                onClick={(e) => {
                  e.stopPropagation();
                  setSlide((s) => Math.max(0, s - 1));
                }}
              >
                <ChevronLeft size={18} />
              </button>
            )}
            {slide < images.length - 1 && (
              <button
                className="carousel-arrow carousel-arrow-right"
                onClick={(e) => {
                  e.stopPropagation();
                  setSlide((s) => Math.min(images.length - 1, s + 1));
                }}
              >
                <ChevronRight size={18} />
              </button>
            )}
            <div className="carousel-counter">{slide + 1}/{images.length}</div>
            <div className="carousel-dots">
              {images.map((_, i) => (
                <span key={i} className={`carousel-dot ${i === slide ? "active" : ""}`} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="post-actions">
        <button className={`icon-action-btn ${liked ? "liked" : ""}`} onClick={() => doLike(false)}>
          <Heart size={24} fill={liked ? "currentColor" : "none"} strokeWidth={1.8} />
        </button>
        <button className="icon-action-btn" onClick={() => document.getElementById(`comment-input-${post._id}`)?.focus()}>
          <MessageCircle size={24} strokeWidth={1.8} />
        </button>
        <button className="icon-action-btn" onClick={() => setShowShare(true)} title="Share">
          <Send size={22} strokeWidth={1.8} />
        </button>
        <div className="spacer" />
        <button
          className={`icon-action-btn ${saved ? "saved" : ""}`}
          onClick={toggleSave}
          title={saved ? "Saved" : "Save"}
        >
          <Bookmark size={22} fill={saved ? "currentColor" : "none"} strokeWidth={1.8} />
        </button>
      </div>

      <div className="post-likes">{likeCount} {likeCount === 1 ? "like" : "likes"}</div>

      {post.caption && (
        <div className="post-caption">
          <b>{post.user.username}</b>
          {post.caption}
        </div>
      )}

      {comments.length > 2 && !showAllComments && (
        <button className="view-comments-toggle" onClick={() => setShowAllComments(true)}>
          View all {comments.length} comments
        </button>
      )}

      <div className="post-comments">
        {sortedComments.map((c) => {
          const isMyComment = (c.user?._id || c.user) === user._id;
          const isPostOwner = post.user._id === user._id;
          const commentLiked = (c.likes || []).some((id) => (id?._id || id) === user._id);

          if (editingComment?.id === c._id) {
            return (
              <form className="comment-edit-row" key={c._id} onSubmit={submitEditComment}>
                <input
                  autoFocus
                  value={editingComment.text}
                  onChange={(e) => setEditingComment({ id: c._id, text: e.target.value })}
                />
                <button type="submit" className="btn-primary">Save</button>
                <button type="button" className="btn-secondary" onClick={() => setEditingComment(null)}>
                  Cancel
                </button>
              </form>
            );
          }

          return (
            <div className={`comment-row ${c.pinned ? "comment-pinned" : ""}`} key={c._id}>
              {c.pinned && (
                <div className="comment-pinned-label">
                  <Pin size={11} /> Pinned by {post.user.username}
                </div>
              )}
              <div className="comment-row-main">
                <b>{c.user?.username || "user"}</b>
                {c.text}
                {c.edited && <span className="comment-edited-tag"> (edited)</span>}
              </div>
              <div className="comment-row-actions">
                <span className="when">{timeAgo(c.createdAt)}</span>
                <button className="comment-action-link" onClick={() => setReplyTo({ id: c._id, username: c.user?.username })}>
                  Reply
                </button>
                {isMyComment && (
                  <button className="comment-action-link" onClick={() => setEditingComment({ id: c._id, text: c.text })}>
                    <Pencil size={12} /> Edit
                  </button>
                )}
                {(isMyComment || isPostOwner) && (
                  <button className="comment-action-link" onClick={() => deleteComment(c._id)}>
                    Delete
                  </button>
                )}
                {isPostOwner && (
                  <button className="comment-action-link" onClick={() => togglePinComment(c._id)}>
                    {c.pinned ? "Unpin" : "Pin"}
                  </button>
                )}
                <button
                  className={`comment-like-btn ${commentLiked ? "liked" : ""}`}
                  onClick={() => toggleCommentLike(c._id)}
                >
                  <Heart size={12} fill={commentLiked ? "currentColor" : "none"} />
                  {(c.likes || []).length > 0 && (c.likes || []).length}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {replyTo && (
        <div className="replying-to-banner">
          Replying to @{replyTo.username}
          <button onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}

      <form className="add-comment-row" onSubmit={submitComment}>
        <input
          id={`comment-input-${post._id}`}
          placeholder={replyTo ? `Reply to @${replyTo.username}…` : "Add a comment…"}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
        />
        <button type="submit" disabled={!commentText.trim() || busy}>
          Post
        </button>
      </form>

      {showShare && <ShareSheet post={post} onClose={() => setShowShare(false)} />}

      {showReport && (
        <div className="share-sheet-overlay" onClick={() => setShowReport(false)}>
          <div className="share-sheet card" onClick={(e) => e.stopPropagation()}>
            <div className="share-sheet-header">
              <span>Report post</span>
              <button className="icon-action-btn" onClick={() => setShowReport(false)}>✕</button>
            </div>
            {reportSent ? (
              <div className="info-banner" style={{ margin: 16 }}>
                Thanks for letting us know. We'll review this post.
              </div>
            ) : (
              <>
                <div className="share-sheet-subtitle">Why are you reporting this post?</div>
                <div className="share-sheet-user-list">
                  {REPORT_REASONS.map((r) => (
                    <button
                      key={r.key}
                      className="post-menu-item report-reason-item"
                      onClick={() => submitReport(r.key)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
