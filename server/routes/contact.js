import { Router } from "express";
import db from "../db.js";

const router = Router();

router.post("/", (req, res) => {
  const { name, email, subject, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Name, email, and message are required." });
  }

  db.prepare(
    "INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)"
  ).run(name, email, subject || null, message);

  res.status(201).json({ ok: true });
});

export default router;
