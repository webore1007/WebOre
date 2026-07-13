import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Create a new website build request (the "fill in details for their website" form)
router.post("/", requireAuth, (req, res) => {
  const {
    business_name,
    industry,
    project_type,
    budget,
    timeline,
    pages_needed,
    features,
    design_style,
    reference_links,
    description,
  } = req.body || {};

  if (!business_name || !project_type) {
    return res.status(400).json({ error: "Business name and project type are required." });
  }

  const info = db
    .prepare(
      `INSERT INTO projects
        (user_id, business_name, industry, project_type, budget, timeline, pages_needed, features, design_style, reference_links, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      business_name,
      industry || null,
      project_type,
      budget || null,
      timeline || null,
      pages_needed || null,
      Array.isArray(features) ? features.join(", ") : features || null,
      design_style || null,
      reference_links || null,
      description || null
    );

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ project });
});

// List the logged-in customer's own requests
router.get("/mine", requireAuth, (req, res) => {
  const projects = db
    .prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC")
    .all(req.user.id);
  res.json({ projects });
});

// Get a single project (owner or admin)
router.get("/:id", requireAuth, (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (project.user_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Not allowed." });
  }
  const messages = db
    .prepare("SELECT * FROM project_messages WHERE project_id = ? ORDER BY created_at ASC")
    .all(project.id);
  res.json({ project, messages });
});

// Add a message/comment to a project thread (owner or admin)
router.post("/:id/messages", requireAuth, (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (project.user_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Not allowed." });
  }
  const { body } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: "Message cannot be empty." });

  db.prepare(
    "INSERT INTO project_messages (project_id, author_role, body) VALUES (?, ?, ?)"
  ).run(project.id, req.user.role, body.trim());

  db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(project.id);

  const messages = db
    .prepare("SELECT * FROM project_messages WHERE project_id = ? ORDER BY created_at ASC")
    .all(project.id);
  res.status(201).json({ messages });
});

export default router;
