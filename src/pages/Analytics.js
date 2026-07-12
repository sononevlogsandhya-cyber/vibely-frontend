import React, { useEffect, useState } from "react";
import { Heart, MessageSquare, Image as ImageIcon, Users } from "lucide-react";
import api from "../api/axios";

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/users/me/analytics")
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-state">Loading analytics…</div>;
  if (!data) return <div className="empty-state">Couldn't load analytics.</div>;

  const maxCount = Math.max(1, ...data.last7Days.map((d) => d.count));

  return (
    <div className="main-container">
      <h2 className="page-title">Your Analytics</h2>

      <div className="stats-grid">
        <div className="stat-card card">
          <ImageIcon size={20} className="stat-icon" />
          <div className="stat-value">{data.postCount}</div>
          <div className="stat-label">Posts</div>
        </div>
        <div className="stat-card card">
          <Heart size={20} className="stat-icon" />
          <div className="stat-value">{data.totalLikes}</div>
          <div className="stat-label">Total Likes</div>
        </div>
        <div className="stat-card card">
          <MessageSquare size={20} className="stat-icon" />
          <div className="stat-value">{data.totalComments}</div>
          <div className="stat-label">Total Comments</div>
        </div>
        <div className="stat-card card">
          <Users size={20} className="stat-icon" />
          <div className="stat-value">{data.followerCount}</div>
          <div className="stat-label">Followers</div>
        </div>
      </div>

      <div className="card chart-card">
        <div className="chart-title">Posts in the last 7 days</div>
        <div className="bar-chart">
          {data.last7Days.map((d) => (
            <div className="bar-col" key={d.date}>
              <div
                className="bar-fill"
                style={{ height: `${(d.count / maxCount) * 100}%` }}
                title={`${d.count} post${d.count === 1 ? "" : "s"}`}
              />
              <span className="bar-label">
                {new Date(d.date).toLocaleDateString(undefined, { weekday: "short" })}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card badges-card">
        <div className="chart-title">Achievement badges</div>
        {data.badges.length === 0 ? (
          <div className="notif-empty">
            Keep posting and growing your account to unlock badges!
          </div>
        ) : (
          <div className="badges-grid">
            {data.badges.map((b) => (
              <div className="badge-tile" key={b.id}>
                <div className="badge-tile-icon">{b.icon}</div>
                <div className="badge-tile-label">{b.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
