import { Router } from "express";
import bcrypt from "bcryptjs";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();
router.use(requireAuth, requireAdmin);

// Dashboard stats
router.get("/stats", (req, res) => {
  const totalUsers = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'customer'").get().c;
  const totalProjects = db.prepare("SELECT COUNT(*) c FROM projects").get().c;
  const newProjects = db.prepare("SELECT COUNT(*) c FROM projects WHERE status = 'new'").get().c;
  const inProgress = db.prepare("SELECT COUNT(*) c FROM projects WHERE status = 'in_progress'").get().c;
  const completed = db.prepare("SELECT COUNT(*) c FROM projects WHERE status = 'completed'").get().c;
  const unreadMessages = db.prepare("SELECT COUNT(*) c FROM contact_messages WHERE status = 'new'").get().c;
  const byType = db
    .prepare("SELECT project_type, COUNT(*) count FROM projects GROUP BY project_type")
    .all();

  res.json({
    totalUsers,
    totalProjects,
    newProjects,
    inProgress,
    completed,
    unreadMessages,
    byType,
  });
});

// All users — admins, developers, and clients (customers) alike.
router.get("/users", (req, res) => {
  const users = db
    .prepare(
      "SELECT id, name, email, role, company, phone, oauth_provider, created_at FROM users ORDER BY created_at DESC"
    )
    .all();
  res.json({ users });
});

const VALID_ROLES = ["admin", "developer", "customer"];

// Create an admin/developer/client account directly from the admin panel.
router.post("/users", (req, res) => {
  const { name, email, password, role, company, phone } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }
  const finalRole = VALID_ROLES.includes(role) ? role : "customer";

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: "An account with that email already exists." });

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      "INSERT INTO users (name, email, password_hash, role, company, phone) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(name, email.toLowerCase(), hash, finalRole, company || null, phone || null);

  const user = db
    .prepare("SELECT id, name, email, role, company, phone, created_at FROM users WHERE id = ?")
    .get(info.lastInsertRowid);
  res.status(201).json({ user });
});

// Update role / profile fields for any user (e.g. promote a client to developer).
router.patch("/users/:id", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });

  const { name, role, company, phone } = req.body || {};
  if (role && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: "Invalid role." });
  }
  if (role === "customer" && user.role === "admin" && req.user.id === user.id) {
    return res.status(400).json({ error: "You can't demote your own account." });
  }

  db.prepare("UPDATE users SET name = ?, role = ?, company = ?, phone = ? WHERE id = ?").run(
    name ?? user.name,
    role ?? user.role,
    company ?? user.company,
    phone ?? user.phone,
    user.id
  );

  const updated = db
    .prepare("SELECT id, name, email, role, company, phone, created_at FROM users WHERE id = ?")
    .get(user.id);
  res.json({ user: updated });
});

router.delete("/users/:id", (req, res) => {
  if (String(req.user.id) === String(req.params.id)) {
    return res.status(400).json({ error: "You can't delete your own account." });
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// All website build requests submitted by customers, newest first
router.get("/projects", (req, res) => {
  const projects = db
    .prepare(
      `SELECT projects.*, users.name AS customer_name, users.email AS customer_email
       FROM projects JOIN users ON users.id = projects.user_id
       ORDER BY projects.created_at DESC`
    )
    .all();
  res.json({ projects });
});

// Update status / admin notes on a request
router.patch("/projects/:id", (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const { status, admin_notes } = req.body || {};
  const next = {
    status: status ?? project.status,
    admin_notes: admin_notes ?? project.admin_notes,
  };

  db.prepare(
    "UPDATE projects SET status = ?, admin_notes = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(next.status, next.admin_notes, project.id);

  const updated = db.prepare("SELECT * FROM projects WHERE id = ?").get(project.id);
  res.json({ project: updated });
});

router.delete("/projects/:id", (req, res) => {
  db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Contact inbox
router.get("/messages", (req, res) => {
  const messages = db
    .prepare("SELECT * FROM contact_messages ORDER BY created_at DESC")
    .all();
  res.json({ messages });
});

router.patch("/messages/:id", (req, res) => {
  const { status } = req.body || {};
  db.prepare("UPDATE contact_messages SET status = ? WHERE id = ?").run(
    status || "read",
    req.params.id
  );
  res.json({ ok: true });
});

router.delete("/messages/:id", (req, res) => {
  db.prepare("DELETE FROM contact_messages WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ---------- Security ----------

// Recent login attempts across the whole site (successful and failed).
router.get("/security/login-history", (req, res) => {
  const history = db
    .prepare("SELECT * FROM login_history ORDER BY created_at DESC LIMIT 200")
    .all();
  res.json({ history });
});

// The logged-in admin changes their own password.
router.post("/security/change-password", (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found." });

  if (user.password_hash) {
    if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, user.id);
  res.json({ ok: true });
});

// Streams a copy of the SQLite database file so the admin can keep an offline backup.
router.get("/security/backup", (req, res) => {
  const dbPath = path.join(__dirname, "..", "webore.db");
  if (!fs.existsSync(dbPath)) return res.status(404).json({ error: "Database file not found." });
  res.download(dbPath, `webore-backup-${new Date().toISOString().slice(0, 10)}.db`);
});

// ---------- Deploy (informational only — this project has no CI/CD wired up) ----------

router.get("/deploy/status", (req, res) => {
  let commit = "unknown";
  let branch = "unknown";
  try {
    commit = execSync("git rev-parse --short HEAD", { cwd: path.join(__dirname, "..", ".."), stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: path.join(__dirname, "..", ".."), stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    /* not a git repo on this host — that's fine, just show "unknown" */
  }

  res.json({
    commit,
    branch,
    nodeVersion: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

export default router;
