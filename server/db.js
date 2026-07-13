import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(path.join(__dirname, "webore.db"));

db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'customer',
    company TEXT,
    phone TEXT,
    oauth_provider TEXT,
    oauth_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    industry TEXT,
    project_type TEXT NOT NULL,
    budget TEXT,
    timeline TEXT,
    pages_needed TEXT,
    features TEXT,
    design_style TEXT,
    reference_links TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    admin_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS project_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    author_role TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS pages (
    slug TEXT PRIMARY KEY,
    title TEXT,
    hero_title TEXT,
    hero_subtitle TEXT,
    body_html TEXT,
    meta_title TEXT,
    meta_description TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS portfolio_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    project_url TEXT,
    category TEXT,
    featured INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT,
    url TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    uploaded_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    excerpt TEXT,
    content TEXT,
    cover_image TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    author_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    published_at TEXT
  );

  CREATE TABLE IF NOT EXISTS login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT,
    role TEXT,
    success INTEGER NOT NULL DEFAULT 1,
    ip TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    referrer TEXT,
    user_agent TEXT,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migration for databases created before OAuth support was added.
const userColumns = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!userColumns.includes("oauth_provider")) {
  db.exec("ALTER TABLE users ADD COLUMN oauth_provider TEXT;");
}
if (!userColumns.includes("oauth_id")) {
  db.exec("ALTER TABLE users ADD COLUMN oauth_id TEXT;");
}

// Seed a default admin account on first boot so the admin panel is reachable immediately.
const adminEmail = "admin@webore.com";
const existingAdmin = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
if (!existingAdmin) {
  const hash = bcrypt.hashSync("Admin@123", 10);
  db.prepare(
    "INSERT INTO users (name, email, password_hash, role, company) VALUES (?, ?, ?, 'admin', ?)"
  ).run("WebOre Admin", adminEmail, hash, "WebOre");
  console.log("Seeded default admin -> admin@webore.com / Admin@123 (change this after first login)");
}

// Seed default site settings (only if missing) so the Settings admin page
// and public site both have sane defaults on first run.
const DEFAULT_SETTINGS = {
  site_name: "WebOre",
  tagline: "Building Your Digital Presence",
  contact_email: "webore1007@gmail.com",
  contact_phone: "",
  social_twitter: "",
  social_instagram: "",
  social_linkedin: "",
  social_github: "",
  seo_default_title: "WebOre — Building Your Digital Presence",
  seo_default_description: "Websites and digital products, designed and built end to end.",
  maintenance_mode: "0",
  maintenance_message: "We're doing a bit of maintenance. Back shortly.",
  google_client_id: process.env.GOOGLE_CLIENT_ID || "64676272437-bjl4nnqekk7og2u6l3ki0gab7m1eqc4i.apps.googleusercontent.com",
  facebook_app_id: process.env.FACEBOOK_APP_ID || "",
  ga_measurement_id: "",
};
const insertSetting = db.prepare(
  "INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)"
);
for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  insertSetting.run(key, value);
}

// Seed default editable content for the four public pages.
const DEFAULT_PAGES = {
  home: {
    title: "Home",
    hero_title: "WebOre",
    hero_subtitle: "Building Your Digital Presence.",
    meta_title: "WebOre — Building Your Digital Presence",
    meta_description: "Websites and digital products, designed and built end to end.",
  },
  about: {
    title: "About",
    hero_title: "Craft, restraint, precision",
    hero_subtitle:
      "WebOre is a studio for teams who care about the details. We design and build websites the way we'd want ours built — considered, fast, and honest about what it takes to get there.",
    meta_title: "About — WebOre",
    meta_description: "Learn how WebOre designs and builds websites end to end.",
  },
  services: {
    title: "Services",
    hero_title: "What we build",
    hero_subtitle:
      "Websites, digital products, and brand experiences — designed and engineered with the same craftsmanship, end to end.",
    meta_title: "Services — WebOre",
    meta_description: "WebOre's website and digital product packages and pricing.",
  },
  contact: {
    title: "Contact",
    hero_title: "Let's talk",
    hero_subtitle:
      "Tell us about your project and we'll get back to you within one business day — or create an account for a more detailed brief and request tracking.",
    meta_title: "Contact — WebOre",
    meta_description: "Get in touch with WebOre to start your project.",
  },
};
const insertPage = db.prepare(
  `INSERT OR IGNORE INTO pages (slug, title, hero_title, hero_subtitle, body_html, meta_title, meta_description)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
for (const [slug, p] of Object.entries(DEFAULT_PAGES)) {
  insertPage.run(slug, p.title, p.hero_title, p.hero_subtitle, "", p.meta_title, p.meta_description);
}

export default db;
