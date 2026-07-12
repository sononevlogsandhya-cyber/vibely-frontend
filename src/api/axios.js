import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("vibely_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const ASSET_URL = API_URL;

// Cloudinary URLs (posts, reels, stories, avatars) are already absolute
// (https://res.cloudinary.com/...), so they must be used as-is. Older/local
// paths (e.g. "/uploads/xyz.jpg") still need the backend URL prefixed.
export function mediaUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path}`;
}

export default api;
