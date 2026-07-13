import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Public: the site's own pages ping this once on load (see js/main.js).
// Deliberately tiny — no cookies, no fingerprinting, just a path + day count.
router.post("/pageview", (req, res) => {
  const { path: pagePath, referrer } = req.body || {};
  if (!pagePath || typeof pagePath !== "string" || pagePath.length > 300) {
    return res.status(204).end();
  }
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
  db.prepare(
    "INSERT INTO page_views (path, referrer, user_agent, ip, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
  ).run(pagePath.slice(0, 300), (referrer || "").slice(0, 300), (req.headers["user-agent"] || "").slice(0, 300), ip);
  res.status(204).end();
});

router.use(requireAuth, requireAdmin);

router.get("/summary", (req, res) => {
  const totalViews = db.prepare("SELECT COUNT(*) c FROM page_views").get().c;
  const last7 = db
    .prepare("SELECT COUNT(*) c FROM page_views WHERE created_at >= datetime('now', '-7 days')")
    .get().c;
  const last30 = db
    .prepare("SELECT COUNT(*) c FROM page_views WHERE created_at >= datetime('now', '-30 days')")
    .get().c;

  const topPages = db
    .prepare(
      `SELECT path, COUNT(*) views FROM page_views
       WHERE created_at >= datetime('now', '-30 days')
       GROUP BY path ORDER BY views DESC LIMIT 10`
    )
    .all();

  const byDay = db
    .prepare(
      `SELECT date(created_at) day, COUNT(*) views FROM page_views
       WHERE created_at >= datetime('now', '-14 days')
       GROUP BY day ORDER BY day ASC`
    )
    .all();

  const topReferrers = db
    .prepare(
      `SELECT COALESCE(NULLIF(referrer, ''), 'Direct / unknown') referrer, COUNT(*) c
       FROM page_views WHERE created_at >= datetime('now', '-30 days')
       GROUP BY referrer ORDER BY c DESC LIMIT 8`
    )
    .all();

  res.json({ totalViews, last7, last30, topPages, byDay, topReferrers });
});

export default router;
