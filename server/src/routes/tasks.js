import express from "express";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import { requireAuth, requireWorkspaceRole } from "../middleware/auth.js";
import { recordActivity, notifyUsers } from "../services/activity.js";
import { emitWorkspace } from "../socket/index.js";

const router = express.Router();
router.use(requireAuth);

const statuses = ["To Do", "In Progress", "In Review", "Done"];
const priorities = ["P0", "P1", "P2"];

function validateTaskBody(body, { partial = false } = {}) {
  if (!partial || body.title !== undefined) {
    if (!body.title?.trim()) return "Task title is required";
  }
  if (body.status !== undefined && !statuses.includes(body.status)) return "Invalid task status";
  if (body.priority !== undefined && !priorities.includes(body.priority)) return "Invalid task priority";
  if (body.assignees !== undefined && !Array.isArray(body.assignees)) return "assignees must be an array";
  if (body.labels !== undefined && !Array.isArray(body.labels)) return "labels must be an array";
  if (body.order !== undefined && !Number.isFinite(Number(body.order))) return "order must be a number";
  if (body.dueDate !== undefined && body.dueDate !== null && Number.isNaN(new Date(body.dueDate).getTime())) return "Invalid dueDate";
  return "";
}

async function validateAssignees(assignees = [], workspace) {
  if (!assignees.length) return "";
  const memberIds = new Set(workspace.members.map((member) => member.user.toString()));
  const invalid = assignees.find((assignee) => !memberIds.has(String(assignee)));
  return invalid ? "Assignees must be workspace members" : "";
}

router.get("/:workspaceId", requireWorkspaceRole, async (req, res) => {
  const query = { workspace: req.workspace._id };
  if (req.query.project) query.project = req.query.project;
  if (req.query.status) query.status = req.query.status;
  if (req.query.priority) query.priority = req.query.priority;
  if (req.query.assignee) query.assignees = req.query.assignee;
  if (req.query.search) query.$text = { $search: req.query.search };
  const tasks = await Task.find(query).populate("project", "name key color").populate("assignees comments.author mentions", "name email avatar").sort({ order: 1, updatedAt: -1 });
  res.json(tasks);
});

router.post("/:workspaceId", requireWorkspaceRole, async (req, res) => {
  const validationError = validateTaskBody(req.body);
  if (validationError) return res.status(400).json({ message: validationError });
  if (!req.body.project) return res.status(400).json({ message: "Project is required" });
  const assigneeError = await validateAssignees(req.body.assignees || [], req.workspace);
  if (assigneeError) return res.status(400).json({ message: assigneeError });
  const project = await Project.findOne({ _id: req.body.project, workspace: req.workspace._id });
  if (!project) return res.status(400).json({ message: "Project does not belong to this workspace" });
  const status = req.body.status || "To Do";
  const task = await Task.create({
    ...req.body,
    status,
    workspace: req.workspace._id,
    history: [{ actor: req.user._id, action: "created", to: status }]
  });
  const populated = await task.populate("project assignees", "name key color email avatar");
  await recordActivity({ io: req.app.get("io"), workspace: req.workspace._id, actor: req.user._id, type: "task.created", targetType: "Task", targetId: task._id, message: `created task ${task.title} in ${status}` });
  if (task.assignees?.length) {
    await notifyUsers({ io: req.app.get("io"), workspace: req.workspace._id, users: task.assignees, type: "task.assignment", title: `${req.user.name} assigned you a task`, body: task.title, link: "/tasks" });
  }
  emitWorkspace(req.app.get("io"), req.workspace._id, "task:created", populated);
  res.status(201).json(populated);
});

router.patch("/:workspaceId/:taskId", requireWorkspaceRole, async (req, res) => {
  const existing = await Task.findOne({ _id: req.params.taskId, workspace: req.workspace._id });
  if (!existing) return res.status(404).json({ message: "Task not found" });
  const validationError = validateTaskBody(req.body, { partial: true });
  if (validationError) return res.status(400).json({ message: validationError });
  const assigneeError = await validateAssignees(req.body.assignees || [], req.workspace);
  if (assigneeError) return res.status(400).json({ message: assigneeError });
  if (req.body.project) {
    const project = await Project.findOne({ _id: req.body.project, workspace: req.workspace._id });
    if (!project) return res.status(400).json({ message: "Project does not belong to this workspace" });
  }
  const previousAssignees = existing.assignees.map((u) => u && u._id ? u._id.toString() : String(u));
  const history = [];
  ["status", "priority", "dueDate"].forEach((field) => {
    if (req.body[field] && String(existing[field]) !== String(req.body[field])) history.push({ actor: req.user._id, action: `changed ${field}`, from: String(existing[field] || ""), to: String(req.body[field]) });
  });
  Object.assign(existing, req.body);
  existing.history.push(...history);
  await existing.save();
  const populated = await existing.populate("project assignees comments.author", "name key color email avatar");
  const statusChange = history.find((item) => item.action === "changed status");
  const newAssignees = existing.assignees.map((u) => u && u._id ? u._id.toString() : String(u)).filter((id) => !previousAssignees.includes(id));
  if (newAssignees.length) {
    await notifyUsers({ io: req.app.get("io"), workspace: req.workspace._id, users: newAssignees, type: "task.assignment", title: `${req.user.name} assigned you a task`, body: existing.title, link: "/tasks" });
  }
  if (statusChange) {
    await recordActivity({ io: req.app.get("io"), workspace: req.workspace._id, actor: req.user._id, type: "task.updated", targetType: "Task", targetId: existing._id, message: `moved ${existing.title} from ${statusChange.from || "Unassigned"} to ${statusChange.to}` });
  }
  emitWorkspace(req.app.get("io"), req.workspace._id, "task:updated", populated);
  res.json(populated);
});

router.delete("/:workspaceId/:taskId", requireWorkspaceRole, async (req, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.taskId, workspace: req.workspace._id });
  if (!task) return res.status(404).json({ message: "Task not found" });
  await recordActivity({ io: req.app.get("io"), workspace: req.workspace._id, actor: req.user._id, type: "task.deleted", targetType: "Task", targetId: task._id, message: `deleted task ${task.title}` });
  emitWorkspace(req.app.get("io"), req.workspace._id, "task:deleted", { _id: task._id });
  res.json({ ok: true });
});

router.post("/:workspaceId/:taskId/comments", requireWorkspaceRole, async (req, res) => {
  const task = await Task.findOne({ _id: req.params.taskId, workspace: req.workspace._id });
  if (!task) return res.status(404).json({ message: "Task not found" });
  if (!req.body.body?.trim()) return res.status(400).json({ message: "Comment body is required" });
  task.comments.push({ author: req.user._id, body: req.body.body, mentions: req.body.mentions || [] });
  task.history.push({ actor: req.user._id, action: "commented" });
  await task.save();
  if (req.body.mentions?.length) {
    await notifyUsers({ io: req.app.get("io"), workspace: req.workspace._id, users: req.body.mentions, type: "mention", title: `${req.user.name} mentioned you`, body: req.body.body, link: `/tasks/${task._id}` });
  }
  const assignees = task.assignees.map((u) => u && u._id ? u._id.toString() : String(u)).filter((id) => id !== req.user._id.toString() && !(req.body.mentions || []).map(String).includes(id));
  if (assignees.length) {
    await notifyUsers({ io: req.app.get("io"), workspace: req.workspace._id, users: assignees, type: "task.comment", title: `${req.user.name} commented on ${task.title}`, body: req.body.body, link: "/tasks" });
  }
  const populated = await task.populate("comments.author comments.mentions", "name email avatar");
  emitWorkspace(req.app.get("io"), req.workspace._id, "task:commented", populated);
  res.status(201).json(populated);
});

router.post("/:workspaceId/reorder", requireWorkspaceRole, async (req, res) => {
  if (!Array.isArray(req.body.tasks)) return res.status(400).json({ message: "tasks must be an array" });
  const invalid = req.body.tasks.find((item) => !item?.id || !statuses.includes(item.status) || !Number.isFinite(Number(item.order)));
  if (invalid) return res.status(400).json({ message: "Each reorder item requires id, valid status, and numeric order" });
  const ids = req.body.tasks.map((item) => item.id);
  const existingTasks = await Task.find({ _id: { $in: ids }, workspace: req.workspace._id }).select("title status");
  const existingById = new Map(existingTasks.map((task) => [task._id.toString(), task]));
  const changedStatusItems = [];
  await Promise.all(req.body.tasks.map((item) => {
    const existing = existingById.get(item.id);
    if (existing && existing.status !== item.status) {
      changedStatusItems.push({ id: item.id, title: existing.title, from: existing.status, to: item.status });
      return Task.updateOne(
        { _id: item.id, workspace: req.workspace._id },
        {
          $set: { status: item.status, order: item.order },
          $push: { history: { actor: req.user._id, action: "changed status", from: existing.status, to: item.status } }
        }
      );
    }
    return Task.updateOne({ _id: item.id, workspace: req.workspace._id }, { status: item.status, order: item.order });
  }));
  await Promise.all(changedStatusItems.map((item) => recordActivity({ io: req.app.get("io"), workspace: req.workspace._id, actor: req.user._id, type: "task.updated", targetType: "Task", targetId: item.id, message: `moved ${item.title} from ${item.from} to ${item.to}` })));
  emitWorkspace(req.app.get("io"), req.workspace._id, "task:reordered", req.body.tasks);
  res.json({ ok: true });
});

export default router;
