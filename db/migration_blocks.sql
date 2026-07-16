-- ============================================================
--  Migration: ระบบบลอค (page_blocks + block_images)
--  รื้อ "หน้าตาเว็บ" (public/home.html) ให้แอดมินแก้เองได้ทุกส่วน
--  เขียน: 2026-07-16
--
--  ┌─ ทำไมต้องมีไฟล์นี้ ────────────────────────────────────┐
--  │ เดิม: เนื้อหาหน้าแรกทั้งหมด hardcode อยู่ใน home.html  │
--  │       แอดมินแก้อะไรไม่ได้เลยสักอย่าง                    │
--  │ ใหม่: ทั้งหน้า = รายการ "บลอค" เรียงตาม sort_order      │
--  │       เพิ่ม/ลบ/สลับ/ซ่อน/แก้ ได้อิสระ ไม่ต้อง ALTER อีก  │
--  └────────────────────────────────────────────────────────┘
--
--  ▶ วิธีรัน: phpMyAdmin → เลือก database (vpkann_database)
--            → แท็บ SQL → วางทั้งไฟล์ → Go
--
--  ★ ปลอดภัย: รันซ้ำได้ ไม่ลบข้อมูลเดิม ไม่แตะตาราง users เลย
--    (ไฟล์นี้แค่ "สร้างตารางใหม่ + ใส่เนื้อหาที่ก็อปมาจาก home.html")
-- ============================================================


-- ============================================================
--  0) ★ ตรวจก่อนรัน ★  — ถ้าผลลัพธ์ว่าง = พร้อมรัน
-- ============================================================
SELECT need.t AS `ตารางที่ยังขาด`, need.fix AS `ต้องรันไฟล์นี้ก่อน`
FROM (
  SELECT 'users' AS t, 'db/schema.sql' AS fix
) need
LEFT JOIN information_schema.TABLES it
       ON it.TABLE_SCHEMA = DATABASE()
      AND it.TABLE_NAME   = need.t
WHERE it.TABLE_NAME IS NULL;


-- ============================================================
--  1) ตาราง page_blocks — หัวใจของระบบใหม่
-- ============================================================
--  1 แถว = 1 บลอคบนหน้า
--
--    user_id    = NULL  → บลอคของ "หน้าตาเว็บ" (หน้าแรก) ← ที่ใช้ตอนนี้
--                 = N   → บลอคของหน้าโปรไฟล์ตัวแทนคนที่ N (เผื่ออนาคต
--                         ตอนรื้อ dashboard.html ใช้ตารางเดียวกันนี้ต่อได้เลย)
--    type       = ชนิดบลอค (ดูด้านล่าง)
--    data       = เนื้อหาบลอค เก็บเป็น JSON — แต่ละ type มีรูปแบบของตัวเอง
--                 *** เพิ่มฟิลด์ใหม่ = ใส่ key ใน JSON ไม่ต้อง ALTER TABLE ***
--    parent_id  = บลอคแม่ (NULL = ชั้นบนสุด / มีค่า = บลอคย่อยข้างใน)
--    sort_order = ลำดับบนหน้า (เลขน้อย = อยู่บน) → สลับลำดับ = แก้เลขนี้
--    is_visible = แสดง(1) / ซ่อน(0) — ซ่อนได้ทุกบลอค ไม่ต้องลบ
--
--  ชนิดบลอคของหน้าแรก (ตรงกับที่พี่ดิวสั่ง 8 ข้อ):
--    1. hero     — ภาพหัวเว็บ 6 ภาพ × 3 อุปกรณ์ + ข้อความ + ปุ่ม
--    2. plans    — "เลือกแผนที่เหมาะกับคุณ"  → ลูกเป็น type='page'
--       page     — 1 ปุ่ม = 1 หน้า กดเข้าไปมีบลอคย่อยอีก ซ้อนได้ไม่จำกัด
--                  ชั้นในสุดเขียนโพสยาวๆ ได้ (เหมือนหน้าโปรไฟล์)
--    3. features — "ทำไมต้องวางแผนกับเรา"   → ลูกเป็น type='card'
--       card     — icon + ตัวหนังสือใหญ่เลือกสีได้ + ข้อความอธิบายยาวๆ
--    4. agents   — "รู้จักที่ปรึกษาของคุณ" โชว์ตัวแทน 3-5 คนเป็น popcard
--                  แบบหน้าค้นหา (แอดมินเลือกเองว่าจะโชว์ใคร)
--    5. awards   — "ความสำเร็จและรางวัล"    → ลูกเป็น type='card' (เหมือนข้อ 3)
--    6. (ไม่มี reviews แล้ว — พี่ดิวสั่งเอาออก)
--    7. recruit  — "กำลังมองหาอาชีพที่เติบโตไปพร้อมกับคุณอยู่หรือไม่?" ใส่ภาพอย่างเดียว
--    8. cta      — "พร้อมเริ่มต้นวางแผนกับเราไหม?" LINE + เบอร์โทร + นัดหมาย
--
--  ชนิดเสริม (แทรกตรงไหนก็ได้): text = ข้อความอิสระ / image = รูปอิสระ
-- ============================================================

CREATE TABLE IF NOT EXISTS page_blocks (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NULL,               -- NULL = หน้าแรกของเว็บ
  parent_id   INT UNSIGNED NULL,               -- บลอคแม่ (NULL = ชั้นบนสุด)
  type        VARCHAR(24)  NOT NULL,           -- ชนิดบลอค
  sort_order  INT          NOT NULL DEFAULT 0, -- ลำดับบนหน้า
  is_visible  TINYINT(1)   NOT NULL DEFAULT 1, -- แสดง/ซ่อน
  data        JSON         NULL,               -- เนื้อหา (รูปแบบตาม type)
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_blocks_page   (user_id, sort_order),
  KEY idx_blocks_parent (parent_id, sort_order),
  KEY idx_blocks_type   (user_id, type),
  CONSTRAINT fk_blocks_user   FOREIGN KEY (user_id)   REFERENCES users(id)       ON DELETE CASCADE,
  CONSTRAINT fk_blocks_parent FOREIGN KEY (parent_id) REFERENCES page_blocks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  2) ตาราง block_images — รูปของบลอค ("ภาพบลอค")
-- ============================================================
--  แยกตารางแทนยัด JSON เพราะ:
--    - 1 บลอคมีได้หลายรูป (hero = 6 ภาพ)
--    - 1 ภาพมีได้หลายเวอร์ชันตามอุปกรณ์ (variant)
--    - สลับลำดับรูป = แก้ sort_order (ไม่ต้อง rewrite ทั้ง JSON)
--    - ลบบลอค → รูปหายตาม (CASCADE) ไม่เหลือไฟล์ผี
--
--    slot    = ภาพที่เท่าไหร่ (0-5 = 6 ภาพ ตามที่พี่ดิวสั่ง)
--    variant = อุปกรณ์:  'web'    = คอมพิวเตอร์
--                        'tablet' = iPad
--                        'mobile' = โทรศัพท์
--    → hero 1 บลอค = 6 slot × 3 variant = อัปได้ 18 รูป
--      (ใส่ไม่ครบก็ได้ — ไม่มี variant ไหน ระบบใช้ 'web' แทน)
-- ============================================================

CREATE TABLE IF NOT EXISTS block_images (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  block_id    INT UNSIGNED NOT NULL,
  image_path  VARCHAR(255) NOT NULL,            -- เช่น /uploads/blocks/hero-1.jpg
  slot        INT          NOT NULL DEFAULT 0,  -- ภาพที่เท่าไหร่ (0-5)
  variant     VARCHAR(12)  NOT NULL DEFAULT 'web',
  caption     VARCHAR(255) NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_block_slot (block_id, slot, variant),  -- 1 ช่อง 1 รูป (อัปทับได้)
  KEY idx_block_images (block_id, slot),
  CONSTRAINT fk_block_images_block FOREIGN KEY (block_id) REFERENCES page_blocks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  3) ใส่บลอคหน้าแรก — ก็อปเนื้อหาที่มีอยู่ใน home.html เข้ามา
-- ============================================================
--  ทุก INSERT มี "WHERE NOT EXISTS" กันสร้างซ้ำเวลารันไฟล์นี้ซ้ำ
--  ข้อความทั้งหมดยกมาจาก home.html ของจริง → หน้าเว็บจะหน้าตาเหมือนเดิมเป๊ะ
--  ต่างกันแค่ "แก้ได้แล้ว"
-- ============================================================

-- ---------- ข้อ 1: hero ----------
INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
SELECT NULL, NULL, 'hero', 1, 1,
       JSON_OBJECT(
         'tagline', 'Plan Today, Live Your Future',
         'heading', 'วางแผนวันนี้ เพื่ออนาคตที่คุณเลือกได้',
         'sub',     'เพราะทุกเป้าหมายในชีวิต ควรมีแผนที่มั่นคงรองรับ',
         'tags',    JSON_ARRAY('❤️ ประกันชีวิต', '➕ สุขภาพ', '🐷 การออม', '🎁 มรดก'),
         'cta_line_url',    'https://line.me/R/ti/p/@kavisara.fwd',
         'cta_appoint_url', '#contact'
       )
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM page_blocks
                  WHERE user_id IS NULL AND parent_id IS NULL AND type = 'hero');

-- ---------- ข้อ 2: plans ("เลือกแผนที่เหมาะกับคุณ") ----------
--  ลูก (type='page') ยังไม่ใส่ — ให้แอดมินกด "สร้างบลอค" เองในหน้าเว็บ
--  กดเข้าไปในบลอค → สร้างบลอคย่อยได้อีก → ชั้นในสุดเขียนโพสยาวๆ
INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
SELECT NULL, NULL, 'plans', 2, 1,
       JSON_OBJECT('title', 'เลือกแผนที่เหมาะกับคุณ',
                   'subtitle', 'คุณกำลังมองหาอะไรอยู่?')
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM page_blocks
                  WHERE user_id IS NULL AND parent_id IS NULL AND type = 'plans');

-- ---------- ข้อ 3: features ("ทำไมต้องวางแผนกับเรา") ----------
INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
SELECT NULL, NULL, 'features', 3, 1,
       JSON_OBJECT('title', 'ทำไมต้องวางแผนกับเรา')
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM page_blocks
                  WHERE user_id IS NULL AND parent_id IS NULL AND type = 'features');

-- ---------- ข้อ 4: agents ("รู้จักที่ปรึกษาของคุณ") ----------
--  agent_ids = ว่างไว้ก่อน → แอดมินกดเลือกเองบนหน้าเว็บว่าจะโชว์ตัวแทนคนไหนบ้าง (3-5 คน)
--  (ระบบเก่า "เลือกบัญชีที่เป็นหน้า Home" ถูกยกเลิกแล้ว — เลือกที่บลอคนี้ที่เดียว)
INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
SELECT NULL, NULL, 'agents', 4, 1,
       JSON_OBJECT('title', 'รู้จักที่ปรึกษาของคุณ',
                   'subtitle', 'ทีมที่ปรึกษาที่พร้อมดูแลคุณ',
                   'agent_ids', JSON_ARRAY(),   -- แอดมินเลือก 3-5 คน
                   'max_show',  5)
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM page_blocks
                  WHERE user_id IS NULL AND parent_id IS NULL AND type = 'agents');

-- ---------- ข้อ 5: awards ("ความสำเร็จและรางวัล") ----------
INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
SELECT NULL, NULL, 'awards', 5, 1,
       JSON_OBJECT('title', 'ความสำเร็จและรางวัล')
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM page_blocks
                  WHERE user_id IS NULL AND parent_id IS NULL AND type = 'awards');

-- ---------- ข้อ 6: reviews — พี่ดิวสั่ง "เอาออก" → ไม่สร้าง ----------

-- ---------- ข้อ 7: recruit (ใส่ภาพอย่างเดียว) ----------
INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
SELECT NULL, NULL, 'recruit', 6, 1,
       JSON_OBJECT('title', 'กำลังมองหาอาชีพที่เติบโตไปพร้อมกับคุณอยู่หรือไม่?')
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM page_blocks
                  WHERE user_id IS NULL AND parent_id IS NULL AND type = 'recruit');

-- ---------- ข้อ 8: cta ("พร้อมเริ่มต้นวางแผนกับเราไหม?") ----------
--  line_id / phone = แอดมินกรอกเองได้บนหน้าเว็บ
--  appointment_agent_id = ฟอร์มนัดหมายที่ลูกค้ากรอก จะเข้าเป็นรายการของตัวแทนคนไหน
--    (NULL = ยังไม่เลือก → ปุ่ม "นัดหมายปรึกษา" จะยังใช้ไม่ได้
--     แอดมินเลือกได้บนหน้าเว็บในบลอคนี้)
--    → ลงตาราง contact_inquiries kind='appointment' → ตัวแทนเห็นที่หน้า /inquiries
INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
SELECT NULL, NULL, 'cta', 7, 1,
       JSON_OBJECT(
         'title',    'พร้อมเริ่มต้นวางแผนกับเราไหม?',
         'subtitle', 'อนาคตที่ดี เริ่มต้นจากการตัดสินใจในวันนี้ — ให้เราช่วยออกแบบแผนที่เหมาะกับชีวิตของคุณ',
         'line_id',  '@kavisara.fwd',
         'line_url', 'https://line.me/R/ti/p/@kavisara.fwd',
         'phone',    '062-2397362',
         'appointment_enabled',  TRUE,
         'appointment_agent_id', NULL
       )
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM page_blocks
                  WHERE user_id IS NULL AND parent_id IS NULL AND type = 'cta');


-- ============================================================
--  4) ใส่การ์ดลูก (type='card') ของข้อ 3 และ ข้อ 5
-- ============================================================
--  card = icon + ตัวหนังสือใหญ่ (เลือกสีได้) + ข้อความอธิบาย
--    icon  = อีโมจิ
--    text  = ตัวหนังสือใหญ่
--    color = สีของตัวหนังสือใหญ่ (hex) — แอดมินเลือกได้
--    desc  = ข้อความอธิบายยาวๆ
--  แอดมินกด "เพิ่มการ์ด" ในหน้าเว็บเพื่อเพิ่มได้เองไม่จำกัด
-- ============================================================

-- ---------- การ์ดของ features (ยกมาจากแถบสถิติเดิมใน home.html) ----------
INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
SELECT NULL, f.id, 'card', c.ord, 1,
       JSON_OBJECT('icon', c.icon, 'text', c.text, 'color', c.color, 'desc', c.descr)
FROM page_blocks f
JOIN (
  SELECT 1 AS ord, '👥' AS icon, '1,000+'       AS text, '#ea580c' AS color, 'ลูกค้าที่ดูแล'          AS descr
  UNION ALL SELECT 2, '🏅', '6+',           '#ea580c', 'ปีประสบการณ์'
  UNION ALL SELECT 3, '🏆', 'MDRT',         '#1f2937', 'มาตรฐานระดับโลก'
  UNION ALL SELECT 4, '🎓', 'Professional', '#1f2937', 'Financial Consultant'
) c
WHERE f.user_id IS NULL AND f.parent_id IS NULL AND f.type = 'features'
  AND NOT EXISTS (SELECT 1 FROM page_blocks ch WHERE ch.parent_id = f.id);

-- ---------- การ์ดของ awards (ยกมาจากตารางรางวัลเดิมใน home.html) ----------
INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
SELECT NULL, a.id, 'card', c.ord, 1,
       JSON_OBJECT('icon', c.icon, 'text', c.text, 'color', c.color, 'desc', c.descr)
FROM page_blocks a
JOIN (
  SELECT 1 AS ord, '🥇' AS icon, '2022' AS text, '#ea580c' AS color, 'MDRT Qualifier'         AS descr
  UNION ALL SELECT 2, '🏆', '2023', '#ea580c', 'Top Unit Manager'
  UNION ALL SELECT 3, '🎖️', '2024', '#ea580c', 'Financial Advisor Award'
  UNION ALL SELECT 4, '👑', '2025', '#ea580c', 'Leadership Achievement'
) c
WHERE a.user_id IS NULL AND a.parent_id IS NULL AND a.type = 'awards'
  AND NOT EXISTS (SELECT 1 FROM page_blocks ch WHERE ch.parent_id = a.id);


-- ============================================================
--  5) ตรวจผลหลังรัน — ควรรันดูทุกครั้ง
-- ============================================================

-- 5.1 บลอคหน้าแรกทั้งหมด (ควรได้ 7 แถว เรียง 1-7 ไม่มี reviews)
--     hero เก็บหัวข้อไว้ใน key 'heading' ส่วนบลอคอื่นใช้ 'title' → ดูทั้งสอง key
SELECT sort_order AS `ลำดับ`, type AS `ชนิดบลอค`,
       COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.title')),
                JSON_UNQUOTE(JSON_EXTRACT(data, '$.heading'))) AS `หัวข้อ`,
       is_visible AS `แสดง`
FROM page_blocks
WHERE user_id IS NULL AND parent_id IS NULL
ORDER BY sort_order;

-- 5.2 การ์ดลูกของ features / awards (ควรได้อย่างละ 4)
SELECT p.type AS `บลอคแม่`,
       JSON_UNQUOTE(JSON_EXTRACT(ch.data, '$.icon')) AS `ไอคอน`,
       JSON_UNQUOTE(JSON_EXTRACT(ch.data, '$.text')) AS `ตัวหนังสือใหญ่`,
       JSON_UNQUOTE(JSON_EXTRACT(ch.data, '$.color')) AS `สี`,
       JSON_UNQUOTE(JSON_EXTRACT(ch.data, '$.desc')) AS `คำอธิบาย`
FROM page_blocks ch
JOIN page_blocks p ON p.id = ch.parent_id
WHERE ch.type = 'card'
ORDER BY p.sort_order, ch.sort_order;


-- ============================================================
--  หมายเหตุ — สิ่งที่ไฟล์นี้ "ไม่" ทำ
-- ============================================================
--  ✗ ไม่แตะตาราง users เลย (ไม่เพิ่ม/ไม่ลบคอลัมน์)
--  ✗ ไม่แตะ user_pages / agent_posts / insurance_plans
--    → หน้าโปรไฟล์ตัวแทน (dashboard.html) ยังทำงานเหมือนเดิมทุกอย่าง
--  ✗ ไม่ลบ site_settings.home_featured_agent_id (บลอค agents ใช้ fallback)
--
--  ตอนรื้อหน้าโปรไฟล์ทีหลัง → ใช้ 2 ตารางนี้ต่อได้เลย
--  แค่ใส่ user_id = id ของตัวแทน แทนที่จะเป็น NULL
-- ============================================================
