import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { useSocket } from "../context/SocketContext";
import PostCard from "../components/PostCard";
import PostSkeleton from "../components/PostSkeleton";

export default function Explore() {
  const { socket } = useSocket();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/posts/explore")
      .then((res) => setPosts(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!socket) return;
    function onNewPost(post) {
      setPosts((prev) => [post, ...prev]);
    }
    socket.on("new-post", onNewPost);
    return () => socket.off("new-post", onNewPost);
  }, [socket]);

  function handleDeleted(id) {
    setPosts((prev) => prev.filter((p) => p._id !== id));
  }

  return (
    <div className="main-container">
      <h2 className="page-title">Explore</h2>

      {loading ? (
        <>
          <PostSkeleton />
          <PostSkeleton />
        </>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🌱</div>
          <p>No posts yet. Be the first to share something!</p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard key={post._id} post={post} onDeleted={handleDeleted} />
        ))
      )}
    </div>
  );
}
