const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { pool } = require('../db/pool');

const router = express.Router();

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads', 'userpages');
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

// ===== GET /api/pages?user_id=N — สาธารณะ: รายการปุ่มของตัวแทนคนหนึ่ง (เฉพาะที่เปิด) =====
router.get('/pages', async (req, res, next) => {
  try {
    const userId = Number(req.query.user_id);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'user_id ไม่ถูกต้อง' });
    const [rows] = await pool.query(
      `SELECT id, button_text, button_image, sort_order
         FROM user_pages WHERE user_id = ? AND is_active = 1
        ORDER BY sort_order, id`,
      [userId]
    );
    res.json({ ok: true, pages: rows });
  } catch (err) { next(err); }
});

// ===== GET /api/pages/mine — เจ้าของ: รายการปุ่มของตัวเอง (รวมที่ปิด) =====
router.get('/pages/mine', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, button_text, button_image, content, sort_order, is_active
         FROM user_pages WHERE user_id = ? ORDER BY sort_order, id`,
      [req.session.userId]
    );
    res.json({ ok: true, pages: rows });
  } catch (err) { next(err); }
});

// ===== GET /api/pages/:id — สาธารณะ: เนื้อหา 1 หน้า =====
router.get('/pages/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });
    const [rows] = await pool.query(
      `SELECT id, user_id, button_text, button_image, content, is_active FROM user_pages WHERE id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบหน้านี้' });
    const page = rows[0];
    // หน้าที่ปิดอยู่ ให้ดูได้เฉพาะเจ้าของ
    if (!page.is_active && (!req.session || req.session.userId !== page.user_id)) {
      return res.status(404).json({ error: 'ไม่พบหน้านี้' });
    }
    const isOwner = !!(req.session && req.session.userId === page.user_id);
    res.json({ ok: true, page, is_owner: isOwner });
  } catch (err) { next(err); }
});

// ===== POST /api/pages — เจ้าของ: เพิ่มปุ่ม/หน้าใหม่ =====
router.post('/pages', requireAuth, express.json(), async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const buttonText = (req.body && req.body.button_text ? String(req.body.button_text) : '').trim() || 'ปุ่มใหม่';
    const content = req.body && req.body.content != null ? String(req.body.content) : '';

    const [[{ maxOrder }]] = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM user_pages WHERE user_id = ?',
      [userId]
    );
    const [result] = await pool.query(
      `INSERT INTO user_pages (user_id, button_text, content, sort_order) VALUES (?, ?, ?, ?)`,
      [userId, buttonText.slice(0, 120), content, maxOrder + 1]
    );
    res.json({ ok: true, id: result.insertId });
  } catch (err) { next(err); }
});

// ===== PUT /api/pages/:id — เจ้าของ: แก้ข้อความปุ่ม / เนื้อหา / สถานะ =====
router.put('/pages/:id', requireAuth, express.json(), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const [rows] = await pool.query('SELECT user_id FROM user_pages WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบหน้านี้' });
    if (rows[0].user_id !== req.session.userId) return res.status(403).json({ error: 'ไม่ใช่เจ้าของหน้านี้' });

    const b = req.body || {};
    const updates = {};
    if ('button_text' in b) updates.button_text = String(b.button_text).trim().slice(0, 120) || 'ปุ่มใหม่';
    if ('content' in b) updates.content = b.content == null ? null : String(b.content);
    if ('is_active' in b) updates.is_active = b.is_active ? 1 : 0;
    if ('sort_order' in b && Number.isInteger(Number(b.sort_order))) updates.sort_order = Number(b.sort_order);

    const keys = Object.keys(updates);
    if (keys.length === 0) return res.status(400).json({ error: 'ไม่มีข้อมูลที่ต้องแก้ไข' });
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => updates[k]);
    values.push(id);
    await pool.query(`UPDATE user_pages SET ${setClause} WHERE id = ?`, values);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ===== POST /api/pages/:id/image — เจ้าของ: อัปโหลดรูปปุ่ม =====
router.post('/pages/:id/image', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์รูป' });
    const newPath = `/uploads/userpages/${req.file.filename}`;

    const [rows] = await pool.query('SELECT user_id, button_image FROM user_pages WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) { safeUnlink(newPath); return res.status(404).json({ error: 'ไม่พบหน้านี้' }); }
    if (rows[0].user_id !== req.session.userId) { safeUnlink(newPath); return res.status(403).json({ error: 'ไม่ใช่เจ้าของหน้านี้' }); }

    await pool.query('UPDATE user_pages SET button_image = ? WHERE id = ?', [newPath, id]);
    if (rows[0].button_image && rows[0].button_image !== newPath) safeUnlink(rows[0].button_image);
    res.json({ ok: true, image: newPath });
  } catch (err) { next(err); }
});

// ===== DELETE /api/pages/:id — เจ้าของ: ลบปุ่ม/หน้า =====
router.delete('/pages/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query('SELECT user_id, button_image FROM user_pages WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบหน้านี้' });
    if (rows[0].user_id !== req.session.userId) return res.status(403).json({ error: 'ไม่ใช่เจ้าของหน้านี้' });
    await pool.query('DELETE FROM user_pages WHERE id = ?', [id]);
    if (rows[0].button_image) safeUnlink(rows[0].button_image);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
