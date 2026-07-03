# FWD Agent Office

เว็บไซต์สำนักงานตัวแทน FWD — Node.js + Express + MySQL พร้อม deploy บน HostAtom (Plesk)

## โครงสร้างโปรเจกต์

```
FWD/
├── index.js              # Express server หลัก (entry point)
├── package.json          # dependencies + scripts
├── .env                  # ค่า env จริง (ห้าม commit)
├── .env.example          # ตัวอย่าง env
├── .gitignore
├── db/
│   ├── pool.js           # MySQL connection pool
│   └── schema.sql        # SQL สร้างตาราง users
├── routes/
│   ├── pages.js          # /, /login, /profile
│   └── auth.js           # /api/auth/login, /register, /logout, /me
└── public/
    ├── index.html        # หน้าหลัก
    ├── profile.html      # หน้าโปรไฟล์ตัวแทน
    ├── login.html        # หน้าล็อกอิน/สมัครสมาชิก
    ├── src/              # รูปภาพ
    └── icon/             # ไอคอน
```

## ติดตั้งบนเครื่อง dev

```powershell
npm install
# ตั้งค่า .env ให้ครบ (DB_NAME, DB_PASSWORD)
npm run dev
```

เปิด http://localhost:3000

## รัน schema ครั้งแรก

หลังสร้าง database ใน HostAtom แล้ว เปิด phpMyAdmin → เลือก database → tab SQL → paste เนื้อหา `db/schema.sql` แล้วกด Go

## Deploy บน HostAtom (Plesk + Git)

### 1. สร้าง MySQL Database ใน HostAtom Control Panel
- Database User: `vpkann_database` (มีอยู่แล้ว)
- จด **DB_NAME** ที่สร้าง (เช่น `vpkann_fwd`)
- จด **DB_HOST** (ปกติ `localhost`)

### 2. รัน SQL schema
- เปิด phpMyAdmin → เลือก database → tab SQL
- Copy `db/schema.sql` ไปวาง → Go

### 3. ตั้งค่า Node.js ใน Plesk
- เข้า Plesk → โดเมน → **Node.js**
- กด **Enable Node.js**
- Node.js version: 18.x หรือใหม่กว่า
- Application Mode: **production**
- Application Root: `/httpdocs` (หรือที่ folder โปรเจกต์)
- Application Startup File: **`index.js`**
- Application URL: ตามโดเมน

### 4. ตั้งค่า Environment Variables ใน Plesk
ใน panel Node.js ของ Plesk เพิ่มตัวแปร:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | สุ่มยาว ๆ อย่างน้อย 32 ตัว |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_USER` | `vpkann_database` |
| `DB_PASSWORD` | `i5g&8P8$zMlkjGcb` |
| `DB_NAME` | (ชื่อ database ที่สร้าง) |

> **อย่า** commit ไฟล์ `.env` ขึ้น git — ให้ใช้ Plesk Environment Variables แทน

### 5. เชื่อม Git
- ใน Plesk → โดเมน → **Git**
- Add Repository → ใส่ URL ของ git repo
- Deploy Path: `/httpdocs`
- Deployment Actions (rebuild on pull):
  ```
  npm install --production
  ```
  *(หรือใช้ Plesk Node.js panel "NPM Install" button)*

### 6. Push code
```powershell
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

Plesk จะ pull → npm install → restart Node.js ให้อัตโนมัติ

### 7. ทดสอบ
- เปิดเว็บ → ควรเห็นหน้า index
- คลิกปุ่ม ➔ → ไปหน้า `/login`
- กด tab "สมัครสมาชิก" → สร้าง user แรก
- ระบบจะพาไปหน้า `/profile`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | หน้าหลัก |
| GET | `/login` | หน้าล็อกอิน |
| GET | `/profile` | หน้าโปรไฟล์ (ต้องล็อกอิน) |
| GET | `/health` | health check |
| POST | `/api/auth/register` | สมัครสมาชิก |
| POST | `/api/auth/login` | ล็อกอิน |
| POST | `/api/auth/logout` | ออกจากระบบ |
| GET | `/api/auth/me` | เช็คสถานะล็อกอิน |

## หมายเหตุสำคัญ

- **express ถูกล็อก v4** (จาก `^5.2.1` ที่ตั้งไว้เดิม) เพราะ v5 ยังเป็น alpha และเข้ากับ `express-session` ไม่ดี
- **เพิ่ม `bcryptjs`** สำหรับ hash password (pure JS ไม่ต้อง compile)
- **เพิ่ม `express-session`** สำหรับเก็บ session
- **เพิ่ม `express-mysql-session`** ให้ session เก็บใน MySQL (table `sessions` สร้างอัตโนมัติตอน boot ครั้งแรก) แทน MemoryStore เดิม เพื่อให้ผู้ใช้ยัง login ค้างอยู่แม้ Node process จะ restart (deploy ใหม่/crash) — ไม่งั้น cookie บอกว่า 30 วันแต่ session หายทันทีที่ restart
- รูป `S__12566769.jpg` หายไปตอน reorganize folder — ต้องเอามาวางที่ `public/src/` ใหม่
