import React, { useEffect, useState } from "react";
import api, { mediaUrl } from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import StoryViewer from "./StoryViewer";
import StoryCreator from "./StoryCreator";

export default function StoryBar() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [groups, setGroups] = useState([]);
  const [viewingIndex, setViewingIndex] = useState(null);
  const [creating, setCreating] = useState(false);

  async function loadStories() {
    try {
      const res = await api.get("/stories/feed");
      setGroups(res.data);
    } catch (err) {
      // ignore
    }
  }

  useEffect(() => {
    loadStories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!socket) return;
    function onNewStory(story) {
      const isMine = story.user._id === user._id;
      const isFollowed = user.following?.includes(story.user._id);
      if (!isMine && !isFollowed) return;
      loadStories();
    }
    socket.on("new-story", onNewStory);
    return () => socket.off("new-story", onNewStory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user._id, user.following]);

  const myGroup = groups.find((g) => g.user._id === user._id);

  function handleCreated() {
    setCreating(false);
    loadStories();
  }

  return (
    <div className="story-bar card">
      <div className="story-bar-scroll">
        <div className="story-item">
          <div
            className={`story-avatar-wrap ${myGroup ? "has-story" : "no-story"}`}
            onClick={() => {
              if (myGroup) {
                setViewingIndex(groups.indexOf(myGroup));
              } else {
                setCreating(true);
              }
            }}
          >
            <img
              className="avatar avatar-md"
              src={
                user.avatar
                  ? `${mediaUrl(user.avatar)}`
                  : "https://api.dicebear.com/7.x/initials/svg?seed=" + user.username
              }
              alt="me"
            />
            {!myGroup && (
              <span
                className="story-add-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setCreating(true);
                }}
              >
                +
              </span>
            )}
          </div>
          <span className="story-label">Your story</span>
        </div>

        {groups
          .filter((g) => g.user._id !== user._id)
          .map((group) => (
            <div className="story-item" key={group.user._id}>
              <div
                className="story-avatar-wrap has-story"
                onClick={() => setViewingIndex(groups.indexOf(group))}
              >
                <img
                  className="avatar avatar-md"
                  src={
                    group.user.avatar
                      ? `${mediaUrl(group.user.avatar)}`
                      : "https://api.dicebear.com/7.x/initials/svg?seed=" + group.user.username
                  }
                  alt={group.user.username}
                />
              </div>
              <span className="story-label">{group.user.username}</span>
            </div>
          ))}
      </div>

      {viewingIndex !== null && (
        <StoryViewer
          groups={groups}
          startIndex={viewingIndex}
          onClose={() => setViewingIndex(null)}
        />
      )}

      {creating && (
        <StoryCreator onClose={() => setCreating(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
