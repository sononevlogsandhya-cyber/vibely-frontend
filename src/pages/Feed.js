import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, TrendingUp, Sparkles } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import PostCard from "../components/PostCard";
import CreatePost from "../components/CreatePost";
import StoryBar from "../components/StoryBar";
import PostSkeleton from "../components/PostSkeleton";

const TABS = [
  { key: "following", label: "Following", icon: Users, endpoint: "/posts/feed" },
  { key: "trending", label: "Trending", icon: TrendingUp, endpoint: "/posts/trending" },
  { key: "interest", label: "Interest", icon: Sparkles, endpoint: "/posts/interest" },
];

export default function Feed() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [activeTab, setActiveTab] = useState("following");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPostsWaiting, setNewPostsWaiting] = useState([]);

  async function loadFeed(tabKey) {
    setLoading(true);
    const tab = TABS.find((t) => t.key === tabKey);
    try {
      const res = await api.get(tab.endpoint);
      setPosts(res.data);
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeed(activeTab);
    setNewPostsWaiting([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Live updates: someone I follow (or I) just posted — show a "new posts" pill
  useEffect(() => {
    if (!socket) return;
    function onNewPost(post) {
      const isMine = post.user._id === user._id;
      const isFollowed = user.following?.includes(post.user._id);
      if (activeTab === "following" && !isMine && !isFollowed) return;
      if (isMine) return; // already added instantly via handleCreated
      setNewPostsWaiting((prev) => [post, ...prev]);
    }
    socket.on("new-post", onNewPost);
    return () => socket.off("new-post", onNewPost);
  }, [socket, user._id, user.following, activeTab]);

  function handleCreated(post) {
    setPosts((prev) => [post, ...prev]);
  }

  function handleDeleted(id) {
    setPosts((prev) => prev.filter((p) => p._id !== id));
  }

  function showWaitingPosts() {
    setPosts((prev) => [...newPostsWaiting, ...prev]);
    setNewPostsWaiting([]);
  }

  return (
    <div className="main-container">
      <StoryBar />
      <CreatePost onCreated={handleCreated} />

      <div className="feed-tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={`feed-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {newPostsWaiting.length > 0 && (
        <button className="new-posts-pill" onClick={showWaitingPosts}>
          ✨ {newPostsWaiting.length} new post{newPostsWaiting.length > 1 ? "s" : ""} — tap to view
        </button>
      )}

      {loading ? (
        <>
          <PostSkeleton />
          <PostSkeleton />
        </>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <div className="icon">✨</div>
          {activeTab === "following" && (
            <p>
              Your feed is quiet. <Link to="/explore"><b>Explore</b></Link> and follow people to
              see their posts here.
            </p>
          )}
          {activeTab === "trending" && <p>No trending posts in the last 3 days yet.</p>}
          {activeTab === "interest" && (
            <p>
              Add some interests on your{" "}
              <Link to={`/profile/${user.username}`}><b>profile</b></Link> to see posts tagged
              with them here.
            </p>
          )}
        </div>
      ) : (
        posts.map((post) => (
          <PostCard key={post._id} post={post} onDeleted={handleDeleted} />
        ))
      )}
    </div>
  );
}
