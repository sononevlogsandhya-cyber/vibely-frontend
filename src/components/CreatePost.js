import React, { useRef, useState } from "react";
import { X, RotateCw, ChevronLeft, ChevronRight, Crop } from "lucide-react";
import api from "../api/axios";

const MAX_IMAGES = 10;

// Instagram-style filter presets — CSS filter strings, baked into the image via canvas before upload
const FILTERS = [
  { id: "none", label: "Normal", css: "none" },
  { id: "clarendon", label: "Clarendon", css: "contrast(1.2) saturate(1.35) brightness(1.05)" },
  { id: "lux", label: "Lux", css: "contrast(1.1) saturate(1.15) brightness(1.1)" },
  { id: "mono", label: "Mono", css: "grayscale(1) contrast(1.1)" },
  { id: "warm", label: "Warm", css: "sepia(0.25) saturate(1.3) brightness(1.05) hue-rotate(-8deg)" },
  { id: "cool", label: "Cool", css: "saturate(1.1) brightness(1.05) hue-rotate(15deg)" },
  { id: "vintage", label: "Vintage", css: "sepia(0.35) contrast(0.95) brightness(0.95) saturate(0.85)" },
  { id: "fade", label: "Fade", css: "contrast(0.85) brightness(1.1) saturate(0.75)" },
];

export default function CreatePost({ onCreated }) {
  const fileInputRef = useRef(null);
  // each item: { file, url, filterId, rotation, crop: "original" | "square" }
  const [files, setFiles] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (incoming.length === 0) return;
    setFiles((prev) => {
      const combined = [
        ...prev,
        ...incoming.map((file) => ({
          file,
          url: URL.createObjectURL(file),
          filterId: "none",
          rotation: 0,
          crop: "original",
        })),
      ];
      return combined.slice(0, MAX_IMAGES);
    });
    setError("");
  }

  function removeAt(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setActiveIdx((i) => Math.max(0, Math.min(i, files.length - 2)));
  }

  function moveItem(idx, dir) {
    setFiles((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setActiveIdx((i) => (i === idx ? i + dir : i === idx + dir ? i - dir : i));
  }

  function patchActive(patch) {
    setFiles((prev) => prev.map((f, i) => (i === activeIdx ? { ...f, ...patch } : f)));
  }

  function rotateActive() {
    patchActive({ rotation: ((files[activeIdx]?.rotation || 0) + 90) % 360 });
  }

  function toggleCropActive() {
    patchActive({ crop: files[activeIdx]?.crop === "square" ? "original" : "square" });
  }

  // Bakes filter + rotation + crop onto a canvas and returns a Blob
  async function renderEditedImage(item) {
    const img = await loadImage(item.url);
    const rad = (item.rotation * Math.PI) / 180;
    const swapDims = item.rotation === 90 || item.rotation === 270;
    const baseW = swapDims ? img.height : img.width;
    const baseH = swapDims ? img.width : img.height;

    let outW = baseW;
    let outH = baseH;
    if (item.crop === "square") {
      const side = Math.min(baseW, baseH);
      outW = side;
      outH = side;
    }

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    const filter = FILTERS.find((f) => f.id === item.filterId)?.css || "none";
    ctx.filter = filter;

    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (files.length === 0 || busy) return;
    setBusy(true);
    setError("");
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        const needsEdit = item.filterId !== "none" || item.rotation !== 0 || item.crop === "square";
        if (needsEdit) {
          const blob = await renderEditedImage(item);
          formData.append("images", blob, `photo-${i}.jpg`);
        } else {
          formData.append("images", item.file);
        }
      }
      formData.append("caption", caption);
      formData.append("tags", tags);
      const res = await api.post("/posts", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onCreated(res.data);
      setFiles([]);
      setCaption("");
      setTags("");
      setActiveIdx(0);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't share your post. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const active = files[activeIdx];

  return (
    <form className="create-post-card card" onSubmit={handleSubmit}>
      {error && <div className="error-banner">{error}</div>}

      {files.length > 0 ? (
        <>
          {/* Big editor preview for the active photo */}
          <div className="cp-editor-preview">
            <button
              type="button"
              className="cp-editor-nav cp-editor-nav-left"
              onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
              disabled={activeIdx === 0}
            >
              <ChevronLeft size={20} />
            </button>
            <div className={`cp-editor-frame ${active?.crop === "square" ? "square" : ""}`}>
              <img
                src={active?.url}
                alt="editing"
                style={{
                  filter: FILTERS.find((f) => f.id === active?.filterId)?.css,
                  transform: `rotate(${active?.rotation || 0}deg)`,
                }}
              />
            </div>
            <button
              type="button"
              className="cp-editor-nav cp-editor-nav-right"
              onClick={() => setActiveIdx((i) => Math.min(files.length - 1, i + 1))}
              disabled={activeIdx === files.length - 1}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="cp-editor-tools">
            <button type="button" className="cp-tool-btn" onClick={rotateActive}>
              <RotateCw size={15} /> Rotate
            </button>
            <button type="button" className="cp-tool-btn" onClick={toggleCropActive}>
              <Crop size={15} /> {active?.crop === "square" ? "Original" : "Square"}
            </button>
          </div>

          <div className="cp-filter-row">
            {FILTERS.map((f) => (
              <button
                type="button"
                key={f.id}
                className={`cp-filter-swatch ${active?.filterId === f.id ? "active" : ""}`}
                onClick={() => patchActive({ filterId: f.id })}
              >
                <img src={active?.url} alt={f.label} style={{ filter: f.css }} />
                <span>{f.label}</span>
              </button>
            ))}
          </div>

          <div className="create-post-preview-strip">
            {files.map((f, i) => (
              <div
                className={`create-post-preview-item ${i === activeIdx ? "active" : ""}`}
                key={i}
                onClick={() => setActiveIdx(i)}
              >
                <img
                  src={f.url}
                  alt={`preview ${i + 1}`}
                  style={{ filter: FILTERS.find((x) => x.id === f.filterId)?.css, transform: `rotate(${f.rotation}deg)` }}
                />
                <div className="preview-reorder-row">
                  <button type="button" onClick={(e) => { e.stopPropagation(); moveItem(i, -1); }} disabled={i === 0}>
                    ‹
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); moveItem(i, 1); }} disabled={i === files.length - 1}>
                    ›
                  </button>
                </div>
                <button type="button" className="preview-remove-btn" onClick={(e) => { e.stopPropagation(); removeAt(i); }}>
                  <X size={13} />
                </button>
              </div>
            ))}
            {files.length < MAX_IMAGES && (
              <div className="create-post-preview-add" onClick={() => fileInputRef.current.click()}>
                + Add
              </div>
            )}
          </div>
        </>
      ) : (
        <div
          className="dropzone"
          onClick={() => fileInputRef.current.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
        >
          📷 Click or drag photos here to share a new vibe (up to {MAX_IMAGES})
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <>
          <textarea
            className="caption-input"
            placeholder="Write a caption…"
            rows={2}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <input
            className="caption-input"
            placeholder="Tags (comma separated, e.g. travel, food, fitness)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            style={{ marginTop: -4 }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn-secondary" onClick={() => setFiles([])}>
              Cancel
            </button>
            <button className="btn-primary" disabled={busy} style={{ marginTop: 0 }}>
              {busy ? "Sharing…" : files.length > 1 ? `Share ${files.length} photos` : "Share"}
            </button>
          </div>
        </>
      )}
    </form>
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
