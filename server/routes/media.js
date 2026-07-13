import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import db from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME = /^(image\/(png|jpe?g|gif|webp|svg\+xml)|video\/(mp4|webm|quicktime)|application\/pdf)$/;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 60);
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.test(file.mimetype)) {
      return cb(new Error("Unsupported file type."));
    }
    cb(null, true);
  },
});

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/", (req, res) => {
  const items = db.prepare("SELECT * FROM media ORDER BY created_at DESC").all();
  res.json({ items });
});

router.post("/upload", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || "Upload failed." });
    if (!req.file) return res.status(400).json({ error: "No file received." });

    const url = `/uploads/${req.file.filename}`;
    const info = db
      .prepare(
        "INSERT INTO media (filename, original_name, url, mime_type, size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(req.file.filename, req.file.originalname, url, req.file.mimetype, req.file.size, req.user.id);

    res.status(201).json({ item: db.prepare("SELECT * FROM media WHERE id = ?").get(info.lastInsertRowid) });
  });
});

router.delete("/:id", (req, res) => {
  const item = db.prepare("SELECT * FROM media WHERE id = ?").get(req.params.id);
  if (!item) return res.status(404).json({ error: "File not found." });

  const filePath = path.join(UPLOADS_DIR, item.filename);
  fs.rm(filePath, { force: true }, () => {});
  db.prepare("DELETE FROM media WHERE id = ?").run(item.id);
  res.json({ ok: true });
});

export default router;
