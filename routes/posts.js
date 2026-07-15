const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { pool } = require('../db/pool');

const router = express.Router();

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads', 'posts');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_IMAGES = 30; // จำนวนรูปสูงสุดต่อโพสต์

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
function parseImages(v) {
  if (!v) return [];
  try {
    const a = typeof v === 'string' ? JSON.parse(v) : v;
    return Array.isArray(a) ? a.filter(s => typeof s === 'string') : [];
  } catch { return []; }
}
// รวมรูปของโพสต์เป็น array เดียว (รองรับโพสต์เก่าที่มีแค่ image_path)
function postImages(row) {
  const arr = parseImages(row.images);
  if (arr.length) return arr;
  return row.image_path ? [row.image_path] : [];
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
      `SELECT id, content, image_path, images, created_at
         FROM agent_posts WHERE user_id = ? AND is_visible = 1
        ORDER BY created_at DESC, id DESC`,
      [userId]
    );
    res.json({ ok: true, posts: rows.map(r => ({ ...r, images: postImages(r) })) });
  } catch (err) { next(err); }
});

// ===== GET /api/posts/mine — เจ้าของ: โพสต์ของตัวเองทั้งหมด (รวมที่ซ่อน) =====
router.get('/posts/mine', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, content, image_path, images, is_visible, created_at
         FROM agent_posts WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
      [req.session.userId]
    );
    res.json({ ok: true, posts: rows.map(r => ({ ...r, images: postImages(r) })) });
  } catch (err) { next(err); }
});

// ===== GET /api/posts/:id — สาธารณะ: โพสต์เดียว (พร้อมข้อมูลตัวแทน) สำหรับหน้า /post/:id =====
router.get('/posts/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });
    const [rows] = await pool.query(
      `SELECT p.id, p.user_id, p.content, p.image_path, p.images, p.is_visible, p.created_at,
              u.first_name, u.last_name, u.avatar_path
         FROM agent_posts p JOIN users u ON u.id = p.user_id
        WHERE p.id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบโพสต์นี้' });
    const p = rows[0];
    // โพสต์ที่ซ่อน ดูได้เฉพาะเจ้าของ
    const isOwner = !!(req.session && req.session.userId === p.user_id);
    if (!p.is_visible && !isOwner) return res.status(404).json({ error: 'ไม่พบโพสต์นี้' });
    res.json({
      ok: true,
      post: {
        id: p.id, user_id: p.user_id, content: p.content, images: postImages(p),
        is_visible: p.is_visible, created_at: p.created_at,
        author: {
          first_name: p.first_name, last_name: p.last_name, avatar_path: p.avatar_path,
        },
      },
    });
  } catch (err) { next(err); }
});

// ===== POST /api/posts — เจ้าของ: สร้างโพสต์ใหม่ (ข้อความ + รูปหลายรูป ไม่บังคับ) =====
router.post('/posts', requireAuth, upload.array('images', MAX_IMAGES), async (req, res, next) => {
  try {
    const content = req.body && req.body.content != null ? String(req.body.content).trim().slice(0, 5000) : '';
    const paths = (req.files || []).map(f => `/uploads/posts/${f.filename}`);

    if (!content && paths.length === 0) {
      (req.files || []).forEach(f => safeUnlink(`/uploads/posts/${f.filename}`));
      return res.status(400).json({ error: 'กรุณาใส่ข้อความหรือรูปอย่างน้อยหนึ่งอย่าง' });
    }
    const isVisible = (req.body && (req.body.is_visible === '0' || req.body.is_visible === 0 || req.body.is_visible === false)) ? 0 : 1;
    const imagesJson = paths.length ? JSON.stringify(paths) : null;

    const [result] = await pool.query(
      `INSERT INTO agent_posts (user_id, content, image_path, images, is_visible) VALUES (?, ?, ?, ?, ?)`,
      [req.session.userId, content || null, paths[0] || null, imagesJson, isVisible]
    );
    res.json({ ok: true, id: result.insertId, images: paths });
  } catch (err) { next(err); }
});

// ===== PUT /api/posts/:id — เจ้าของ: แก้ข้อความ / เปิด-ปิดการแสดง (ไม่ยุ่งกับรูป) =====
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

// ===== POST /api/posts/:id/images — เจ้าของ: กำหนดชุดรูปใหม่ (เก็บที่เลือกไว้ + เพิ่มไฟล์ใหม่) =====
// body: images_keep = JSON array ของ path เดิมที่ต้องการเก็บ, files field 'images' = รูปใหม่
router.post('/posts/:id/images', requireAuth, upload.array('images', MAX_IMAGES), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const newPaths = (req.files || []).map(f => `/uploads/posts/${f.filename}`);
    const cleanupNew = () => newPaths.forEach(safeUnlink);

    if (!Number.isInteger(id) || id <= 0) { cleanupNew(); return res.status(400).json({ error: 'id ไม่ถูกต้อง' }); }
    const [rows] = await pool.query('SELECT user_id, image_path, images FROM agent_posts WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) { cleanupNew(); return res.status(404).json({ error: 'ไม่พบโพสต์นี้' }); }
    if (rows[0].user_id !== req.session.userId) { cleanupNew(); return res.status(403).json({ error: 'ไม่ใช่เจ้าของโพสต์นี้' }); }

    const oldImages = postImages(rows[0]);
    let keep = [];
    if (req.body && req.body.images_keep != null) {
      try {
        const parsed = typeof req.body.images_keep === 'string' ? JSON.parse(req.body.images_keep) : req.body.images_keep;
        keep = Array.isArray(parsed) ? parsed.filter(p => oldImages.includes(p)) : [];
      } catch { keep = []; }
    } else {
      keep = oldImages; // ไม่ส่ง keep = เก็บของเดิมทั้งหมด แล้วต่อท้ายด้วยรูปใหม่
    }

    const merged = [...keep, ...newPaths].slice(0, MAX_IMAGES);
    // ไฟล์ใหม่ที่เกินโควตา (ถูก slice ทิ้ง) + รูปเก่าที่ไม่ได้เก็บ → ลบทิ้ง
    newPaths.forEach(p => { if (!merged.includes(p)) safeUnlink(p); });
    oldImages.forEach(p => { if (!merged.includes(p)) safeUnlink(p); });

    const imagesJson = merged.length ? JSON.stringify(merged) : null;
    await pool.query('UPDATE agent_posts SET images = ?, image_path = ? WHERE id = ?', [imagesJson, merged[0] || null, id]);
    res.json({ ok: true, images: merged });
  } catch (err) { next(err); }
});

// ===== DELETE /api/posts/:id — เจ้าของ: ลบโพสต์ (ลบไฟล์รูปทุกรูปด้วย) =====
router.delete('/posts/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const [rows] = await pool.query('SELECT user_id, image_path, images FROM agent_posts WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบโพสต์นี้' });
    if (rows[0].user_id !== req.session.userId) return res.status(403).json({ error: 'ไม่ใช่เจ้าของโพสต์นี้' });

    await pool.query('DELETE FROM agent_posts WHERE id = ?', [id]);
    const all = new Set(postImages(rows[0]));
    if (rows[0].image_path) all.add(rows[0].image_path);
    all.forEach(safeUnlink);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
