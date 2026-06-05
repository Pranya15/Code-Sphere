import express from "express";
import DocPage from "../models/DocPage.js";
import { requireAuth, requireWorkspaceRole } from "../middleware/auth.js";
import { recordActivity } from "../services/activity.js";
import { emitWorkspace } from "../socket/index.js";

const router = express.Router();
router.use(requireAuth);

router.get("/:workspaceId", requireWorkspaceRole, async (req, res) => {
  res.json(await DocPage.find({ workspace: req.workspace._id }).populate("createdBy updatedBy", "name avatar").sort("title"));
});

router.post("/:workspaceId", requireWorkspaceRole, async (req, res) => {
  if (!req.body.title?.trim()) return res.status(400).json({ message: "Page title is required" });
  const page = await DocPage.create({ ...req.body, workspace: req.workspace._id, createdBy: req.user._id, updatedBy: req.user._id });
  await recordActivity({ io: req.app.get("io"), workspace: req.workspace._id, actor: req.user._id, type: "doc.created", targetType: "DocPage", targetId: page._id, message: `created doc ${page.title}` });
  res.status(201).json(page);
});

router.patch("/:workspaceId/:pageId", requireWorkspaceRole, async (req, res) => {
  const page = await DocPage.findOne({ _id: req.params.pageId, workspace: req.workspace._id });
  if (!page) return res.status(404).json({ message: "Page not found" });
  if (req.body.title !== undefined && !req.body.title?.trim()) return res.status(400).json({ message: "Page title is required" });
  if (req.body.content !== undefined && req.body.content !== page.content) page.versionHistory.push({ content: page.content, editor: req.user._id, message: "Auto-saved previous version" });
  Object.assign(page, req.body, { updatedBy: req.user._id });
  await page.save();
  emitWorkspace(req.app.get("io"), req.workspace._id, "doc:updated", page);
  res.json(page);
});

router.delete("/:workspaceId/:pageId", requireWorkspaceRole, async (req, res) => {
  const page = await DocPage.findOneAndDelete({ _id: req.params.pageId, workspace: req.workspace._id });
  if (!page) return res.status(404).json({ message: "Page not found" });
  await DocPage.updateMany({ workspace: req.workspace._id, parent: page._id }, { $unset: { parent: "" } });
  await recordActivity({ io: req.app.get("io"), workspace: req.workspace._id, actor: req.user._id, type: "doc.deleted", targetType: "DocPage", targetId: page._id, message: `deleted doc ${page.title}` });
  emitWorkspace(req.app.get("io"), req.workspace._id, "doc:deleted", { _id: page._id });
  res.json({ ok: true });
});

router.post("/:workspaceId/:pageId/restore/:versionIndex", requireWorkspaceRole, async (req, res) => {
  const page = await DocPage.findOne({ _id: req.params.pageId, workspace: req.workspace._id });
  if (!page?.versionHistory[req.params.versionIndex]) return res.status(404).json({ message: "Version not found" });
  page.versionHistory.push({ content: page.content, editor: req.user._id, message: "Version restored" });
  page.content = page.versionHistory[req.params.versionIndex].content;
  page.updatedBy = req.user._id;
  await page.save();
  res.json(page);
});

export default router;
