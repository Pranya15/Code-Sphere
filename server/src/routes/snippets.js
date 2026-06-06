import express from "express";
import Snippet from "../models/Snippet.js";
import { requireAuth, requireWorkspaceRole } from "../middleware/auth.js";
import { wrapAsyncRouter } from "../utils/wrapAsyncRouter.js";

const router = express.Router();
router.use(requireAuth);

router.get("/:workspaceId", requireWorkspaceRole, async (req, res) => {
  const query = { workspace: req.workspace._id };
  if (req.query.language) query.language = req.query.language;
  if (req.query.tag) query.tags = req.query.tag;
  if (req.query.search) query.$text = { $search: req.query.search };
  res.json(await Snippet.find(query).populate("createdBy", "name avatar").sort("-updatedAt"));
});

router.post("/:workspaceId", requireWorkspaceRole, async (req, res) => {
  if (!req.body.title?.trim()) return res.status(400).json({ message: "Snippet title is required" });
  if (!req.body.code?.trim()) return res.status(400).json({ message: "Snippet code is required" });
  res.status(201).json(await Snippet.create({ ...req.body, workspace: req.workspace._id, createdBy: req.user._id }));
});

router.patch("/:workspaceId/:snippetId", requireWorkspaceRole, async (req, res) => {
  if (req.body.title !== undefined && !req.body.title?.trim()) return res.status(400).json({ message: "Snippet title is required" });
  if (req.body.code !== undefined && !req.body.code?.trim()) return res.status(400).json({ message: "Snippet code is required" });
  const snippet = await Snippet.findOneAndUpdate({ _id: req.params.snippetId, workspace: req.workspace._id }, req.body, { new: true });
  if (!snippet) return res.status(404).json({ message: "Snippet not found" });
  res.json(snippet);
});

router.delete("/:workspaceId/:snippetId", requireWorkspaceRole, async (req, res) => {
  const snippet = await Snippet.findOneAndDelete({ _id: req.params.snippetId, workspace: req.workspace._id });
  if (!snippet) return res.status(404).json({ message: "Snippet not found" });
  res.json({ ok: true });
});

router.post("/:workspaceId/:snippetId/copy", requireWorkspaceRole, async (req, res) => {
  const snippet = await Snippet.findOneAndUpdate({ _id: req.params.snippetId, workspace: req.workspace._id }, { $inc: { copiedCount: 1 } }, { new: true });
  res.json(snippet);
});

export default wrapAsyncRouter(router);
