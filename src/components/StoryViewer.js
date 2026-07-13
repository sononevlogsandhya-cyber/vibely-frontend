import React, { useEffect, useRef, useState } from "react";
import api, { mediaUrl } from "../api/axios";

const STORY_DURATION = 5000; // ms per story

export default function StoryViewer({ groups, startIndex, onClose }) {
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [stickerTallies, setStickerTallies] = useState({}); // stickerId -> tally array
  const [myVotes, setMyVotes] = useState({}); // stickerId -> optionIndex
  const timerRef = useRef(null);
  const startRef = useRef(Date.now());

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];

  useEffect(() => {
    if (!story) return;
    api.put(`/stories/${story._id}/view`).catch(() => {});
  }, [story]);

  useEffect(() => {
    if (!story) return;
    setProgress(0);
    startRef.current = Date.now();

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.min(100, (elapsed / STORY_DURATION) * 100);
      setProgress(pct);
      if (pct >= 100) {
        goNext();
      }
    }, 60);

    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex]);

  async function votePoll(stickerId, optionIndex) {
    setMyVotes((prev) => ({ ...prev, [stickerId]: optionIndex }));
    clearInterval(timerRef.current); // pause auto-advance while voting
    try {
      const res = await api.put(`/stories/${story._id}/sticker/${stickerId}/vote`, { optionIndex });
      setStickerTallies((prev) => ({ ...prev, [stickerId]: res.data.tally }));
    } catch (err) {
      // ignore
    }
  }

  function goNext() {
    if (!group) return;
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((i) => i + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  }

  function goPrev() {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1];
      setGroupIndex((g) => g - 1);
      setStoryIndex(prevGroup.stories.length - 1);
    }
  }

  if (!story) return null;

  return (
    <div className="story-viewer-overlay">
      <div className="story-viewer-inner">
        <div className="story-progress-row">
          {group.stories.map((s, i) => (
            <div className="story-progress-track" key={s._id}>
              <div
                className="story-progress-fill"
                style={{
                  width:
                    i < storyIndex ? "100%" : i === storyIndex ? `${progress}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        <div className="story-viewer-header">
          <img
            className="avatar avatar-sm"
            src={
              group.user.avatar
                ? `${mediaUrl(group.user.avatar)}`
                : "https://api.dicebear.com/7.x/initials/svg?seed=" + group.user.username
            }
            alt={group.user.username}
          />
          <span>{group.user.username}</span>
          <div className="spacer" />
          <button className="story-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="story-media-area">
          {story.mediaType === "video" ? (
            <video src={`${mediaUrl(story.media)}`} autoPlay muted playsInline onEnded={goNext} />
          ) : (
            <img src={`${mediaUrl(story.media)}`} alt="story" />
          )}

          {(story.stickers || []).map((s) => (
            <div
              key={s._id}
              className="story-sticker-view"
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
              onClick={(e) => e.stopPropagation()}
            >
              {s.type === "location" && (
                <span className="story-sticker-chip">📍 {s.data?.label}</span>
              )}
              {s.type === "mention" && (
                <span className="story-sticker-chip">@{s.data?.username}</span>
              )}
              {s.type === "poll" && (
                <div className="story-sticker-poll">
                  <div className="story-sticker-poll-q">{s.question}</div>
                  <div className="story-sticker-poll-opts">
                    {s.options.map((opt, i) => {
                      const tally = stickerTallies[s._id];
                      const voted = myVotes[s._id];
                      return (
                        <span
                          key={i}
                          className={voted === i ? "voted" : ""}
                          onClick={() => votePoll(s._id, i)}
                        >
                          {opt}
                          {tally ? ` · ${tally[i]}` : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="story-tap-zone story-tap-left" onClick={goPrev} />
          <div className="story-tap-zone story-tap-right" onClick={goNext} />
        </div>
      </div>
    </div>
  );
}
