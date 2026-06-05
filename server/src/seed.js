import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "./config/db.js";
import Activity from "./models/Activity.js";
import DocPage from "./models/DocPage.js";
import Invite from "./models/Invite.js";
import Notification from "./models/Notification.js";
import Project from "./models/Project.js";
import Snippet from "./models/Snippet.js";
import Task from "./models/Task.js";
import User from "./models/User.js";
import Workspace from "./models/Workspace.js";

await connectDatabase();
await mongoose.connection.db.dropDatabase();

const [owner, admin, engineer, designer, viewer] = await User.create([
  { name: "Ava Chen", email: "owner@codesphere.dev", password: "Password123!", plan: "pro", bio: "Product-minded engineering leader", skills: ["React", "Node", "AI"] },
  { name: "Maya Singh", email: "maya@codesphere.dev", password: "Password123!", plan: "pro", bio: "Platform admin", skills: ["MongoDB", "DevOps"] },
  { name: "Leo Martin", email: "leo@codesphere.dev", password: "Password123!", bio: "Full-stack engineer", skills: ["JavaScript", "Go", "Security"] },
  { name: "Nora Patel", email: "nora@codesphere.dev", password: "Password123!", bio: "Design systems", skills: ["UX", "Research"] },
  { name: "Sam Rivera", email: "sam@codesphere.dev", password: "Password123!", bio: "Stakeholder reviewer", skills: ["Product", "QA"] }
]);

const workspace = await Workspace.create({
  name: "CodeSphere Labs",
  slug: "codesphere-labs",
  description: "Internal workspace for shipping CodeSphere",
  owner: owner._id,
  members: [
    { user: owner._id, role: "Owner" },
    { user: admin._id, role: "Admin" },
    { user: engineer._id, role: "Member" },
    { user: designer._id, role: "Member" },
    { user: viewer._id, role: "Viewer" }
  ]
});

const [platform, aiProject, mobile] = await Project.create([
  { workspace: workspace._id, name: "Platform Core", key: "CORE", description: "Auth, workspaces, billing, and collaboration", status: "Active", color: "#0f766e", lead: owner._id, members: [owner._id, admin._id, engineer._id], dueDate: days(28), repositoryUrl: "https://github.com/example/codesphere" },
  { workspace: workspace._id, name: "AI Insights", key: "AI", description: "Gemini-powered project intelligence", status: "Active", color: "#7c3aed", lead: admin._id, members: [admin._id, engineer._id], dueDate: days(18) },
  { workspace: workspace._id, name: "Mobile Polish", key: "MOB", description: "Responsive flows and touch-first boards", status: "Planning", color: "#ea580c", lead: designer._id, members: [designer._id, engineer._id], dueDate: days(42) }
]);

await Task.create([
  task(platform, "Implement workspace roles", "Owner/Admin/Member/Viewer permissions across routes and UI.", "Done", "P0", [owner._id, admin._id], ["auth", "rbac"], days(-2), 0),
  task(platform, "Kanban drag and drop persistence", "Persist cross-column ordering and broadcast updates.", "In Progress", "P0", [engineer._id], ["tasks", "realtime"], days(3), 1),
  task(platform, "Billing plan limits", "Enforce Free vs Pro limits and expose upgrade flow.", "In Review", "P1", [owner._id], ["billing"], days(5), 2),
  task(platform, "Notification preference settings", "Let users configure email, push, and digest notifications.", "To Do", "P2", [designer._id], ["profile"], days(12), 3),
  task(aiProject, "AI standup generator", "Summarize yesterday, today, and blockers from task metadata.", "Done", "P1", [admin._id], ["gemini"], days(-1), 0),
  task(aiProject, "Code review scoring prompt", "Return score, risks, fixes, and maintainability guidance.", "In Progress", "P0", [engineer._id], ["ai", "security"], days(2), 1),
  task(aiProject, "Workspace AI search", "Answer questions using projects, tasks, docs, and snippets.", "To Do", "P1", [admin._id], ["search"], days(9), 2),
  task(mobile, "Responsive sidebar navigation", "Ship compact mobile navigation without content overlap.", "In Progress", "P1", [designer._id], ["mobile", "ui"], days(7), 0),
  task(mobile, "Calendar agenda density", "Improve event scanning on narrow screens.", "To Do", "P2", [designer._id], ["calendar"], days(15), 1)
]);

await DocPage.create([
  { workspace: workspace._id, project: platform._id, title: "Engineering Handbook", content: "# Engineering Handbook\n\n## Release Rules\n- Every change links to a task.\n- Production migrations require review.\n\n## API Standards\n| Area | Rule |\n| --- | --- |\n| Auth | JWT bearer tokens |\n| Realtime | Socket.IO workspace rooms |\n\n```js\nfetch('/api/workspaces')\n```", createdBy: owner._id, updatedBy: owner._id },
  { workspace: workspace._id, project: aiProject._id, title: "AI Operating Notes", parent: null, content: "# AI Operating Notes\n\nUse Gemini for synthesis and deterministic local fallbacks when a key is not configured.\n\n[[Engineering Handbook]]", createdBy: admin._id, updatedBy: admin._id },
  { workspace: workspace._id, project: mobile._id, title: "Design QA Checklist", content: "# Design QA Checklist\n\n- Validate light and dark mode.\n- Verify mobile board columns scroll horizontally.\n- Confirm buttons fit long labels.", createdBy: designer._id, updatedBy: designer._id }
]);

await Snippet.create([
  { workspace: workspace._id, title: "JWT Auth Header", description: "Attach bearer token to Axios requests.", language: "javascript", tags: ["auth", "axios"], folder: "Frontend", code: "api.interceptors.request.use((config) => {\n  const token = localStorage.getItem('codesphere_token');\n  if (token) config.headers.Authorization = `Bearer ${token}`;\n  return config;\n});", createdBy: engineer._id },
  { workspace: workspace._id, title: "Python Task Grouper", description: "Group task dictionaries by status.", language: "python", tags: ["tasks", "analytics"], folder: "Utilities", code: "from collections import defaultdict\n\ndef group_by_status(tasks):\n    grouped = defaultdict(list)\n    for task in tasks:\n        grouped[task['status']].append(task)\n    return grouped", createdBy: admin._id },
  { workspace: workspace._id, title: "Go Health Handler", description: "Tiny net/http health check.", language: "go", tags: ["api", "go"], folder: "Backend", code: "func Health(w http.ResponseWriter, r *http.Request) {\n    w.Header().Set(\"Content-Type\", \"application/json\")\n    w.WriteHeader(http.StatusOK)\n    w.Write([]byte(`{\"status\":\"ok\"}`))\n}", createdBy: engineer._id }
]);

await Activity.create([
  { workspace: workspace._id, actor: owner._id, type: "workspace.created", targetType: "Workspace", targetId: workspace._id, message: "created workspace CodeSphere Labs" },
  { workspace: workspace._id, actor: engineer._id, type: "task.updated", targetType: "Task", message: "moved Kanban drag and drop persistence to In Progress" },
  { workspace: workspace._id, actor: admin._id, type: "doc.updated", targetType: "DocPage", message: "updated AI Operating Notes" }
]);

await Notification.create([
  { workspace: workspace._id, user: owner._id, type: "review", title: "Task ready for review", body: "Billing plan limits is waiting in In Review.", link: "/tasks" },
  { workspace: workspace._id, user: engineer._id, type: "mention", title: "You were mentioned", body: "Please validate the code review scoring prompt.", link: "/tasks" }
]);

console.log("Seed complete. Login with owner@codesphere.dev / Password123!");
process.exit(0);

function days(offset) {
  return new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
}

function task(project, title, description, status, priority, assignees, labels, dueDate, order) {
  return {
    workspace: workspace._id,
    project: project._id,
    title,
    description,
    status,
    priority,
    assignees,
    labels,
    dueDate,
    order,
    comments: [{ author: owner._id, body: `Tracking progress on ${title}.`, mentions: assignees }],
    mentions: assignees,
    history: [{ actor: owner._id, action: "created", to: status }]
  };
}
