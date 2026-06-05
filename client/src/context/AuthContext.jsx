import { createContext, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api, setToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(localStorage.getItem("codesphere_workspace") || "");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const { data } = await api.get("/auth/me");
    setUser(data.user);
    setWorkspaces(data.workspaces);
    const savedWorkspaceId = localStorage.getItem("codesphere_workspace") || activeWorkspaceId;
    const hasSavedWorkspace = data.workspaces.some((workspace) => workspace._id === savedWorkspaceId);
    const workspaceId = hasSavedWorkspace ? savedWorkspaceId : data.workspaces[0]?._id || "";
    setActiveWorkspaceId(workspaceId);
    if (workspaceId) localStorage.setItem("codesphere_workspace", workspaceId);
    else localStorage.removeItem("codesphere_workspace");
  }

  useEffect(() => {
    const token = localStorage.getItem("codesphere_token");
    if (!token) {
      setLoading(false);
      return;
    }
    refresh().catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeWorkspaceId) localStorage.setItem("codesphere_workspace", activeWorkspaceId);
  }, [activeWorkspaceId]);

  async function login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    setToken(data.token);
    setUser(data.user);
    await refresh();
    toast.success("Signed in");
  }

  async function register(name, email, password, profile = {}) {
    const { data } = await api.post("/auth/register", { name, email, password, ...profile });
    setToken(data.token);
    setUser(data.user);
    await refresh();
    toast.success("Account created");
  }

  function logout() {
    setToken(null);
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspaceId("");
    localStorage.removeItem("codesphere_workspace");
    toast.success("Signed out");
  }

  const value = useMemo(() => ({ user, setUser, workspaces, setWorkspaces, activeWorkspaceId, setActiveWorkspaceId, activeWorkspace: workspaces.find((item) => item._id === activeWorkspaceId), loading, login, register, logout, refresh }), [user, workspaces, activeWorkspaceId, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
