import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
const ALLOWED_SLUGS = ["home", "about", "services", "contact"];

// Public: fetch one page's editable content (used by the site's own pages to
// overlay admin-edited hero text at load time — see js/pages-cms.js).
router.get("/:slug", (req, res) => {
  if (!ALLOWED_SLUGS.includes(req.params.slug)) {
    return res.status(404).json({ error: "Unknown page." });
  }
  const page = db.prepare("SELECT * FROM pages WHERE slug = ?").get(req.params.slug);
  if (!page) return res.status(404).json({ error: "Page not found." });
  res.json({ page });
});

// Admin: list every editable page.
router.get("/", requireAuth, requireAdmin, (req, res) => {
  const pages = db.prepare("SELECT * FROM pages ORDER BY slug").all();
  res.json({ pages });
});

// Admin: update a page's editable fields.
router.patch("/:slug", requireAuth, requireAdmin, (req, res) => {
  if (!ALLOWED_SLUGS.includes(req.params.slug)) {
    return res.status(404).json({ error: "Unknown page." });
  }
  const page = db.prepare("SELECT * FROM pages WHERE slug = ?").get(req.params.slug);
  if (!page) return res.status(404).json({ error: "Page not found." });

  const { title, hero_title, hero_subtitle, body_html, meta_title, meta_description } = req.body || {};
  db.prepare(
    `UPDATE pages SET
       title = ?, hero_title = ?, hero_subtitle = ?, body_html = ?,
       meta_title = ?, meta_description = ?, updated_at = datetime('now')
     WHERE slug = ?`
  ).run(
    title ?? page.title,
    hero_title ?? page.hero_title,
    hero_subtitle ?? page.hero_subtitle,
    body_html ?? page.body_html,
    meta_title ?? page.meta_title,
    meta_description ?? page.meta_description,
    req.params.slug
  );

  res.json({ page: db.prepare("SELECT * FROM pages WHERE slug = ?").get(req.params.slug) });
});

export default router;
