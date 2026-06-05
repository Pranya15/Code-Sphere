import express from "express";
import Activity from "../models/Activity.js";
import DocPage from "../models/DocPage.js";
import Project from "../models/Project.js";
import Snippet from "../models/Snippet.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import { requireAuth, requireWorkspaceRole } from "../middleware/auth.js";
import { runGemini } from "../services/gemini.js";

const router = express.Router();
router.use(requireAuth);

router.get("/:workspaceId", requireWorkspaceRole, async (req, res) => {
  const q = req.query.q || "";
  const text = q ? { $text: { $search: q } } : {};
  const memberIds = req.workspace.members.map((member) => member.user);
  const [projects, tasks, docs, snippets, activities, users] = await Promise.all([
    Project.find({ workspace: req.workspace._id, ...text }).limit(8),
    Task.find({ workspace: req.workspace._id, ...text }).limit(8),
    DocPage.find({ workspace: req.workspace._id, ...text }).limit(8),
    Snippet.find({ workspace: req.workspace._id, ...text }).limit(8),
    Activity.find({ workspace: req.workspace._id, ...text }).populate("actor", "name avatar").limit(8),
    User.find({ _id: { $in: memberIds }, $or: [{ name: new RegExp(q, "i") }, { email: new RegExp(q, "i") }, { skills: new RegExp(q, "i") }] }).select("name email avatar skills").limit(8)
  ]);
  res.json({ projects, tasks, docs, snippets, activities, users });
});

router.post("/:workspaceId/ai", requireWorkspaceRole, async (req, res) => {
  const [projects, tasks, docs, snippets] = await Promise.all([
    Project.find({ workspace: req.workspace._id }).select("name status description").lean(),
    Task.find({ workspace: req.workspace._id }).select("title status priority dueDate").lean(),
    DocPage.find({ workspace: req.workspace._id }).select("title content").limit(20).lean(),
    Snippet.find({ workspace: req.workspace._id }).select("title language tags").lean()
  ]);
  const answer = await runGemini(
    `Answer this workspace question using the JSON context.\nQuestion: ${req.body.question}\nContext: ${JSON.stringify({ projects, tasks, docs, snippets })}`,
    "AI search is ready, but GEMINI_API_KEY is not configured. Add it to server/.env to enable workspace-aware answers."
  );
  res.json({ answer });
});

export default router;
