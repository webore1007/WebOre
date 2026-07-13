import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `post-${Date.now()}`;
}

// Public: published posts only.
router.get("/", (req, res) => {
  const posts = db
    .prepare(
      "SELECT id, title, slug, excerpt, cover_image, published_at FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC"
    )
    .all();
  res.json({ posts });
});

router.get("/:slug", (req, res) => {
  const post = db
    .prepare("SELECT * FROM blog_posts WHERE slug = ? AND status = 'published'")
    .get(req.params.slug);
  if (!post) return res.status(404).json({ error: "Post not found." });
  res.json({ post });
});

// ---- Admin ----
const admin = Router();
admin.use(requireAuth, requireAdmin);

admin.get("/", (req, res) => {
  const posts = db.prepare("SELECT * FROM blog_posts ORDER BY updated_at DESC").all();
  res.json({ posts });
});

admin.post("/", (req, res) => {
  const { title, excerpt, content, cover_image, status } = req.body || {};
  if (!title) return res.status(400).json({ error: "Title is required." });

  let slug = slugify(req.body.slug || title);
  const existing = db.prepare("SELECT id FROM blog_posts WHERE slug = ?").get(slug);
  if (existing) slug = `${slug}-${Date.now().toString().slice(-5)}`;

  const finalStatus = status === "published" ? "published" : "draft";
  const info = db
    .prepare(
      `INSERT INTO blog_posts (title, slug, excerpt, content, cover_image, status, author_id, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      slug,
      excerpt || null,
      content || null,
      cover_image || null,
      finalStatus,
      req.user.id,
      finalStatus === "published" ? new Date().toISOString() : null
    );

  res.status(201).json({ post: db.prepare("SELECT * FROM blog_posts WHERE id = ?").get(info.lastInsertRowid) });
});

admin.patch("/:id", (req, res) => {
  const post = db.prepare("SELECT * FROM blog_posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found." });

  const { title, excerpt, content, cover_image, status } = req.body || {};
  const nextStatus = status && ["draft", "published"].includes(status) ? status : post.status;
  const justPublished = nextStatus === "published" && post.status !== "published";

  db.prepare(
    `UPDATE blog_posts SET
       title = ?, excerpt = ?, content = ?, cover_image = ?, status = ?,
       updated_at = datetime('now'), published_at = ?
     WHERE id = ?`
  ).run(
    title ?? post.title,
    excerpt ?? post.excerpt,
    content ?? post.content,
    cover_image ?? post.cover_image,
    nextStatus,
    justPublished ? new Date().toISOString() : post.published_at,
    post.id
  );

  res.json({ post: db.prepare("SELECT * FROM blog_posts WHERE id = ?").get(post.id) });
});

admin.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM blog_posts WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export { admin as adminBlogRouter };
export default router;
