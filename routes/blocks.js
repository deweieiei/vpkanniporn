const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { pool } = require('../db/pool');

const router = express.Router();

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads', 'blocks');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ===== สิทธิ์: หน้าแรกของเว็บ แก้ได้เฉพาะ SupperAdmin (role='admin') =====
// (ตรงกับ requireAdmin ใน routes/admin.js)
function requireAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.role === 'admin') return next();
  return res.status(403).json({ error: 'ต้องเข้าสู่ระบบเป็น SupperAdmin ก่อน' });
}
function isAdmin(req) {
  return !!(req.session && req.session.userId && req.session.role === 'admin');
}

// ชนิดบลอคที่อนุญาต — กันยัด type มั่วเข้ามา
const BLOCK_TYPES = [
  'hero',     // 1. ภาพหัวเว็บ 6 ภาพ × 3 อุปกรณ์
  'plans',    // 2. "เลือกแผนที่เหมาะกับคุณ" (ลูก = page)
  'page',     //    1 ปุ่ม = 1 หน้า ซ้อนได้ไม่จำกัด
  'features', // 3. "ทำไมต้องวางแผนกับเรา" (ลูก = card)
  'agents',   // 4. "รู้จักที่ปรึกษาของคุณ" โชว์ตัวแทน 3-5 คน
  'awards',   // 5. "ความสำเร็จและรางวัล" (ลูก = card)
  'recruit',  // 7. "กำลังมองหาอาชีพ..." ใส่ภาพอย่างเดียว
  'cta',      // 8. "พร้อมเริ่มต้นวางแผนกับเราไหม?"
  'card',     //    การ์ด icon + ตัวหนังสือใหญ่ + สี + คำอธิบาย
  'text',     //    ข้อความอิสระ
  'image',    //    รูปอิสระ
];

// hero = 6 ภาพ (slot 0-5) × 3 อุปกรณ์
const MAX_SLOT = 5;
const VARIANTS = ['web', 'tablet', 'mobile'];

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

// Sanitize HTML ที่แอดมินกรอก (บลอค page เขียนโพสยาวๆ ได้) — ตัด script/iframe/event handler/javascript:
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

// data เป็น JSON อิสระ (คนละรูปแบบตาม type) — sanitize เฉพาะ key ที่เป็นเนื้อหา HTML
function cleanData(data) {
  if (data == null) return null;
  if (typeof data !== 'object' || Array.isArray(data)) return null;
  const out = { ...data };
  if ('content' in out && out.content != null) out.content = sanitizeHtml(String(out.content));
  return out;
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

// mysql2 คืน JSON column มาเป็น object อยู่แล้ว แต่บาง config คืนเป็น string — กันไว้ทั้งสองแบบ
function parseData(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

// ประกอบบลอคเป็นต้นไม้ (parent → children) + แนบรูปเข้าแต่ละบลอค
function buildTree(rows, images) {
  const byId = new Map();
  rows.forEach((r) => {
    byId.set(r.id, {
      id: r.id,
      parent_id: r.parent_id,
      type: r.type,
      sort_order: r.sort_order,
      is_visible: !!r.is_visible,
      data: parseData(r.data) || {},
      images: [],
      children: [],
    });
  });

  images.forEach((img) => {
    const b = byId.get(img.block_id);
    if (b) b.images.push({ id: img.id, path: img.image_path, slot: img.slot, variant: img.variant, caption: img.caption });
  });

  const roots = [];
  byId.forEach((b) => {
    if (b.parent_id && byId.has(b.parent_id)) byId.get(b.parent_id).children.push(b);
    else if (!b.parent_id) roots.push(b);
  });

  const bySort = (a, z) => a.sort_order - z.sort_order || a.id - z.id;
  roots.sort(bySort);
  byId.forEach((b) => b.children.sort(bySort));
  return roots;
}

// ===== GET /api/blocks — บลอคทั้งหน้า (เป็นต้นไม้) =====
//   ไม่ใส่ query    → หน้าแรกของเว็บ (user_id IS NULL)
//   ?user_id=N     → หน้าโปรไฟล์ตัวแทนคนที่ N (เผื่ออนาคตตอนรื้อ dashboard.html)
//   ผู้เข้าชมเห็นเฉพาะบลอคที่เปิด / SupperAdmin เห็นทั้งหมดรวมที่ซ่อน
router.get('/blocks', async (req, res, next) => {
  try {
    const admin = isAdmin(req);

    let userId = null;
    if (req.query.user_id != null && req.query.user_id !== '') {
      userId = Number(req.query.user_id);
      if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'user_id ไม่ถูกต้อง' });
    }

    const scopeSql = userId == null ? 'user_id IS NULL' : 'user_id = ?';
    const scopeArgs = userId == null ? [] : [userId];
    const visibleSql = admin ? '' : ' AND is_visible = 1';

    const [rows] = await pool.query(
      `SELECT id, parent_id, type, sort_order, is_visible, data
         FROM page_blocks
        WHERE ${scopeSql}${visibleSql}
        ORDER BY sort_order, id`,
      scopeArgs
    );

    let images = [];
    if (rows.length) {
      const ids = rows.map((r) => r.id);
      const [imgRows] = await pool.query(
        `SELECT id, block_id, image_path, slot, variant, caption
           FROM block_images
          WHERE block_id IN (${ids.map(() => '?').join(',')})
          ORDER BY slot, variant`,
        ids
      );
      images = imgRows;
    }

    res.json({ ok: true, is_admin: admin, blocks: buildTree(rows, images) });
  } catch (err) { next(err); }
});

// ===== GET /api/blocks/:id — บลอคเดียว (ใช้ในหน้า /page/:id) =====
router.get('/blocks/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const [rows] = await pool.query(
      `SELECT id, user_id, parent_id, type, sort_order, is_visible, data
         FROM page_blocks WHERE id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบบลอคนี้' });

    const admin = isAdmin(req);
    const block = rows[0];
    if (!block.is_visible && !admin) return res.status(404).json({ error: 'ไม่พบบลอคนี้' });

    const [images] = await pool.query(
      `SELECT id, block_id, image_path, slot, variant, caption
         FROM block_images WHERE block_id = ? ORDER BY slot, variant`,
      [id]
    );
    const [children] = await pool.query(
      `SELECT id, parent_id, type, sort_order, is_visible, data
         FROM page_blocks WHERE parent_id = ?${admin ? '' : ' AND is_visible = 1'}
        ORDER BY sort_order, id`,
      [id]
    );

    // รูปของบลอคลูก (ใช้เป็นรูปบนปุ่ม) — ต้องส่งไปด้วย ไม่งั้นปุ่มย่อยจะไม่มีรูป
    let childImages = [];
    if (children.length) {
      const cids = children.map((c) => c.id);
      const [ci] = await pool.query(
        `SELECT id, block_id, image_path, slot, variant, caption
           FROM block_images
          WHERE block_id IN (${cids.map(() => '?').join(',')})
          ORDER BY slot, variant`,
        cids
      );
      childImages = ci;
    }

    // breadcrumb: เดินขึ้นไปหาบลอคแม่ทีละชั้น (จำกัด 30 ชั้นกันวนไม่รู้จบ)
    const breadcrumb = [];
    let cursor = block.parent_id;
    let guard = 0;
    while (cursor && guard < 30) {
      const [pr] = await pool.query('SELECT id, parent_id, type, data FROM page_blocks WHERE id = ? LIMIT 1', [cursor]);
      if (pr.length === 0) break;
      const d = parseData(pr[0].data) || {};
      breadcrumb.unshift({ id: pr[0].id, type: pr[0].type, title: d.button_text || d.title || '' });
      cursor = pr[0].parent_id;
      guard++;
    }

    res.json({
      ok: true,
      is_admin: admin,
      block: {
        id: block.id,
        parent_id: block.parent_id,
        type: block.type,
        is_visible: !!block.is_visible,
        data: parseData(block.data) || {},
        images: images.map((i) => ({ id: i.id, path: i.image_path, slot: i.slot, variant: i.variant, caption: i.caption })),
      },
      children: children.map((c) => ({
        id: c.id, type: c.type, sort_order: c.sort_order,
        is_visible: !!c.is_visible, data: parseData(c.data) || {},
        images: childImages
          .filter((i) => i.block_id === c.id)
          .map((i) => ({ id: i.id, path: i.image_path, slot: i.slot, variant: i.variant, caption: i.caption })),
      })),
      breadcrumb,
    });
  } catch (err) { next(err); }
});

// ===== POST /api/blocks — SupperAdmin: เพิ่มบลอคใหม่ =====
//   body: { type, parent_id?, user_id?, data? }
router.post('/blocks', requireAdmin, express.json(), async (req, res, next) => {
  try {
    const b = req.body || {};
    const type = String(b.type || '').trim();
    if (!BLOCK_TYPES.includes(type)) return res.status(400).json({ error: 'ชนิดบลอคไม่ถูกต้อง' });

    let userId = null;
    if (b.user_id != null && b.user_id !== '') {
      userId = Number(b.user_id);
      if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'user_id ไม่ถูกต้อง' });
    }

    // ตรวจ parent_id (ถ้ามี): ต้องมีจริง + อยู่หน้าเดียวกัน
    let parentId = null;
    if (b.parent_id != null && b.parent_id !== '') {
      parentId = Number(b.parent_id);
      if (!Number.isInteger(parentId) || parentId <= 0) return res.status(400).json({ error: 'parent_id ไม่ถูกต้อง' });
      const [p] = await pool.query('SELECT user_id FROM page_blocks WHERE id = ? LIMIT 1', [parentId]);
      if (p.length === 0) return res.status(404).json({ error: 'ไม่พบบลอคแม่' });
      const parentUser = p[0].user_id;
      if ((parentUser == null ? null : Number(parentUser)) !== userId) {
        return res.status(400).json({ error: 'บลอคแม่อยู่คนละหน้ากับบลอคลูก' });
      }
    }

    // sort_order นับต่อในกลุ่มพี่น้องเดียวกัน
    const [[{ maxOrder }]] = await pool.query(
      parentId == null
        ? `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM page_blocks
            WHERE parent_id IS NULL AND ${userId == null ? 'user_id IS NULL' : 'user_id = ?'}`
        : 'SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM page_blocks WHERE parent_id = ?',
      parentId == null ? (userId == null ? [] : [userId]) : [parentId]
    );

    const data = cleanData(b.data) || {};
    const [result] = await pool.query(
      `INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
       VALUES (?, ?, ?, ?, 1, CAST(? AS JSON))`,
      [userId, parentId, type, maxOrder + 1, JSON.stringify(data)]
    );
    res.json({ ok: true, id: result.insertId });
  } catch (err) { next(err); }
});

// ===== PUT /api/blocks/:id — SupperAdmin: แก้เนื้อหา / ซ่อน-แสดง / ลำดับ =====
//   body: { data?, is_visible?, sort_order? }
//   data = merge ทับของเดิม (ส่งมาเฉพาะ key ที่จะแก้ได้)
router.put('/blocks/:id', requireAdmin, express.json(), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const [rows] = await pool.query('SELECT data FROM page_blocks WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบบลอคนี้' });

    const b = req.body || {};
    const updates = [];
    const values = [];

    if ('data' in b) {
      const incoming = cleanData(b.data);
      if (incoming == null) return res.status(400).json({ error: 'data ต้องเป็น object' });
      const merged = { ...(parseData(rows[0].data) || {}), ...incoming };
      updates.push('data = CAST(? AS JSON)');
      values.push(JSON.stringify(merged));
    }
    if ('is_visible' in b) { updates.push('is_visible = ?'); values.push(b.is_visible ? 1 : 0); }
    if ('sort_order' in b && Number.isInteger(Number(b.sort_order))) {
      updates.push('sort_order = ?'); values.push(Number(b.sort_order));
    }

    if (updates.length === 0) return res.status(400).json({ error: 'ไม่มีข้อมูลที่ต้องแก้ไข' });
    values.push(id);
    await pool.query(`UPDATE page_blocks SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ===== PUT /api/blocks/reorder — SupperAdmin: สลับลำดับทีเดียวหลายบลอค =====
//   body: { ids: [id1, id2, id3] }  → เรียงตามลำดับใน array
router.put('/blocks-reorder', requireAdmin, express.json(), async (req, res, next) => {
  try {
    const ids = (req.body && req.body.ids) || [];
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ต้องส่ง ids เป็น array' });
    const clean = ids.map(Number);
    if (clean.some((n) => !Number.isInteger(n) || n <= 0)) return res.status(400).json({ error: 'ids ไม่ถูกต้อง' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (let i = 0; i < clean.length; i++) {
        await conn.query('UPDATE page_blocks SET sort_order = ? WHERE id = ?', [i + 1, clean[i]]);
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ===== POST /api/blocks/:id/image — SupperAdmin: อัปรูปเข้าช่อง (slot × variant) =====
//   form-data: image=<file>, slot=0..5, variant=web|tablet|mobile
//   อัปทับช่องเดิมได้ (UNIQUE block_id+slot+variant) → ลบไฟล์เก่าทิ้งให้ด้วย
router.post('/blocks/:id/image', requireAdmin, upload.single('image'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์รูป' });
    const newPath = `/uploads/blocks/${req.file.filename}`;

    const slot = Number(req.body.slot || 0);
    const variant = String(req.body.variant || 'web');
    if (!Number.isInteger(slot) || slot < 0 || slot > MAX_SLOT) {
      safeUnlink(newPath);
      return res.status(400).json({ error: `slot ต้องเป็น 0-${MAX_SLOT}` });
    }
    if (!VARIANTS.includes(variant)) {
      safeUnlink(newPath);
      return res.status(400).json({ error: 'variant ต้องเป็น web / tablet / mobile' });
    }

    const [rows] = await pool.query('SELECT id FROM page_blocks WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) { safeUnlink(newPath); return res.status(404).json({ error: 'ไม่พบบลอคนี้' }); }

    // รูปเดิมในช่องนี้ (ถ้ามี) → เก็บ path ไว้ลบไฟล์หลังอัปเดต DB สำเร็จ
    const [old] = await pool.query(
      'SELECT image_path FROM block_images WHERE block_id = ? AND slot = ? AND variant = ? LIMIT 1',
      [id, slot, variant]
    );

    await pool.query(
      `INSERT INTO block_images (block_id, image_path, slot, variant)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE image_path = VALUES(image_path)`,
      [id, newPath, slot, variant]
    );

    if (old.length && old[0].image_path && old[0].image_path !== newPath) safeUnlink(old[0].image_path);
    res.json({ ok: true, image: newPath, slot, variant });
  } catch (err) { next(err); }
});

// ===== DELETE /api/blocks/:id/image — SupperAdmin: ลบรูปในช่อง =====
//   query: ?slot=0&variant=web
router.delete('/blocks/:id/image', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const slot = Number(req.query.slot || 0);
    const variant = String(req.query.variant || 'web');
    if (!VARIANTS.includes(variant)) return res.status(400).json({ error: 'variant ไม่ถูกต้อง' });

    const [rows] = await pool.query(
      'SELECT image_path FROM block_images WHERE block_id = ? AND slot = ? AND variant = ? LIMIT 1',
      [id, slot, variant]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบรูปในช่องนี้' });

    await pool.query('DELETE FROM block_images WHERE block_id = ? AND slot = ? AND variant = ?', [id, slot, variant]);
    safeUnlink(rows[0].image_path);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ===== POST /api/blocks/:id/content-image — SupperAdmin: อัปรูปแทรกในเนื้อหา (Rich Text) =====
// คืน url ให้ frontend เอาไปวางเป็น <img> ในเนื้อหา (ฝังใน data.content ไม่เก็บแถวใน block_images)
router.post('/blocks/:id/content-image', requireAdmin, upload.single('image'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์รูป' });
    const url = `/uploads/blocks/${req.file.filename}`;

    const [rows] = await pool.query('SELECT id FROM page_blocks WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) { safeUnlink(url); return res.status(404).json({ error: 'ไม่พบบลอคนี้' }); }

    res.json({ ok: true, url });
  } catch (err) { next(err); }
});

// ===== DELETE /api/blocks/:id — SupperAdmin: ลบบลอค (ลูกหลานหายตาม CASCADE) =====
router.delete('/blocks/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const [rows] = await pool.query('SELECT id FROM page_blocks WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบบลอคนี้' });

    // เก็บ path รูปของบลอคนี้ + ลูกหลานทุกชั้น (BFS) ไว้ลบไฟล์หลัง DB cascade
    // เพราะ ON DELETE CASCADE ลบแถวให้ แต่ไม่ได้ลบไฟล์รูปบนดิสก์
    const images = [];
    let frontier = [id];
    let guard = 0;
    while (frontier.length && guard < 5000) {
      const [imgs] = await pool.query(
        `SELECT image_path FROM block_images WHERE block_id IN (${frontier.map(() => '?').join(',')})`,
        frontier
      );
      imgs.forEach((i) => { if (i.image_path) images.push(i.image_path); });

      const [children] = await pool.query(
        `SELECT id FROM page_blocks WHERE parent_id IN (${frontier.map(() => '?').join(',')})`,
        frontier
      );
      if (children.length === 0) break;
      frontier = children.map((c) => c.id);
      guard += children.length;
    }

    await pool.query('DELETE FROM page_blocks WHERE id = ?', [id]);
    images.forEach(safeUnlink);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
