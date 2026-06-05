import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";

export function signToken(user) {
  return jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "7d" });
}

export function randomPassword() {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}A1!`;
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Authentication required" });
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    const user = await User.findById(payload.id).select("-password");
    if (!user) return res.status(401).json({ message: "Invalid token" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export async function requireWorkspaceRole(req, res, next) {
  const workspaceId = req.params.workspaceId || req.body.workspaceId || req.query.workspaceId;
  if (!workspaceId) return res.status(400).json({ message: "workspaceId is required" });
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return res.status(404).json({ message: "Workspace not found" });
  let membership = workspace.members.find((member) => member.user.toString() === req.user._id.toString());
  const isOwner = workspace.owner?.toString() === req.user._id.toString();

  if (!membership && isOwner) {
    workspace.members.push({ user: req.user._id, role: "Owner" });
    await workspace.save();
    membership = { user: req.user._id, role: "Owner" };
  }

  if (membership && isOwner && membership.role !== "Owner") {
    membership.role = "Owner";
    await Workspace.updateOne(
      { _id: workspace._id, "members.user": req.user._id },
      { $set: { "members.$.role": "Owner" } }
    );
    membership = { user: req.user._id, role: "Owner" };
  }

  if (!membership) return res.status(403).json({ message: "Workspace access denied" });
  req.workspace = workspace;
  req.role = membership.role;
  next();
}
