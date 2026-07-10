const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
}
function requireAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.role === 'admin') return next();
  return res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบ' });
}

// ===== POST /api/track — สาธารณะ: บันทึกการเข้าชม 1 ครั้ง (best-effort, ห้ามทำหน้าเว็บพัง) =====
router.post('/track', express.json(), async (req, res) => {
  try {
    const b = req.body || {};
    const userId = Number(b.user_id);
    if (!Number.isInteger(userId) || userId <= 0) return res.json({ ok: false });

    const visitorId = String(b.visitor_id || '').trim().slice(0, 40);
    const pageKey = (String(b.page_key || '').trim().slice(0, 80)) || 'unknown';
    const pageTitle = b.page_title != null ? String(b.page_title).trim().slice(0, 200) : null;
    const path = b.path != null ? String(b.path).trim().slice(0, 255) : null;
    if (!visitorId) return res.json({ ok: false });

    // ตรวจว่าตัวแทนมีจริง (กันยิง user_id มั่ว)
    const [u] = await pool.query('SELECT id FROM users WHERE id = ? AND is_active = 1 LIMIT 1', [userId]);
    if (u.length === 0) return res.json({ ok: false });

    await pool.query(
      'INSERT INTO page_views (user_id, visitor_id, page_key, page_title, path) VALUES (?, ?, ?, ?, ?)',
      [userId, visitorId, pageKey, pageTitle, path]
    );
    res.json({ ok: true });
  } catch (err) {
    // tracking ล้มเหลวไม่ควรกระทบผู้ชม
    console.warn('[track]', err.message);
    res.json({ ok: false });
  }
});

// ===== GET /api/track/stats — เจ้าของ: ภาพรวมสถิติการเข้าชมของตัวเอง =====
// แอดมินส่ง ?user_id=<id> มาเพื่อดูสถิติของตัวแทนคนอื่นได้ (ใช้ในหน้า /support-admin/stats/:id)
router.get('/track/stats', requireAuth, async (req, res, next) => {
  try {
    let uid = req.session.userId;
    if (req.query.user_id && req.session.role === 'admin') {
      const q = Number(req.query.user_id);
      if (!Number.isInteger(q) || q <= 0) return res.status(400).json({ error: 'user_id ไม่ถูกต้อง' });
      uid = q;
    }

    const [[overall]] = await pool.query(
      `SELECT
         COUNT(*)                                                       AS pageViews,
         COUNT(DISTINCT visitor_id)                                     AS uniqueVisitors,
         COUNT(DISTINCT CONCAT(visitor_id, '|', DATE(created_at)))      AS totalVisits
       FROM page_views WHERE user_id = ?`,
      [uid]
    );

    // ผู้เข้าชม (unique) แยกตามช่วงเวลา
    const [[period]] = await pool.query(
      `SELECT
         COUNT(DISTINCT CASE WHEN created_at >= CURDATE() THEN visitor_id END) AS today,
         COUNT(DISTINCT CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) THEN visitor_id END) AS week,
         COUNT(DISTINCT CASE WHEN created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN visitor_id END) AS month,
         COUNT(DISTINCT CASE WHEN created_at >= DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01')
                              AND created_at <  DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN visitor_id END) AS lastMonth
       FROM page_views WHERE user_id = ?`,
      [uid]
    );

    // แยกตามหน้า (หน้าไหนคนสนใจมากสุด)
    const [byPage] = await pool.query(
      `SELECT page_key AS pageKey, MAX(page_title) AS title,
              COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors
         FROM page_views WHERE user_id = ?
        GROUP BY page_key ORDER BY views DESC LIMIT 50`,
      [uid]
    );

    const month = Number(period.month) || 0;
    const lastMonth = Number(period.lastMonth) || 0;
    let monthChangePct = null; // null = เทียบไม่ได้ (เดือนก่อนไม่มีข้อมูล)
    if (lastMonth > 0) monthChangePct = Math.round(((month - lastMonth) / lastMonth) * 100);
    else if (month > 0) monthChangePct = 100;

    res.json({
      ok: true,
      overall: {
        pageViews: Number(overall.pageViews) || 0,
        uniqueVisitors: Number(overall.uniqueVisitors) || 0,
        totalVisits: Number(overall.totalVisits) || 0,
      },
      period: {
        today: Number(period.today) || 0,
        week: Number(period.week) || 0,
        month: month,
        lastMonth: lastMonth,
        monthChangePct: monthChangePct,
      },
      byPage: byPage,
    });
  } catch (err) { next(err); }
});

// ===== GET /api/track/leaderboard — แอดมิน: ดูว่าตัวแทนคนไหนคนเข้าชมเยอะ =====
router.get('/track/leaderboard', requireAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.avatar_path,
              COUNT(pv.id)                    AS pageViews,
              COUNT(DISTINCT pv.visitor_id)   AS uniqueVisitors,
              COUNT(DISTINCT CASE WHEN pv.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN pv.visitor_id END) AS monthVisitors
         FROM users u
         LEFT JOIN page_views pv ON pv.user_id = u.id
        WHERE u.role <> 'admin'
        GROUP BY u.id
        ORDER BY pageViews DESC`
    );
    res.json({ ok: true, users: rows });
  } catch (err) { next(err); }
});

module.exports = router;
