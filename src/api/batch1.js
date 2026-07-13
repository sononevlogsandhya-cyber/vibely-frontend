// Batch 1 API helpers — Comments (edit/delete/reply/pin/like), Privacy & Safety, Saved Collections, Hashtags
// Import these into your components: import * as b1 from "../api/batch1";
import api from "./axios";

// ---- Comments ----
export const replyComment = (postId, text, parentId) =>
  api.post(`/posts/${postId}/comment`, { text, parent: parentId });

export const editComment = (postId, commentId, text) =>
  api.put(`/posts/${postId}/comment/${commentId}`, { text });

export const deleteComment = (postId, commentId) =>
  api.delete(`/posts/${postId}/comment/${commentId}`);

export const pinComment = (postId, commentId) =>
  api.put(`/posts/${postId}/comment/${commentId}/pin`);

export const likeComment = (postId, commentId) =>
  api.put(`/posts/${postId}/comment/${commentId}/like`);

export const editPostCaption = (postId, caption) =>
  api.put(`/posts/${postId}`, { caption });

// ---- Hashtags ----
export const getPostsByHashtag = (tag) => api.get(`/posts/hashtag/${tag}`);

// ---- Privacy & Safety ----
export const toggleBlock = (userId) => api.put(`/users/${userId}/block`);
export const getBlockedUsers = () => api.get(`/users/me/blocked`);
export const toggleMute = (userId) => api.put(`/users/${userId}/mute`);
export const toggleMuteStory = (userId) => api.put(`/users/${userId}/mute-story`);
export const toggleRestrict = (userId) => api.put(`/users/${userId}/restrict`);
export const setHiddenWords = (words) => api.put(`/users/me/hidden-words`, { words });

// ---- Saved Collections ----
export const createCollection = (name) => api.post(`/users/me/collections`, { name });
export const getCollections = () => api.get(`/users/me/collections`);
export const getCollection = (collectionId) => api.get(`/users/me/collections/${collectionId}`);
export const togglePostInCollection = (collectionId, postId) =>
  api.put(`/users/me/collections/${collectionId}/toggle/${postId}`);
export const deleteCollection = (collectionId) => api.delete(`/users/me/collections/${collectionId}`);
