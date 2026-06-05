import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { Activity, AlertTriangle, Bell, BookOpen, Bot, CalendarDays, CheckCircle2, Code2, CreditCard, Eye, EyeOff, FileSearch, Github, KanbanSquare, LayoutDashboard, Linkedin, Loader2, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Settings, ShieldCheck, Sparkles, Sun, User, UserPlus, Users, Workflow, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "./context/AuthContext";
import { useSocket } from "./context/SocketContext";
import { api, setToken } from "./api/client";
import { Badge, Button, Input, Loading } from "./components/ui";
import { ActivityPage, AiAssistantPage, AiCodeReviewPage, AiSearchPage, BillingPage, CalendarPage, DashboardPage, DocsPage, HelpPage, InvitePage, NotificationsPage, ProfilePage, ProjectsPage, ReportsPage, SettingsPage, SnippetsPage, TasksPage, TeamPage, WorkspacesPage } from "./pages/AppPages";

const nav = [
  ["Dashboard", "/", LayoutDashboard],
  ["Projects", "/projects", KanbanSquare],
  ["Tasks", "/tasks", KanbanSquare],
  ["Calendar", "/calendar", CalendarDays],
  ["Activity", "/activity", Activity],
  ["Team", "/team", Users],
  ["Wiki", "/docs", BookOpen],
  ["Snippets", "/snippets", Code2],
  ["AI Assistant", "/ai-assistant", Bot],
  ["AI Search", "/ai-search", FileSearch],
  ["Settings", "/settings", Settings],
  ["Billing", "/billing", CreditCard]
];

export default function App() {
  const { loading, user } = useAuth();
  if (loading) return <Loading />;
  return <Routes>
    <Route path="/landing" element={<LandingPage />} />
    <Route path="/login" element={<LoginRoute user={user} />} />
    <Route path="/accept-invite/:token" element={<AcceptInvitePage />} />
    <Route element={user ? <Shell /> : <Navigate to="/landing" />}>
      <Route index element={<DashboardPage />} />
      <Route path="workspaces" element={<WorkspacesPage />} />
      <Route path="projects" element={<ProjectsPage />} />
      <Route path="tasks" element={<TasksPage />} />
      <Route path="calendar" element={<CalendarPage />} />
      <Route path="docs" element={<DocsPage />} />
      <Route path="snippets" element={<SnippetsPage />} />
      <Route path="ai-assistant" element={<AiAssistantPage />} />
      <Route path="ai-search" element={<AiSearchPage />} />
      <Route path="ai-code-review" element={<AiCodeReviewPage />} />
      <Route path="activity" element={<ActivityPage />} />
      <Route path="team" element={<TeamPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="billing" element={<BillingPage />} />
      <Route path="invite" element={<InvitePage />} />
      <Route path="help" element={<HelpPage />} />
    </Route>
  </Routes>;
}

function OAuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const redirect = params.get("redirect");
    if (!token) {
      setError("OAuth sign-in did not return an application token.");
      return;
    }
    setToken(token);
    refresh()
      .then(() => navigate(redirect?.startsWith("/") ? redirect : "/", { replace: true }))
      .catch((requestError) => {
        setToken(null);
        setError(requestError.response?.data?.message || "OAuth sign-in could not be completed.");
      });
  }, [location.search]);

  return <div className="flex min-h-screen items-center justify-center p-4 text-[var(--text)]">
    <div className="glass-card w-full max-w-md rounded-2xl p-6 shadow-glow">
      <div className="mb-4 flex items-center gap-3">
        <Loader2 className={`h-5 w-5 text-violet-500 ${error ? "" : "animate-spin"}`} />
        <div className="text-lg font-bold">{error ? "Sign-in failed" : "Completing sign-in"}</div>
      </div>
      {error && <div className="mb-4 rounded-xl border border-rose-300/50 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-200">{error}</div>}
      {error && <Button onClick={() => navigate("/login", { replace: true })}>Back to sign in</Button>}
    </div>
  </div>;
}

function LoginRoute({ user }) {
  const location = useLocation();
  const redirect = new URLSearchParams(location.search).get("redirect");
  const error = new URLSearchParams(location.search).get("error");
  const target = redirect?.startsWith("/") ? redirect : "/";
  return user ? <Navigate to={target} replace /> : <AuthPage initialError={error} />;
}

function AcceptInvitePage() {
  const { token } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refresh, setActiveWorkspaceId } = useAuth();
  const [invite, setInvite] = useState(null);
  const [status, setStatus] = useState("validating");
  const [error, setError] = useState("");
  const acceptedRef = useRef(false);

  useEffect(() => {
    let active = true;
    setStatus("validating");
    setError("");
    api.get(`/workspaces/invites/${token}`)
      .then(({ data }) => {
        if (!active) return;
        setInvite(data);
        setStatus(user ? "ready" : "auth_required");
        if (!user) setError("You must be logged in to accept this invitation.");
      })
      .catch((requestError) => {
        if (!active) return;
        setStatus("error");
        setError(requestError.response?.data?.message || "Invite token could not be validated.");
      });
    return () => {
      active = false;
    };
  }, [token, user?._id]);

  useEffect(() => {
    if (!user || !invite || acceptedRef.current) return;
    acceptedRef.current = true;
    setStatus("accepting");
    setError("");
    api.post(`/workspaces/accept/${token}`)
      .then(async ({ data }) => {
        await refresh();
        setActiveWorkspaceId(data.workspace._id);
        localStorage.setItem("codesphere_workspace", data.workspace._id);
        setStatus("accepted");
        navigate("/", { replace: true });
      })
      .catch((requestError) => {
        acceptedRef.current = false;
        setStatus("error");
        setError(requestError.response?.data?.message || "Invitation could not be accepted.");
      });
  }, [user, invite, token, refresh, setActiveWorkspaceId, navigate]);

  const loginPath = `/login?redirect=${encodeURIComponent(location.pathname)}`;

  return <div className="flex min-h-screen items-center justify-center p-4 text-[var(--text)]">
    <div className="glass-card w-full max-w-lg rounded-2xl p-6 shadow-glow">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl aurora-gradient text-white">
          {status === "error" ? <AlertTriangle className="h-5 w-5" /> : status === "accepted" ? <CheckCircle2 className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Accept Invitation</h1>
          <p className="text-sm text-slate-500">Join a CodeSphere workspace.</p>
        </div>
      </div>

      {invite && <div className="mb-5 rounded-xl border border-[var(--line)] bg-white/45 p-4 text-sm dark:bg-white/5">
        <div className="font-semibold">{invite.workspace?.name}</div>
        <div className="mt-1 text-slate-500">Role: {invite.role}</div>
        <div className="mt-1 text-slate-500">{invite.targetType === "link" ? "Shareable workspace link" : `Invited email: ${invite.email}`}</div>
      </div>}

      {["validating", "accepting"].includes(status) && <div className="flex items-center gap-3 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
        {status === "validating" ? "Validating invitation..." : "Accepting invitation..."}
      </div>}

      {status === "auth_required" && <div>
        <div className="mb-4 rounded-xl border border-amber-300/50 bg-amber-400/10 p-3 text-sm text-amber-700 dark:text-amber-200">{error}</div>
        <Button onClick={() => navigate(loginPath)}>Sign in to accept</Button>
      </div>}

      {status === "error" && <div>
        <div className="mb-4 rounded-xl border border-rose-300/50 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-200">{error}</div>
        {!user && <Button onClick={() => navigate(loginPath)}>Sign in</Button>}
      </div>}
    </div>
  </div>;
}

function Shell() {
  const { user, logout, workspaces, activeWorkspaceId, setActiveWorkspaceId } = useAuth();
  const { online } = useSocket();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [themePref, setThemePref] = useState(() => localStorage.getItem("codesphere_theme") || "system");
  const [dark, setDark] = useState(() => {
    const pref = localStorage.getItem("codesphere_theme") || "system";
    if (pref === "dark") return true;
    if (pref === "light") return false;
    return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("codesphere_nav") === "collapsed");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    // persist the user's explicit preference; 'system' is stored literally
    localStorage.setItem("codesphere_theme", themePref);
  }, [dark, themePref]);

  useEffect(() => {
    localStorage.setItem("codesphere_nav", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  useEffect(() => {
    function onKey(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") setCommandOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const run = setTimeout(async () => {
      if (!query.trim() || !activeWorkspaceId) return setResults(null);
      const { data } = await api.get(`/search/${activeWorkspaceId}?q=${encodeURIComponent(query)}`);
      setResults(data);
    }, 250);
    return () => clearTimeout(run);
  }, [query, activeWorkspaceId]);

  const shellColumns = collapsed ? "lg:grid-cols-[5rem_minmax(0,1fr)]" : "lg:grid-cols-[18rem_minmax(0,1fr)]";

  return <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-300">
    <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
      <div className="absolute left-1/4 top-0 h-px w-1/2 aurora-gradient" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/60 to-transparent dark:from-white/5" />
    </div>
    <div className={`mx-auto grid w-full max-w-[1800px] gap-0 ${shellColumns}`}>
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} setActiveWorkspaceId={setActiveWorkspaceId} user={user} logout={logout} />
      </div>
      <main className="relative min-w-0 bg-[var(--bg)] transition-all duration-300">
        <header className="border-b border-[var(--line)] bg-[var(--bg)]/78 px-4 py-4 backdrop-blur-xl md:px-6 lg:px-8">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex items-center gap-3">
              <Button variant="ghost" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu className="h-4 w-4" /></Button>
              <Button variant="ghost" className="hidden lg:inline-flex" onClick={() => setCollapsed(!collapsed)} aria-label="Collapse navigation">{collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}</Button>
              <div className="hidden min-w-44 md:block">
                <div className="text-sm font-semibold tracking-tight">{workspaces.find((workspace) => workspace._id === activeWorkspaceId)?.name || "Workspace"}</div>
                <div className="text-xs text-slate-500">Product command center</div>
              </div>
            </div>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setCommandOpen(false)} placeholder="Search projects, tasks, users, snippets, docs, activity" className="pl-9 pr-20" />
              <kbd className="pointer-events-none absolute right-3 top-2.5 rounded-md border border-[var(--line)] bg-white/70 px-2 py-1 text-xs text-slate-500 dark:bg-white/6">Ctrl K</kbd>
              {results && <GlobalResults results={results} onOpen={(path) => { setQuery(""); setResults(null); navigate(path); }} />}
            </div>
              <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-[var(--line)] bg-white/60 px-3 py-2 text-xs text-slate-500 dark:bg-white/6 md:flex"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,.8)]" />{online.length} online</div>
              <Button variant="ghost" onClick={() => {
                // toggle between explicit light/dark (clears 'system')
                const nextPref = dark ? "light" : "dark";
                setThemePref(nextPref);
                setDark(nextPref === "dark");
              }} aria-label="Toggle theme">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
              <Button variant="ghost" onClick={() => navigate("/profile")}><User className="h-4 w-4" /><span className="hidden sm:inline">{user.name}</span></Button>
            </div>
          </div>
        </header>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 py-5 md:px-6 md:py-7 lg:px-8"><Outlet /></motion.div>
      </main>
    </div>
    <div className="lg:hidden">
      <Sidebar collapsed={false} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} setActiveWorkspaceId={setActiveWorkspaceId} user={user} logout={logout} />
    </div>
    <CommandPalette open={commandOpen} setOpen={setCommandOpen} navigate={navigate} />
  </div>;
}

function Sidebar({ collapsed, mobileOpen, setMobileOpen, workspaces, activeWorkspaceId, setActiveWorkspaceId, user, logout }) {
  const activeWorkspace = workspaces.find((workspace) => workspace._id === activeWorkspaceId);
  const initials = user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "CS";
  const content = <aside className={`${collapsed ? "w-20" : "w-full lg:w-72"} flex min-h-full flex-col border-r border-[var(--line)] bg-white/78 p-3 backdrop-blur-xl transition-all duration-300 dark:bg-night/86`}>
    <div className="mb-4 flex min-h-12 items-center gap-3 rounded-xl px-2">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl aurora-gradient text-sm font-black text-white shadow-glow">CS</div>
      {!collapsed && <div><div className="font-bold tracking-tight">CodeSphere</div><div className="text-xs text-slate-500">Team operating system</div></div>}
      <button className="ml-auto rounded-lg p-2 text-slate-500 lg:hidden" onClick={() => setMobileOpen(false)}><X className="h-4 w-4" /></button>
    </div>
    {!collapsed && <div className="mb-4 rounded-xl border border-[var(--line)] bg-white/72 p-3 shadow-[0_14px_36px_rgba(15,23,42,.07)] dark:bg-white/6">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-xs font-black text-white dark:bg-white dark:text-slate-950">{activeWorkspace?.name?.slice(0, 2).toUpperCase() || "WS"}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{activeWorkspace?.name || "Workspace"}</div>
          <div className="text-xs text-slate-500">{activeWorkspace?.members?.length || 0} members</div>
        </div>
        <Workflow className="h-4 w-4 text-slate-400" />
      </div>
      <select value={activeWorkspaceId} onChange={(event) => setActiveWorkspaceId(event.target.value)} className="h-10 w-full rounded-lg border border-[var(--line)] bg-white/80 px-3 text-sm font-semibold outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-[var(--ring)] dark:bg-carbon">
        {workspaces.map((workspace) => <option key={workspace._id} value={workspace._id}>{workspace.name}</option>)}
      </select>
    </div>}
    <nav className="flex-1 space-y-1 pr-1">
      {nav.map(([label, href, Icon]) => <NavLink key={href} to={href} title={label} onClick={() => setMobileOpen(false)} className={({ isActive }) => `group flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition duration-200 ${isActive ? "bg-slate-950 text-white shadow-[0_10px_28px_rgba(15,23,42,.16)] dark:bg-white dark:text-slate-950" : "text-slate-600 hover:bg-white/76 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/8 dark:hover:text-white"}`}><Icon className="h-4 w-4 shrink-0 transition group-hover:scale-105" /> {!collapsed && <span className="truncate">{label}</span>}</NavLink>)}
    </nav>
    {!collapsed && <div className="mt-4 space-y-3">
      <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-3 text-xs text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"><div className="mb-1 flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4" />Pro workspace</div><p>AI insights, live collaboration, and reporting are enabled.</p></div>
      <div className="rounded-xl border border-[var(--line)] bg-white/72 p-3 dark:bg-white/6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full aurora-gradient text-xs font-bold text-white">{user?.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : initials}</div>
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{user?.name}</div><div className="truncate text-xs text-slate-500">{user?.email}</div></div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <NavLink to="/profile" onClick={() => setMobileOpen(false)} className="inline-flex items-center justify-center rounded-lg border border-[var(--line)] px-2 py-2 text-xs font-semibold transition hover:bg-slate-100 dark:hover:bg-white/8"><User className="h-3.5 w-3.5" /></NavLink>
          <NavLink to="/settings" onClick={() => setMobileOpen(false)} className="inline-flex items-center justify-center rounded-lg border border-[var(--line)] px-2 py-2 text-xs font-semibold transition hover:bg-slate-100 dark:hover:bg-white/8"><Settings className="h-3.5 w-3.5" /></NavLink>
          <button onClick={logout} className="inline-flex items-center justify-center rounded-lg border border-[var(--line)] px-2 py-2 text-xs font-semibold transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"><LogOut className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>}
  </aside>;
  return <>
    <div className="hidden lg:block">{content}</div>
    <AnimatePresence>{mobileOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-night/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)}><motion.div initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} className="h-full" onClick={(event) => event.stopPropagation()}>{content}</motion.div></motion.div>}</AnimatePresence>
  </>;
}

function GlobalResults({ results, onOpen }) {
  const groups = [["Projects", results.projects, "/projects"], ["Tasks", results.tasks, "/tasks"], ["Docs", results.docs, "/docs"], ["Snippets", results.snippets, "/snippets"], ["Users", results.users, "/team"], ["Activity", results.activities, "/activity"]];
  return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card absolute left-0 right-0 top-12 z-40 max-h-96 overflow-auto rounded-xl p-3 shadow-glow ring-1 ring-[var(--line)] bg-[var(--card)]">
    {groups.map(([label, items, path]) => items?.length ? <div key={label} className="mb-3 last:mb-0"><div className="mb-1 text-xs font-semibold uppercase text-slate-500">{label}</div>{items.map((item) => <button key={item._id} onClick={() => onOpen(path)} className="block w-full rounded-lg px-2 py-2 text-left text-sm transition hover:bg-violet-500/10">{item.name || item.title || item.message || item.email}</button>)}</div> : null)}
  </motion.div>;
}

function CommandPalette({ open, setOpen, navigate }) {
  const [filter, setFilter] = useState("");
  const items = useMemo(() => nav.filter(([label]) => label.toLowerCase().includes(filter.toLowerCase())), [filter]);
  return <AnimatePresence>{open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-start justify-center bg-night/55 p-4 pt-24 backdrop-blur-md" onMouseDown={() => setOpen(false)}>
    <motion.div initial={{ opacity: 0, scale: 0.96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 18 }} className="glass-card w-full max-w-2xl rounded-2xl p-3 shadow-glow" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-center gap-2 border-b border-[var(--line)] pb-3"><Search className="h-4 w-4 text-violet-500" /><input autoFocus value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Jump to a page or workflow" className="h-10 flex-1 bg-transparent text-sm outline-none" /><kbd className="rounded-md border border-[var(--line)] px-2 py-1 text-xs text-slate-500">Esc</kbd></div>
      <div className="thin-scroll mt-3 max-h-80 overflow-y-auto">{items.map(([label, href, Icon]) => <button key={href} onClick={() => { navigate(href); setOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition hover:bg-violet-500/10"><span className="flex h-9 w-9 items-center justify-center rounded-lg aurora-gradient text-white"><Icon className="h-4 w-4" /></span><span className="font-medium">{label}</span></button>)}</div>
    </motion.div>
  </motion.div>}</AnimatePresence>;
}

function LandingPage() {
  return <div className="min-h-screen overflow-hidden px-4 py-6 text-[var(--text)]">
    <nav className="mx-auto flex max-w-7xl items-center justify-between">
      <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl aurora-gradient font-black text-white shadow-glow">CS</div><div className="font-bold">CodeSphere</div></div>
      <Button onClick={() => { window.location.href = "/login"; }}>Open App</Button>
    </nav>
    <section className="mx-auto grid min-h-[calc(100vh-92px)] max-w-7xl items-center gap-8 py-10 lg:grid-cols-[.9fr_1.1fr]">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <Badge>Futuristic developer collaboration</Badge>
        <h1 className="mt-5 max-w-3xl text-5xl font-black leading-tight tracking-tight md:text-7xl">CodeSphere</h1>
        <p className="mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300">A premium command center for projects, docs, snippets, AI reviews, live teamwork, and launch-ready workspace analytics.</p>
        <div className="mt-7 flex flex-wrap gap-3"><Button onClick={() => { window.location.href = "/login"; }}><Sparkles className="h-4 w-4" />Enter Workspace</Button><Button variant="ghost" onClick={() => { window.location.href = "/login"; }}>Sign in</Button></div>
      </motion.div>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.08 }} className="aurora-border rounded-3xl p-2">
        <div className="glass-card overflow-hidden rounded-3xl p-4">
          <div className="mb-4 flex items-center justify-between"><div><div className="text-sm text-slate-500">Workspace health</div><div className="text-2xl font-bold">Aurora Release</div></div><Badge tone="amber">Pro</Badge></div>
          <div className="grid gap-3 md:grid-cols-3"><MetricTile label="Velocity" value="92%" /><MetricTile label="Blockers" value="2" /><MetricTile label="AI Score" value="A+" /></div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">{["To Do", "In Progress", "Review", "Done"].map((status, index) => <div key={status} className="rounded-2xl border border-[var(--line)] bg-white/45 p-3 dark:bg-white/5"><div className="mb-3 text-sm font-semibold">{status}</div>{Array.from({ length: index + 1 }, (_, item) => <div key={item} className="mb-2 rounded-xl bg-violet-500/10 p-3"><div className="h-2 w-2/3 rounded-full aurora-gradient" /><div className="mt-2 h-2 w-1/2 rounded-full bg-slate-300/40" /></div>)}</div>)}</div>
        </div>
      </motion.div>
    </section>
  </div>;
}

function MetricTile({ label, value }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-white/45 p-4 dark:bg-white/5"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-3xl font-black aurora-text">{value}</div></div>;
}

function AuthPage({ initialError = "" }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(initialError);

  async function submit(event) {
    event.preventDefault();
    if (!form.email.trim() || !form.password.trim() || (mode === "register" && !form.name.trim())) {
      setError("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
    } catch (submitError) {
      setError(submitError.response?.data?.message || submitError.message || "Unable to complete authentication.");
    } finally {
      setSubmitting(false);
    }
  }
  return <div className="grid min-h-screen items-center gap-8 p-4 lg:grid-cols-[1fr_480px] lg:p-8">
    <div className="hidden px-8 lg:block"><div className="max-w-2xl"><Badge>CodeSphere Identity</Badge><h1 className="mt-5 text-6xl font-black tracking-tight">Build inside the sphere.</h1><p className="mt-5 text-lg text-slate-600 dark:text-slate-300">A violet-cyan workspace for teams who want planning, docs, snippets, realtime signals, and AI engineering support in one polished system.</p></div></div>
    <motion.form initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="glass-card mx-auto w-full max-w-md rounded-3xl p-6 shadow-glow">
      <div className="mb-6"><div className="flex h-12 w-12 items-center justify-center rounded-2xl aurora-gradient font-black text-white">CS</div><div className="mt-4 text-2xl font-black">Welcome to CodeSphere</div><p className="text-sm text-slate-500">Sign in to your premium developer workspace.</p></div>
      {error && <div className="mb-4 rounded-xl border border-rose-300/50 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-200">{error}</div>}
      {mode === "register" && <Input className="mb-3" required placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />}
      <Input className="mb-3" required type="email" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
      <div className="relative mb-4">
        <Input required className="pr-11" type={showPassword ? "text" : "password"} placeholder="Password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-2 rounded-md p-2 text-slate-500 transition hover:bg-violet-500/10">
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "login" ? "Sign in" : "Create account"}</Button>
      <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="mt-4 w-full text-sm font-semibold text-violet-600 dark:text-violet-300">{mode === "login" ? "Create a new workspace" : "Use an existing account"}</button>
    </motion.form>
  </div>;
}
