import React, { useRef, useState } from "react";
import api from "../api/axios";

export default function CreateReel({ onClose, onCreated }) {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [coverTime, setCoverTime] = useState(0);
  const [coverPreview, setCoverPreview] = useState(null);

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError("");
    setDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
    setCoverTime(0);
    setCoverPreview(null);
  }

  function onVideoLoaded() {
    const d = videoRef.current?.duration || 0;
    setDuration(d);
    setTrimEnd(d);
    setCoverTime(Math.min(0.1, d));
  }

  // Capture the current video frame as a cover thumbnail preview (client-side, for user feedback only —
  // the server re-extracts the actual cover frame at coverTime after any server-side trim)
  function captureCoverPreview() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    setCoverPreview(canvas.toDataURL("image/jpeg", 0.85));
  }

  function seekTo(t) {
    if (videoRef.current) videoRef.current.currentTime = t;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("video", file);
      formData.append("caption", caption);
      // Only send trim range if it's meaningfully narrower than the full clip
      if (duration > 0 && (trimStart > 0.05 || trimEnd < duration - 0.05)) {
        formData.append("trimStart", trimStart.toFixed(2));
        formData.append("trimEnd", trimEnd.toFixed(2));
      }
      formData.append("coverTime", Math.max(0, coverTime - trimStart).toFixed(2));
      const res = await api.post("/reels", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't upload your reel. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="story-creator-overlay">
      <div className="story-creator-inner" style={{ maxWidth: 420 }}>
        <div className="story-creator-header">
          <button className="story-close-btn" onClick={onClose}>
            ✕
          </button>
          <span>New reel</span>
          <button
            className="btn-primary story-share-btn"
            disabled={busy || !file}
            onClick={handleSubmit}
          >
            {busy ? "Uploading…" : "Post"}
          </button>
        </div>

        <div style={{ padding: 16 }}>
          {error && <div className="error-banner">{error}</div>}

          {preview ? (
            <video
              ref={videoRef}
              src={preview}
              className="reel-upload-preview"
              controls
              onLoadedMetadata={onVideoLoaded}
            />
          ) : (
            <div className="dropzone" onClick={() => fileInputRef.current.click()}>
              🎥 Click to choose a short video for your reel
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => handleFile(e.target.files[0])}
          />

          {preview && duration > 0 && (
            <>
              <div className="reel-trim-block">
                <div className="reel-trim-label">
                  Trim clip &nbsp;
                  <span className="reel-trim-range">
                    {formatTime(trimStart)} – {formatTime(trimEnd)} ({formatTime(Math.max(0, trimEnd - trimStart))})
                  </span>
                </div>
                <div className="reel-trim-row">
                  <span className="reel-trim-tag">Start</span>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.1}
                    value={trimStart}
                    onChange={(e) => {
                      const v = Math.min(parseFloat(e.target.value), trimEnd - 0.2);
                      setTrimStart(Math.max(0, v));
                      seekTo(Math.max(0, v));
                    }}
                  />
                </div>
                <div className="reel-trim-row">
                  <span className="reel-trim-tag">End</span>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.1}
                    value={trimEnd}
                    onChange={(e) => {
                      const v = Math.max(parseFloat(e.target.value), trimStart + 0.2);
                      setTrimEnd(Math.min(duration, v));
                      seekTo(Math.min(duration, v));
                    }}
                  />
                </div>
              </div>

              <div className="reel-cover-block">
                <div className="reel-trim-label">Choose cover frame</div>
                <div className="reel-trim-row">
                  <input
                    type="range"
                    min={trimStart}
                    max={trimEnd}
                    step={0.1}
                    value={coverTime}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setCoverTime(v);
                      seekTo(v);
                    }}
                    onMouseUp={captureCoverPreview}
                    onTouchEnd={captureCoverPreview}
                  />
                  {coverPreview && <img src={coverPreview} alt="cover" className="reel-cover-thumb" />}
                </div>
              </div>
            </>
          )}

          {preview && (
            <textarea
              className="caption-input"
              placeholder="Write a caption…"
              rows={2}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              style={{ marginTop: 12 }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(s) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
