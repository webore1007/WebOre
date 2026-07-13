import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Public: everyone can see the portfolio, ordered the way the admin set.
router.get("/", (req, res) => {
  const items = db
    .prepare("SELECT * FROM portfolio_items ORDER BY sort_order ASC, created_at DESC")
    .all();
  res.json({ items });
});

router.use(requireAuth, requireAdmin);

router.post("/", (req, res) => {
  const { title, description, image_url, project_url, category, featured, sort_order } = req.body || {};
  if (!title) return res.status(400).json({ error: "Title is required." });

  const info = db
    .prepare(
      `INSERT INTO portfolio_items (title, description, image_url, project_url, category, featured, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      description || null,
      image_url || null,
      project_url || null,
      category || null,
      featured ? 1 : 0,
      Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0
    );

  res.status(201).json({ item: db.prepare("SELECT * FROM portfolio_items WHERE id = ?").get(info.lastInsertRowid) });
});

router.patch("/:id", (req, res) => {
  const item = db.prepare("SELECT * FROM portfolio_items WHERE id = ?").get(req.params.id);
  if (!item) return res.status(404).json({ error: "Portfolio item not found." });

  const { title, description, image_url, project_url, category, featured, sort_order } = req.body || {};
  db.prepare(
    `UPDATE portfolio_items SET
       title = ?, description = ?, image_url = ?, project_url = ?, category = ?, featured = ?, sort_order = ?
     WHERE id = ?`
  ).run(
    title ?? item.title,
    description ?? item.description,
    image_url ?? item.image_url,
    project_url ?? item.project_url,
    category ?? item.category,
    featured != null ? (featured ? 1 : 0) : item.featured,
    sort_order != null && Number.isFinite(Number(sort_order)) ? Number(sort_order) : item.sort_order,
    item.id
  );

  res.json({ item: db.prepare("SELECT * FROM portfolio_items WHERE id = ?").get(item.id) });
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM portfolio_items WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;
