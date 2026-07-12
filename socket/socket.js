function initSocket(io, onlineUsers) {
  io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.id);

    socket.on("identify", (userId) => {
      if (!userId) return;
      onlineUsers.set(userId, socket.id);
      io.emit("online-users", Array.from(onlineUsers.keys()));
    });

    // Chat typing indicator: { toUserId, conversationId, isTyping }
    socket.on("typing", ({ toUserId, conversationId, isTyping }) => {
      const targetSocket = onlineUsers.get(toUserId);
      if (targetSocket) {
        io.to(targetSocket).emit("typing", { conversationId, isTyping });
      }
    });

    // Join/leave a post or reel "room" so live like/comment updates reach
    // everyone currently viewing that item, not just the author.
    socket.on("join-room", (room) => {
      if (room) socket.join(room);
    });
    socket.on("leave-room", (room) => {
      if (room) socket.leave(room);
    });

    socket.on("disconnect", () => {
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          onlineUsers.delete(userId);
          break;
        }
      }
      io.emit("online-users", Array.from(onlineUsers.keys()));
      console.log("❌ Socket disconnected:", socket.id);
    });
  });
}

module.exports = initSocket;
