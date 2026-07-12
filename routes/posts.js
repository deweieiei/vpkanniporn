const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { pool } = require('../db/pool');

const router = express.Router();

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads', 'posts');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
}

function webPathToDisk(webPath) {
  if (typeof webPath !== 'string' || !webPath.startsWith('/uploads/')) return null;
  const candidate = path.resolve(PUBLIC_DIR, '.' + webPath);
  const base = path.join(PUBLIC_DIR, 'uploads');
  if (!candidate.startsWith(base + path.sep)) return null;
  return candidate;
}
function safeUnlink(webPath) {
  const disk = webPathToDisk(webPath);
  if (!disk) return;
  fs.unlink(disk, (err) => { if (err && err.code !== 'ENOENT') console.warn('unlink', err.message); });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || '.jpg';
      cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpe?g|png|webp|gif)$/i.test(file.mimetype)) return cb(null, true);
    cb(new Error('อนุญาตเฉพาะรูปภาพ'));
  },
});

// ===== GET /api/posts?user_id=N — สาธารณะ: โพสต์ที่เปิดแสดงของตัวแทนคนนั้น =====
router.get('/posts', async (req, res, next) => {
  try {
    const userId = Number(req.query.user_id);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'user_id ไม่ถูกต้อง' });
    const [rows] = await pool.query(
      `SELECT id, content, image_path, created_at
         FROM agent_posts WHERE user_id = ? AND is_visible = 1
        ORDER BY created_at DESC, id DESC`,
      [userId]
    );
    res.json({ ok: true, posts: rows });
  } catch (err) { next(err); }
});

// ===== GET /api/posts/mine — เจ้าของ: โพสต์ของตัวเองทั้งหมด (รวมที่ซ่อน) =====
router.get('/posts/mine', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, content, image_path, is_visible, created_at
         FROM agent_posts WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
      [req.session.userId]
    );
    res.json({ ok: true, posts: rows });
  } catch (err) { next(err); }
});

// ===== POST /api/posts — เจ้าของ: สร้างโพสต์ใหม่ (ข้อความ + รูป 1 รูป ไม่บังคับ) =====
router.post('/posts', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    const content = req.body && req.body.content != null ? String(req.body.content).trim().slice(0, 5000) : '';
    const imagePath = req.file ? `/uploads/posts/${req.file.filename}` : null;

    // ต้องมีอย่างน้อยข้อความหรือรูป
    if (!content && !imagePath) {
      return res.status(400).json({ error: 'กรุณาใส่ข้อความหรือรูปอย่างน้อยหนึ่งอย่าง' });
    }
    const isVisible = (req.body && (req.body.is_visible === '0' || req.body.is_visible === 0 || req.body.is_visible === false)) ? 0 : 1;

    const [result] = await pool.query(
      `INSERT INTO agent_posts (user_id, content, image_path, is_visible) VALUES (?, ?, ?, ?)`,
      [req.session.userId, content || null, imagePath, isVisible]
    );
    res.json({ ok: true, id: result.insertId, image_path: imagePath });
  } catch (err) { next(err); }
});

// ===== PUT /api/posts/:id — เจ้าของ: แก้ข้อความ / เปิด-ปิดการแสดง =====
router.put('/posts/:id', requireAuth, express.json(), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const [rows] = await pool.query('SELECT user_id FROM agent_posts WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบโพสต์นี้' });
    if (rows[0].user_id !== req.session.userId) return res.status(403).json({ error: 'ไม่ใช่เจ้าของโพสต์นี้' });

    const b = req.body || {};
    const updates = {};
    if ('content' in b) updates.content = b.content == null ? null : String(b.content).trim().slice(0, 5000) || null;
    if ('is_visible' in b) updates.is_visible = b.is_visible ? 1 : 0;

    const keys = Object.keys(updates);
    if (keys.length === 0) return res.status(400).json({ error: 'ไม่มีข้อมูลที่ต้องแก้ไข' });
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => updates[k]);
    values.push(id);
    await pool.query(`UPDATE agent_posts SET ${setClause} WHERE id = ?`, values);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ===== POST /api/posts/:id/image — เจ้าของ: เปลี่ยน/เพิ่มรูปของโพสต์ =====
router.post('/posts/:id/image', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์รูป' });
    const newPath = `/uploads/posts/${req.file.filename}`;

    const [rows] = await pool.query('SELECT user_id, image_path FROM agent_posts WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) { safeUnlink(newPath); return res.status(404).json({ error: 'ไม่พบโพสต์นี้' }); }
    if (rows[0].user_id !== req.session.userId) { safeUnlink(newPath); return res.status(403).json({ error: 'ไม่ใช่เจ้าของโพสต์นี้' }); }

    await pool.query('UPDATE agent_posts SET image_path = ? WHERE id = ?', [newPath, id]);
    if (rows[0].image_path && rows[0].image_path !== newPath) safeUnlink(rows[0].image_path);
    res.json({ ok: true, image_path: newPath });
  } catch (err) { next(err); }
});

// ===== DELETE /api/posts/:id — เจ้าของ: ลบโพสต์ (ลบไฟล์รูปด้วย) =====
router.delete('/posts/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const [rows] = await pool.query('SELECT user_id, image_path FROM agent_posts WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบโพสต์นี้' });
    if (rows[0].user_id !== req.session.userId) return res.status(403).json({ error: 'ไม่ใช่เจ้าของโพสต์นี้' });

    await pool.query('DELETE FROM agent_posts WHERE id = ?', [id]);
    if (rows[0].image_path) safeUnlink(rows[0].image_path);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
