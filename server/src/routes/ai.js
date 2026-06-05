import express from "express";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import { requireAuth, requireWorkspaceRole } from "../middleware/auth.js";
import { runGemini } from "../services/gemini.js";

const router = express.Router();
router.use(requireAuth);

router.post("/:workspaceId/assistant", requireWorkspaceRole, async (req, res) => {
  if (req.user.plan !== "pro") return res.status(402).json({ message: "AI Assistant requires Pro" });
  const [projects, tasks] = await Promise.all([
    Project.find({ workspace: req.workspace._id }).lean(),
    Task.find({ workspace: req.workspace._id }).populate("assignees", "name").lean()
  ]);
  const prompt = `You are CodeSphere's project assistant. Return a concise, structured answer.\nMode: ${req.body.mode}\nRequest: ${req.body.prompt}\nWorkspace: ${req.workspace.name}\nProjects: ${JSON.stringify(projects)}\nTasks: ${JSON.stringify(tasks)}`;
  const answer = await runGemini(prompt, localAssistant(req.body.mode, projects, tasks, req.body.prompt));
  res.json({ answer });
});

router.post("/code-review", requireAuth, async (req, res) => {
  if (req.user.plan !== "pro") return res.status(402).json({ message: "AI Code Review requires Pro" });
  const prompt = `Review this ${req.body.language || "code"} for bugs, performance, security, maintainability, score 1-100, and concrete fixes:\n${req.body.code}`;
  const fallback = localCodeReview(req.body.code || "");
  const review = await runGemini(prompt, fallback);
  res.json({ review });
});

function localAssistant(mode, projects, tasks, prompt) {
  const open = tasks.filter((task) => task.status !== "Done");
  const blockers = open.filter((task) => task.priority === "P0");
  const dueSoon = open.filter((task) => task.dueDate && new Date(task.dueDate) < new Date(Date.now() + 1000 * 60 * 60 * 24 * 7));
  if (mode === "standup") return `Yesterday: ${tasks.filter((task) => task.status === "Done").length} tasks are complete. Today: focus on ${open.slice(0, 5).map((task) => task.title).join(", ") || "planning"}. Blockers: ${blockers.map((task) => task.title).join(", ") || "none"}.`;
  if (mode === "breakdown") return `Suggested breakdown for "${prompt}": define acceptance criteria, create API contract, build UI workflow, add realtime updates, write validation tests, prepare release notes.`;
  return `Workspace has ${projects.length} projects and ${tasks.length} tasks. Completion is ${tasks.length ? Math.round(tasks.filter((task) => task.status === "Done").length / tasks.length * 100) : 0}%. Current blockers: ${blockers.length}. Due within seven days: ${dueSoon.length}.`;
}

function localCodeReview(code) {
  const findings = [];
  if (/eval\s*\(/.test(code)) findings.push("Security: avoid eval because it can execute untrusted input.");
  if (/innerHTML\s*=/.test(code)) findings.push("Security: sanitize values before assigning innerHTML.");
  if (/for\s*\(.+\)\s*{[\s\S]*await /.test(code)) findings.push("Performance: awaits inside loops can often be batched with Promise.all.");
  if (!findings.length) findings.push("No critical pattern-based issues found. Add tests for edge cases and error paths.");
  return `Score: ${findings.length > 1 ? 72 : 86}/100\nFindings:\n- ${findings.join("\n- ")}\nRecommendations:\n- Add input validation.\n- Add explicit error handling.\n- Keep pure logic covered with unit tests.`;
}

export default router;
