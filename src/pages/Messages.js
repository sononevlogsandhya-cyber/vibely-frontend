import React, { useEffect, useRef, useState } from "react";
import api, { mediaUrl } from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

export default function Messages() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  async function loadConversations() {
    try {
      const res = await api.get("/messages/conversations");
      setConversations(res.data);
    } catch (err) {
      // ignore
    }
  }

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!activeId) return;
    api
      .get(`/messages/${activeId}`)
      .then((res) => setMessages(res.data))
      .catch(() => {});
  }, [activeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!socket) return;
    function onNewMessage({ conversationId, message }) {
      if (conversationId === activeId) {
        setMessages((prev) => [...prev, message]);
      }
      loadConversations();
    }
    function onTyping({ conversationId, isTyping }) {
      if (conversationId === activeId) setOtherTyping(isTyping);
    }
    socket.on("new-message", onNewMessage);
    socket.on("typing", onTyping);
    return () => {
      socket.off("new-message", onNewMessage);
      socket.off("typing", onTyping);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, activeId]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
        setSearchResults(res.data.filter((u) => u._id !== user._id));
      } catch (err) {
        // ignore
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, user._id]);

  async function startConversation(otherUserId) {
    try {
      const res = await api.post("/messages/conversations", { userId: otherUserId });
      setActiveId(res.data._id);
      setQuery("");
      setSearchResults([]);
      loadConversations();
    } catch (err) {
      // ignore
    }
  }

  function otherParticipant(conv) {
    return conv.participants.find((p) => p._id !== user._id) || conv.participants[0];
  }

  function notifyTyping(isTyping) {
    if (!socket || !activeId) return;
    const conv = conversations.find((c) => c._id === activeId);
    if (!conv) return;
    const other = otherParticipant(conv);
    socket.emit("typing", { toUserId: other._id, conversationId: activeId, isTyping });
  }

  function handleTextChange(v) {
    setText(v);
    notifyTyping(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => notifyTyping(false), 1500);
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!text.trim() || !activeId) return;
    const messageText = text.trim();
    setText("");
    notifyTyping(false);
    try {
      const res = await api.post(`/messages/${activeId}`, { text: messageText });
      setMessages((prev) => [...prev, res.data]);
      loadConversations();
    } catch (err) {
      // ignore
    }
  }

  const activeConv = conversations.find((c) => c._id === activeId);

  return (
    <div className="messages-layout">
      <div className="messages-sidebar card">
        <div className="messages-search-wrap">
          <input
            className="messages-search-input"
            placeholder="Search people to message…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div className="search-results" style={{ position: "static", marginTop: 6 }}>
              {searchResults.map((u) => (
                <div
                  key={u._id}
                  className="search-result-row"
                  onClick={() => startConversation(u._id)}
                >
                  <img
                    className="avatar avatar-sm"
                    src={
                      u.avatar
                        ? `${mediaUrl(u.avatar)}`
                        : "https://api.dicebear.com/7.x/initials/svg?seed=" + u.username
                    }
                    alt=""
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>@{u.username}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {conversations.length === 0 ? (
          <div className="notif-empty">Search someone above to start chatting.</div>
        ) : (
          conversations.map((conv) => {
            const other = otherParticipant(conv);
            return (
              <div
                key={conv._id}
                className={`conversation-row ${activeId === conv._id ? "active" : ""}`}
                onClick={() => setActiveId(conv._id)}
              >
                <img
                  className="avatar avatar-md"
                  src={
                    other.avatar
                      ? `${mediaUrl(other.avatar)}`
                      : "https://api.dicebear.com/7.x/initials/svg?seed=" + other.username
                  }
                  alt={other.username}
                />
                <div style={{ overflow: "hidden" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{other.username}</div>
                  <div className="conversation-preview">{conv.lastMessage || "Say hi 👋"}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="messages-chat card">
        {!activeConv ? (
          <div className="empty-state" style={{ margin: "auto" }}>
            <div className="icon">💬</div>
            <p>Select a conversation or search for someone to start chatting.</p>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <img
                className="avatar avatar-sm"
                src={
                  otherParticipant(activeConv).avatar
                    ? `${mediaUrl(otherParticipant(activeConv).avatar)}`
                    : "https://api.dicebear.com/7.x/initials/svg?seed=" +
                      otherParticipant(activeConv).username
                }
                alt=""
              />
              <span style={{ fontWeight: 600 }}>{otherParticipant(activeConv).username}</span>
            </div>

            <div className="chat-messages">
              {messages.map((m) => (
                <div
                  key={m._id}
                  className={`chat-bubble-row ${
                    m.sender._id === user._id ? "mine" : "theirs"
                  }`}
                >
                  <div className="chat-bubble">{m.text}</div>
                </div>
              ))}
              {otherTyping && (
                <div className="chat-bubble-row theirs">
                  <div className="chat-bubble typing-bubble">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-row" onSubmit={sendMessage}>
              <input
                placeholder="Message…"
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
              />
              <button type="submit" disabled={!text.trim()}>
                Send
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
