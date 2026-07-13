import React, { useRef, useState } from "react";
import api from "../api/axios";

const COLOR_BACKGROUNDS = [
  ["#FF5C77", "#FFB347"],
  ["#2B1B3D", "#1B4B43"],
  ["#4361EE", "#7209B7"],
  ["#F72585", "#4CC9F0"],
  ["#06D6A0", "#118AB2"],
  ["#FFB703", "#FB8500"],
];

const EMOJIS = ["😂", "❤️", "🔥", "✨", "🎉", "😍", "👏", "🙌", "💯", "😎"];
const TEXT_COLORS = ["#FFFFFF", "#241F26", "#FF5C77", "#FFB347", "#1B4B43", "#4361EE"];

const CANVAS_W = 720;
const CANVAS_H = 1280;

export default function StoryCreator({ onClose, onCreated }) {
  const fileInputRef = useRef(null);
  const previewRef = useRef(null);

  const [bgImage, setBgImage] = useState(null); // data URL for preview + Image element for canvas
  const [, setBgImageFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [bgGradient, setBgGradient] = useState(COLOR_BACKGROUNDS[0]);
  const [mode, setMode] = useState("color"); // color | photo | video
  // overlays: kind "text" | "emoji" get baked into the final image at share-time.
  // kind "location" | "mention" | "poll" are interactive stickers sent to the server as metadata.
  const [overlays, setOverlays] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [showMentionInput, setShowMentionInput] = useState(false);
  const [showPollInput, setShowPollInput] = useState(false);
  const [locationText, setLocationText] = useState("");
  const [mentionText, setMentionText] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptA, setPollOptA] = useState("Yes");
  const [pollOptB, setPollOptB] = useState("No");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dragState = useRef(null);

  function handlePhotoSelect(file) {
    if (!file) return;
    setMode("photo");
    setBgImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setBgImage(e.target.result);
    reader.readAsDataURL(file);
  }

  function handleVideoSelect(file) {
    if (!file) return;
    setMode("video");
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  }

  function addTextBox() {
    const id = Date.now().toString();
    setOverlays((prev) => [
      ...prev,
      { id, kind: "text", text: "Type here", color: "#FFFFFF", x: 50, y: 50, size: 32 },
    ]);
  }

  function addEmoji(emoji) {
    const id = Date.now().toString();
    setOverlays((prev) => [
      ...prev,
      { id, kind: "emoji", text: emoji, color: "#FFFFFF", x: 50, y: 30, size: 60 },
    ]);
    setShowEmojiPicker(false);
  }

  function addLocationSticker() {
    if (!locationText.trim()) return;
    const id = Date.now().toString();
    setOverlays((prev) => [...prev, { id, kind: "location", label: locationText.trim(), x: 50, y: 20 }]);
    setLocationText("");
    setShowLocationInput(false);
  }

  function addMentionSticker() {
    const uname = mentionText.trim().replace(/^@/, "");
    if (!uname) return;
    const id = Date.now().toString();
    setOverlays((prev) => [...prev, { id, kind: "mention", username: uname, x: 50, y: 35 }]);
    setMentionText("");
    setShowMentionInput(false);
  }

  function addPollSticker() {
    if (!pollQuestion.trim()) return;
    const id = Date.now().toString();
    setOverlays((prev) => [
      ...prev,
      {
        id,
        kind: "poll",
        question: pollQuestion.trim(),
        options: [pollOptA.trim() || "Yes", pollOptB.trim() || "No"],
        x: 50,
        y: 55,
      },
    ]);
    setPollQuestion("");
    setPollOptA("Yes");
    setPollOptB("No");
    setShowPollInput(false);
  }

  function updateOverlay(id, patch) {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  function removeOverlay(id) {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
  }

  function onDragStart(e, id) {
    const rect = previewRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragState.current = { id, rect, clientX, clientY };
  }

  function onDragMove(e) {
    if (!dragState.current) return;
    const { id, rect } = dragState.current;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const xPct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    updateOverlay(id, { x: xPct, y: yPct });
  }

  function onDragEnd() {
    dragState.current = null;
  }

  async function handleShare() {
    setBusy(true);
    setError("");
    try {
      const textOverlays = overlays.filter((o) => o.kind === "text" || o.kind === "emoji");
      const interactiveStickers = overlays
        .filter((o) => o.kind === "location" || o.kind === "mention" || o.kind === "poll")
        .map((o) => ({
          type: o.kind,
          x: o.x,
          y: o.y,
          data: o.kind === "location" ? { label: o.label } : o.kind === "mention" ? { username: o.username } : {},
          question: o.kind === "poll" ? o.question : undefined,
          options: o.kind === "poll" ? o.options : undefined,
        }));

      if (mode === "video") {
        if (!videoFile) {
          setError("Please choose a video first.");
          setBusy(false);
          return;
        }
        const formData = new FormData();
        formData.append("media", videoFile);
        formData.append("stickers", JSON.stringify(interactiveStickers));
        const res = await api.post("/stories", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        onCreated(res.data);
        return;
      }

      // Composite background + text/emoji overlays onto a canvas, then upload the flattened image.
      // Interactive stickers (location/mention/poll) travel as metadata, not baked pixels.
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext("2d");

      if (mode === "photo" && bgImage) {
        const img = await loadImage(bgImage);
        drawImageCover(ctx, img, CANVAS_W, CANVAS_H);
      } else {
        const gradient = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
        gradient.addColorStop(0, bgGradient[0]);
        gradient.addColorStop(1, bgGradient[1]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }

      textOverlays.forEach((o) => {
        const px = (o.x / 100) * CANVAS_W;
        const py = (o.y / 100) * CANVAS_H;
        const fontSize = (o.size / 380) * CANVAS_W; // scale relative to preview width
        ctx.font = `700 ${fontSize}px 'Inter', sans-serif`;
        ctx.fillStyle = o.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(o.text, px, py);
      });

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
      const formData = new FormData();
      formData.append("media", blob, "story.png");
      formData.append("stickers", JSON.stringify(interactiveStickers));

      const res = await api.post("/stories", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't share your story. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="story-creator-overlay">
      <div className="story-creator-inner">
        <div className="story-creator-header">
          <button className="story-close-btn" onClick={onClose}>
            ✕
          </button>
          <span>Create story</span>
          <button className="btn-primary story-share-btn" disabled={busy} onClick={handleShare}>
            {busy ? "Sharing…" : "Share"}
          </button>
        </div>

        {error && <div className="error-banner" style={{ margin: "8px 16px" }}>{error}</div>}

        <div
          className="story-preview"
          ref={previewRef}
          style={
            mode === "photo" && bgImage
              ? {
                  backgroundImage: `url(${bgImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : mode === "video"
              ? {}
              : { background: `linear-gradient(135deg, ${bgGradient[0]}, ${bgGradient[1]})` }
          }
          onMouseMove={onDragMove}
          onMouseUp={onDragEnd}
          onMouseLeave={onDragEnd}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
        >
          {mode === "video" && videoPreview && (
            <video src={videoPreview} className="story-preview-video" muted autoPlay loop playsInline />
          )}

          {overlays.map((o) => (
            <div
              key={o.id}
              className={`story-overlay-text story-sticker-${o.kind}`}
              style={{
                left: `${o.x}%`,
                top: `${o.y}%`,
                color: o.color,
                fontSize: o.size,
              }}
              onMouseDown={(e) => onDragStart(e, o.id)}
              onTouchStart={(e) => onDragStart(e, o.id)}
            >
              {o.kind === "text" && (
                <input
                  value={o.text}
                  onChange={(e) => updateOverlay(o.id, { text: e.target.value })}
                  style={{ color: o.color, fontSize: o.size }}
                  className="story-overlay-input"
                />
              )}
              {o.kind === "emoji" && <span>{o.text}</span>}
              {o.kind === "location" && <span className="story-sticker-chip">📍 {o.label}</span>}
              {o.kind === "mention" && <span className="story-sticker-chip">@{o.username}</span>}
              {o.kind === "poll" && (
                <div className="story-sticker-poll">
                  <div className="story-sticker-poll-q">{o.question}</div>
                  <div className="story-sticker-poll-opts">
                    <span>{o.options[0]}</span>
                    <span>{o.options[1]}</span>
                  </div>
                </div>
              )}
              <button
                className="story-overlay-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeOverlay(o.id);
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {mode !== "video" && (
          <div className="story-color-row">
            {COLOR_BACKGROUNDS.map((grad, i) => (
              <button
                key={i}
                className={`story-color-swatch ${
                  mode === "color" && bgGradient === grad ? "active" : ""
                }`}
                style={{ background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` }}
                onClick={() => {
                  setMode("color");
                  setBgGradient(grad);
                }}
              />
            ))}
          </div>
        )}

        <div className="story-toolbar">
          <button className="story-tool-btn" onClick={() => fileInputRef.current.click()}>
            🖼️ Photo
          </button>
          <button
            className="story-tool-btn"
            onClick={() => document.getElementById("story-video-input").click()}
          >
            🎥 Video
          </button>
          <button className="story-tool-btn" onClick={addTextBox}>
            🔤 Text
          </button>
          <button className="story-tool-btn" onClick={() => setShowEmojiPicker((p) => !p)}>
            😊 Sticker
          </button>
          <button className="story-tool-btn" onClick={() => setShowLocationInput((p) => !p)}>
            📍 Location
          </button>
          <button className="story-tool-btn" onClick={() => setShowMentionInput((p) => !p)}>
            @ Mention
          </button>
          <button className="story-tool-btn" onClick={() => setShowPollInput((p) => !p)}>
            📊 Poll
          </button>
        </div>

        {showEmojiPicker && (
          <div className="story-emoji-picker">
            {EMOJIS.map((e) => (
              <button key={e} className="story-emoji-btn" onClick={() => addEmoji(e)}>
                {e}
              </button>
            ))}
          </div>
        )}

        {showLocationInput && (
          <div className="story-sticker-form">
            <input
              className="caption-input"
              placeholder="Add a location…"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addLocationSticker()}
            />
            <button className="btn-primary" style={{ marginTop: 0 }} onClick={addLocationSticker}>
              Add
            </button>
          </div>
        )}

        {showMentionInput && (
          <div className="story-sticker-form">
            <input
              className="caption-input"
              placeholder="username"
              value={mentionText}
              onChange={(e) => setMentionText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMentionSticker()}
            />
            <button className="btn-primary" style={{ marginTop: 0 }} onClick={addMentionSticker}>
              Add
            </button>
          </div>
        )}

        {showPollInput && (
          <div className="story-sticker-form story-sticker-form-poll">
            <input
              className="caption-input"
              placeholder="Ask a question…"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="caption-input"
                placeholder="Option A"
                value={pollOptA}
                onChange={(e) => setPollOptA(e.target.value)}
              />
              <input
                className="caption-input"
                placeholder="Option B"
                value={pollOptB}
                onChange={(e) => setPollOptB(e.target.value)}
              />
            </div>
            <button className="btn-primary" style={{ marginTop: 0 }} onClick={addPollSticker}>
              Add poll
            </button>
          </div>
        )}

        {overlays.some((o) => o.kind === "text") && (
          <div className="story-textcolor-row">
            <span style={{ fontSize: 12, color: "var(--muted)", marginRight: 6 }}>
              Text color:
            </span>
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                className="story-textcolor-swatch"
                style={{ background: c }}
                onClick={() => {
                  const last = overlays.filter((o) => o.kind === "text").slice(-1)[0];
                  if (last) updateOverlay(last.id, { color: c });
                }}
              />
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handlePhotoSelect(e.target.files[0])}
        />
        <input
          id="story-video-input"
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => handleVideoSelect(e.target.files[0])}
        />
      </div>
    </div>
  );
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawImageCover(ctx, img, w, h) {
  const imgRatio = img.width / img.height;
  const canvasRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > canvasRatio) {
    sh = img.height;
    sw = sh * canvasRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / canvasRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}
