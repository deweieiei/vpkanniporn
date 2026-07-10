const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

const PUBLIC_COLUMNS = `
  id, first_name, last_name, avatar_path, position, company, branch,
  phone, email, province, license_number, license_number_2,
  bio, quote, facebook_url, line_id, instagram_url, awards, awards_visible, cover_images,
  cover_image_tablet, cover_image_mobile,
  hero_heading, hero_tagline, hero_sub, hero_image,
  created_at
`;

// GET /api/users  — รายการตัวแทนสำหรับแสดงในหน้า index
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, avatar_path, position, branch, province, phone, quote
       FROM users
       WHERE is_active = 1
       ORDER BY created_at DESC`
    );
    res.json({ ok: true, users: rows });
  } catch (err) {
    next(err);
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
