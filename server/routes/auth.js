import { Router } from "express";
import bcrypt from "bcryptjs";
import db from "../db.js";
import { requireAuth, signToken } from "../middleware/auth.js";

const router = Router();

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
}

function logLogin(req, { userId, email, role, success }) {
  try {
    db.prepare(
      "INSERT INTO login_history (user_id, email, role, success, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(userId || null, email || null, role || null, success ? 1 : 0, clientIp(req), (req.headers["user-agent"] || "").slice(0, 300));
  } catch {
    /* login history is best-effort only */
  }
}

function getSetting(key) {
  const row = db.prepare("SELECT value FROM site_settings WHERE key = ?").get(key);
  return row ? row.value : "";
}

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    company: u.company,
    phone: u.phone,
    created_at: u.created_at,
  };
}

router.post("/signup", (req, res) => {
  const { name, email, password, company, phone } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      "INSERT INTO users (name, email, password_hash, role, company, phone) VALUES (?, ?, ?, 'customer', ?, ?)"
    )
    .run(name, email.toLowerCase(), hash, company || null, phone || null);

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
  if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
    logLogin(req, { email: email.toLowerCase(), success: false });
    return res.status(401).json({ error: "Invalid email or password." });
  }

  logLogin(req, { userId: user.id, email: user.email, role: user.role, success: true });
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

// ---------- Social login helpers ----------

function findOrCreateOauthUser({ provider, oauthId, email, name }) {
  const normalizedEmail = (email || "").toLowerCase();

  // If this provider+id already has an account, use it.
  let user = db
    .prepare("SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?")
    .get(provider, oauthId);
  if (user) return user;

  // Otherwise, link to an existing email/password account with the same email,
  // or create a brand new account.
  if (normalizedEmail) {
    user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);
  }

  if (user) {
    db.prepare("UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?").run(
      provider,
      oauthId,
      user.id
    );
    return db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  }

  const info = db
    .prepare(
      "INSERT INTO users (name, email, password_hash, role, oauth_provider, oauth_id) VALUES (?, ?, NULL, 'customer', ?, ?)"
    )
    .run(name || "New user", normalizedEmail || `${provider}_${oauthId}@no-email.webore`, provider, oauthId);

  return db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
}

router.post("/google", async (req, res) => {
  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: "Missing Google credential." });

  try {
    // Lightweight verification via Google's tokeninfo endpoint — no extra dependency needed.
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!verifyRes.ok) throw new Error("invalid token");
    const payload = await verifyRes.json();

    const expectedClientId = getSetting("google_client_id") || process.env.GOOGLE_CLIENT_ID;
    if (expectedClientId && payload.aud !== expectedClientId) {
      return res.status(401).json({ error: "Google sign-in is not configured for this site." });
    }
    if (!["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)) {
      throw new Error("invalid issuer");
    }

    const user = findOrCreateOauthUser({
      provider: "google",
      oauthId: payload.sub,
      email: payload.email,
      name: payload.name,
    });

    logLogin(req, { userId: user.id, email: user.email, role: user.role, success: true });
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch {
    res.status(401).json({ error: "Could not verify Google sign-in. Please try again." });
  }
});

router.post("/facebook", async (req, res) => {
  const { accessToken } = req.body || {};
  if (!accessToken) return res.status(400).json({ error: "Missing Facebook access token." });

  try {
    const profileRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`
    );
    if (!profileRes.ok) throw new Error("invalid token");
    const profile = await profileRes.json();
    if (!profile.id) throw new Error("invalid profile");

    const user = findOrCreateOauthUser({
      provider: "facebook",
      oauthId: profile.id,
      email: profile.email,
      name: profile.name,
    });

    logLogin(req, { userId: user.id, email: user.email, role: user.role, success: true });
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch {
    res.status(401).json({ error: "Could not verify Facebook sign-in. Please try again." });
  }
});

router.get("/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({ user: publicUser(user) });
});

export default router;
