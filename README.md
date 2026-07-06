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
│   ├── pool.js                       # MySQL connection pool
│   ├── schema.sql                    # SQL สร้างตาราง (users + insurance_categories/plans)
│   └── migration_insurance_plans.sql # migration แยก สำหรับ DB เก่าที่มี users อยู่แล้ว
├── routes/
│   ├── pages.js          # /, /login, /profile, /dashboard, /agent/:id, /search, /plans, /plans/:id
│   ├── auth.js           # /api/auth/login, /register, /logout, /me, /profile (PUT)
│   ├── users.js          # /api/users, /api/users/:id
│   └── plans.js          # /api/plans (CRUD), /api/categories — Phase 3
└── public/
    ├── index.html        # หน้าหลัก (landing) — service card เชื่อมไป /plans?category=slug
    ├── dashboard.html    # โปรไฟล์ตัวแทน — ใช้ทั้ง /profile, /dashboard (โหมดตัวเอง แก้ไขได้
    │                     # รวมจัดการแบบประกันในโมดัล "plans") และ /agent/:id (โหมดดูคนอื่น,
    │                     # read-only) แยกโหมดด้วย URL path
    │                     # (profile.html เดิมถูกยุบรวมเข้ามาที่นี่แล้ว 2026-07-03)
    ├── login.html        # หน้าล็อกอิน/สมัครสมาชิก
    ├── search.html       # ค้นหาตัวแทน
    ├── plans.html        # รายการแบบประกัน (public, filter ตามหมวดหมู่)
    ├── plan-detail.html  # รายละเอียดแบบประกันรายตัว (public)
    ├── nav.js            # nav bar ที่ใช้ร่วมกันหลายหน้า
    ├── src/               # รูปภาพ
    └── uploads/           # avatar/cover/plan images ที่ผู้ใช้อัปโหลด
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

**ถ้า database มีตาราง `users` อยู่แล้ว** (deploy ครั้งแรกไปนานแล้ว) ให้รัน
`db/migration_insurance_plans.sql` เพิ่มด้วย (สร้างตาราง insurance_categories +
insurance_plans สำหรับ Phase 3 — ปลอดภัยรันซ้ำได้ ไม่ลบข้อมูลเดิม)

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
| GET | `/profile` | โปรไฟล์ตัวเอง (ต้องล็อกอิน, แก้ไขได้) — serve `dashboard.html` |
| GET | `/dashboard` | เหมือน `/profile` (alias เดิม, ต้องล็อกอิน) |
| GET | `/agent/:id` | ดูโปรไฟล์ตัวแทนคนอื่น (public, read-only) — serve `dashboard.html` เช่นกัน |
| GET | `/search` | ค้นหาตัวแทน |
| GET | `/health` | health check |
| POST | `/api/auth/register` | สมัครสมาชิก |
| POST | `/api/auth/login` | ล็อกอิน |
| POST | `/api/auth/logout` | ออกจากระบบ |
| GET | `/api/auth/me` | เช็คสถานะล็อกอิน |
| PUT | `/api/auth/profile` | แก้ไขโปรไฟล์ (avatar, cover images, ข้อมูลส่วนตัว) |
| GET | `/api/users` | รายชื่อตัวแทนทั้งหมด |
| GET | `/api/users/:id` | ข้อมูลตัวแทนรายคน (public) |
| GET | `/plans` | รายการแบบประกัน (public, filter `?category=slug&user_id=`) |
| GET | `/plans/:id` | รายละเอียดแบบประกัน (public) |
| GET | `/api/categories` | รายการหมวดหมู่แบบประกัน (6 หมวด) |
| GET | `/api/plans` | รายการแบบประกัน (public, active เท่านั้น) |
| GET | `/api/plans/mine` | แบบประกันของตัวเอง รวมที่ซ่อนอยู่ (ต้องล็อกอิน) |
| GET | `/api/plans/:id` | รายละเอียดแบบประกัน (public, นับ view) |
| POST | `/api/plans` | สร้างแบบประกันใหม่ (ต้องล็อกอิน) |
| PUT | `/api/plans/:id` | แก้ไขแบบประกัน (ต้องเป็นเจ้าของ) |
| DELETE | `/api/plans/:id` | ลบแบบประกัน (ต้องเป็นเจ้าของ) |

## SupperAdmin — จัดการตัวแทน (ผู้ใช้)

"SupperAdmin" (role `admin`) ล็อกอินแยกที่ `/support-admin` เพื่อ **เพิ่ม/ปิด-เปิด/ลบ ตัวแทน (ผู้ใช้)**
เว็บนี้ **ไม่มีหน้าสมัครสมาชิกเอง** — บัญชีตัวแทนทั้งหมดสร้างโดย SupperAdmin เท่านั้น

หน้าแรก (`/`) เป็น **หน้าค้นหาตัวแทน** ล้วนๆ (ค้นด้วยชื่อ/รหัส/จังหวัด/สาขา ดึงจาก `/api/users`)

**ติดตั้งครั้งแรก (สร้างบัญชี admin)**
- รัน `db/seed_admin.sql` ใน phpMyAdmin (หรือ `db/migration_supperadmin.sql`)
  → ได้บัญชี **user `admin` / รหัส `1234`** (เข้ารหัส bcrypt)
- (ทางเลือก) เปลี่ยนรหัส: `node scripts/create_supperadmin.js admin <รหัสใหม่>`

**การใช้งาน**
- เข้า `/support-admin` → ล็อกอิน (user `admin` / pass `1234`) → หน้า `/support-admin/users`
- กรอกฟอร์ม "เพิ่มตัวแทน" (อีเมล+รหัสผ่าน = ใช้ล็อกอินที่ `/login`) → ตัวแทนแก้โปรไฟล์ตัวเองได้
- พื้นหลังหน้า login + โลโก้ ใช้ไฟล์ใน `public/assets/` (`background.svg`, `Logo.svg`)

**Endpoints ที่เพิ่ม**

| Method | Path | สิทธิ์ | Description |
|--------|------|--------|-------------|
| POST | `/api/auth/supperadmin-login` | public | ล็อกอิน SupperAdmin (`{username, password}`) → ต้อง role `admin` |
| GET | `/api/admin/users` | admin | รายชื่อผู้ใช้ทั้งหมด |
| POST | `/api/admin/users` | admin | เพิ่มผู้ใช้ (email, password, first_name, last_name, role, …) |
| PUT | `/api/admin/users/:id` | admin | แก้ข้อมูล/เปลี่ยนรหัส/สถานะ/บทบาท |
| DELETE | `/api/admin/users/:id` | admin | ลบผู้ใช้ |

> หมายเหตุ: ระบบแก้ข้อความหน้า index (CMS / ตาราง `site_content`) ถูกยกเลิกแล้ว (รอบ 14) เพราะ index เปลี่ยนเป็นหน้าค้นหา

## หมายเหตุสำคัญ

- **express ถูกล็อก v4** (จาก `^5.2.1` ที่ตั้งไว้เดิม) เพราะ v5 ยังเป็น alpha และเข้ากับ `express-session` ไม่ดี
- **เพิ่ม `bcryptjs`** สำหรับ hash password (pure JS ไม่ต้อง compile)
- **เพิ่ม `express-session`** สำหรับเก็บ session
- **เพิ่ม `express-mysql-session`** ให้ session เก็บใน MySQL (table `sessions` สร้างอัตโนมัติตอน boot ครั้งแรก) แทน MemoryStore เดิม เพื่อให้ผู้ใช้ยัง login ค้างอยู่แม้ Node process จะ restart (deploy ใหม่/crash) — ไม่งั้น cookie บอกว่า 30 วันแต่ session หายทันทีที่ restart
- รูป `S__12566769.jpg` ไม่มีหน้าไหนอ้างอิงแล้ว (เปลี่ยนไปใช้รูป Unsplash ในหน้าแรกแทน) — ดู `AI_Memory/09_ตรวจสอบไฟล์ไม่ใช้.txt` ว่าจะเก็บหรือลบ
- **`insurance_plans.content_html`**: ชื่อคอลัมน์มี "html" แต่ตอนนี้ฝั่ง frontend (`plan-detail.html`) render เป็น **plain text เท่านั้น** (escape แล้วค่อยแปลง `\n` เป็น `<br>`) ไม่ใช่ innerHTML ตรงๆ เพราะเนื้อหามาจากตัวแทนกรอกเอง ถ้าจะเปิด rich text/HTML จริงในอนาคต ต้องใส่ sanitizer (เช่น DOMPurify) ก่อน ไม่งั้นจะเป็นช่องโหว่ stored XSS
