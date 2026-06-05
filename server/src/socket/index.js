import jwt from "jsonwebtoken";
import User from "../models/User.js";

const onlineUsers = new Map();

export function configureSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));
      const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
      const user = await User.findById(payload.id).select("name email avatar");
      if (!user) return next(new Error("Unauthorized"));
      socket.user = user;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    onlineUsers.set(socket.user._id.toString(), { user: socket.user, socketId: socket.id });
    socket.join(`user:${socket.user._id}`);
    socket.emit("presence:online", Array.from(onlineUsers.values()).map((entry) => entry.user));

    socket.on("workspace:join", (workspaceId) => {
      socket.join(`workspace:${workspaceId}`);
      socket.to(`workspace:${workspaceId}`).emit("presence:joined", socket.user);
    });

    socket.on("task:typing", ({ workspaceId, taskId }) => {
      socket.to(`workspace:${workspaceId}`).emit("task:typing", { taskId, user: socket.user });
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(socket.user._id.toString());
      io.emit("presence:offline", { userId: socket.user._id });
    });
  });
}

export function emitWorkspace(io, workspaceId, event, payload) {
  io.to(`workspace:${workspaceId}`).emit(event, payload);
}
