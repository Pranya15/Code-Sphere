import express from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import { requireAuth, randomPassword, signToken } from "../middleware/auth.js";
import { wrapAsyncRouter } from "../utils/wrapAsyncRouter.js";

const router = express.Router();
const providers = ["google", "microsoft", "github", "linkedin", "apple"];

const oauthConfigs = {
  google: {
    name: "Google",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile"
  },
  github: {
    name: "GitHub",
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email"
  },
  linkedin: {
    name: "LinkedIn",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scope: "openid profile email"
  },
  microsoft: {
    name: "Microsoft",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: "openid profile email User.Read"
  },
  apple: {
    name: "Apple",
    authUrl: "https://appleid.apple.com/auth/authorize",
    tokenUrl: "https://appleid.apple.com/auth/token",
    scope: "name email"
  }
};

const placeholderValues = new Set([
  "replace-with-a-long-random-secret",
  "your-client-id",
  "your-client-secret",
  "client-id",
  "client-secret"
]);

const oauthSetupGuide = {
  envFile: "server/.env",
  requiredOrigins: ["CLIENT_ORIGIN", "API_ORIGIN"],
  requiredCallbacks: providers.map((provider) => ({
    provider,
    env: [`${provider.toUpperCase()}_CLIENT_ID`, `${provider.toUpperCase()}_CLIENT_SECRET`],
    callbackPath: `/api/auth/oauth/${provider}/callback`
  })),
  steps: [
    "Create an OAuth application in the provider developer console.",
    "Set the authorized redirect URI to the callback URL reported by /api/auth/oauth/diagnostics.",
    "Copy the client id and client secret into server/.env.",
    "Restart the server so server/.env is loaded."
  ]
};

function isConfiguredValue(value) {
  return Boolean(value && !placeholderValues.has(String(value).trim()));
}

function clientOrigin(req) {
  return (process.env.CLIENT_ORIGIN || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

function apiOrigin(req) {
  return (process.env.API_ORIGIN || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

function redirectUri(req, provider) {
  return `${apiOrigin(req)}/api/auth/oauth/${provider}/callback`;
}

function providerCredentials(provider) {
  return {
    clientId: process.env[`${provider.toUpperCase()}_CLIENT_ID`],
    clientSecret: process.env[`${provider.toUpperCase()}_CLIENT_SECRET`]
  };
}

function providerMissingVars(provider) {
  const credentials = providerCredentials(provider);
  const missing = [];
  if (!isConfiguredValue(credentials.clientId)) missing.push(`${provider.toUpperCase()}_CLIENT_ID`);
  if (!isConfiguredValue(credentials.clientSecret)) missing.push(`${provider.toUpperCase()}_CLIENT_SECRET`);
  return missing;
}

function providerStatus(req, provider) {
  const missing = providerMissingVars(provider);
  return {
    id: provider,
    name: oauthConfigs[provider].name,
    configured: missing.length === 0,
    status: missing.length === 0 ? "working" : "missing",
    missing,
    authUrl: `/api/auth/oauth/${provider}/start`,
    callbackUrl: redirectUri(req, provider),
    requiredEnv: [`${provider.toUpperCase()}_CLIENT_ID`, `${provider.toUpperCase()}_CLIENT_SECRET`],
    requiredCallbackUrl: redirectUri(req, provider),
    scope: oauthConfigs[provider].scope,
    providerAuthUrl: oauthConfigs[provider].authUrl,
    providerTokenUrl: oauthConfigs[provider].tokenUrl
  };
}

function requireOAuthConfig(provider) {
  const credentials = providerCredentials(provider);
  const missing = providerMissingVars(provider);
  if (missing.length) {
    throw Object.assign(new Error(`${provider} OAuth is not configured. Missing: ${missing.join(", ")}`), { status: 503, missing });
  }
  return credentials;
}

function extractProfileUrlInput(value) {
  const input = String(value || "").trim();
  if (!input) return "";
  const markdownLink = input.match(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/i);
  if (markdownLink) return markdownLink[1];
  const bracketOnly = input.match(/^\[([^\]]+)\]$/);
  if (bracketOnly) return bracketOnly[1].trim();
  return input;
}

function parseUrlWithDefaultHttps(value) {
  const input = extractProfileUrlInput(value);
  if (!input) return null;
  try {
    return new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
}

function normalizeLinkedInProfileUrl(value) {
  const url = parseUrlWithDefaultHttps(value);
  if (!url) return "";
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  if (host !== "linkedin.com" || parts[0]?.toLowerCase() !== "in" || parts.length !== 2) return "";
  const username = decodeURIComponent(parts[1]).trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(username)) return "";
  return `https://www.linkedin.com/in/${encodeURIComponent(username)}`;
}

function normalizeGitHubProfileUrl(value) {
  const url = parseUrlWithDefaultHttps(value);
  if (!url) return "";
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  if (host !== "github.com" || parts.length !== 1) return "";
  const username = parts[0].trim();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i.test(username)) return "";
  return `https://github.com/${username}`;
}

function normalizeProfileLinks(input) {
  return {
    ...input,
    github: input.github ? normalizeGitHubProfileUrl(input.github) : "",
    linkedin: input.linkedin ? normalizeLinkedInProfileUrl(input.linkedin) : ""
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw Object.assign(new Error(`OAuth provider request failed with ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ""}`), { status: 502 });
  }
  return response.json();
}

async function exchangeCode(req, provider, code) {
  const config = oauthConfigs[provider];
  const { clientId, clientSecret } = requireOAuthConfig(provider);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri(req, provider),
    grant_type: "authorization_code"
  });
  if (provider === "microsoft") body.set("scope", config.scope);
  const token = await fetchJson(config.tokenUrl, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!token.access_token && !token.id_token) throw Object.assign(new Error("OAuth provider did not return a token"), { status: 502 });
  return token;
}

function decodeJwtPayload(token) {
  const payload = String(token || "").split(".")[1];
  if (!payload) return {};
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

async function fetchProviderProfile(provider, token) {
  const accessToken = token.access_token;
  if (provider === "google") {
    const profile = await fetchJson("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return { id: profile.sub, name: profile.name, email: profile.email, avatar: profile.picture };
  }

  if (provider === "github") {
    const githubHeaders = { 
      Authorization: `Bearer ${accessToken}`, 
      Accept: "application/vnd.github+json", 
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "CodeSphere"
    };
    const [profile, emails] = await Promise.all([
      fetchJson("https://api.github.com/user", { headers: githubHeaders }),
      fetchJson("https://api.github.com/user/emails", { headers: githubHeaders })
    ]);
    const email = profile.email || emails.find((item) => item.primary && item.verified)?.email || emails.find((item) => item.verified)?.email;
    return {
      id: profile.id,
      name: profile.name || profile.login,
      email,
      avatar: profile.avatar_url,
      username: profile.login,
      profileUrl: profile.html_url
    };
  }

  if (provider === "linkedin") {
    const profile = await fetchJson("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const linkedInProfileUrl = profile.profile || (profile.vanityName ? `https://www.linkedin.com/in/${profile.vanityName}` : "");
    return {
      id: profile.sub,
      name: profile.name,
      email: profile.email,
      avatar: profile.picture,
      profileUrl: linkedInProfileUrl
    };
  }

  if (provider === "apple") {
    const profile = decodeJwtPayload(token.id_token);
    return {
      id: profile.sub,
      name: profile.name || profile.email?.split("@")[0] || "Apple user",
      email: profile.email,
      avatar: ""
    };
  }

  const profile = await fetchJson("https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  let avatar = "";
  try {
    const photoResponse = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (photoResponse.ok) {
      const buffer = Buffer.from(await photoResponse.arrayBuffer());
      avatar = `data:${photoResponse.headers.get("content-type") || "image/jpeg"};base64,${buffer.toString("base64")}`;
    }
  } catch {
    avatar = "";
  }
  return { id: profile.id, name: profile.displayName, email: profile.mail || profile.userPrincipalName, avatar };
}

function normalizeProfile(provider, body) {
  const profile = body.profile || body;
  const email = profile.email?.trim().toLowerCase();
  const username = profile.username || profile.login || "";
  const providerId = profile.id || profile.sub;
  return {
    id: providerId ? String(providerId) : "",
    name: profile.name || profile.displayName || username || email?.split("@")[0] || "OAuth user",
    email,
    avatar: profile.avatar || profile.avatarUrl || profile.picture || "",
    github: provider === "github" ? (profile.profileUrl || profile.html_url || (username ? `https://github.com/${username}` : "")) : profile.github,
    linkedin: provider === "linkedin" ? (profile.profileUrl || profile.linkedin || "") : profile.linkedin,
    username,
    profileUrl: profile.profileUrl || profile.html_url || profile.url || ""
  };
}

async function upsertOAuthUser(provider, body) {
  const profile = normalizeProfile(provider, body);
  if (!profile.id) throw Object.assign(new Error("OAuth provider did not return an account id"), { status: 400 });
  if (!profile.email) throw Object.assign(new Error("OAuth provider did not return an email address"), { status: 400 });
  const providerIdPath = `providers.${provider}.id`;
  const providerEmailPath = `providers.${provider}.email`;
  let user = await User.findOne({ [providerIdPath]: profile.id });
  if (!user && profile.email) user = await User.findOne({ email: profile.email });
  if (!user && profile.github) user = await User.findOne({ github: profile.github });
  if (!user && profile.linkedin) user = await User.findOne({ linkedin: profile.linkedin });
  if (!user) {
    user = await User.create({ name: profile.name, email: profile.email, password: randomPassword(), avatar: profile.avatar, github: profile.github, linkedin: profile.linkedin });
  }
  user.name = user.name || profile.name;
  user.avatar = profile.avatar || user.avatar;
  if (profile.github) user.github = profile.github;
  if (profile.linkedin) user.linkedin = profile.linkedin;
  user.providers = user.providers || {};
  user.set(`providers.${provider}`, {
    id: profile.id,
    email: profile.email,
    username: provider === "github" ? profile.username : undefined,
    profileUrl: profile.profileUrl || profile.github || profile.linkedin
  });
  user.lastSeenAt = new Date();
  await user.save();
  return user;
}

async function ensurePersonalWorkspace(user) {
  const count = await Workspace.countDocuments({ $or: [{ owner: user._id }, { "members.user": user._id }] });
  if (count) return null;
  const slug = `${user.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
  return Workspace.create({
    name: `${user.name}'s Workspace`,
    slug,
    owner: user._id,
    members: [{ user: user._id, role: "Owner" }]
  });
}

router.post("/register", async (req, res) => {
  const body = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    github: z.string().optional().or(z.literal("")),
    linkedin: z.string().optional().or(z.literal(""))
  }).parse(req.body);
  const links = normalizeProfileLinks(body);
  if (body.github && !links.github) return res.status(400).json({ message: "GitHub profile URL must look like https://github.com/username or github.com/username" });
  if (body.linkedin && !links.linkedin) return res.status(400).json({ message: "LinkedIn profile URL must look like https://www.linkedin.com/in/username, https://linkedin.com/in/username, or www.linkedin.com/in/username" });
  const existing = await User.findOne({ email: body.email });
  if (existing) return res.status(409).json({ message: "Email is already registered" });
  const user = await User.create({ ...body, github: links.github, linkedin: links.linkedin });
  const slug = `${body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
  const workspace = await Workspace.create({
    name: `${body.name}'s Workspace`,
    slug,
    owner: user._id,
    members: [{ user: user._id, role: "Owner" }]
  });
  res.status(201).json({ token: signToken(user), user: await User.findById(user._id).select("-password"), workspace });
});

router.post("/login", async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const user = await User.findOne({ email: body.email }).select("+password");
  if (!user || !(await user.comparePassword(body.password))) return res.status(401).json({ message: "Invalid email or password" });
  res.json({ token: signToken(user), user: await User.findById(user._id).select("-password") });
});

router.get("/oauth/providers", (req, res) => {
  const providerReports = providers.map((provider) => providerStatus(req, provider));
  res.json({
    providers: providerReports,
    workingProviders: providerReports.filter((provider) => provider.configured).map((provider) => provider.id),
    missingProviders: providerReports.filter((provider) => !provider.configured).map((provider) => ({ id: provider.id, missing: provider.missing })),
    requiredCallbackUrls: Object.fromEntries(providerReports.map((provider) => [provider.id, provider.requiredCallbackUrl])),
    requiredEnv: Object.fromEntries(providerReports.map((provider) => [provider.id, provider.requiredEnv])),
    setupGuide: oauthSetupGuide,
    jwtConfigured: isConfiguredValue(process.env.JWT_SECRET),
    missingCoreEnv: isConfiguredValue(process.env.JWT_SECRET) ? [] : ["JWT_SECRET"]
  });
});

router.get("/oauth/diagnostics", (req, res) => {
  const providerReports = providers.map((provider) => providerStatus(req, provider));
  res.json({
    clientOrigin: clientOrigin(req),
    apiOrigin: apiOrigin(req),
    jwt: {
      configured: isConfiguredValue(process.env.JWT_SECRET),
      missing: isConfiguredValue(process.env.JWT_SECRET) ? [] : ["JWT_SECRET"]
    },
    workingProviders: providerReports.filter((provider) => provider.configured).map((provider) => provider.id),
    missingProviders: providerReports.filter((provider) => !provider.configured).map((provider) => ({ id: provider.id, missing: provider.missing })),
    requiredCallbackUrls: Object.fromEntries(providerReports.map((provider) => [provider.id, provider.requiredCallbackUrl])),
    requiredEnv: Object.fromEntries(providerReports.map((provider) => [provider.id, provider.requiredEnv])),
    providers: providerReports,
    setupGuide: oauthSetupGuide
  });
});

router.get("/oauth/:provider/start", (req, res) => {
  const provider = req.params.provider;
  if (!providers.includes(provider)) return res.status(400).json({ message: "Unsupported OAuth provider" });
  try {
    const { clientId } = requireOAuthConfig(provider);
    const redirect = typeof req.query.redirect === "string" && req.query.redirect.startsWith("/") ? req.query.redirect : "/";
    const state = jwt.sign({ provider, redirect }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "10m" });
    const url = new URL(oauthConfigs[provider].authUrl);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri(req, provider));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", oauthConfigs[provider].scope);
    url.searchParams.set("state", state);
    res.redirect(url.toString());
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || "OAuth login failed", missing: error.missing || [] });
  }
});

router.get("/oauth/:provider/callback", async (req, res) => {
  const provider = req.params.provider;
  if (!providers.includes(provider)) return res.status(400).json({ message: "Unsupported OAuth provider" });
  try {
    if (req.query.error) throw Object.assign(new Error(String(req.query.error_description || req.query.error)), { status: 401 });
    const state = jwt.verify(String(req.query.state || ""), process.env.JWT_SECRET || "dev-secret");
    if (state.provider !== provider) throw Object.assign(new Error("OAuth state provider mismatch"), { status: 400 });
    const token = await exchangeCode(req, provider, String(req.query.code || ""));
    const profile = await fetchProviderProfile(provider, token);
    const user = await upsertOAuthUser(provider, { profile });
    await ensurePersonalWorkspace(user);
    const callbackUrl = new URL(`${clientOrigin(req)}/auth/callback`);
    callbackUrl.searchParams.set("token", signToken(user));
    callbackUrl.searchParams.set("redirect", state.redirect || "/");
    res.redirect(callbackUrl.toString());
  } catch (error) {
    const callbackUrl = new URL(`${clientOrigin(req)}/login`);
    callbackUrl.searchParams.set("error", error.message || "OAuth login failed");
    res.redirect(callbackUrl.toString());
  }
});

router.get("/me", requireAuth, async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { lastSeenAt: new Date() });
  await Workspace.updateMany(
    { owner: req.user._id, "members.user": { $ne: req.user._id } },
    { $push: { members: { user: req.user._id, role: "Owner" } } }
  );
  await Workspace.updateMany(
    { owner: req.user._id, "members.user": req.user._id },
    { $set: { "members.$[ownerMember].role": "Owner" } },
    { arrayFilters: [{ "ownerMember.user": req.user._id }] }
  );
  const workspaces = await Workspace.find({ $or: [{ "members.user": req.user._id }, { owner: req.user._id }] }).populate("members.user", "name email avatar plan bio skills github linkedin lastSeenAt");
  res.json({ user: req.user, workspaces });
});

router.patch("/profile", requireAuth, async (req, res) => {
  const allowed = ["name", "avatar", "bio", "skills", "github", "linkedin", "preferences", "security"];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (Object.hasOwn(updates, "github")) {
    const normalized = updates.github ? normalizeGitHubProfileUrl(updates.github) : "";
    if (updates.github && !normalized) return res.status(400).json({ message: "GitHub profile URL must look like https://github.com/username or github.com/username" });
    updates.github = normalized;
  }
  if (Object.hasOwn(updates, "linkedin")) {
    const normalized = updates.linkedin ? normalizeLinkedInProfileUrl(updates.linkedin) : "";
    if (updates.linkedin && !normalized) return res.status(400).json({ message: "LinkedIn profile URL must look like https://www.linkedin.com/in/username, https://linkedin.com/in/username, or www.linkedin.com/in/username" });
    updates.linkedin = normalized;
  }
  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select("-password");
  res.json(user);
});

export default wrapAsyncRouter(router);
