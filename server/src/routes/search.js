import express from "express";
import Activity from "../models/Activity.js";
import DocPage from "../models/DocPage.js";
import Project from "../models/Project.js";
import Snippet from "../models/Snippet.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import { requireAuth, requireWorkspaceRole } from "../middleware/auth.js";
import { runGemini } from "../services/gemini.js";
import { wrapAsyncRouter } from "../utils/wrapAsyncRouter.js";

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
  if (!req.body.question?.trim()) return res.status(400).json({ message: "Question is required" });
  const [projects, tasks, docs, snippets, activities] = await Promise.all([
    Project.find({ workspace: req.workspace._id }).select("name status description").lean(),
    Task.find({ workspace: req.workspace._id }).select("title status priority dueDate").lean(),
    DocPage.find({ workspace: req.workspace._id }).select("title content").limit(20).lean(),
    Snippet.find({ workspace: req.workspace._id }).select("title language tags").lean(),
    Activity.find({ workspace: req.workspace._id }).select("type message createdAt").sort("-createdAt").limit(20).lean()
  ]);
  const context = { projects, tasks, docs, snippets, activities };
  const answer = await runGemini(
    `Answer this workspace question using the JSON context.\nQuestion: ${req.body.question}\nContext: ${JSON.stringify(context)}`,
    localAiSearch(req.body.question, context)
  );
  res.json({ answer });
});

function localAiSearch(question, { projects, tasks, docs, snippets, activities }) {
  const words = question.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
  const matches = (value) => words.some((word) => String(value || "").toLowerCase().includes(word));
  const matchedTasks = tasks.filter((task) => matches(`${task.title} ${task.status} ${task.priority}`));
  const matchedProjects = projects.filter((project) => matches(`${project.name} ${project.status} ${project.description}`));
  const matchedDocs = docs.filter((doc) => matches(`${doc.title} ${doc.content}`));
  const matchedSnippets = snippets.filter((snippet) => matches(`${snippet.title} ${snippet.language} ${(snippet.tags || []).join(" ")}`));
  const openP0 = tasks.filter((task) => task.priority === "P0" && task.status !== "Done");
  return [
    `Workspace search summary for "${question}":`,
    `- Projects matched: ${matchedProjects.length}${matchedProjects.length ? ` (${matchedProjects.slice(0, 4).map((item) => item.name).join(", ")})` : ""}`,
    `- Tasks matched: ${matchedTasks.length}${matchedTasks.length ? ` (${matchedTasks.slice(0, 5).map((item) => `${item.title} - ${item.status}`).join(", ")})` : ""}`,
    `- Docs matched: ${matchedDocs.length}${matchedDocs.length ? ` (${matchedDocs.slice(0, 4).map((item) => item.title).join(", ")})` : ""}`,
    `- Snippets matched: ${matchedSnippets.length}${matchedSnippets.length ? ` (${matchedSnippets.slice(0, 4).map((item) => item.title).join(", ")})` : ""}`,
    `- Open P0 tasks: ${openP0.length}${openP0.length ? ` (${openP0.map((item) => item.title).join(", ")})` : ""}`,
    `- Recent activity checked: ${activities.length} events`,
    "Configure a valid GEMINI_API_KEY in server/.env for natural language synthesis over this same live data."
  ].join("\n");
}

export default wrapAsyncRouter(router);
