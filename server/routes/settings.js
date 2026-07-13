import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Keys any visitor's browser is allowed to see (needed to render the public
// site: OAuth client IDs, contact info, social links, SEO defaults, etc.)
// Anything else (left as admin-only) never leaves the server.
const PUBLIC_KEYS = [
  "site_name",
  "tagline",
  "contact_email",
  "contact_phone",
  "social_twitter",
  "social_instagram",
  "social_linkedin",
  "social_github",
  "seo_default_title",
  "seo_default_description",
  "maintenance_mode",
  "maintenance_message",
  "google_client_id",
  "facebook_app_id",
  "ga_measurement_id",
];

function getAllSettings() {
  const rows = db.prepare("SELECT key, value FROM site_settings").all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

// Public: only the safe subset, used by config.js / auth.js at runtime so the
// site doesn't need code edits to turn on Google/Facebook login.
router.get("/public", (req, res) => {
  const all = getAllSettings();
  const out = {};
  for (const k of PUBLIC_KEYS) out[k] = all[k] ?? "";
  res.json({ settings: out });
});

// Admin: full settings object.
router.get("/", requireAuth, requireAdmin, (req, res) => {
  res.json({ settings: getAllSettings() });
});

// Admin: update one or more settings at once, e.g.
// { "site_name": "WebOre", "maintenance_mode": "1" }
router.patch("/", requireAuth, requireAdmin, (req, res) => {
  const body = req.body || {};
  const upsert = db.prepare(
    "INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  for (const [key, value] of Object.entries(body)) {
    upsert.run(key, value == null ? "" : String(value));
  }
  res.json({ settings: getAllSettings() });
});

export default router;
