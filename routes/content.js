const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { pool } = require('../db/pool');

const router = express.Router();

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SITE_UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads', 'site');
fs.mkdirSync(SITE_UPLOAD_DIR, { recursive: true });

// ===== สิทธิ์: ต้องเป็น Support Admin เท่านั้น =====
function requireSupportAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.role === 'support_admin') {
    return next();
  }
  return res.status(403).json({ error: 'ต้องเข้าสู่ระบบเป็น Support Admin ก่อน' });
}

// ===== แปลง web path (/uploads/...) -> disk path ปลอดภัย กัน path traversal =====
function webPathToDisk(webPath) {
  if (typeof webPath !== 'string' || !webPath.startsWith('/uploads/')) return null;
  const candidate = path.resolve(PUBLIC_DIR, '.' + webPath);
  const uploadsBase = path.join(PUBLIC_DIR, 'uploads');
  if (!candidate.startsWith(uploadsBase + path.sep)) return null;
  return candidate;
}

function safeUnlink(webPath) {
  const diskPath = webPathToDisk(webPath);
  if (!diskPath) return;
  fs.unlink(diskPath, (err) => {
    if (err && err.code !== 'ENOENT') console.warn('unlink failed:', diskPath, err.message);
  });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, SITE_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || '.jpg';
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpe?g|png|webp|gif)$/i.test(file.mimetype)) return cb(null, true);
    cb(new Error('อนุญาตเฉพาะรูปภาพ (jpg/png/webp/gif)'));
  },
});

// ===== GET /api/content — สาธารณะ: คืน map { key: value } ให้หน้า index ใช้ =====
router.get('/content', async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT content_key, content_value FROM site_content');
    const content = {};
    for (const r of rows) content[r.content_key] = r.content_value;
    res.json({ ok: true, content });
  } catch (err) {
    next(err);
  }
});

// ===== GET /api/content/admin — Support Admin: คืนข้อมูลเต็มไว้สร้างฟอร์ม editor =====
router.get('/content/admin', requireSupportAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT content_key, section, label, content_type, content_value, sort_order
         FROM site_content
        ORDER BY section, sort_order, content_key`
    );
    res.json({ ok: true, items: rows });
  } catch (err) {
    next(err);
  }
});

// ===== PUT /api/content — Support Admin: บันทึกข้อความหลายช่องพร้อมกัน =====
// body: { updates: { key: value, ... } }  (เฉพาะช่องชนิด text)
router.put('/content', requireSupportAdmin, express.json(), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const updates = req.body && req.body.updates;
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      conn.release();
      return res.status(400).json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง (ต้องมี updates เป็น object)' });
    }

    const keys = Object.keys(updates);
    if (keys.length === 0) {
      conn.release();
      return res.status(400).json({ error: 'ไม่มีข้อมูลที่ต้องบันทึก' });
    }

    // อัปเดตเฉพาะ key ที่มีอยู่จริง + เป็นชนิด text เท่านั้น (กันแก้ path รูปผ่าน endpoint นี้)
    const [existRows] = await conn.query(
      `SELECT content_key FROM site_content
        WHERE content_type = 'text' AND content_key IN (?)`,
      [keys]
    );
    const allowed = new Set(existRows.map((r) => r.content_key));

    await conn.beginTransaction();
    let saved = 0;
    for (const k of keys) {
      if (!allowed.has(k)) continue;
      const v = updates[k];
      await conn.query('UPDATE site_content SET content_value = ? WHERE content_key = ?', [
        v == null ? null : String(v),
        k,
      ]);
      saved++;
    }
    await conn.commit();

    res.json({ ok: true, saved, skipped: keys.length - saved });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    next(err);
  } finally {
    conn.release();
  }
});

// ===== POST /api/content/image — Support Admin: อัปโหลดรูปแทน 1 key =====
// multipart: field 'image' + body 'key'
router.post('/content/image', requireSupportAdmin, upload.single('image'), async (req, res, next) => {
  try {
    const key = req.body && req.body.key;
    if (!req.file) {
      return res.status(400).json({ error: 'ไม่พบไฟล์รูปที่อัปโหลด' });
    }
    const newWebPath = `/uploads/site/${req.file.filename}`;

    const [rows] = await pool.query(
      "SELECT content_value FROM site_content WHERE content_key = ? AND content_type = 'image' LIMIT 1",
      [key]
    );
    if (rows.length === 0) {
      // key ไม่ถูกต้อง — ลบไฟล์ที่เพิ่งอัปโหลดทิ้ง ไม่ให้ค้างเป็นขยะ
      safeUnlink(newWebPath);
      return res.status(400).json({ error: 'ไม่พบช่องรูปนี้ (key ไม่ถูกต้อง)' });
    }

    const oldPath = rows[0].content_value;
    await pool.query('UPDATE site_content SET content_value = ? WHERE content_key = ?', [newWebPath, key]);

    // ลบรูปเก่า (เฉพาะที่เคยอัปโหลดไว้ใน /uploads/) หลังอัปเดตสำเร็จ
    if (oldPath && oldPath !== newWebPath) safeUnlink(oldPath);

    res.json({ ok: true, key, value: newWebPath });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
