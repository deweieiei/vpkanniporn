const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');

const router = express.Router();

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const AVATARS_DIR = path.join(PUBLIC_DIR, 'uploads', 'avatars');
const COVERS_DIR = path.join(PUBLIC_DIR, 'uploads', 'covers');
const PENDING_AVATAR_DIR = path.join(AVATARS_DIR, '_new');
const PENDING_COVER_DIR = path.join(COVERS_DIR, '_new');

[AVATARS_DIR, COVERS_DIR, PENDING_AVATAR_DIR, PENDING_COVER_DIR].forEach(d =>
  fs.mkdirSync(d, { recursive: true })
);

function userSubdir(baseDir, userId) {
  const dir = path.join(baseDir, String(userId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// แปลง web path (/uploads/...) -> disk path (absolute) ปลอดภัย ป้องกัน path traversal
function webPathToDisk(webPath) {
  if (typeof webPath !== 'string' || !webPath.startsWith('/uploads/')) return null;
  const candidate = path.resolve(PUBLIC_DIR, '.' + webPath);
  const uploadsBase = path.join(PUBLIC_DIR, 'uploads');
  if (!candidate.startsWith(uploadsBase + path.sep) && candidate !== uploadsBase) return null;
  return candidate;
}

function safeUnlink(webPath) {
  const diskPath = webPathToDisk(webPath);
  if (!diskPath) return;
  fs.unlink(diskPath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.warn('unlink failed:', diskPath, err.message);
    }
  });
}

// multer เขียนไฟล์ลง disk ก่อน handler จะรันเสมอ — ถ้า request ถูก reject
// ด้วยเหตุผลอื่น (validation fail) ต้องลบไฟล์ที่เพิ่งอัปโหลดทิ้ง ไม่งั้นจะค้างเป็นขยะ
function cleanupUploadedFiles(req) {
  if (!req.files) return;
  Object.values(req.files).flat().forEach((f) => {
    fs.unlink(f.path, (err) => {
      if (err && err.code !== 'ENOENT') {
        console.warn('cleanup upload failed:', f.path, err.message);
      }
    });
  });
}

function parseJsonArray(v) {
  if (!v) return [];
  try {
    const arr = typeof v === 'string' ? JSON.parse(v) : v;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isCover = /^(cover_images|cover_image_tablet|cover_image_mobile|hero_image)$/.test(file.fieldname);
    const baseDir = isCover ? COVERS_DIR : AVATARS_DIR;
    const userId = req.session && req.session.userId;
    if (userId) {
      cb(null, userSubdir(baseDir, userId));
    } else {
      // ยังไม่มี userId (ตอน register) — ไปที่ _new ก่อน แล้วจะ move หลัง INSERT
      cb(null, isCover ? PENDING_COVER_DIR : PENDING_AVATAR_DIR);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || '.jpg';
    const safe = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, safe);
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

const profileUpload = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'cover_images', maxCount: 6 },
  { name: 'cover_image_tablet', maxCount: 1 },
  { name: 'cover_image_mobile', maxCount: 1 },
  { name: 'hero_image', maxCount: 1 },
]);

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const FULL_USER_COLUMNS = `
  id, email, first_name, last_name, birthdate, gender, province, avatar_path,
  role, is_active, created_at, updated_at,
  phone, position, company, branch, license_number, license_number_2,
  bio, quote, facebook_url, line_id, instagram_url, awards, awards_visible, cover_images,
  cover_image_tablet, cover_image_mobile,
  hero_heading, hero_tagline, hero_sub, hero_image
`;

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
}

router.post('/login', express.json(), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    }

    const [rows] = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name, avatar_path, is_active, role
       FROM users WHERE email = ? LIMIT 1`,
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'บัญชีนี้ถูกระงับการใช้งาน' });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.role = user.role;
    req.session.cookie.maxAge = null;
    req.session.cookie.expires = null;
    res.json({
      ok: true,
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar_path: user.avatar_path,
      role: user.role,
    });
  } catch (err) {
    next(err);
  }
});

// ===== Login เฉพาะ SupperAdmin (role = 'admin') =====
// ล็อกอินด้วย "ชื่อผู้ใช้" (ไม่ใช่อีเมล) — แยกจาก /login ปกติที่ตรวจรูปแบบอีเมล
router.post('/supperadmin-login', express.json(), async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }

    const [rows] = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name, is_active, role
       FROM users WHERE email = ? AND role = 'admin' LIMIT 1`,
      [username]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'บัญชีนี้ถูกระงับการใช้งาน' });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.role = user.role;
    req.session.cookie.maxAge = null;
    req.session.cookie.expires = null;
    res.json({ ok: true, id: user.id, role: user.role });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('fwd.sid');
    res.json({ ok: true });
  });
});

router.get('/me', async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.json({ authenticated: false });
    }
    const [rows] = await pool.query(
      `SELECT ${FULL_USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
      [req.session.userId]
    );
    if (rows.length === 0) {
      req.session.destroy(() => {});
      return res.json({ authenticated: false });
    }
    res.json({ authenticated: true, user: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/profile', requireAuth, profileUpload, async (req, res, next) => {
  try {
    const userId = req.session.userId;

    // อ่านข้อมูลเก่าเพื่อรู้ว่าไฟล์ใดต้องลบ
    const [currentRows] = await pool.query(
      'SELECT avatar_path, cover_images, cover_image_tablet, cover_image_mobile, hero_image FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (currentRows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    }
    const oldAvatar = currentRows[0].avatar_path;
    const oldCovers = parseJsonArray(currentRows[0].cover_images);
    const oldTablet = currentRows[0].cover_image_tablet;
    const oldMobile = currentRows[0].cover_image_mobile;
    const oldHeroImage = currentRows[0].hero_image;

    const allowed = [
      'first_name', 'last_name', 'birthdate', 'gender', 'province',
      'phone', 'position', 'company', 'branch',
      'license_number', 'license_number_2',
      'bio', 'quote',
      'facebook_url', 'line_id', 'instagram_url',
      'hero_heading', 'hero_tagline', 'hero_sub',
    ];
    const updates = {};
    for (const k of allowed) {
      if (k in req.body) {
        const v = req.body[k];
        updates[k] = v === '' ? null : v;
      }
    }

    if ('awards' in req.body) {
      try {
        const parsed = typeof req.body.awards === 'string'
          ? JSON.parse(req.body.awards)
          : req.body.awards;
        updates.awards = Array.isArray(parsed) ? JSON.stringify(parsed) : null;
      } catch (e) {
        cleanupUploadedFiles(req);
        return res.status(400).json({ error: 'awards ต้องเป็น JSON array' });
      }
    }

    // สถานะเปิด/ปิด ส่วน "ความสำเร็จและรางวัล" (checkbox → 0/1)
    if ('awards_visible' in req.body) {
      const v = req.body.awards_visible;
      updates.awards_visible = (v === '1' || v === 1 || v === true || v === 'true') ? 1 : 0;
    }

    // ไฟล์ที่ต้องลบหลัง update สำเร็จ
    const filesToDelete = [];

    // Avatar
    if (req.files && req.files.avatar && req.files.avatar[0]) {
      const f = req.files.avatar[0];
      updates.avatar_path = `/uploads/avatars/${userId}/${f.filename}`;
      if (oldAvatar && oldAvatar !== updates.avatar_path) {
        filesToDelete.push(oldAvatar);
      }
    }

    // Hero background image (ภาพพื้นหลัง hero — 1 รูป, override cover slideshow)
    if (req.files && req.files.hero_image && req.files.hero_image[0]) {
      const f = req.files.hero_image[0];
      updates.hero_image = `/uploads/covers/${userId}/${f.filename}`;
      if (oldHeroImage && oldHeroImage !== updates.hero_image) filesToDelete.push(oldHeroImage);
    } else if (req.body.hero_image_clear === '1') {
      // ล้างรูป hero กลับไปใช้พื้นหลัง/ข้อความเดิม
      updates.hero_image = null;
      if (oldHeroImage) filesToDelete.push(oldHeroImage);
    }

    // Cover images
    const hasNewCovers = !!(req.files && req.files.cover_images && req.files.cover_images.length > 0);
    const hasKeepInstruction = 'cover_images_keep' in req.body;

    if (hasNewCovers || hasKeepInstruction) {
      let requestedKeep = [];
      if (hasKeepInstruction) {
        try {
          const parsed = typeof req.body.cover_images_keep === 'string'
            ? JSON.parse(req.body.cover_images_keep)
            : req.body.cover_images_keep;
          requestedKeep = Array.isArray(parsed) ? parsed.filter(s => typeof s === 'string') : [];
        } catch (e) {
          cleanupUploadedFiles(req);
          return res.status(400).json({ error: 'cover_images_keep ต้องเป็น JSON array' });
        }
      }
      // เฉพาะ path ที่เป็นของ user คนนี้จริงๆ (ป้องกัน inject path คนอื่น)
      const validKept = requestedKeep.filter(p => oldCovers.includes(p));
      const newPaths = hasNewCovers
        ? req.files.cover_images.map(f => `/uploads/covers/${userId}/${f.filename}`)
        : [];
      const combined = [...validKept, ...newPaths];
      const merged = combined.slice(0, 6);
      updates.cover_images = merged.length > 0 ? JSON.stringify(merged) : null;

      // คอลัมน์ภาพปกที่ไม่อยู่ใน merged = ต้องลบ (ทั้งของเก่าที่ถูกแทนที่
      // และไฟล์ใหม่ที่เพิ่งอัปโหลดแต่เกิน 6 รูปเลยถูก slice() ตัดทิ้ง —
      // ถ้าไม่ลบตรงนี้ไฟล์จะค้างอยู่ที่ disk ตลอดไปเพราะไม่มี reference ใน DB)
      oldCovers.forEach(p => {
        if (!merged.includes(p)) filesToDelete.push(p);
      });
      combined.forEach(p => {
        if (newPaths.includes(p) && !merged.includes(p)) filesToDelete.push(p);
      });
    }

    // Cover override เฉพาะ iPad / มือถือ (อย่างละ 1 รูป — แทนที่สไลด์ desktop เมื่อดูจากจอนั้น)
    // อัปรูปใหม่ = ตั้งค่า, ส่ง <field>_clear=1 = ล้างกลับไปใช้สไลด์ desktop
    [
      { field: 'cover_image_tablet', old: oldTablet },
      { field: 'cover_image_mobile', old: oldMobile },
    ].forEach(({ field, old }) => {
      if (req.files && req.files[field] && req.files[field][0]) {
        const f = req.files[field][0];
        updates[field] = `/uploads/covers/${userId}/${f.filename}`;
        if (old && old !== updates[field]) filesToDelete.push(old);
      } else if (req.body[`${field}_clear`] === '1') {
        updates[field] = null;
        if (old) filesToDelete.push(old);
      }
    });

    if (updates.gender && !['male', 'female', 'other'].includes(updates.gender)) {
      cleanupUploadedFiles(req);
      return res.status(400).json({ error: 'เพศไม่ถูกต้อง' });
    }

    const keys = Object.keys(updates);
    if (keys.length === 0) {
      cleanupUploadedFiles(req);
      return res.status(400).json({ error: 'ไม่มีข้อมูลที่ต้องอัพเดต' });
    }

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => updates[k]);
    values.push(userId);

    await pool.query(`UPDATE users SET ${setClause} WHERE id = ?`, values);

    // ลบไฟล์เก่าหลัง UPDATE สำเร็จ
    filesToDelete.forEach(safeUnlink);

    const [rows] = await pool.query(
      `SELECT ${FULL_USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );
    res.json({ ok: true, user: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
