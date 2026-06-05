import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import toast from "react-hot-toast";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, activeWorkspaceId } = useAuth();
  const [socket, setSocket] = useState(null);
  const [online, setOnline] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("codesphere_token");
    if (!user || !token) return;
    const client = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, { auth: { token } });
    setSocket(client);
    client.on("presence:online", setOnline);
    client.on("presence:joined", (member) => setOnline((current) => [...current.filter((item) => item._id !== member._id), member]));
    client.on("presence:offline", ({ userId }) => setOnline((current) => current.filter((item) => item._id !== userId)));
    client.on("activity:new", (activity) => setEvents((current) => [activity, ...current].slice(0, 20)));
    client.on("notification:new", () => toast("New workspace notification"));
    return () => client.close();
  }, [user?._id]);

  useEffect(() => {
    if (socket && activeWorkspaceId) socket.emit("workspace:join", activeWorkspaceId);
  }, [socket, activeWorkspaceId]);

  const value = useMemo(() => ({ socket, online, events }), [socket, online, events]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
