import Activity from "../models/Activity.js";
import Notification from "../models/Notification.js";
import { emitWorkspace } from "../socket/index.js";

export async function recordActivity({ io, workspace, actor, type, targetType, targetId, message, metadata = {} }) {
  const activity = await Activity.create({ workspace, actor, type, targetType, targetId, message, metadata });
  const populated = await activity.populate("actor", "name email avatar");
  if (io) emitWorkspace(io, workspace, "activity:new", populated);
  return populated;
}

export async function notifyUsers({ io, workspace, users, type, title, body, link }) {
  const uniqueUsers = [...new Set(users.map((u) => u && u._id ? u._id.toString() : String(u)))];
  const notifications = await Notification.insertMany(
    uniqueUsers.map((user) => ({ workspace, user, type, title, body, link }))
  );
  if (io) {
    notifications.forEach((notification) => io.to(`user:${notification.user}`).emit("notification:new", notification));
    emitWorkspace(io, workspace, "notification:new", notifications);
  }
  return notifications;
}
