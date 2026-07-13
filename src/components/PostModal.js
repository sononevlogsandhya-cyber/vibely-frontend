import React from "react";
import { X } from "lucide-react";
import PostCard from "./PostCard";

export default function PostModal({ post, onClose, onDeleted }) {
  if (!post) return null;
  return (
    <div className="post-modal-overlay" onClick={onClose}>
      <div className="post-modal-inner" onClick={(e) => e.stopPropagation()}>
        <button className="post-modal-close" onClick={onClose}>
          <X size={20} />
        </button>
        <PostCard
          post={post}
          autoFocusComments
          onDeleted={(id) => {
            onDeleted?.(id);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
