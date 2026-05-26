require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');

const pagesRouter = require('./routes/pages');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  name: 'fwd.sid',
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 15,
  },
}));

app.use('/', pagesRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);

app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
}));

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.get('/api/health/db', async (_req, res) => {
  try {
    const { ping } = require('./db/pool');
    await ping();
    res.json({
      ok: true,
      db_host: process.env.DB_HOST,
      db_name: process.env.DB_NAME,
      db_user: process.env.DB_USER,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      code: err.code,
      errno: err.errno,
      message: err.message,
      db_host: process.env.DB_HOST,
      db_name: process.env.DB_NAME,
      db_user: process.env.DB_USER,
    });
  }
});

app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    code: err.code,
    errno: err.errno,
  });
});

app.listen(PORT, () => {
  console.log(`FWD server listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
