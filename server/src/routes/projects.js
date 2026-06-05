import express from "express";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import { requireAuth, requireWorkspaceRole } from "../middleware/auth.js";
import { recordActivity, notifyUsers } from "../services/activity.js";
import { emitWorkspace } from "../socket/index.js";

const router = express.Router();
router.use(requireAuth);

router.get("/:workspaceId", requireWorkspaceRole, async (req, res) => {
  res.json(await Project.find({ workspace: req.workspace._id }).populate("lead members", "name email avatar").sort("-updatedAt"));
});

router.post("/:workspaceId", requireWorkspaceRole, async (req, res) => {
  if (!req.body.name?.trim()) return res.status(400).json({ message: "Project name is required" });
  if (!req.body.key?.trim()) return res.status(400).json({ message: "Project key is required" });
  const projectCount = await Project.countDocuments({ workspace: req.workspace._id });
  if (req.user.plan === "free" && projectCount >= 5) return res.status(402).json({ message: "Free plan allows five projects per workspace" });
  const project = await Project.create({ ...req.body, key: req.body.key.toUpperCase(), workspace: req.workspace._id });
  await recordActivity({ io: req.app.get("io"), workspace: req.workspace._id, actor: req.user._id, type: "project.created", targetType: "Project", targetId: project._id, message: `created project ${project.name}` });
  emitWorkspace(req.app.get("io"), req.workspace._id, "project:created", project);
  res.status(201).json(project);
});

router.patch("/:workspaceId/:projectId", requireWorkspaceRole, async (req, res) => {
  if (req.body.name !== undefined && !req.body.name?.trim()) return res.status(400).json({ message: "Project name is required" });
  if (req.body.key !== undefined && !req.body.key?.trim()) return res.status(400).json({ message: "Project key is required" });
  const updates = { ...req.body };
  if (updates.key) updates.key = updates.key.toUpperCase();
  const project = await Project.findOneAndUpdate({ _id: req.params.projectId, workspace: req.workspace._id }, updates, { new: true }).populate("lead members", "name email avatar");
  if (!project) return res.status(404).json({ message: "Project not found" });
  await recordActivity({ io: req.app.get("io"), workspace: req.workspace._id, actor: req.user._id, type: "project.updated", targetType: "Project", targetId: project._id, message: `updated project ${project.name}` });
  const projectUsers = [project.lead?._id || project.lead, ...(project.members || []).map((member) => member._id || member)].filter(Boolean).filter((id) => id.toString() !== req.user._id.toString());
  if (projectUsers.length) await notifyUsers({ io: req.app.get("io"), workspace: req.workspace._id, users: projectUsers, type: "project.update", title: `${project.name} was updated`, body: `${req.user.name} changed project details.`, link: "/projects" });
  emitWorkspace(req.app.get("io"), req.workspace._id, "project:updated", project);
  res.json(project);
});

router.delete("/:workspaceId/:projectId", requireWorkspaceRole, async (req, res) => {
  const project = await Project.findOneAndDelete({ _id: req.params.projectId, workspace: req.workspace._id });
  if (!project) return res.status(404).json({ message: "Project not found" });
  await Task.deleteMany({ project: project._id, workspace: req.workspace._id });
  await recordActivity({ io: req.app.get("io"), workspace: req.workspace._id, actor: req.user._id, type: "project.deleted", targetType: "Project", targetId: project._id, message: `deleted project ${project.name}` });
  res.json({ ok: true });
});

router.get("/:workspaceId/:projectId/report", requireWorkspaceRole, async (req, res) => {
  const [project, tasks] = await Promise.all([
    Project.findOne({ _id: req.params.projectId, workspace: req.workspace._id }).populate("lead members", "name email avatar"),
    Task.find({ project: req.params.projectId, workspace: req.workspace._id }).populate("assignees", "name avatar")
  ]);
  if (!project) return res.status(404).json({ message: "Project not found" });
  const done = tasks.filter((task) => task.status === "Done").length;
  const blockers = tasks.filter((task) => task.priority === "P0" && task.status !== "Done");
  res.json({ project, summary: { totalTasks: tasks.length, done, completion: tasks.length ? Math.round(done / tasks.length * 100) : 0, blockers }, tasks });
});

export default router;
