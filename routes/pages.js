const express = require('express');
const path = require('path');

const router = express.Router();
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.redirect('/login');
}

router.get('/', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

router.get('/login', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/profile');
  res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

router.get('/profile', requireAuth, (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'profile.html'));
});

// ดูโปรไฟล์ตัวแทนคนอื่น (สาธารณะ ไม่ต้อง login)
router.get('/agent/:id', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'profile.html'));
});

router.get('/search', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'search.html'));
});

router.get('/packages', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'packages.html'));
});

module.exports = router;
