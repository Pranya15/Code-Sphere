import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { connectDatabase } from "./config/db.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { configureSocket } from "./socket/index.js";
import authRoutes from "./routes/auth.js";
import workspaceRoutes from "./routes/workspaces.js";
import projectRoutes from "./routes/projects.js";
import taskRoutes from "./routes/tasks.js";
import docRoutes from "./routes/docs.js";
import snippetRoutes from "./routes/snippets.js";
import searchRoutes from "./routes/search.js";
import aiRoutes from "./routes/ai.js";
import miscRoutes from "./routes/misc.js";

const app = express();
const server = createServer(app);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
const clientDistPath = path.resolve(__dirname, "../../client/dist");
const port = process.env.PORT || 5000;
const host = process.env.HOST || "0.0.0.0";
const clientOrigin = process.env.CLIENT_ORIGIN || `http://localhost:${port}`;
const allowedOrigins = new Set([
  clientOrigin,
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]);
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true
};
const io = new Server(server, { cors: corsOptions });

app.set("io", io);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors(corsOptions));
app.use(express.json({
  limit: "5mb",
  verify: (req, res, buffer) => {
    if (req.originalUrl === "/api/billing/webhook") req.rawBody = Buffer.from(buffer);
  }
}));
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 60_000, limit: 300 }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(express.static(clientDistPath));

app.get("/api/health", (req, res) => res.json({ status: "ok", name: "CodeSphere API" }));
app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/docs", docRoutes);
app.use("/api/snippets", snippetRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api", miscRoutes);

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
  const indexPath = path.join(clientDistPath, "index.html");
  res.sendFile(indexPath, (error) => {
    if (error) next(error);
  });
});

app.use(notFound);
app.use(errorHandler);

configureSocket(io);
await connectDatabase();
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Stop the existing CodeSphere server or set PORT to a free port.`);
    process.exit(1);
  }
  throw error;
});
server.listen(port, host, () => console.log(`CodeSphere running at http://localhost:${port}`));
