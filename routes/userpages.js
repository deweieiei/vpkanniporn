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

// Sanitize เนื้อหา HTML จาก Rich Text Editor ก่อนเก็บลง DB (กัน XSS)
// เจ้าของแก้เฉพาะหน้าตัวเอง แต่เนื้อหาถูกแสดงให้ผู้เข้าชมด้วย → ตัด script/iframe/event handler/javascript:
function sanitizeHtml(html) {
  if (typeof html !== 'string') return html;
  return html
    .replace(/<\s*(script|iframe|object|embed|style|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|style|link|meta)\b[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');
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

// ===== GET /api/pages — สาธารณะ: รายการบลอค (เฉพาะที่เปิด) =====
//   ?user_id=N              → บลอคชั้นบนสุดของตัวแทนคนนั้น (parent_id IS NULL) — ใช้ในโปรไฟล์
//   ?parent_id=X            → บลอคย่อยที่อยู่ข้างในหน้า X — ใช้ในหน้า /page/X
router.get('/pages', async (req, res, next) => {
  try {
    const parentRaw = req.query.parent_id;
    if (parentRaw != null && parentRaw !== '') {
      const parentId = Number(parentRaw);
      if (!Number.isInteger(parentId) || parentId <= 0) return res.status(400).json({ error: 'parent_id ไม่ถูกต้อง' });
      const [rows] = await pool.query(
        `SELECT id, button_text, button_image, sort_order
           FROM user_pages WHERE parent_id = ? AND is_active = 1
          ORDER BY sort_order, id`,
        [parentId]
      );
      return res.json({ ok: true, pages: rows });
    }
    const userId = Number(req.query.user_id);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'user_id ไม่ถูกต้อง' });
    const [rows] = await pool.query(
      `SELECT id, button_text, button_image, sort_order
         FROM user_pages WHERE user_id = ? AND parent_id IS NULL AND is_active = 1
        ORDER BY sort_order, id`,
      [userId]
    );
    res.json({ ok: true, pages: rows });
  } catch (err) { next(err); }
});

// ===== GET /api/pages/mine — เจ้าของ: รายการบลอคของตัวเอง (รวมที่ปิด) =====
//   (ไม่มี query)  → บลอคชั้นบนสุด (parent_id IS NULL)
//   ?parent_id=X   → บลอคย่อยข้างในหน้า X (ต้องเป็นเจ้าของหน้า X)
router.get('/pages/mine', requireAuth, async (req, res, next) => {
  try {
    const parentRaw = req.query.parent_id;
    if (parentRaw != null && parentRaw !== '') {
      const parentId = Number(parentRaw);
      if (!Number.isInteger(parentId) || parentId <= 0) return res.status(400).json({ error: 'parent_id ไม่ถูกต้อง' });
      const [p] = await pool.query('SELECT user_id FROM user_pages WHERE id = ? LIMIT 1', [parentId]);
      if (p.length === 0) return res.status(404).json({ error: 'ไม่พบหน้านี้' });
      if (p[0].user_id !== req.session.userId) return res.status(403).json({ error: 'ไม่ใช่เจ้าของหน้านี้' });
      const [rows] = await pool.query(
        `SELECT id, button_text, button_image, content, sort_order, is_active
           FROM user_pages WHERE parent_id = ? ORDER BY sort_order, id`,
        [parentId]
      );
      return res.json({ ok: true, pages: rows });
    }
    const [rows] = await pool.query(
      `SELECT id, button_text, button_image, content, sort_order, is_active
         FROM user_pages WHERE user_id = ? AND parent_id IS NULL ORDER BY sort_order, id`,
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
      `SELECT id, user_id, parent_id, button_text, button_image, content, is_active FROM user_pages WHERE id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบหน้านี้' });
    const page = rows[0];
    // หน้าที่ปิดอยู่ ให้ดูได้เฉพาะเจ้าของ
    if (!page.is_active && (!req.session || req.session.userId !== page.user_id)) {
      return res.status(404).json({ error: 'ไม่พบหน้านี้' });
    }
    const isOwner = !!(req.session && req.session.userId === page.user_id);

    // breadcrumb: เดินขึ้นไปหาหน้าแม่ทีละชั้น (จำกัด 30 ชั้นกันวนไม่รู้จบ)
    // ผลลัพธ์เรียงจากบนสุด → ล่างสุด (ไม่รวมหน้าปัจจุบัน) เช่น [จังหวัด, อำเภอ]
    const breadcrumb = [];
    let cursor = page.parent_id;
    let guard = 0;
    while (cursor && guard < 30) {
      const [pr] = await pool.query('SELECT id, parent_id, button_text FROM user_pages WHERE id = ? LIMIT 1', [cursor]);
      if (pr.length === 0) break;
      breadcrumb.unshift({ id: pr[0].id, button_text: pr[0].button_text });
      cursor = pr[0].parent_id;
      guard++;
    }

    res.json({ ok: true, page, is_owner: isOwner, breadcrumb });
  } catch (err) { next(err); }
});

// ===== POST /api/pages — เจ้าของ: เพิ่มบลอค/หน้าใหม่ =====
//   body.parent_id (ไม่ใส่ = บลอคชั้นบนสุดในโปรไฟล์ / ใส่ = บลอคย่อยข้างในหน้านั้น)
router.post('/pages', requireAuth, express.json(), async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const buttonText = (req.body && req.body.button_text ? String(req.body.button_text) : '').trim() || 'ปุ่มใหม่';
    const content = req.body && req.body.content != null ? String(req.body.content) : '';

    // ตรวจ parent_id (ถ้ามี): ต้องมีจริง และต้องเป็นของ user คนเดียวกัน
    let parentId = null;
    if (req.body && req.body.parent_id != null && req.body.parent_id !== '') {
      parentId = Number(req.body.parent_id);
      if (!Number.isInteger(parentId) || parentId <= 0) return res.status(400).json({ error: 'parent_id ไม่ถูกต้อง' });
      const [p] = await pool.query('SELECT user_id FROM user_pages WHERE id = ? LIMIT 1', [parentId]);
      if (p.length === 0) return res.status(404).json({ error: 'ไม่พบหน้าแม่' });
      if (p[0].user_id !== userId) return res.status(403).json({ error: 'ไม่ใช่เจ้าของหน้าแม่' });
    }

    // sort_order นับต่อในกลุ่มพี่น้องเดียวกัน (parent เดียวกัน)
    const [[{ maxOrder }]] = await pool.query(
      parentId == null
        ? 'SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM user_pages WHERE user_id = ? AND parent_id IS NULL'
        : 'SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM user_pages WHERE parent_id = ?',
      parentId == null ? [userId] : [parentId]
    );
    const [result] = await pool.query(
      `INSERT INTO user_pages (user_id, parent_id, button_text, content, sort_order) VALUES (?, ?, ?, ?, ?)`,
      [userId, parentId, buttonText.slice(0, 120), content, maxOrder + 1]
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
    if ('content' in b) updates.content = b.content == null ? null : sanitizeHtml(String(b.content));
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

// ===== POST /api/pages/:id/content-image — เจ้าของ: อัปโหลดรูปแทรกในเนื้อหา (Rich Text) =====
// คืน url ให้ frontend เอาไปวางเป็น <img> ในเนื้อหา (ไม่เก็บ path ใน DB แยก — ฝังใน content HTML)
router.post('/pages/:id/content-image', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์รูป' });
    const url = `/uploads/userpages/${req.file.filename}`;

    const [rows] = await pool.query('SELECT user_id FROM user_pages WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) { safeUnlink(url); return res.status(404).json({ error: 'ไม่พบหน้านี้' }); }
    if (rows[0].user_id !== req.session.userId) { safeUnlink(url); return res.status(403).json({ error: 'ไม่ใช่เจ้าของหน้านี้' }); }

    res.json({ ok: true, url });
  } catch (err) { next(err); }
});

// ===== DELETE /api/pages/:id — เจ้าของ: ลบบลอค/หน้า (ลูกหลานถูกลบตาม ON DELETE CASCADE) =====
router.delete('/pages/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query('SELECT user_id, button_image FROM user_pages WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบหน้านี้' });
    if (rows[0].user_id !== req.session.userId) return res.status(403).json({ error: 'ไม่ใช่เจ้าของหน้านี้' });

    // เก็บ path รูปของหน้านี้ + ลูกหลานทุกชั้น (ไล่ทีละชั้นแบบ BFS) ไว้ลบไฟล์หลัง DB cascade
    // เพราะ ON DELETE CASCADE ลบแถวในฐานข้อมูลให้ แต่ไม่ได้ลบไฟล์รูปบนดิสก์
    const images = [];
    if (rows[0].button_image) images.push(rows[0].button_image);
    let frontier = [id];
    let guard = 0;
    while (frontier.length && guard < 5000) {
      const [children] = await pool.query(
        `SELECT id, button_image FROM user_pages WHERE parent_id IN (${frontier.map(() => '?').join(',')})`,
        frontier
      );
      if (children.length === 0) break;
      children.forEach(c => { if (c.button_image) images.push(c.button_image); });
      frontier = children.map(c => c.id);
      guard += children.length;
    }

    await pool.query('DELETE FROM user_pages WHERE id = ?', [id]);
    images.forEach(safeUnlink);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
