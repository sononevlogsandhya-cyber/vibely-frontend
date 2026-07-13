import React from "react";

export default function PostSkeleton() {
  return (
    <div className="post-card card skeleton-card">
      <div className="post-header">
        <div className="skeleton skeleton-circle" />
        <div style={{ flex: 1 }}>
          <div className="skeleton skeleton-line" style={{ width: "40%", marginBottom: 6 }} />
          <div className="skeleton skeleton-line" style={{ width: "25%", height: 10 }} />
        </div>
      </div>
      <div className="skeleton skeleton-image" />
      <div style={{ padding: "12px 14px" }}>
        <div className="skeleton skeleton-line" style={{ width: "60%", marginBottom: 8 }} />
        <div className="skeleton skeleton-line" style={{ width: "40%" }} />
      </div>
    </div>
  );
}
