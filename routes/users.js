const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

const PUBLIC_COLUMNS = `
  id, first_name, last_name, avatar_path, position, company, branch,
  phone, email, province, license_number, license_number_2,
  bio, quote, facebook_url, line_id, instagram_url, tiktok_url, x_url, awards, awards_visible, cover_images,
  cover_image_tablet, cover_image_mobile,
  hero_heading, hero_tagline, hero_sub, hero_image, recruit_visible, consult_order,
  created_at
`;

// GET /api/users  — รายการตัวแทนสำหรับแสดงในหน้า index
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, avatar_path, position, role, branch, province, phone, quote
       FROM users
       WHERE is_active = 1
       ORDER BY created_at DESC`
    );
    res.json({ ok: true, users: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/home-featured — สาธารณะ: ตัวแทนที่แอดมินตั้งให้โชว์ในหน้า Home
// (ต้องมาก่อน /:id ไม่งั้น "home-featured" จะถูกจับเป็น :id)
router.get('/home-featured', async (_req, res, next) => {
  try {
    const [[s]] = await pool.query(
      "SELECT setting_value FROM site_settings WHERE setting_key = 'home_featured_agent_id' LIMIT 1"
    );
    const id = s && s.setting_value ? Number(s.setting_value) : null;
    if (!id || !Number.isInteger(id) || id <= 0) return res.json({ ok: true, agent: null });
    const [rows] = await pool.query(
      `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ? AND is_active = 1 LIMIT 1`, [id]
    );
    res.json({ ok: true, agent: rows[0] || null });
  } catch (err) {
    // ตาราง site_settings อาจยังไม่ถูกสร้าง → ไม่ให้หน้า Home พัง
    res.json({ ok: true, agent: null });
  }
});

// GET /api/users/:id  — public profile info
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'id ไม่ถูกต้อง' });
    }
    const [rows] = await pool.query(
      `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ? AND is_active = 1 LIMIT 1`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบตัวแทน' });
    }
    res.json({ ok: true, user: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
