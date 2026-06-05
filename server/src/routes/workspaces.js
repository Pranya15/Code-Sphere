import crypto from "crypto";
import express from "express";
import Invite from "../models/Invite.js";
import Activity from "../models/Activity.js";
import DocPage from "../models/DocPage.js";
import Snippet from "../models/Snippet.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import { requireAuth, requireWorkspaceRole } from "../middleware/auth.js";
import { recordActivity, notifyUsers } from "../services/activity.js";
import { sendWorkspaceInviteEmail } from "../services/mailer.js";
import { emitWorkspace } from "../socket/index.js";

const router = express.Router();

async function findInviteByToken(token) {
  return Invite.findOne({ token }).populate("workspace", "name slug").populate("invitedBy", "name email");
}

function absoluteInviteUrl(req, token) {
  const origin = process.env.CLIENT_ORIGIN || `${req.protocol}://${req.get("host")}`;
  return `${origin.replace(/\/$/, "")}/accept-invite/${token}`;
}

function normalizeInviteTarget(value) {
  const raw = String(value || "").trim();
  const lower = raw.toLowerCase();
  if (!raw) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) return { targetType: "email", target: lower, email: lower, channel: "email" };
  return null;
}

function userMatchesInvite(user, invite) {
  if (invite.targetType === "link") return true;
  if (!invite.targetType && invite.email) return user.email?.toLowerCase() === invite.email?.toLowerCase();
  if (invite.targetType === "email") return user.email?.toLowerCase() === invite.email?.toLowerCase();
  return false;
}

function getInviteState(invite) {
  if (!invite) return { status: 404, code: "INVALID_INVITE", message: "Invite token is invalid" };
  if (invite.targetType !== "link" && invite.acceptedAt) return { status: 409, code: "INVITE_ALREADY_ACCEPTED", message: "This invitation has already been accepted" };
  if (invite.expiresAt <= new Date()) return { status: 410, code: "INVITE_EXPIRED", message: "This invitation has expired" };
  return null;
}

router.get("/invites/:token", async (req, res) => {
  const invite = await findInviteByToken(req.params.token);
  const error = getInviteState(invite);
  if (error) return res.status(error.status).json(error);

  res.json({
    targetType: invite.targetType,
    target: invite.target,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
    workspace: invite.workspace,
    invitedBy: invite.invitedBy
  });
});

router.use(requireAuth);

router.post("/accept/:token", async (req, res) => {
  const invite = await findInviteByToken(req.params.token);
  const error = getInviteState(invite);
  if (error) return res.status(error.status).json(error);
  if (!userMatchesInvite(req.user, invite)) {
    const target = invite.email || invite.target;
    return res.status(403).json({ code: "INVITE_TARGET_MISMATCH", message: `This invitation was sent to ${target}. Sign in or link that account to accept it.` });
  }

  const workspaceId = invite.workspace._id;
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return res.status(404).json({ code: "WORKSPACE_NOT_FOUND", message: "Workspace not found" });

  const alreadyMember = workspace.members.some((member) => member.user.toString() === req.user._id.toString());
  if (!alreadyMember) workspace.members.push({ user: req.user._id, role: invite.role });
  if (invite.targetType !== "link") {
    invite.acceptedAt = new Date();
  }
  await Promise.all([workspace.save(), invite.save()]);
  await recordActivity({ io: req.app.get("io"), workspace: workspaceId, actor: req.user._id, type: "member.joined", targetType: "User", targetId: req.user._id, message: `joined ${workspace.name}` });
  await notifyUsers({ io: req.app.get("io"), workspace: workspaceId, users: [workspace.owner], type: "workspace.member_joined", title: `${req.user.name} joined ${workspace.name}`, body: `${req.user.name} accepted an invitation as ${invite.role}.`, link: "/team" });
  emitWorkspace(req.app.get("io"), workspaceId, "member:joined", { user: req.user, role: invite.role });

  res.json({
    message: alreadyMember ? "Invite accepted; user was already a workspace member" : "Invite accepted",
    workspace: { _id: workspace._id, name: workspace.name, slug: workspace.slug }
  });
});

router.get("/", async (req, res) => {
  const workspaces = await Workspace.find({ $or: [{ "members.user": req.user._id }, { owner: req.user._id }] }).populate("members.user", "name email avatar plan bio skills github linkedin lastSeenAt");
  res.json(workspaces);
});

router.post("/", async (req, res) => {
  if (!req.body.name?.trim()) return res.status(400).json({ message: "Workspace name is required" });
  const count = await Workspace.countDocuments({ owner: req.user._id });
  if (req.user.plan === "free" && count >= 2) return res.status(402).json({ message: "Free plan allows two workspaces" });
  const slug = `${req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
  const workspace = await Workspace.create({
    name: req.body.name,
    slug,
    description: req.body.description,
    owner: req.user._id,
    members: [{ user: req.user._id, role: "Owner" }]
  });
  await recordActivity({ io: req.app.get("io"), workspace: workspace._id, actor: req.user._id, type: "workspace.created", targetType: "Workspace", targetId: workspace._id, message: `created workspace ${workspace.name}` });
  res.status(201).json(workspace);
});

router.patch("/:workspaceId", requireWorkspaceRole, async (req, res) => {
  if (!["Owner", "Admin"].includes(req.role)) return res.status(403).json({ message: "Only owners and admins can edit workspaces" });
  if (req.body.name !== undefined && !req.body.name?.trim()) return res.status(400).json({ message: "Workspace name is required" });
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => ["name", "description", "logo", "settings"].includes(key)));
  const workspace = await Workspace.findByIdAndUpdate(req.workspace._id, updates, { new: true }).populate("members.user", "name email avatar plan");
  await recordActivity({ io: req.app.get("io"), workspace: req.workspace._id, actor: req.user._id, type: "workspace.updated", targetType: "Workspace", targetId: workspace._id, message: `updated workspace ${workspace.name}` });
  res.json(workspace);
});

router.delete("/:workspaceId", requireWorkspaceRole, async (req, res) => {
  if (req.role !== "Owner") return res.status(403).json({ message: "Only owners can delete workspaces" });
  if (req.workspace.owner.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Only the workspace owner can delete this workspace" });
  await Promise.all([
    Project.deleteMany({ workspace: req.workspace._id }),
    Task.deleteMany({ workspace: req.workspace._id }),
    DocPage.deleteMany({ workspace: req.workspace._id }),
    Snippet.deleteMany({ workspace: req.workspace._id }),
    Activity.deleteMany({ workspace: req.workspace._id }),
    Invite.deleteMany({ workspace: req.workspace._id })
  ]);
  await Workspace.deleteOne({ _id: req.workspace._id });
  res.json({ ok: true });
});

router.get("/:workspaceId/dashboard", requireWorkspaceRole, async (req, res) => {
  const now = new Date();
  const [projects, tasks, upcoming, overdue, members, activities, totalWorkspaces] = await Promise.all([
    Project.find({ workspace: req.workspace._id }).lean(),
    Task.find({ workspace: req.workspace._id }).populate("assignees", "name avatar").lean(),
    Task.find({ workspace: req.workspace._id, dueDate: { $gte: now } }).populate("project", "name key color").populate("assignees", "name avatar").sort("dueDate").limit(8).lean(),
    Task.find({ workspace: req.workspace._id, dueDate: { $ne: null, $lt: now }, status: { $ne: "Done" } }).populate("project", "name key color").populate("assignees", "name avatar").sort("dueDate").limit(8).lean(),
    User.find({ _id: { $in: req.workspace.members.map((member) => member.user) } }).select("name email avatar skills github linkedin plan").lean(),
    Activity.find({ workspace: req.workspace._id }).populate("actor", "name email avatar").sort("-createdAt").limit(12).lean(),
    Workspace.countDocuments({ $or: [{ "members.user": req.user._id }, { owner: req.user._id }] })
  ]);
  const byStatus = tasks.reduce((acc, task) => ({ ...acc, [task.status]: (acc[task.status] || 0) + 1 }), {});
  const byPriority = tasks.reduce((acc, task) => ({ ...acc, [task.priority]: (acc[task.priority] || 0) + 1 }), {});
  const completion = tasks.length ? Math.round((byStatus.Done || 0) / tasks.length * 100) : 0;
  const projectProgress = projects.map((project) => {
    const projectTasks = tasks.filter((task) => task.project?.toString() === project._id.toString());
    const completed = projectTasks.filter((task) => task.status === "Done").length;
    return {
      ...project,
      totalTasks: projectTasks.length,
      completedTasks: completed,
      progress: projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : 0
    };
  });
  res.json({
    projects,
    projectProgress,
    stats: {
      totalWorkspaces,
      projects: projects.length,
      tasks: tasks.length,
      completed: byStatus.Done || 0,
      inProgress: byStatus["In Progress"] || 0,
      teamMembers: members.length,
      byStatus,
      byPriority,
      completion
    },
    upcoming,
    overdue,
    members,
    activities,
    productivity: statusesToProductivity(tasks)
  });
});

function statusesToProductivity(tasks) {
  const buckets = new Map();
  tasks.forEach((task) => {
    const day = new Date(task.updatedAt || task.createdAt).toISOString().slice(0, 10);
    const current = buckets.get(day) || { date: day, completed: 0, active: 0 };
    if (task.status === "Done") current.completed += 1;
    else current.active += 1;
    buckets.set(day, current);
  });
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
}

router.post("/:workspaceId/invites", requireWorkspaceRole, async (req, res) => {
  if (!["Owner", "Admin"].includes(req.role)) return res.status(403).json({ message: "Only owners and admins can invite members" });
  const parsed = normalizeInviteTarget(req.body.email || req.body.target);
  if (!parsed) return res.status(400).json({ message: "Enter a valid email address" });
  const existingUser = await User.findOne({ email: parsed.email });
  if (existingUser && req.workspace.members.some((member) => member.user.toString() === existingUser._id.toString())) {
    return res.status(409).json({ message: "This user is already a workspace member" });
  }
  const token = crypto.randomBytes(32).toString("base64url");
  const invite = await Invite.create({
    workspace: req.workspace._id,
    ...parsed,
    role: req.body.role || "Member",
    token,
    invitedBy: req.user._id,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    delivery: { channel: "email", status: "queued" }
  });
  const inviteUrl = absoluteInviteUrl(req, token);
  const delivery = await sendWorkspaceInviteEmail({
    to: parsed.email,
    workspaceName: req.workspace.name,
    inviterName: req.user.name,
    inviteUrl,
    role: invite.role
  });
  invite.delivery = { channel: "email", status: delivery.status, sentAt: new Date(), message: delivery.message };
  await invite.save();
  if (existingUser) {
    await notifyUsers({ io: req.app.get("io"), workspace: req.workspace._id, users: [existingUser._id], type: "invitation", title: `${req.user.name} invited you to ${req.workspace.name}`, body: `Role: ${invite.role}`, link: `/accept-invite/${token}` });
  }
  await recordActivity({ io: req.app.get("io"), workspace: req.workspace._id, actor: req.user._id, type: "member.invited", targetType: "Invite", targetId: invite._id, message: `invited ${invite.target}` });
  emitWorkspace(req.app.get("io"), req.workspace._id, "invite:created", { ...invite.toObject(), inviteUrl });
  res.status(201).json({ ...invite.toObject(), inviteUrl });
});

router.post("/:workspaceId/invites/link", requireWorkspaceRole, async (req, res) => {
  if (!["Owner", "Admin"].includes(req.role)) return res.status(403).json({ message: "Only owners and admins can invite members" });
  const token = crypto.randomBytes(32).toString("base64url");
  const invite = await Invite.create({
    workspace: req.workspace._id,
    targetType: "link",
    target: `workspace:${req.workspace._id}`,
    role: req.body.role || req.workspace.settings?.defaultRole || "Member",
    token,
    invitedBy: req.user._id,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    delivery: {
      channel: "link",
      status: "manual",
      sentAt: new Date(),
      message: "Secure shareable invite link generated."
    }
  });
  const inviteUrl = absoluteInviteUrl(req, token);
  await recordActivity({ io: req.app.get("io"), workspace: req.workspace._id, actor: req.user._id, type: "member.invite_link_created", targetType: "Invite", targetId: invite._id, message: "created a workspace invite link" });
  emitWorkspace(req.app.get("io"), req.workspace._id, "invite:created", { ...invite.toObject(), inviteUrl });
  res.status(201).json({ ...invite.toObject(), inviteUrl });
});

router.patch("/:workspaceId/members/:userId", requireWorkspaceRole, async (req, res) => {
  if (req.role !== "Owner") return res.status(403).json({ message: "Only owners can change roles" });
  if (!["Owner", "Admin", "Member", "Viewer"].includes(req.body.role)) return res.status(400).json({ message: "Invalid role" });
  if (req.params.userId === req.workspace.owner.toString() && req.body.role !== "Owner") {
    return res.status(400).json({ message: "The workspace owner must keep the Owner role" });
  }
  await Workspace.updateOne({ _id: req.workspace._id, "members.user": req.params.userId }, { $set: { "members.$.role": req.body.role } });
  res.json(await Workspace.findById(req.workspace._id).populate("members.user", "name email avatar plan bio skills github linkedin lastSeenAt"));
});

router.delete("/:workspaceId/members/:userId", requireWorkspaceRole, async (req, res) => {
  if (!["Owner", "Admin"].includes(req.role)) return res.status(403).json({ message: "Only owners and admins can remove members" });
  if (req.params.userId === req.workspace.owner.toString()) return res.status(400).json({ message: "Workspace owner cannot be removed" });
  await Workspace.updateOne({ _id: req.workspace._id }, { $pull: { members: { user: req.params.userId } } });
  await recordActivity({ io: req.app.get("io"), workspace: req.workspace._id, actor: req.user._id, type: "member.removed", targetType: "User", targetId: req.params.userId, message: "removed a team member" });
  res.json(await Workspace.findById(req.workspace._id).populate("members.user", "name email avatar plan bio skills github linkedin lastSeenAt"));
});

export default router;
