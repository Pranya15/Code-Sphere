import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths, subWeeks } from "date-fns";
import { Activity, AlertCircle, Bell, BookOpen, Bot, Calendar, CalendarDays, Check, ChevronLeft, ChevronRight, Clipboard, Code2, Copy, CreditCard, Edit3, ExternalLink, Filter, FileText, Github, LayoutGrid, Linkedin, List, Loader2, Mail, MessageCircle, Plus, Search, Send, Settings, ShieldCheck, Sparkles, Trash2, UserPlus, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { Badge, Button, Empty, Input, Panel, Select, Skeleton, Textarea, timeAgo } from "../components/ui";

const statuses = ["To Do", "In Progress", "In Review", "Done"];
const priorities = { P0: "red", P1: "amber", P2: "teal" };
const emptyProjectForm = { name: "", key: "", description: "", color: "#7C3AED", status: "Active" };
const emptySnippetForm = { title: "", language: "javascript", description: "", tags: "", code: "" };
const emptyTaskForm = { title: "", description: "", priority: "P1", status: "To Do", labels: "", project: "", assignee: "", dueDate: "" };

function getErrorMessage(error, fallback = "Request failed") {
  return error.response?.data?.message || error.message || fallback;
}

function ConfirmModal({ item, onCancel, onConfirm, loading }) {
  if (!item) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/55 p-4 backdrop-blur-sm">
    <div className="glass-card w-full max-w-md rounded-2xl p-5 shadow-glow">
      <div className="mb-2 text-lg font-bold">Delete {item.label}</div>
      <p className="text-sm text-slate-500">This action cannot be undone.</p>
      <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button><Button onClick={onConfirm} disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}Delete</Button></div>
    </div>
  </div>;
}

function useWorkspaceEndpoint(path, fallback = []) {
  const { activeWorkspaceId } = useAuth();
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(true);
  async function load() {
    if (!activeWorkspaceId) return;
    setLoading(true);
    const response = await api.get(path(activeWorkspaceId));
    setData(response.data);
    setLoading(false);
  }
  useEffect(() => { load().catch(() => setLoading(false)); }, [activeWorkspaceId]);
  return { data, setData, loading, reload: load };
}

function PageTitle({ icon: Icon, title, subtitle, action }) {
  return <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl aurora-gradient text-white shadow-glow"><Icon className="h-5 w-5" /></div><div><h1 className="text-2xl font-black tracking-tight md:text-3xl">{title}</h1><p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{subtitle}</p></div></div>
    {action}
  </div>;
}

export function DashboardPage() {
  const { activeWorkspaceId } = useAuth();
  const { events } = useSocket();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!activeWorkspaceId) return;
    setError("");
    api.get(`/workspaces/${activeWorkspaceId}/dashboard`)
      .then(({ data }) => setDashboard(data))
      .catch((requestError) => {
        setDashboard(null);
        setError(getErrorMessage(requestError, "Dashboard could not be loaded"));
      });
  }, [activeWorkspaceId, events.length]);
  if (error) return <Empty title={error} />;
  if (!dashboard) return <div className="grid gap-4 md:grid-cols-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>;
  const chart = statuses.map((status) => ({ status, count: dashboard.stats.byStatus[status] || 0 }));
  return <>
    <PageTitle icon={LayoutIcon} title="Dashboard" subtitle="Project progress, team activity, deadlines, and productivity signals." />
    <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-6">
      <Metric label="Workspaces" value={dashboard.stats.totalWorkspaces ?? 1} />
      <Metric label="Projects" value={dashboard.stats.projects ?? dashboard.projects.length} />
      <Metric label="Tasks" value={dashboard.stats.tasks} />
      <Metric label="Completed" value={dashboard.stats.completed ?? (dashboard.stats.byStatus.Done || 0)} />
      <Metric label="In Progress" value={dashboard.stats.inProgress ?? (dashboard.stats.byStatus["In Progress"] || 0)} />
      <Metric label="Team Members" value={dashboard.stats.teamMembers ?? (dashboard.members?.length || 0)} />
    </div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <Panel><h2 className="mb-3 font-semibold">Progress by Status</h2><div className="space-y-4">{chart.map((item) => <div key={item.status}><div className="mb-1 flex justify-between text-sm"><span>{item.status}</span><span>{item.count}</span></div><div className="h-3 rounded-full bg-slate-200/60 dark:bg-white/10"><div className="h-3 rounded-full aurora-gradient shadow-[0_0_22px_rgba(124,58,237,.28)]" style={{ width: `${dashboard.stats.tasks ? item.count / dashboard.stats.tasks * 100 : 0}%` }} /></div></div>)}</div></Panel>
      <Panel><h2 className="mb-3 font-semibold">Upcoming Deadlines</h2><div className="space-y-2">{dashboard.upcoming.map((task) => <div key={task._id} className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-white/40 p-3 text-sm transition hover:bg-violet-500/5 dark:bg-white/5"><span>{task.title}</span><Badge tone={priorities[task.priority]}>{format(new Date(task.dueDate), "MMM d")}</Badge></div>)}</div></Panel>
    </div>
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <Panel><h2 className="mb-3 font-semibold">Project Progress</h2><div className="grid gap-2">{(dashboard.projectProgress || dashboard.projects).map((project) => <ProjectRow key={project._id} project={project} />)}</div></Panel>
      <Panel><h2 className="mb-3 font-semibold">Recent Activity</h2><ActivityList items={dashboard.activities?.length ? dashboard.activities : events} empty="Realtime activity will appear here as your team works." /></Panel>
    </div>
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <Panel><h2 className="mb-3 font-semibold">Team Members</h2><div className="grid gap-2">{dashboard.members?.map((member) => <div key={member._id} className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-white/45 p-3 text-sm dark:bg-white/5"><Avatar user={member} /><div><div className="font-semibold">{member.name}</div><div className="text-xs text-slate-500">{member.role || "Member"}</div></div></div>)}</div></Panel>
      <Panel><h2 className="mb-3 font-semibold">Productivity Charts</h2><div className="flex h-44 items-end gap-2">{(dashboard.productivity || []).map((point) => <div key={point.date} className="flex flex-1 flex-col items-center gap-2"><div className="flex w-full items-end gap-1"><div className="flex-1 rounded-t bg-violet-500" style={{ height: `${Math.max(8, point.completed * 18)}px` }} /><div className="flex-1 rounded-t bg-cyan-400" style={{ height: `${Math.max(8, point.active * 14)}px` }} /></div><span className="text-[10px] text-slate-500">{format(new Date(point.date), "M/d")}</span></div>)}</div><div className="mt-3 flex gap-4 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded bg-violet-500" />Completed</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded bg-cyan-400" />Active</span></div></Panel>
    </div>
  </>;
}

function Metric({ label, value }) {
  return <Panel className="aurora-border"><div className="flex items-center justify-between"><div className="text-sm text-slate-500">{label}</div><Sparkles className="h-4 w-4 text-violet-500" /></div><div className="mt-3 text-4xl font-black aurora-text">{value}</div></Panel>;
}

function ProjectRow({ project }) {
  return <div className="rounded-xl border border-[var(--line)] bg-white/35 p-3 transition hover:bg-violet-500/5 dark:bg-white/5"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="h-3 w-3 rounded-full shadow-[0_0_16px_currentColor]" style={{ backgroundColor: project.color, color: project.color }} /><div><div className="font-medium">{project.name}</div><div className="text-xs text-slate-500">{project.status} - {project.key}</div></div></div><Badge>{project.progress ?? 0}%</Badge></div><div className="mt-3 h-2 rounded-full bg-slate-200/60 dark:bg-white/10"><div className="h-2 rounded-full aurora-gradient" style={{ width: `${project.progress ?? 0}%` }} /></div></div>;
}

export function WorkspacesPage() {
  const { workspaces, refresh, activeWorkspaceId, setActiveWorkspaceId } = useAuth();
  const [form, setForm] = useState({ name: "", description: "" });
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  async function create() {
    if (!form.name.trim()) return toast.error("Workspace name is required");
    setLoading(true);
    try {
      const response = editingId ? await api.patch(`/workspaces/${editingId}`, form) : await api.post("/workspaces", form);
      setForm({ name: "", description: "" });
      setEditingId("");
      await refresh();
      if (!editingId && response.data?._id) setActiveWorkspaceId(response.data._id);
      toast.success(editingId ? "Workspace updated" : "Workspace created");
    } finally {
      setLoading(false);
    }
  }
  function edit(workspace) {
    setEditingId(workspace._id);
    setForm({ name: workspace.name || "", description: workspace.description || "" });
  }
  async function remove() {
    setLoading(true);
    try {
      await api.delete(`/workspaces/${confirm.id}`);
      if (confirm.id === activeWorkspaceId) {
        const next = workspaces.find((workspace) => workspace._id !== confirm.id)?._id || "";
        setActiveWorkspaceId(next);
      }
      setConfirm(null);
      await refresh();
      toast.success("Workspace deleted");
    } finally {
      setLoading(false);
    }
  }
  return <>
    <PageTitle icon={Users} title="Workspaces" subtitle="Create collaboration spaces and manage team membership." />
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]"><Panel><div className="grid gap-3">{workspaces.map((workspace) => <div key={workspace._id} className="rounded-xl border border-[var(--line)] bg-white/40 p-4 transition hover:bg-violet-500/5 dark:bg-white/5"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{workspace.name}</div><div className="text-sm text-slate-500">{workspace.description || "Private workspace"} - {workspace.members.length} members</div></div><div className="flex gap-2"><Button variant="ghost" onClick={() => edit(workspace)}><Edit3 className="h-4 w-4" /></Button><Button variant="ghost" onClick={() => setConfirm({ id: workspace._id, label: workspace.name })}><Trash2 className="h-4 w-4" /></Button></div></div></div>)}</div></Panel><Panel><h2 className="mb-3 font-semibold">{editingId ? "Edit Workspace" : "New Workspace"}</h2><Input required className="mb-3" placeholder="Workspace name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><Button className="mt-3 w-full" onClick={create} disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}{editingId ? "Save Workspace" : "Create"}</Button>{editingId && <Button variant="ghost" className="mt-2 w-full" onClick={() => { setEditingId(""); setForm({ name: "", description: "" }); }}><X className="h-4 w-4" />Cancel</Button>}</Panel></div>
    <ConfirmModal item={confirm} loading={loading} onCancel={() => setConfirm(null)} onConfirm={remove} />
  </>;
}

export function ProjectsPage() {
  const { activeWorkspaceId, user } = useAuth();
  const { data: projects, reload } = useWorkspaceEndpoint((id) => `/projects/${id}`);
  const [form, setForm] = useState(emptyProjectForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  async function create() {
    if (!form.name.trim()) return toast.error("Project name is required");
    if (!form.key.trim()) return toast.error("Project key is required");
    setLoading(true);
    try {
      const payload = { ...form, key: form.key.toUpperCase(), lead: user?._id };
      if (editingId) await api.patch(`/projects/${activeWorkspaceId}/${editingId}`, payload);
      else await api.post(`/projects/${activeWorkspaceId}`, payload);
      setForm(emptyProjectForm);
      setEditingId("");
      await reload();
      toast.success(editingId ? "Project updated" : "Project created");
    } finally {
      setLoading(false);
    }
  }
  function edit(project) {
    setEditingId(project._id);
    setForm({ name: project.name || "", key: project.key || "", description: project.description || "", color: project.color || "#7C3AED", status: project.status || "Active" });
  }
  async function remove() {
    setLoading(true);
    try {
      await api.delete(`/projects/${activeWorkspaceId}/${confirm.id}`);
      setConfirm(null);
      await reload();
      toast.success("Project deleted");
    } finally {
      setLoading(false);
    }
  }
  return <>
    <PageTitle icon={KanbanIcon} title="Projects" subtitle="Plan initiatives, assign leads, track status, and generate reports." />
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]"><Panel><div className="grid gap-3 md:grid-cols-2">{projects.map((project) => <ProjectCard key={project._id} project={project} onEdit={edit} onDelete={() => setConfirm({ id: project._id, label: project.name })} />)}</div></Panel><Panel><h2 className="mb-3 font-semibold">{editingId ? "Edit Project" : "Create Project"}</h2><Input required className="mb-3" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Input required className="mb-3" placeholder="Key" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} /><Select className="mb-3" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Planning</option><option>Active</option><option>Paused</option><option>Done</option></Select><Input className="mb-3" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /><Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><Button className="mt-3 w-full" onClick={create} disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}{editingId ? "Save Project" : "Create Project"}</Button>{editingId && <Button variant="ghost" className="mt-2 w-full" onClick={() => { setEditingId(""); setForm(emptyProjectForm); }}><X className="h-4 w-4" />Cancel</Button>}</Panel></div>
    <ConfirmModal item={confirm} loading={loading} onCancel={() => setConfirm(null)} onConfirm={remove} />
  </>;
}

function ProjectCard({ project, onEdit, onDelete }) {
  return <div className="aurora-border rounded-2xl bg-white/35 p-4 transition hover:-translate-y-1 hover:bg-violet-500/5 dark:bg-white/5"><div className="mb-3 flex items-center justify-between"><span className="h-3 w-3 rounded-full shadow-[0_0_16px_currentColor]" style={{ backgroundColor: project.color, color: project.color }} /><div className="flex items-center gap-2"><Badge>{project.status}</Badge><Button variant="ghost" onClick={() => onEdit(project)}><Edit3 className="h-4 w-4" /></Button><Button variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button></div></div><h3 className="font-semibold">{project.name}</h3><p className="mt-1 min-h-10 text-sm text-slate-500">{project.description}</p><div className="mt-4 text-xs text-slate-500">Lead: {project.lead?.name || "Unassigned"} - Due {project.dueDate ? format(new Date(project.dueDate), "MMM d") : "later"}</div></div>;
}

export function TasksPage() {
  const { activeWorkspaceId } = useAuth();
  const { data: tasks, setData: setTasks, reload } = useWorkspaceEndpoint((id) => `/tasks/${id}`);
  const { data: projects } = useWorkspaceEndpoint((id) => `/projects/${id}`);
  const { data: members } = useWorkspaceEndpoint((id) => `/team/${id}`);
  const { socket } = useSocket();
  const [form, setForm] = useState(emptyTaskForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [view, setView] = useState("board");
  const [filterPriority, setFilterPriority] = useState("All");
  const [query, setQuery] = useState("");
  useEffect(() => { if (!form.project && projects[0]) setForm((current) => ({ ...current, project: projects[0]._id })); }, [projects]);
  useEffect(() => { if (!form.assignee && members[0]) setForm((current) => ({ ...current, assignee: members[0]._id })); }, [members]);
  useEffect(() => {
    if (!socket) return;
    const upsertTask = (task) => setTasks((current) => [task, ...current.filter((item) => item._id !== task._id)]);
    const applyReorder = (items) => setTasks((current) => current.map((task) => {
      const update = items.find((item) => item.id === task._id);
      return update ? { ...task, status: update.status, order: update.order } : task;
    }));
    socket.on("task:created", upsertTask);
    socket.on("task:updated", upsertTask);
    socket.on("task:deleted", (task) => setTasks((current) => current.filter((item) => item._id !== task._id)));
    socket.on("task:reordered", applyReorder);
    return () => {
      socket.off("task:created", upsertTask);
      socket.off("task:updated", upsertTask);
      socket.off("task:deleted");
      socket.off("task:reordered", applyReorder);
    };
  }, [socket, setTasks]);
  async function create(status = form.status) {
    if (!form.title.trim()) {
      toast.error("Task title is required");
      return;
    }
    if (!form.project) return toast.error("Project is required");
    const payload = { ...form, dueDate: form.dueDate || null, status, assignees: form.assignee ? [form.assignee] : [], labels: form.labels.split(",").map((label) => label.trim()).filter(Boolean) };
    delete payload.assignee;
    setLoading(true);
    try {
      const { data } = editingId ? await api.patch(`/tasks/${activeWorkspaceId}/${editingId}`, payload) : await api.post(`/tasks/${activeWorkspaceId}`, payload);
      setTasks((current) => [data, ...current.filter((task) => task._id !== data._id)]);
      setForm({ ...form, title: "", description: "", labels: "" });
      setEditingId("");
      toast.success(editingId ? "Task updated" : "Task created");
    } finally {
      setLoading(false);
    }
  }
  function editTask(task) {
    setEditingId(task._id);
    setForm({ title: task.title || "", description: task.description || "", priority: task.priority || "P1", status: task.status || "To Do", labels: (task.labels || []).join(", "), project: task.project?._id || task.project || "", assignee: task.assignees?.[0]?._id || "", dueDate: task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : "" });
    document.getElementById("task-title-input")?.focus();
  }
  async function deleteTask() {
    setLoading(true);
    try {
      await api.delete(`/tasks/${activeWorkspaceId}/${confirm.id}`);
      setTasks((current) => current.filter((task) => task._id !== confirm.id));
      setConfirm(null);
      toast.success("Task deleted");
    } finally {
      setLoading(false);
    }
  }
  function selectColumn(status) {
    setForm((current) => ({ ...current, status }));
    document.getElementById("task-title-input")?.focus();
  }
  async function drag(result) {
    if (!result.destination) return;
    if (result.source.droppableId === result.destination.droppableId && result.source.index === result.destination.index) return;
    const moved = tasks.find((task) => task._id === result.draggableId);
    if (!moved) return;
    const columns = Object.fromEntries(statuses.map((status) => [
      status,
      tasks.filter((task) => task.status === status && task._id !== moved._id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    ]));
    columns[result.destination.droppableId].splice(result.destination.index, 0, { ...moved, status: result.destination.droppableId });
    const updated = statuses.flatMap((status) => columns[status].map((task, index) => ({ ...task, status, order: index })));
    setTasks(updated);
    try {
      await api.post(`/tasks/${activeWorkspaceId}/reorder`, { tasks: updated.map((task) => ({ id: task._id, status: task.status, order: task.order })) });
    } catch (error) {
      reload();
      toast.error("Task move could not be saved");
    }
  }
  async function changeStatus(task, status) {
    if (task.status === status) return;
    const order = tasks.filter((item) => item.status === status && item._id !== task._id).length;
    const previous = tasks;
    setTasks((current) => current.map((item) => item._id === task._id ? { ...item, status, order } : item));
    try {
      const { data } = await api.patch(`/tasks/${activeWorkspaceId}/${task._id}`, { status, order });
      setTasks((current) => current.map((item) => item._id === data._id ? data : item));
    } catch (error) {
      setTasks(previous);
      toast.error("Task status could not be saved");
    }
  }
  const visibleTasks = useMemo(() => tasks.filter((task) => {
    const matchesPriority = filterPriority === "All" || task.priority === filterPriority;
    const text = `${task.title} ${task.description || ""} ${task.project?.name || ""} ${task.labels?.join(" ") || ""}`.toLowerCase();
    return matchesPriority && text.includes(query.trim().toLowerCase());
  }), [tasks, filterPriority, query]);
  const boardStats = {
    total: visibleTasks.length,
    active: visibleTasks.filter((task) => !["Done"].includes(task.status)).length,
    urgent: visibleTasks.filter((task) => task.priority === "P0").length
  };
  return <>
    <PageTitle icon={KanbanIcon} title="Tasks" subtitle="Plan, prioritize, and move work through a clean product workflow." />
    <section className="mb-5 rounded-xl border border-[var(--line)] bg-white/78 p-4 shadow-[0_18px_55px_rgba(15,23,42,.08)] backdrop-blur-xl dark:bg-white/6 md:p-5">
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-[var(--line)] bg-white/70 p-3 dark:bg-white/5"><div className="text-xs font-semibold uppercase text-slate-500">Visible work</div><div className="mt-1 text-2xl font-black">{boardStats.total}</div></div>
        <div className="rounded-lg border border-[var(--line)] bg-white/70 p-3 dark:bg-white/5"><div className="text-xs font-semibold uppercase text-slate-500">Active</div><div className="mt-1 text-2xl font-black">{boardStats.active}</div></div>
        <div className="rounded-lg border border-[var(--line)] bg-white/70 p-3 dark:bg-white/5"><div className="text-xs font-semibold uppercase text-slate-500">Priority P0</div><div className="mt-1 text-2xl font-black text-rose-600 dark:text-rose-300">{boardStats.urgent}</div></div>
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(240px,1.3fr)_minmax(160px,.8fr)_minmax(160px,.8fr)_100px_140px_150px_minmax(140px,.8fr)_auto]">
        <Input id="task-title-input" placeholder="Task title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}>{projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</Select>
        <Select value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })}><option value="">Unassigned</option>{members.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}</Select>
        <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>P0</option><option>P1</option><option>P2</option></Select>
        <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{statuses.map((status) => <option key={status}>{status}</option>)}</Select>
        <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        <Input placeholder="Labels" value={form.labels} onChange={(e) => setForm({ ...form, labels: e.target.value })} />
        <Button className="whitespace-nowrap" onClick={() => create()} disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}{editingId ? "Save Task" : "Add Task"}</Button>
      </div>
      {editingId && <Button variant="ghost" className="mt-3" onClick={() => { setEditingId(""); setForm({ ...emptyTaskForm, project: projects[0]?._id || "", assignee: members[0]?._id || "" }); }}><X className="h-4 w-4" />Cancel Edit</Button>}
    </section>
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-white/70 p-3 backdrop-blur-xl dark:bg-white/5 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap gap-2">
        {[["board", "Board View", LayoutGrid], ["list", "List View", List], ["calendar", "Calendar View", Calendar]].map(([key, label, Icon]) => <button key={key} onClick={() => setView(key)} className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${view === key ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950" : "border-[var(--line)] bg-white/65 text-slate-600 hover:bg-white dark:bg-white/5 dark:text-slate-300"}`}><Icon className="h-4 w-4" />{label}</button>)}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 sm:w-72"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Search tasks" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <div className="relative sm:w-44"><Filter className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><Select className="pl-9" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}><option>All</option><option>P0</option><option>P1</option><option>P2</option></Select></div>
      </div>
    </div>
    {view === "board" && <DragDropContext onDragEnd={drag}><div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">{statuses.map((status) => {
      const columnTasks = visibleTasks.filter((task) => task.status === status).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return <Droppable droppableId={status} key={status}>{(drop, snapshot) => <section ref={drop.innerRef} {...drop.droppableProps} className={`flex min-w-0 flex-col overflow-hidden rounded-xl border bg-slate-50/80 shadow-[0_16px_44px_rgba(15,23,42,.07)] transition dark:bg-white/5 ${snapshot.isDraggingOver ? "border-teal-300 ring-4 ring-teal-400/15" : "border-[var(--line)]"}`}>
        <div className="flex items-center justify-between border-b border-[var(--line)] bg-white/70 px-4 py-3 dark:bg-white/5">
          <div><h2 className="font-semibold tracking-tight">{status}</h2><p className="text-xs text-slate-500">{columnTasks.length ? "Drag to reprioritize" : "Ready for new work"}</p></div>
          <span className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-carbon dark:text-slate-300">{columnTasks.length}</span>
        </div>
        <div className="p-3"><Button type="button" variant="ghost" className="w-full justify-center" onClick={() => selectColumn(status)}><Plus className="h-4 w-4" />Add Task</Button></div>
        <div className="min-h-40 flex-1 space-y-3 px-3 pb-3">
          {columnTasks.map((task, index) => <Draggable draggableId={task._id} index={index} key={task._id}>{(dragItem, dragSnapshot) => <div ref={dragItem.innerRef} {...dragItem.draggableProps} {...dragItem.dragHandleProps}><TaskCard task={task} onStatusChange={changeStatus} onEdit={editTask} onDelete={() => setConfirm({ id: task._id, label: task.title })} dragging={dragSnapshot.isDragging} /></div>}</Draggable>)}
          {drop.placeholder}
          {!columnTasks.length && <div className="rounded-lg border border-dashed border-[var(--line)] bg-white/60 p-6 text-center text-sm text-slate-500 dark:bg-white/5">No tasks in {status}</div>}
        </div>
      </section>}</Droppable>;
    })}</div></DragDropContext>}
    {view === "list" && <Panel><div className="space-y-2">{visibleTasks.map((task) => <TaskListRow key={task._id} task={task} onStatusChange={changeStatus} onEdit={editTask} onDelete={() => setConfirm({ id: task._id, label: task.title })} />)}</div></Panel>}
    {view === "calendar" && <Panel><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{statuses.map((status) => <div key={status}><div className="mb-2 text-sm font-semibold">{status}</div>{visibleTasks.filter((task) => task.status === status).map((task) => <TaskListRow key={task._id} task={task} onStatusChange={changeStatus} onEdit={editTask} onDelete={() => setConfirm({ id: task._id, label: task.title })} />)}</div>)}</div></Panel>}
    <ConfirmModal item={confirm} loading={loading} onCancel={() => setConfirm(null)} onConfirm={deleteTask} />
  </>;
}

function TaskCard({ task, onStatusChange, onEdit, onDelete, dragging = false }) {
  const assignee = task.assignees?.[0];
  return <motion.article layout className={`group rounded-xl border border-[var(--line)] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,.08)] transition duration-200 dark:bg-carbon/92 ${dragging ? "rotate-1 scale-[1.02] shadow-glow" : "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_42px_rgba(15,23,42,.12)] dark:hover:border-slate-600"}`}>
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <Badge tone={priorities[task.priority]}>{task.priority}</Badge>
        <span className="truncate rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-white/8">{task.project?.key || "TASK"}</span>
      </div>
      <div className="flex items-center gap-1 opacity-80 transition group-hover:opacity-100">
        <button type="button" aria-label="Edit task" onClick={(e) => { e.stopPropagation(); onEdit(task); }} className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/8 dark:hover:text-white"><Edit3 className="h-4 w-4" /></button>
        <button type="button" aria-label="Delete task" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
    <h3 className="line-clamp-2 text-[15px] font-bold leading-5 tracking-tight">{task.title}</h3>
    <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">{task.description || "No description added."}</p>
    <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">{task.labels?.slice(0, 3).map((label) => <Badge key={label}>{label}</Badge>)}</div>
    <Select className="mt-3 h-9 min-h-9 rounded-md text-xs font-semibold" value={task.status} onChange={(e) => onStatusChange(task, e.target.value)} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>{statuses.map((status) => <option key={status}>{status}</option>)}</Select>
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3 text-xs text-slate-500">
      <div className="flex min-w-0 items-center gap-2"><Avatar user={assignee} /><span className="truncate">{assignee?.name || "Unassigned"}</span></div>
      <div className="flex shrink-0 items-center gap-3"><span>{task.dueDate ? format(new Date(task.dueDate), "MMM d") : "No date"}</span><span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{task.comments?.length || 0}</span></div>
    </div>
  </motion.article>;
}

function TaskListRow({ task, onStatusChange, onEdit, onDelete }) {
  return <div className="mb-2 grid gap-3 rounded-xl border border-[var(--line)] bg-white/78 p-3 text-sm shadow-[0_8px_24px_rgba(15,23,42,.05)] transition hover:bg-white dark:bg-white/5 md:grid-cols-[1fr_120px_160px_120px_96px] md:items-center"><div><div className="font-semibold">{task.title}</div><div className="text-xs text-slate-500">{task.project?.name || "No project"}</div></div><Badge tone={priorities[task.priority]}>{task.priority}</Badge><Select value={task.status} onChange={(e) => onStatusChange(task, e.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</Select><div className="text-xs text-slate-500">{task.dueDate ? format(new Date(task.dueDate), "MMM d") : "No date"}</div><div className="flex gap-2"><Button variant="ghost" onClick={() => onEdit(task)}><Edit3 className="h-4 w-4" /></Button><Button variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button></div></div>;
}

function Avatar({ user }) {
  const initials = user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";
  return <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full aurora-gradient text-[10px] font-bold text-white">{user?.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : initials}</span>;
}

export function CalendarPage() {
  const { activeWorkspaceId } = useAuth();
  const { data: tasks, setData: setTasks } = useWorkspaceEndpoint((id) => `/tasks/${id}`);
  const { data: projects } = useWorkspaceEndpoint((id) => `/projects/${id}`);
  const { data: members } = useWorkspaceEndpoint((id) => `/team/${id}`);
  const { socket } = useSocket();
  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ project: "All", assignee: "All", priority: "All", status: "All" });

  useEffect(() => {
    if (!socket) return;
    const upsertTask = (task) => setTasks((current) => [task, ...current.filter((item) => item._id !== task._id)]);
    socket.on("task:created", upsertTask);
    socket.on("task:updated", upsertTask);
    socket.on("task:deleted", (task) => setTasks((current) => current.filter((item) => item._id !== task._id)));
    socket.on("task:reordered", (items) => setTasks((current) => current.map((task) => {
      const update = items.find((item) => item.id === task._id);
      return update ? { ...task, status: update.status, order: update.order } : task;
    })));
    return () => {
      socket.off("task:created", upsertTask);
      socket.off("task:updated", upsertTask);
      socket.off("task:deleted");
      socket.off("task:reordered");
    };
  }, [socket, setTasks]);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const assigneeIds = task.assignees?.map((assignee) => assignee._id || assignee) || [];
    return task.dueDate
      && (filters.project === "All" || (task.project?._id || task.project) === filters.project)
      && (filters.assignee === "All" || assigneeIds.includes(filters.assignee))
      && (filters.priority === "All" || task.priority === filters.priority)
      && (filters.status === "All" || task.status === filters.status);
  }), [tasks, filters]);

  const visibleDays = useMemo(() => {
    if (view === "day") return [cursor];
    const start = view === "week" ? startOfWeek(cursor) : startOfWeek(startOfMonth(cursor));
    const end = view === "week" ? endOfWeek(cursor) : endOfWeek(endOfMonth(cursor));
    const days = [];
    for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
    return days;
  }, [cursor, view]);

  const selectedTasks = filteredTasks.filter((task) => isSameDay(new Date(task.dueDate), selectedDate));
  const overdueTasks = filteredTasks.filter((task) => new Date(task.dueDate) < new Date() && task.status !== "Done");
  useEffect(() => {
    if (!taskForm.project && projects[0]) setTaskForm((current) => ({ ...current, project: projects[0]._id }));
  }, [projects]);
  useEffect(() => {
    if (!taskForm.assignee && members[0]) setTaskForm((current) => ({ ...current, assignee: members[0]._id }));
  }, [members]);
  function move(step) {
    if (view === "month") setCursor((date) => step > 0 ? addMonths(date, 1) : subMonths(date, 1));
    if (view === "week") setCursor((date) => step > 0 ? addWeeks(date, 1) : subWeeks(date, 1));
    if (view === "day") setCursor((date) => addDays(date, step));
  }
  function startCreate(date = selectedDate) {
    setSelectedDate(date);
    setEditingId("");
    setSelectedTask(null);
    setTaskForm({ ...emptyTaskForm, project: projects[0]?._id || "", assignee: members[0]?._id || "", dueDate: format(date, "yyyy-MM-dd") });
    document.getElementById("calendar-task-title")?.focus();
  }
  export function TeamPage() {
    const { activeWorkspaceId } = useAuth();
    const { data: members, reload } = useWorkspaceEndpoint((id) => `/team/${id}`);
    const { online, socket } = useSocket();
    const [invite, setInvite] = useState({ email: "", role: "Member" });
    const [link, setLink] = useState("");
    const [loading, setLoading] = useState(false);
    const [confirm, setConfirm] = useState(null);

    async function sendInvite() {
      if (!invite.email.trim()) return toast.error("Enter an email address");
      setLoading(true);
      try {
        const { data } = await api.post(`/workspaces/${activeWorkspaceId}/invites`, invite);
        setLink(data.inviteUrl);
        toast.success(data.delivery?.status === "sent" ? "Invitation email sent" : "Invite link created");
      } finally {
        setLoading(false);
      }
    }

    async function createShareLink() {
      setLoading(true);
      try {
        const { data } = await api.post(`/workspaces/${activeWorkspaceId}/invites/link`, { role: invite.role });
        setLink(data.inviteUrl);
        toast.success("Shareable invite link created");
      } finally {
        setLoading(false);
      }
    }

    async function changeRole(member, role) {
      await api.patch(`/workspaces/${activeWorkspaceId}/members/${member._id}`, { role });
      await reload();
      toast.success("Role updated");
    }

    async function remove() {
      setLoading(true);
      try {
        await api.delete(`/workspaces/${activeWorkspaceId}/members/${confirm.id}`);
        setConfirm(null);
        await reload();
        toast.success("Member removed");
      } finally {
        setLoading(false);
      }
    }

    useEffect(() => {
      if (!socket) return;
      socket.on("member:joined", reload);
      socket.on("invite:created", reload);
      return () => {
        socket.off("member:joined", reload);
        socket.off("invite:created", reload);
      };
    }, [socket, reload]);

    const onlineIds = new Set(online.map((member) => member._id));

    return <>
      <PageTitle icon={Users} title="Team Members" subtitle="Profiles, roles, presence, skills, and account links." action={<Button onClick={sendInvite} disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}Invite</Button>} />
      <Panel className="mb-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto_auto]">
          <Input required type="email" placeholder="Email address" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
          <Select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}><option>Admin</option><option>Member</option><option>Viewer</option></Select>
          <Button onClick={sendInvite} disabled={loading}><Mail className="h-4 w-4" />Send Email Invite</Button>
          <Button variant="ghost" onClick={createShareLink} disabled={loading}><Copy className="h-4 w-4" />Share Link</Button>
        </div>
        {link && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-900"><span>Invite link:</span><a className="font-semibold text-violet-600" href={link}>{link}</a><Button variant="ghost" onClick={() => navigator.clipboard?.writeText(link)}>Copy</Button></div>}
      </Panel>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {members.map((member) => (
          <Panel key={member._id}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <Avatar user={member} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{member.name}</span>
                    <span className={`h-2 w-2 rounded-full ${onlineIds.has(member._id) ? "bg-emerald-400" : "bg-slate-300"}`} />
                  </div>
                  <div className="text-xs text-slate-400">{onlineIds.has(member._id) ? "Online now" : member.lastSeenAt ? `Last seen ${timeAgo(member.lastSeenAt)}` : "Offline"}</div>
                </div>
              </div>
              <Select className="w-32" value={member.role} onChange={(e) => changeRole(member, e.target.value)}>
                <option>Owner</option>
                <option>Admin</option>
                <option>Member</option>
                <option>Viewer</option>
              </Select>
            </div>
            <p className="mt-3 min-h-10 text-sm text-slate-500">{member.bio || "No bio added."}</p>
            <div className="mt-3 flex flex-wrap gap-1">{member.skills?.map((skill) => <Badge key={skill}>{skill}</Badge>)}</div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="text-xs text-slate-500">{member.email}</div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setConfirm({ id: member._id, label: member.name })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <ConfirmModal item={confirm} loading={loading} onCancel={() => setConfirm(null)} onConfirm={remove} />
    </>;
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Select value={filters.project} onChange={(e) => setFilters({ ...filters, project: e.target.value })}><option>All</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</Select>
        <Select value={filters.assignee} onChange={(e) => setFilters({ ...filters, assignee: e.target.value })}><option>All</option>{members.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}</Select>
        <Select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}><option>All</option><option>P0</option><option>P1</option><option>P2</option></Select>
        <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option>All</option>{statuses.map((status) => <option key={status}>{status}</option>)}</Select>
      </div>
    </Panel>
    <Panel className="mb-4">
      <h2 className="mb-3 font-semibold">{editingId ? "Edit Calendar Task" : `Create Task for ${format(selectedDate, "MMM d")}`}</h2>
      <div className="grid gap-3 xl:grid-cols-[minmax(220px,1.2fr)_minmax(160px,.8fr)_minmax(140px,.7fr)_100px_130px_150px_minmax(140px,.8fr)_auto]">
        <Input id="calendar-task-title" placeholder="Task title" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
        <Select value={taskForm.project} onChange={(e) => setTaskForm({ ...taskForm, project: e.target.value })}>{projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</Select>
        <Select value={taskForm.assignee} onChange={(e) => setTaskForm({ ...taskForm, assignee: e.target.value })}><option value="">Unassigned</option>{members.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}</Select>
        <Select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}><option>P0</option><option>P1</option><option>P2</option></Select>
        <Select value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}>{statuses.map((status) => <option key={status}>{status}</option>)}</Select>
        <Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
        <Input placeholder="Labels" value={taskForm.labels} onChange={(e) => setTaskForm({ ...taskForm, labels: e.target.value })} />
        <Button onClick={saveCalendarTask} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{editingId ? "Save" : "Add"}</Button>
      </div>
      <Textarea className="mt-3 min-h-20" placeholder="Description" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
      {editingId && <Button variant="ghost" className="mt-3" onClick={() => { setEditingId(""); setTaskForm({ ...emptyTaskForm, project: projects[0]?._id || "", assignee: members[0]?._id || "", dueDate: format(selectedDate, "yyyy-MM-dd") }); }}><X className="h-4 w-4" />Cancel Edit</Button>}
    </Panel>
    {!!overdueTasks.length && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-sm text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-200"><div className="mb-2 flex items-center gap-2 font-semibold"><AlertCircle className="h-4 w-4" />Overdue tasks</div><div className="flex flex-wrap gap-2">{overdueTasks.slice(0, 8).map((task) => <button key={task._id} onClick={() => setSelectedTask(task)} className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold dark:bg-white/10">{task.title}</button>)}</div></div>}
    <div className={`grid gap-3 ${view === "day" ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-7"}`}>
      {visibleDays.map((day) => {
        const dayTasks = filteredTasks.filter((task) => isSameDay(new Date(task.dueDate), day));
        return <button key={day.toISOString()} onClick={() => startCreate(day)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const task = tasks.find((item) => item._id === event.dataTransfer.getData("text/task-id")); if (task) moveTaskToDate(task, day); }} className={`min-h-36 rounded-xl border p-3 text-left transition hover:bg-white dark:hover:bg-white/8 ${isSameDay(day, selectedDate) ? "border-slate-950 bg-white shadow-[0_12px_30px_rgba(15,23,42,.08)] dark:border-white dark:bg-white/8" : "border-[var(--line)] bg-white/55 dark:bg-white/5"} ${view === "month" && !isSameMonth(day, cursor) ? "opacity-45" : ""}`}>
          <div className="mb-2 flex items-center justify-between"><span className={`text-sm font-bold ${isToday(day) ? "rounded-full bg-slate-950 px-2 py-1 text-white dark:bg-white dark:text-slate-950" : ""}`}>{format(day, view === "month" ? "d" : "EEE, MMM d")}</span><span className="text-xs text-slate-500">{dayTasks.length}</span></div>
          <div className="space-y-2">{dayTasks.slice(0, view === "month" ? 3 : 12).map((task) => <div key={task._id} draggable onDragStart={(event) => event.dataTransfer.setData("text/task-id", task._id)} onClick={(event) => { event.stopPropagation(); setSelectedTask(task); }} className="rounded-lg border border-[var(--line)] bg-white/80 p-2 text-xs shadow-sm dark:bg-carbon/80"><div className="mb-1 flex items-center gap-1"><Badge tone={priorities[task.priority]}>{task.priority}</Badge><span className="truncate font-semibold">{task.project?.key || "TASK"}</span></div><div className="line-clamp-2 font-medium">{task.title}</div></div>)}</div>
        </button>;
      })}
    </div>
    <Panel className="mt-4">
      <h2 className="mb-3 font-semibold">Tasks on {format(selectedDate, "MMMM d, yyyy")}</h2>
      {selectedTasks.length ? <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{selectedTasks.map((task) => <button key={task._id} onClick={() => setSelectedTask(task)} className="rounded-xl border border-[var(--line)] bg-white/70 p-3 text-left text-sm transition hover:bg-white dark:bg-white/5 dark:hover:bg-white/8"><div className="mb-2 flex items-center gap-2"><Badge tone={priorities[task.priority]}>{task.priority}</Badge><span className="text-xs font-semibold text-slate-500">{task.status}</span></div><div className="font-semibold">{task.title}</div><div className="mt-1 text-xs text-slate-500">{task.project?.name || "No project"}</div></button>)}</div> : <Empty title="No tasks scheduled for this date." />}
    </Panel>
    {selectedTask && <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/55 p-4 backdrop-blur-sm" onMouseDown={() => setSelectedTask(null)}>
      <div className="glass-card w-full max-w-lg rounded-2xl p-5" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3"><div><Badge tone={priorities[selectedTask.priority]}>{selectedTask.priority}</Badge><h2 className="mt-2 text-xl font-bold">{selectedTask.title}</h2><p className="mt-1 text-sm text-slate-500">{selectedTask.project?.name || "No project"} - {selectedTask.status}</p></div><Button variant="ghost" onClick={() => setSelectedTask(null)}><X className="h-4 w-4" /></Button></div>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{selectedTask.description || "No description added."}</p>
        <div className="mt-4 flex flex-wrap gap-2">{selectedTask.labels?.map((label) => <Badge key={label}>{label}</Badge>)}</div>
        <div className="mt-4 text-sm text-slate-500">Due {selectedTask.dueDate ? format(new Date(selectedTask.dueDate), "MMMM d, yyyy") : "No due date"}</div>
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => startEdit(selectedTask)}><Edit3 className="h-4 w-4" />Edit</Button><Button variant="ghost" onClick={() => setSelectedTask(null)}>Close</Button></div>
      </div>
    </div>}
  </>;
}

export function DocsPage() {
  const { activeWorkspaceId } = useAuth();
  const { data: pages, reload } = useWorkspaceEndpoint((id) => `/docs/${id}`);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState({ title: "", content: "" });
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  useEffect(() => { if (!selected && pages[0]) { setSelected(pages[0]); setDraft(pages[0]); } }, [pages]);
  async function save() {
    if (!draft.title?.trim()) return toast.error("Page title is required");
    setLoading(true);
    try {
      const { data } = selected?._id ? await api.patch(`/docs/${activeWorkspaceId}/${selected._id}`, draft) : await api.post(`/docs/${activeWorkspaceId}`, draft);
      setSelected(data);
      setDraft(data);
      await reload();
      toast.success("Page saved");
    } finally {
      setLoading(false);
    }
  }
  async function remove() {
    setLoading(true);
    try {
      await api.delete(`/docs/${activeWorkspaceId}/${confirm.id}`);
      setConfirm(null);
      setSelected(null);
      setDraft({ title: "", content: "" });
      await reload();
      toast.success("Page deleted");
    } finally {
      setLoading(false);
    }
  }
  async function restore(index) {
    if (!selected?._id) return;
    setLoading(true);
    try {
      const { data } = await api.post(`/docs/${activeWorkspaceId}/${selected._id}/restore/${index}`);
      setSelected(data);
      setDraft(data);
      await reload();
      toast.success("Version restored");
    } finally {
      setLoading(false);
    }
  }
  return <><PageTitle icon={BookOpen} title="Documentation Wiki" subtitle="Nested pages, rich markdown editing, linked docs, tables, code blocks, images, and version restore." action={<Button onClick={() => { setSelected(null); setDraft({ title: "Untitled Page", content: "# Untitled Page\n\n" }); }}><Plus className="h-4 w-4" />New Page</Button>} /><div className="grid gap-4 lg:grid-cols-[280px_1fr]"><Panel><div className="space-y-2">{pages.map((page) => <div key={page._id} className="flex items-center gap-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-900"><button onClick={() => { setSelected(page); setDraft(page); }} className="block min-w-0 flex-1 px-2 py-2 text-left text-sm">{page.parent ? "  " : ""}{page.title}</button><button type="button" className="p-2 text-slate-500" onClick={() => setConfirm({ id: page._id, label: page.title })}><Trash2 className="h-4 w-4" /></button></div>)}</div></Panel><div className="grid gap-4 xl:grid-cols-2"><Panel><Input required className="mb-3" value={draft.title || ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /><Textarea className="min-h-96 font-mono" value={draft.content || ""} onChange={(e) => setDraft({ ...draft, content: e.target.value })} /><div className="mt-3 flex gap-2"><Button onClick={save} disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}Save Page</Button>{selected?._id && <Button variant="ghost" onClick={() => setConfirm({ id: selected._id, label: selected.title })}><Trash2 className="h-4 w-4" />Delete</Button>}</div></Panel><Panel><h2 className="mb-3 font-semibold">Preview</h2><div className="prose prose-slate max-w-none dark:prose-invert"><ReactMarkdown>{draft.content || ""}</ReactMarkdown></div><h3 className="mt-6 font-semibold">Version History</h3><div className="mt-2 space-y-2 text-sm">{draft.versionHistory?.map((version, index) => <div key={index} className="flex items-center justify-between rounded-md border border-slate-200 p-2 dark:border-slate-800"><span>{version.message} - {timeAgo(version.createdAt)}</span><Button variant="ghost" onClick={() => restore(index)}>Restore</Button></div>)}</div></Panel></div></div><ConfirmModal item={confirm} loading={loading} onCancel={() => setConfirm(null)} onConfirm={remove} /></>;
}

export function SnippetsPage() {
  const { activeWorkspaceId } = useAuth();
  const { data: snippets, reload } = useWorkspaceEndpoint((id) => `/snippets/${id}`);
  const [form, setForm] = useState(emptySnippetForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  async function save() {
    if (!form.title.trim()) return toast.error("Snippet title is required");
    if (!form.code.trim()) return toast.error("Snippet code is required");
    setLoading(true);
    try {
      const payload = { ...form, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean) };
      if (editingId) await api.patch(`/snippets/${activeWorkspaceId}/${editingId}`, payload);
      else await api.post(`/snippets/${activeWorkspaceId}`, payload);
      setForm(emptySnippetForm);
      setEditingId("");
      await reload();
      toast.success(editingId ? "Snippet updated" : "Snippet created");
    } finally {
      setLoading(false);
    }
  }
  async function copy(snippet) {
    await navigator.clipboard.writeText(snippet.code);
    await api.post(`/snippets/${activeWorkspaceId}/${snippet._id}/copy`);
    toast.success("Snippet copied");
  }
  function edit(snippet) {
    setEditingId(snippet._id);
    setForm({ title: snippet.title || "", language: snippet.language || "javascript", description: snippet.description || "", tags: (snippet.tags || []).join(", "), code: snippet.code || "" });
  }
  async function remove() {
    setLoading(true);
    try {
      await api.delete(`/snippets/${activeWorkspaceId}/${confirm.id}`);
      setConfirm(null);
      await reload();
      toast.success("Snippet deleted");
    } finally {
      setLoading(false);
    }
  }
  return <><PageTitle icon={Code2} title="Code Snippets" subtitle="Save, tag, search, edit, copy, and share reusable code." /><div className="grid gap-4 xl:grid-cols-[1fr_420px]"><Panel><div className="grid gap-3 md:grid-cols-2">{snippets.map((snippet) => <div key={snippet._id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">{snippet.title}</h3><div className="flex items-center gap-2"><Badge>{snippet.language}</Badge><Button variant="ghost" onClick={() => edit(snippet)}><Edit3 className="h-4 w-4" /></Button><Button variant="ghost" onClick={() => setConfirm({ id: snippet._id, label: snippet.title })}><Trash2 className="h-4 w-4" /></Button></div></div><p className="text-sm text-slate-500">{snippet.description}</p><pre className="thin-scroll mt-3 max-h-44 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100"><code>{snippet.code}</code></pre><div className="mt-3 flex items-center justify-between"><div className="flex flex-wrap gap-1">{snippet.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div><Button variant="ghost" onClick={() => copy(snippet)}><Copy className="h-4 w-4" />Copy</Button></div></div>)}</div></Panel><Panel><h2 className="mb-3 font-semibold">{editingId ? "Edit Snippet" : "New Snippet"}</h2><Input required className="mb-3" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><Select className="mb-3" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}><option value="javascript">JavaScript</option><option value="python">Python</option><option value="java">Java</option><option value="cpp">C++</option><option value="go">Go</option></Select><Input className="mb-3" placeholder="Tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /><Textarea required placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /><Button className="mt-3 w-full" onClick={save} disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}Save Snippet</Button>{editingId && <Button variant="ghost" className="mt-2 w-full" onClick={() => { setEditingId(""); setForm(emptySnippetForm); }}><X className="h-4 w-4" />Cancel</Button>}</Panel></div><ConfirmModal item={confirm} loading={loading} onCancel={() => setConfirm(null)} onConfirm={remove} /></>;
}

export function AiAssistantPage() {
  const { activeWorkspaceId } = useAuth();
  const [mode, setMode] = useState("summary");
  const [prompt, setPrompt] = useState("Summarize current project health and blockers.");
  const [answer, setAnswer] = useState("");
  async function ask() {
    const { data } = await api.post(`/ai/${activeWorkspaceId}/assistant`, { mode, prompt });
    setAnswer(data.answer);
  }
  return <AiPanel icon={Bot} title="AI Assistant" subtitle="Summaries, standups, blocker detection, task breakdowns, workspace Q&A, and insights." controls={<><Select value={mode} onChange={(e) => setMode(e.target.value)}><option value="summary">Project Summary</option><option value="standup">Standup Report</option><option value="breakdown">Feature Breakdown</option><option value="blockers">Blocker Analysis</option></Select><Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} /><Button onClick={ask}><Send className="h-4 w-4" />Ask Gemini</Button></>} answer={answer} />;
}

export function AiSearchPage() {
  const { activeWorkspaceId } = useAuth();
  const [question, setQuestion] = useState("Which P0 tasks are still open?");
  const [answer, setAnswer] = useState("");
  async function ask() {
    const { data } = await api.post(`/search/${activeWorkspaceId}/ai`, { question });
    setAnswer(data.answer);
  }
  return <AiPanel icon={Search} title="AI Search" subtitle="Ask workspace-wide questions over projects, tasks, docs, snippets, and activities." controls={<><Textarea value={question} onChange={(e) => setQuestion(e.target.value)} /><Button onClick={ask}><Search className="h-4 w-4" />Search with AI</Button></>} answer={answer} />;
}

export function AiCodeReviewPage() {
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("function save(input) {\n  document.body.innerHTML = input\n}");
  const [review, setReview] = useState("");
  async function submit() {
    const { data } = await api.post("/ai/code-review", { language, code });
    setReview(data.review);
  }
  return <AiPanel icon={ShieldCheck} title="AI Code Review" subtitle="Bug detection, performance suggestions, security analysis, code quality scores, and fixes." controls={<><Select value={language} onChange={(e) => setLanguage(e.target.value)}><option>javascript</option><option>python</option><option>java</option><option>cpp</option><option>go</option></Select><Textarea className="min-h-72 font-mono" value={code} onChange={(e) => setCode(e.target.value)} /><Button onClick={submit}><ShieldCheck className="h-4 w-4" />Review Code</Button></>} answer={review} />;
}

function AiPanel({ icon, title, subtitle, controls, answer }) {
  const Icon = icon;
  return <><PageTitle icon={Icon} title={title} subtitle={subtitle} /><div className="grid gap-4 lg:grid-cols-[420px_1fr]"><Panel><div className="space-y-3">{controls}</div></Panel><Panel><h2 className="mb-3 font-semibold">Result</h2><pre className="whitespace-pre-wrap text-sm leading-6">{answer || "Run a request to generate analysis."}</pre></Panel></div></>;
}

export function ActivityPage() {
  const { data } = useWorkspaceEndpoint((id) => `/activity/${id}`);
  return <><PageTitle icon={Activity} title="Activity Feed" subtitle="Workspace updates, project events, task changes, mentions, and collaboration history." /><Panel><ActivityList items={data} empty="No activity yet." /></Panel></>;
}

function ActivityList({ items, empty }) {
  if (!items?.length) return <Empty title={empty} />;
  return <div className="space-y-3">{items.map((item) => <div key={item._id || item.createdAt} className="flex gap-3 rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800"><div className="mt-1 h-2 w-2 rounded-full bg-teal-600" /><div><div><span className="font-medium">{item.actor?.name || "System"}</span> {item.message}</div><div className="text-xs text-slate-500">{timeAgo(item.createdAt)}</div></div></div>)}</div>;
}

export function TeamPage() {
  const { activeWorkspaceId } = useAuth();
  const { data: members, reload } = useWorkspaceEndpoint((id) => `/team/${id}`);
  const { online, socket } = useSocket();
  const [invite, setInvite] = useState({ email: "", role: "Member" });
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  async function sendInvite() {
    if (!invite.email.trim()) return toast.error("Enter an email address");
    setLoading(true);
    try {
      const { data } = await api.post(`/workspaces/${activeWorkspaceId}/invites`, invite);
      setLink(data.inviteUrl);
      toast.success(data.delivery?.status === "sent" ? "Invitation email sent" : "Invite link created");
    } finally {
      setLoading(false);
    }
  }
  async function createShareLink() {
    setLoading(true);
    try {
      const { data } = await api.post(`/workspaces/${activeWorkspaceId}/invites/link`, { role: invite.role });
      setLink(data.inviteUrl);
      toast.success("Shareable invite link created");
    } finally {
      setLoading(false);
    }
  }
  async function changeRole(member, role) {
    await api.patch(`/workspaces/${activeWorkspaceId}/members/${member._id}`, { role });
    await reload();
    toast.success("Role updated");
  }
  async function remove() {
    setLoading(true);
    try {
      await api.delete(`/workspaces/${activeWorkspaceId}/members/${confirm.id}`);
      setConfirm(null);
      await reload();
      toast.success("Member removed");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!socket) return;
    socket.on("member:joined", reload);
    socket.on("invite:created", reload);
    return () => {
      socket.off("member:joined", reload);
      socket.off("invite:created", reload);
    };
  }, [socket, reload]);
  const onlineIds = new Set(online.map((member) => member._id));
  return <><PageTitle icon={Users} title="Team Members" subtitle="Profiles, roles, presence, skills, and account links." action={<Button onClick={sendInvite} disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}Invite</Button>} /><Panel className="mb-4"><div className="grid gap-3 md:grid-cols-[1fr_180px_auto_auto]"><Input required type="email" placeholder="Email address" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /><Select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}><option>Admin</option><option>Member</option><option>Viewer</option></Select><Button onClick={sendInvite} disabled={loading}><Mail className="h-4 w-4" />Send Email Invite</Button><Button variant="ghost" onClick={createShareLink} disabled={loading}><Copy className="h-4 w-4" />Share Link</Button></div>{link && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-900"><span>Invite link:</span><a className="font-semibold text-violet-600" href={link}>{link}</a><Button variant="ghost" onClick={() => navigator.clipboard?.writeText(link)}>Copy</Button></div>}</Panel><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{members.map((member) => <Panel key={member._id}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><Avatar user={member} /><div><div className="flex items-center gap-2 font-semibold">{member.name}<span className={`h-2 w-2 rounded-full ${onlineIds.has(member._id) ? "bg-emerald-400" : "bg-slate-300"}`} /></div><div className="text-xs text-slate-400">{onlineIds.has(member._id) ? "Online now" : member.lastSeenAt ? `Last seen ${timeAgo(member.lastSeenAt)}` : "Offline"}</div></div></div><Select className="w-32" value={member.role} onChange={(e) => changeRole(member, e.target.value)}><option>Owner</option><option>Admin</option><option>Member</option><option>Viewer</option></Select></div><p className="mt-3 min-h-10 text-sm text-slate-500">{member.bio || "No bio added."}</p><div className="mt-3 flex flex-wrap gap-1">{member.skills?.map((skill) => <Badge key={skill}>{skill}</Badge>)}</div><div className="mt-4 flex flex-wrap gap-2 text-sm">{member.github && <a className="inline-flex items-center gap-1 font-semibold text-violet-600" href={member.github} target="_blank" rel="noreferrer"><Github className="h-4 w-4" />GitHub</a>}{member.linkedin && <a className="inline-flex items-center gap-1 font-semibold text-violet-600" href={member.linkedin} target="_blank" rel="noreferrer"><Linkedin className="h-4 w-4" />LinkedIn</a>}</div><Button variant="ghost" className="mt-4 w-full" onClick={() => setConfirm({ id: member._id, label: member.name })}><Trash2 className="h-4 w-4" />Remove</Button></Panel>)}</div><ConfirmModal item={confirm} loading={loading} onCancel={() => setConfirm(null)} onConfirm={remove} /></>;
}

export function NotificationsPage() {
  const { data: notifications, reload } = useWorkspaceEndpoint(() => "/notifications");
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    socket.on("notification:new", reload);
    return () => socket.off("notification:new", reload);
  }, [socket, reload]);
  async function markRead(id) {
    await api.patch(`/notifications/${id}/read`);
    reload();
  }
  return <><PageTitle icon={Bell} title="Notifications" subtitle="Invitations, task assignments, comments, mentions, project updates, and workspace updates." /><Panel>{notifications.length ? <div className="space-y-2">{notifications.map((notification) => <div key={notification._id} className={`flex items-center justify-between gap-3 rounded-md border p-3 dark:border-slate-800 ${notification.readAt ? "border-slate-200 opacity-70" : "border-violet-300 bg-violet-500/5"}`}><div><div className="flex items-center gap-2 font-medium"><Badge>{notification.type}</Badge>{notification.title}</div><div className="mt-1 text-sm text-slate-500">{notification.body}</div>{notification.link && <a className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-violet-600" href={notification.link}>Open <ExternalLink className="h-3 w-3" /></a>}</div><Button variant="ghost" onClick={() => markRead(notification._id)}>{notification.readAt ? <Check className="h-4 w-4" /> : "Mark read"}</Button></div>)}</div> : <Empty title="No notifications yet." />}</Panel></>;
}

export function ReportsPage() {
  const { activeWorkspaceId } = useAuth();
  const { data: projects } = useWorkspaceEndpoint((id) => `/projects/${id}`);
  const [report, setReport] = useState(null);
  async function load(projectId) {
    const { data } = await api.get(`/projects/${activeWorkspaceId}/${projectId}/report`);
    setReport(data);
  }
  return <><PageTitle icon={Clipboard} title="Presentations/Project Reports" subtitle="Generate executive-ready project health reports from live work." /><div className="grid gap-4 lg:grid-cols-[320px_1fr]"><Panel><div className="space-y-2">{projects.map((project) => <Button key={project._id} variant="ghost" className="w-full justify-start" onClick={() => load(project._id)}>{project.name}</Button>)}</div></Panel><Panel>{report ? <div><h2 className="text-lg font-semibold">{report.project.name}</h2><div className="mt-3 grid gap-3 md:grid-cols-3"><Metric label="Tasks" value={report.summary.totalTasks} /><Metric label="Done" value={report.summary.done} /><Metric label="Completion" value={`${report.summary.completion}%`} /></div><h3 className="mt-5 font-semibold">Blockers</h3><div className="mt-2 space-y-2">{report.summary.blockers.map((task) => <TaskLine key={task._id} task={task} />)}</div></div> : "Select a project to generate a report."}</Panel></div></>;
}

function TaskLine({ task }) {
  return <div className="rounded-md border border-slate-200 p-2 text-sm dark:border-slate-800"><Badge tone={priorities[task.priority]}>{task.priority}</Badge> <span className="ml-2">{task.title}</span></div>;
}

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState(user);
  async function save() {
    const { data } = await api.patch("/auth/profile", form);
    setUser(data);
    toast.success("Profile updated");
  }
  return <><PageTitle icon={Users} title="User Profile" subtitle="Avatar, bio, skills, social links, security, and notification preferences." /><Panel className="max-w-3xl"><div className="grid gap-3 md:grid-cols-2"><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Input value={form.avatar || ""} placeholder="Avatar URL" onChange={(e) => setForm({ ...form, avatar: e.target.value })} /><Input value={form.github || ""} placeholder="GitHub link" onChange={(e) => setForm({ ...form, github: e.target.value })} /><Input value={form.linkedin || ""} placeholder="LinkedIn link" onChange={(e) => setForm({ ...form, linkedin: e.target.value })} /></div><Textarea className="mt-3" value={form.bio || ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} /><Input className="mt-3" value={(form.skills || []).join(", ")} onChange={(e) => setForm({ ...form, skills: e.target.value.split(",").map((skill) => skill.trim()) })} /><Button className="mt-3" onClick={save}>Save Profile</Button></Panel></>;
}

export function SettingsPage() {
  const { user, setUser } = useAuth();
  const [preferences, setPreferences] = useState(user.preferences || {});
  async function save() {
    const { data } = await api.patch("/auth/profile", { preferences });
    setUser(data);
    // Apply theme preference immediately
    const theme = preferences.theme || "system";
    if (theme === "dark") document.documentElement.classList.add("dark");
    else if (theme === "light") document.documentElement.classList.remove("dark");
    else {
      const isDark = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", isDark);
    }
    localStorage.setItem("codesphere_theme", theme);
    toast.success("Settings saved");
  }
  return <><PageTitle icon={Settings} title="Settings" subtitle="Personal preferences, notification rules, security settings, and account management." /><Panel className="max-w-xl"><Select className="mb-3" value={preferences.theme || "system"} onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}><option value="system">System theme</option><option value="light">Light</option><option value="dark">Dark</option></Select>{["emailNotifications", "pushNotifications", "weeklyDigest"].map((key) => <label key={key} className="mb-3 flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800"><span>{key.replace(/([A-Z])/g, " $1")}</span><input type="checkbox" checked={Boolean(preferences[key])} onChange={(e) => setPreferences({ ...preferences, [key]: e.target.checked })} /></label>)}<Button onClick={save}>Save Settings</Button></Panel></>;
}

export function BillingPage() {
  const { user, setUser } = useAuth();
  const [billing, setBilling] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const [paymentMethod, setPaymentMethod] = useState("razorpay");
  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);

  useEffect(() => {
    api.get("/billing")
      .then(({ data }) => setBilling(data))
      .catch(() => {
        toast.error("Failed to load billing details");
        setBilling({
          plans: [
            { 
              id: "free", 
              name: "Free", 
              price: 0, 
              monthlyPrice: 0,
              yearlyPrice: 0,
              limits: ["2 workspaces", "5 projects per workspace", "5 members"], 
              features: ["Tasks", "Docs", "Snippets", "Realtime collaboration"] 
            },
            { 
              id: "pro", 
              name: "Pro", 
              price: 19, 
              monthlyPrice: 499,
              yearlyPrice: 4999,
              currency: "INR",
              limits: ["Unlimited workspaces", "Unlimited projects", "Unlimited members"], 
              features: ["All Free features", "AI Assistant", "AI Search", "AI Code Review", "Advanced analytics"] 
            }
          ],
          paymentHistory: []
        });
      });
  }, []);

  async function initiatePayment(plan, period) {
    setLoading(true);
    try {
      const { data } = await api.post("/billing/create-order", { plan, billingPeriod: period });
      setOrderDetails(data);
      setShowPayment(true);
      
      if (data.orderId.startsWith("mock_order_")) {
        setTimeout(async () => {
          try {
            const verifyRes = await api.post("/billing/verify-payment", {
              razorpayOrderId: data.orderId,
              razorpayPaymentId: `mock_pay_${Math.random().toString(36).slice(2)}`,
              razorpaySignature: "mock_signature",
              plan,
              billingPeriod: period
            });
            setUser(verifyRes.data.user);
            setShowPayment(false);
            toast.success("Test Mode: " + verifyRes.data.message);
            api.get("/billing").then(({ data: billingData }) => setBilling(billingData));
          } catch (error) {
            toast.error("Failed to verify simulated payment");
          } finally {
            setLoading(false);
          }
        }, 1500);
        return;
      }
      
      // Load Razorpay script if not already loaded
      if (!window.Razorpay) {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => openRazorpayCheckout(data);
        document.body.appendChild(script);
      } else {
        openRazorpayCheckout(data);
      }
    } catch (error) {
      toast.error("Failed to initiate payment");
    } finally {
      setLoading(false);
    }
  }

  function openRazorpayCheckout(order) {
    const options = {
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "CodeSphere",
      description: `Pro Plan - ${billingPeriod === "monthly" ? "Monthly" : "Yearly"}`,
      order_id: order.orderId,
      handler: async function(response) {
        setLoading(true);
        try {
          const { data } = await api.post("/billing/verify-payment", {
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            plan: selectedPlan,
            billingPeriod
          });
          setUser(data.user);
          setShowPayment(false);
          toast.success(data.message);
          // Refresh billing data
          api.get("/billing").then(({ data: billingData }) => setBilling(billingData));
        } catch (error) {
          toast.error("Payment verification failed");
        } finally {
          setLoading(false);
        }
      },
      prefill: {
        name: user.name,
        email: user.email
      },
      theme: {
        color: "#7C3AED"
      },
      method: {
        upi: true,
        card: true,
        netbanking: true,
        wallet: true,
        emi: true,
        paylater: true
      },
      config: {
        display: {
          blocks: {
            upi: {
              name: "Pay via UPI",
              instruments: [
                {
                  method: "upi",
                  flows: ["qr", "collect"]
                }
              ]
            }
          },
          sequence: ["block.upi"],
          preferences: {
            show_default_blocks: false
          }
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
    rzp.on("payment.failed", function(response) {
      toast.error("Payment failed");
      setShowPayment(false);
    });
  }

  async function switchToFree() {
    setLoading(true);
    try {
      const { data } = await api.post("/billing/create-order", { plan: "free", billingPeriod: "monthly" });
      setUser(data.user);
      toast.success(data.message);
      api.get("/billing").then(({ data: billingData }) => setBilling(billingData));
    } catch (error) {
      toast.error("Failed to switch plan");
    } finally {
      setLoading(false);
    }
  }

  if (!billing) return <div className="flex items-center justify-center min-h-64"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>;

  return <>
    <PageTitle icon={CreditCard} title="Billing & Subscription" subtitle="Manage your subscription, payment methods, and billing history." />
    
    <div className="grid gap-6 mb-8">
      <div className="flex items-center gap-4">
        <button onClick={() => setBillingPeriod("monthly")} className={`px-4 py-2 rounded-lg font-semibold transition ${billingPeriod === "monthly" ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "border border-[var(--line)] bg-white/60 hover:bg-white dark:bg-white/5"}`}>
          Monthly
        </button>
        <button onClick={() => setBillingPeriod("yearly")} className={`px-4 py-2 rounded-lg font-semibold transition ${billingPeriod === "yearly" ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "border border-[var(--line)] bg-white/60 hover:bg-white dark:bg-white/5"}`}>
          Yearly <span className="ml-1 text-xs text-violet-600 dark:text-violet-300">Save 17%</span>
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {billing.plans.map((plan) => {
          const price = billingPeriod === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
          return (
            <Panel key={plan.id} className={`relative ${plan.id === "pro" ? "aurora-border" : ""}`}>
              {plan.id === "pro" && <div className="absolute -top-3 right-4"><Badge tone="violet">Popular</Badge></div>}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{plan.name}</h2>
                <Badge>{user.plan === plan.id ? "Current" : "Available"}</Badge>
              </div>
              <div className="mb-4">
                <span className="text-4xl font-black">₹{price}</span>
                <span className="text-sm text-slate-500">/{billingPeriod}</span>
              </div>
              <div className="space-y-3 mb-6">
                <div className="font-semibold text-sm text-slate-500">Limits:</div>
                {plan.limits.map((item) => (
                  <div key={item} className="flex gap-2 text-sm">
                    <Check className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
                    {item}
                  </div>
                ))}
                <div className="font-semibold text-sm text-slate-500 mt-4">Features:</div>
                {plan.features.map((item) => (
                  <div key={item} className="flex gap-2 text-sm">
                    <Check className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
                    {item}
                  </div>
                ))}
              </div>
              {plan.id !== user.plan && (
                <Button 
                  className="w-full" 
                  disabled={loading}
                  onClick={() => plan.id === "free" ? switchToFree() : initiatePayment(plan.id, billingPeriod)}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {plan.id === "free" ? "Switch to Free" : "Upgrade to Pro"}
                </Button>
              )}
            </Panel>
          );
        })}
      </div>
    </div>

    <Panel>
      <h2 className="text-lg font-semibold mb-4">Payment Methods</h2>
      <div className="grid gap-3 md:grid-cols-4">
        {[
          { id: "razorpay", name: "Razorpay", icon: "💳", desc: "Cards, UPI, Netbanking, Wallets" },
          { id: "upi", name: "UPI", icon: "📱", desc: "Direct UPI payment" },
          { id: "phonepe", name: "PhonePe", icon: "🟣", desc: "PhonePe wallet" },
          { id: "gpay", name: "Google Pay", icon: "🔵", desc: "Google Pay UPI" }
        ].map((method) => (
          <button
            key={method.id}
            onClick={() => setPaymentMethod(method.id)}
            className={`p-4 rounded-xl border-2 text-left transition ${
              paymentMethod === method.id 
                ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10" 
                : "border-[var(--line)] bg-white/60 hover:bg-white dark:bg-white/5"
            }`}
          >
            <div className="text-2xl mb-2">{method.icon}</div>
            <div className="font-semibold">{method.name}</div>
            <div className="text-xs text-slate-500">{method.desc}</div>
          </button>
        ))}
      </div>
    </Panel>

    {billing.paymentHistory && billing.paymentHistory.length > 0 && (
      <Panel className="mt-6">
        <h2 className="text-lg font-semibold mb-4">Payment History</h2>
        <div className="space-y-2">
          {billing.paymentHistory.map((payment) => (
            <div key={payment._id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--line)] bg-white/60 dark:bg-white/5">
              <div>
                <div className="font-semibold">₹{payment.amount} - {payment.plan.charAt(0).toUpperCase() + payment.plan.slice(1)} Plan</div>
                <div className="text-xs text-slate-500">{new Date(payment.createdAt).toLocaleDateString()} • {payment.billingPeriod}</div>
              </div>
              <Badge tone={payment.status === "completed" ? "teal" : payment.status === "pending" ? "amber" : "rose"}>
                {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
              </Badge>
            </div>
          ))}
        </div>
      </Panel>
    )}

    {showPayment && orderDetails && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/55 p-4 backdrop-blur-sm">
        <div className="glass-card w-full max-w-md rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Complete Payment</h2>
            <button onClick={() => setShowPayment(false)}><X className="h-5 w-5" /></button>
          </div>
          <div className="mb-4">
            <div className="text-sm text-slate-500">Amount</div>
            <div className="text-3xl font-black">₹{orderDetails.amount / 100}</div>
          </div>
          <div className="mb-4">
            <div className="text-sm text-slate-500">Payment Method</div>
            <div className="font-semibold">{paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</div>
          </div>
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 dark:bg-amber-500/10 dark:border-amber-400/20 dark:text-amber-200">
            <div className="font-semibold mb-1">Test Mode</div>
            <div>Use test card details: 4242 4242 4242 4242, any future date, any CVV</div>
          </div>
          {loading && (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
              <span>Processing payment...</span>
            </div>
          )}
        </div>
      </div>
    )}
  </>;
}

export function InvitePage() {
  const { activeWorkspaceId } = useAuth();
  const [invite, setInvite] = useState({ email: "", role: "Member" });
  const [link, setLink] = useState("");
  async function send() {
    const { data } = await api.post(`/workspaces/${activeWorkspaceId}/invites`, invite);
    setLink(data.inviteUrl);
    toast.success(data.delivery?.status === "sent" ? "Invitation email sent" : "Invite link created");
  }
  async function createShareLink() {
    const { data } = await api.post(`/workspaces/${activeWorkspaceId}/invites/link`, { role: invite.role });
    setLink(data.inviteUrl);
    toast.success("Shareable invite link created");
  }
  return <><PageTitle icon={UserPlus} title="Invite Members" subtitle="Invite by email or generate a secure shareable workspace link." /><Panel className="max-w-lg"><Input className="mb-3" type="email" placeholder="Email address" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /><Select className="mb-3" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}><option>Admin</option><option>Member</option><option>Viewer</option></Select><div className="flex flex-wrap gap-2"><Button onClick={send}><Mail className="h-4 w-4" />Send Email Invite</Button><Button variant="ghost" onClick={createShareLink}><Copy className="h-4 w-4" />Create Share Link</Button></div>{link && <div className="mt-4 rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-900"><a className="font-semibold text-violet-600" href={link}>{link}</a></div>}<div className="mt-4 grid gap-2 text-sm text-slate-500"><div className="flex items-center gap-2"><Mail className="h-4 w-4" />Email invites are sent through configured SMTP.</div><div className="flex items-center gap-2"><UserPlus className="h-4 w-4" />Share links let authenticated users join automatically.</div></div></Panel></>;
}

export function HelpPage() {
  return <><PageTitle icon={FileText} title="Help & Support" subtitle="Operational guidance for running CodeSphere in development and production." /><div className="grid gap-4 md:grid-cols-2"><Panel><h2 className="font-semibold">Getting Started</h2><p className="mt-2 text-sm text-slate-500">Seed data includes a Pro owner account, sample projects, tasks, docs, snippets, activity, and notifications. Configure Gemini with GEMINI_API_KEY to enable live AI output.</p></Panel><Panel><h2 className="font-semibold">Production Checklist</h2><div className="mt-2 space-y-2 text-sm text-slate-500"><div>Use managed MongoDB and strong JWT_SECRET.</div><div>Connect object storage for uploads.</div><div>Replace simulated billing upgrade with Stripe checkout and webhooks.</div><div>Run behind HTTPS with correct CLIENT_ORIGIN.</div></div></Panel></div></>;
}

function LayoutIcon(props) { return <Activity {...props} />; }
function KanbanIcon(props) { return <Clipboard {...props} />; }
