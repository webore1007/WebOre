import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import contactRoutes from "./routes/contact.js";
import adminRoutes from "./routes/admin.js";
import settingsRoutes from "./routes/settings.js";
import pagesRoutes from "./routes/pages.js";
import portfolioRoutes from "./routes/portfolio.js";
import blogRoutes, { adminBlogRouter } from "./routes/blog.js";
import mediaRoutes, { UPLOADS_DIR } from "./routes/media.js";
import analyticsRoutes from "./routes/analytics.js";
import db from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.join(__dirname, ".."); // the plain HTML/CSS/JS site lives one level up

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true, service: "webore-api" }));

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/blog", adminBlogRouter);
app.use("/api/admin/media", mediaRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/pages", pagesRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/analytics", analyticsRoutes);

// Uploaded media (images/video/pdf) from the admin Media library.
app.use("/uploads", express.static(UPLOADS_DIR));

// Maintenance mode: when turned on in Settings, every public page shows a
// simple holding message instead of the site — admins, the API, static
// assets, and the login/admin pages themselves stay reachable so the site
// can always be turned back on.
function isMaintenanceOn() {
  const row = db.prepare("SELECT value FROM site_settings WHERE key = 'maintenance_mode'").get();
  return row?.value === "1";
}
const MAINTENANCE_ALLOWLIST = new Set(["/login.html", "/admin.html", "/favicon.ico"]);
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
  if (req.path.startsWith("/css") || req.path.startsWith("/js") || req.path.startsWith("/legal")) return next();
  if (MAINTENANCE_ALLOWLIST.has(req.path)) return next();
  if (!req.path.endsWith(".html") && req.path !== "/") return next();
  if (!isMaintenanceOn()) return next();

  const authHeader = req.headers.authorization || "";
  if (authHeader) return next(); // let logged-in API calls through regardless

  const message = db.prepare("SELECT value FROM site_settings WHERE key = 'maintenance_message'").get()?.value
    || "We're doing a bit of maintenance. Back shortly.";
  res
    .status(503)
    .type("html")
    .send(
      `<!doctype html><html><head><meta charset="utf-8"><title>Maintenance</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>body{background:#05040f;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px;}
      div{max-width:480px}h1{font-size:1.5rem;margin-bottom:12px}p{color:rgba(255,255,255,.7)}</style>
      </head><body><div><h1>We'll be right back</h1><p>${message.replace(/</g, "&lt;")}</p></div></body></html>`
    );
});

// Serve the static site (index.html, about.html, css/, js/, legal/, etc.)
// so the whole thing runs from a single `npm start` — no separate build step.
app.use(express.static(SITE_DIR));

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(PORT, () => {
  console.log(`WebOre running on http://localhost:${PORT}`);
});
