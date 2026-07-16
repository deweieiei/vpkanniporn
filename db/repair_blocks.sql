-- ============================================================
--  ซ่อมระบบบลอค — ใช้แทน migration_blocks.sql ที่รันแล้วมีปัญหา
--  2026-07-16
--
--  ┌─ เกิดอะไรขึ้น ─────────────────────────────────────────┐
--  │ ไฟล์ migration_blocks.sql มี 2 เวอร์ชัน:               │
--  │   เวอร์ชันแรก : user_id = NOT NULL (ห้ามว่าง)          │
--  │   เวอร์ชันสอง : user_id = NULL ได้ (NULL = หน้าแรก)    │
--  │ พอเวอร์ชันแรกรันไปแล้ว ตารางถูกสร้างด้วยกฎ NOT NULL     │
--  │ เวอร์ชันสองใช้ CREATE TABLE IF NOT EXISTS = "มีแล้วข้าม"│
--  │ → ตารางกฎเก่าค้างอยู่ → INSERT NULL ไม่ได้              │
--  │   ERROR 1048: Column 'user_id' cannot be null           │
--  └────────────────────────────────────────────────────────┘
--
--  ▶ วิธีรัน: phpMyAdmin → เลือก database → แท็บ SQL → วางทั้งไฟล์ → Go
--
--  ★ ปลอดภัย: แตะแค่ 2 ตาราง page_blocks + block_images (ตารางใหม่ สร้างวันนี้
--    มีแต่ข้อมูลตัวอย่างที่ก็อปมาจาก home.html — ไม่ใช่ข้อมูลที่พี่ดิวพิมพ์เอง)
--    ✗ ไม่แตะ users / user_pages / agent_posts / contact_inquiries / อะไรทั้งนั้น
--    ★ รันซ้ำได้ ไม่พัง
-- ============================================================


-- ============================================================
--  ขั้นที่ 1 — ล้างของเก่าที่พังทิ้ง
-- ============================================================
--  ทำไมต้องลบทิ้ง ไม่ซ่อมทีละจุด:
--    ตอนนี้ DB อยู่ในสภาพครึ่งๆ กลางๆ (ตารางกฎผิด + ข้อมูลผูก user_id 4 +
--    block_images อาจไม่มี) ซ่อมทีละจุดจะซับซ้อนและพลาดง่าย
--    ข้อมูลข้างในเป็นแค่ "ข้อความตัวอย่างที่ผมก็อปมาจากหน้าเว็บเดิม" ไม่มีอะไรของพี่
--    → ลบแล้วสร้างใหม่ให้ถูกตั้งแต่ต้น สะอาดกว่าและชัวร์กว่า
--
--  ลำดับสำคัญ: ลบ block_images ก่อน เพราะมันอ้างถึง page_blocks อยู่

DROP TABLE IF EXISTS block_images;
DROP TABLE IF EXISTS page_blocks;


-- ============================================================
--  ขั้นที่ 2 — สร้างใหม่ให้ถูก (user_id ยอมให้เป็น NULL)
-- ============================================================
--    user_id = NULL → บลอคของ "หน้าตาเว็บ" (หน้าแรก)  ← ที่ใช้ตอนนี้
--             = N   → บลอคของหน้าโปรไฟล์ตัวแทนคนที่ N (เผื่ออนาคต)

CREATE TABLE page_blocks (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NULL,               -- ★ NULL ได้ = หน้าแรกของเว็บ
  parent_id   INT UNSIGNED NULL,               -- บลอคแม่ (NULL = ชั้นบนสุด)
  type        VARCHAR(24)  NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  is_visible  TINYINT(1)   NOT NULL DEFAULT 1,
  data        JSON         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_blocks_page   (user_id, sort_order),
  KEY idx_blocks_parent (parent_id, sort_order),
  KEY idx_blocks_type   (user_id, type),
  CONSTRAINT fk_blocks_user   FOREIGN KEY (user_id)   REFERENCES users(id)       ON DELETE CASCADE,
  CONSTRAINT fk_blocks_parent FOREIGN KEY (parent_id) REFERENCES page_blocks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE block_images (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  block_id    INT UNSIGNED NOT NULL,
  image_path  VARCHAR(255) NOT NULL,
  slot        INT          NOT NULL DEFAULT 0,   -- ภาพที่เท่าไหร่ (0-5 = 6 ภาพ)
  variant     VARCHAR(12)  NOT NULL DEFAULT 'web', -- web=คอม / tablet=iPad / mobile=โทรศัพท์
  caption     VARCHAR(255) NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_block_slot (block_id, slot, variant),
  KEY idx_block_images (block_id, slot),
  CONSTRAINT fk_block_images_block FOREIGN KEY (block_id) REFERENCES page_blocks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  ขั้นที่ 3 — ใส่บลอคหน้าแรก 7 อัน (user_id = NULL)
-- ============================================================
--  ข้อความยกมาจาก home.html เดิมทั้งหมด → หน้าเว็บจะหน้าตาเหมือนเดิม แค่แก้ได้แล้ว
--  ไม่มี reviews (ข้อ 6 พี่ดิวสั่งเอาออก)

INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data) VALUES
-- ข้อ 1: hero (ภาพ 6 ภาพ × 3 อุปกรณ์ อัปทีหลังบนหน้าเว็บ)
(NULL, NULL, 'hero', 1, 1, JSON_OBJECT(
  'tagline', 'Plan Today, Live Your Future',
  'heading', 'วางแผนวันนี้ เพื่ออนาคตที่คุณเลือกได้',
  'sub',     'เพราะทุกเป้าหมายในชีวิต ควรมีแผนที่มั่นคงรองรับ',
  'tags',    JSON_ARRAY('❤️ ประกันชีวิต', '➕ สุขภาพ', '🐷 การออม', '🎁 มรดก'),
  'cta_line_url',    'https://line.me/R/ti/p/@kavisara.fwd',
  'cta_appoint_url', '#contact')),

-- ข้อ 2: plans (ปุ่ม/บลอคซ้อนชั้น — แอดมินกด "สร้างบลอค" เพิ่มเองบนหน้าเว็บ)
(NULL, NULL, 'plans', 2, 1, JSON_OBJECT(
  'title',    'เลือกแผนที่เหมาะกับคุณ',
  'subtitle', 'คุณกำลังมองหาอะไรอยู่?')),

-- ข้อ 3: features (การ์ด icon + ตัวหนังสือใหญ่เลือกสีได้ + คำอธิบาย)
(NULL, NULL, 'features', 3, 1, JSON_OBJECT('title', 'ทำไมต้องวางแผนกับเรา')),

-- ข้อ 4: agents (โชว์ตัวแทน 3-5 คน แบบ popcard — แอดมินเลือกเองบนหน้าเว็บ)
(NULL, NULL, 'agents', 4, 1, JSON_OBJECT(
  'title',     'รู้จักที่ปรึกษาของคุณ',
  'subtitle',  'ทีมที่ปรึกษาที่พร้อมดูแลคุณ',
  'agent_ids', JSON_ARRAY(),
  'max_show',  5)),

-- ข้อ 5: awards (โครงเดียวกับข้อ 3)
(NULL, NULL, 'awards', 5, 1, JSON_OBJECT('title', 'ความสำเร็จและรางวัล')),

-- ข้อ 6: reviews — พี่ดิวสั่งเอาออก → ไม่สร้าง

-- ข้อ 7: recruit (ใส่ภาพอย่างเดียว)
(NULL, NULL, 'recruit', 6, 1, JSON_OBJECT(
  'title', 'กำลังมองหาอาชีพที่เติบโตไปพร้อมกับคุณอยู่หรือไม่?')),

-- ข้อ 8: cta (LINE + เบอร์โทร + นัดหมาย — แอดมินกรอก/เลือกเองบนหน้าเว็บ)
(NULL, NULL, 'cta', 7, 1, JSON_OBJECT(
  'title',    'พร้อมเริ่มต้นวางแผนกับเราไหม?',
  'subtitle', 'อนาคตที่ดี เริ่มต้นจากการตัดสินใจในวันนี้ — ให้เราช่วยออกแบบแผนที่เหมาะกับชีวิตของคุณ',
  'line_id',  '@kavisara.fwd',
  'line_url', 'https://line.me/R/ti/p/@kavisara.fwd',
  'phone',    '062-2397362',
  'appointment_enabled',  TRUE,
  'appointment_agent_id', NULL));


-- ============================================================
--  ขั้นที่ 4 — ใส่การ์ดลูกของข้อ 3 และ ข้อ 5
-- ============================================================
--  ต้องใช้ id ของบลอคแม่ → หาด้วย SELECT (ไม่ hardcode เลข เพราะ id อาจไม่ใช่ 1-7)

-- การ์ดของ features (ยกมาจากแถบสถิติเดิมใน home.html)
INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
SELECT NULL, f.id, 'card', c.ord, 1,
       JSON_OBJECT('icon', c.icon, 'text', c.text, 'color', c.color, 'desc', c.descr)
FROM page_blocks f
JOIN (
  SELECT 1 AS ord, '👥' AS icon, '1,000+'       AS text, '#ea580c' AS color, 'ลูกค้าที่ดูแล'   AS descr
  UNION ALL SELECT 2, '🏅', '6+',           '#ea580c', 'ปีประสบการณ์'
  UNION ALL SELECT 3, '🏆', 'MDRT',         '#1f2937', 'มาตรฐานระดับโลก'
  UNION ALL SELECT 4, '🎓', 'Professional', '#1f2937', 'Financial Consultant'
) c
WHERE f.user_id IS NULL AND f.parent_id IS NULL AND f.type = 'features';

-- การ์ดของ awards (ยกมาจากตารางรางวัลเดิมใน home.html)
INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
SELECT NULL, a.id, 'card', c.ord, 1,
       JSON_OBJECT('icon', c.icon, 'text', c.text, 'color', c.color, 'desc', c.descr)
FROM page_blocks a
JOIN (
  SELECT 1 AS ord, '🥇' AS icon, '2022' AS text, '#ea580c' AS color, 'MDRT Qualifier' AS descr
  UNION ALL SELECT 2, '🏆', '2023', '#ea580c', 'Top Unit Manager'
  UNION ALL SELECT 3, '🎖️', '2024', '#ea580c', 'Financial Advisor Award'
  UNION ALL SELECT 4, '👑', '2025', '#ea580c', 'Leadership Achievement'
) c
WHERE a.user_id IS NULL AND a.parent_id IS NULL AND a.type = 'awards';


-- ============================================================
--  ขั้นที่ 5 — ตรวจผล ★ ต้องได้แบบนี้เป๊ะ ★
-- ============================================================

-- 5.1 คอลัมน์ user_id ต้องขึ้น `ยอมให้ว่าง` = YES
SELECT COLUMN_NAME AS `คอลัมน์`, IS_NULLABLE AS `ยอมให้ว่าง (ต้องเป็น YES)`
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'page_blocks' AND COLUMN_NAME = 'user_id';

-- 5.2 ต้องได้ 7 แถว เรียง 1-7 · user_id ว่างทุกแถว · ไม่มี reviews
SELECT sort_order AS `ลำดับ`, type AS `ชนิดบลอค`,
       COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.title')),
                JSON_UNQUOTE(JSON_EXTRACT(data, '$.heading'))) AS `หัวข้อ`,
       (SELECT COUNT(*) FROM page_blocks c WHERE c.parent_id = b.id) AS `การ์ดลูก`
FROM page_blocks b
WHERE user_id IS NULL AND parent_id IS NULL
ORDER BY sort_order;

-- 5.3 ต้องได้ features 4 การ์ด + awards 4 การ์ด
SELECT p.type AS `บลอคแม่`, COUNT(*) AS `จำนวนการ์ด`
FROM page_blocks ch JOIN page_blocks p ON p.id = ch.parent_id
WHERE ch.type = 'card' GROUP BY p.type;

-- 5.4 ตาราง block_images ต้องมี (ถ้าไม่มีแถวไม่เป็นไร — ยังไม่ได้อัปรูป)
SELECT TABLE_NAME AS `ตารางที่มี (ต้องเห็นทั้ง 2 ชื่อ)`
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('page_blocks', 'block_images');
