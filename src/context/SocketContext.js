import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [socketReady, setSocketReady] = useState(null);
  const [liveNotifications, setLiveNotifications] = useState([]);

  useEffect(() => {
    if (!user) return;

    const socket = io(API_URL);
    socketRef.current = socket;

    socket.emit("identify", user._id);

    socket.on("notification", (payload) => {
      setLiveNotifications((prev) => [payload, ...prev]);
    });

    socket.on("connect", () => setSocketReady(socket));
    setSocketReady(socket);

    return () => {
      socket.disconnect();
    };
  }, [user]);

  function clearLiveNotifications() {
    setLiveNotifications([]);
  }

  return (
    <SocketContext.Provider
      value={{ socket: socketReady, liveNotifications, clearLiveNotifications }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
