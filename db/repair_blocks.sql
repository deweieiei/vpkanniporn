/* ============================================================
   ซ่อมระบบบลอค (page_blocks + block_images)
   ใช้แทน migration_blocks.sql ที่รันแล้วมีปัญหา — 2026-07-16

   วิธีรัน: phpMyAdmin -> เลือก database -> แท็บ SQL -> วางทั้งไฟล์ -> Go
            (ต้องวางทั้งไฟล์ ห้ามเลือกก็อปบางท่อน)

   ปลอดภัย: แตะแค่ 2 ตาราง page_blocks + block_images
            ซึ่งเป็นตารางใหม่ที่เพิ่งสร้าง มีแต่ข้อความตัวอย่างจาก home.html
            ไม่แตะ users / user_pages / agent_posts / contact_inquiries
            รันซ้ำได้ ไม่พัง

   หมายเหตุสำคัญ:
   ไฟล์นี้ใช้คอมเมนต์แบบปิดหัวปิดท้ายทั้งหมด ไม่ใช้คอมเมนต์แบบขีดสองขีดเลย
   เพราะคอมเมนต์แบบขีดสองขีดแปลว่า ข้ามทั้งบรรทัดนี้
   ถ้าตอนก็อปวางแล้วบรรทัดหาย คำสั่ง SQL จะถูกกลืนเป็นคอมเมนต์หมด
   ไม่มีอะไรทำงานเลย แบบปิดหัวปิดท้ายจะรอด ต่อให้ไฟล์ยุบเหลือบรรทัดเดียว
   ============================================================ */


/* ---------- ขั้นที่ 1: ล้างของเก่าที่พังทิ้ง ----------
   ลบ block_images ก่อน เพราะมันอ้างถึง page_blocks อยู่ */

DROP TABLE IF EXISTS block_images;
DROP TABLE IF EXISTS page_blocks;


/* ---------- ขั้นที่ 2: สร้างใหม่ให้ถูก ----------
   user_id = NULL คือบลอคของหน้าตาเว็บ (หน้าแรก)
   user_id = ตัวเลข คือบลอคของหน้าโปรไฟล์ตัวแทนคนนั้น (เผื่ออนาคต) */

CREATE TABLE page_blocks (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NULL,
  parent_id   INT UNSIGNED NULL,
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
  slot        INT          NOT NULL DEFAULT 0,
  variant     VARCHAR(12)  NOT NULL DEFAULT 'web',
  caption     VARCHAR(255) NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_block_slot (block_id, slot, variant),
  KEY idx_block_images (block_id, slot),
  CONSTRAINT fk_block_images_block FOREIGN KEY (block_id) REFERENCES page_blocks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


/* ---------- ขั้นที่ 3: ใส่บลอคหน้าแรก 7 อัน ----------
   แยกเป็นคำสั่งละบลอค ไม่รวมเป็นก้อนเดียว
   ถ้าอันไหนพัง อันอื่นยังรันต่อได้ และไม่มีเครื่องหมายจุลภาคห้อยท้าย

   ลำดับ 1 hero, 2 plans, 3 features, 4 agents, 5 awards, 6 recruit, 7 cta
   (ไม่มี reviews — พี่ดิวสั่งเอาออก) */

INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
VALUES (NULL, NULL, 'hero', 1, 1, JSON_OBJECT(
  'tagline', 'Plan Today, Live Your Future',
  'heading', 'วางแผนวันนี้ เพื่ออนาคตที่คุณเลือกได้',
  'sub',     'เพราะทุกเป้าหมายในชีวิต ควรมีแผนที่มั่นคงรองรับ',
  'tags',    JSON_ARRAY('❤️ ประกันชีวิต', '➕ สุขภาพ', '🐷 การออม', '🎁 มรดก'),
  'cta_line_url',    'https://line.me/R/ti/p/@kavisara.fwd',
  'cta_appoint_url', '#contact'));

INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
VALUES (NULL, NULL, 'plans', 2, 1, JSON_OBJECT(
  'title',    'เลือกแผนที่เหมาะกับคุณ',
  'subtitle', 'คุณกำลังมองหาอะไรอยู่?'));

INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
VALUES (NULL, NULL, 'features', 3, 1, JSON_OBJECT('title', 'ทำไมต้องวางแผนกับเรา'));

INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
VALUES (NULL, NULL, 'agents', 4, 1, JSON_OBJECT(
  'title',     'รู้จักที่ปรึกษาของคุณ',
  'subtitle',  'ทีมที่ปรึกษาที่พร้อมดูแลคุณ',
  'agent_ids', JSON_ARRAY(),
  'max_show',  5));

INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
VALUES (NULL, NULL, 'awards', 5, 1, JSON_OBJECT('title', 'ความสำเร็จและรางวัล'));

INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
VALUES (NULL, NULL, 'recruit', 6, 1, JSON_OBJECT(
  'title', 'กำลังมองหาอาชีพที่เติบโตไปพร้อมกับคุณอยู่หรือไม่?'));

INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data)
VALUES (NULL, NULL, 'cta', 7, 1, JSON_OBJECT(
  'title',    'พร้อมเริ่มต้นวางแผนกับเราไหม?',
  'subtitle', 'อนาคตที่ดี เริ่มต้นจากการตัดสินใจในวันนี้ — ให้เราช่วยออกแบบแผนที่เหมาะกับชีวิตของคุณ',
  'line_id',  '@kavisara.fwd',
  'line_url', 'https://line.me/R/ti/p/@kavisara.fwd',
  'phone',    '062-2397362',
  'appointment_enabled',  TRUE,
  'appointment_agent_id', NULL));


/* ---------- ขั้นที่ 4: การ์ดลูกของ features และ awards ----------
   การ์ด = ไอคอน + ตัวหนังสือใหญ่ (เลือกสีได้) + คำอธิบาย
   หา id ของบลอคแม่ด้วย SELECT ไม่ใส่เลขตายตัว เพราะ id อาจไม่ใช่ 1-7 */

INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data) SELECT NULL, f.id, 'card', c.ord, 1, JSON_OBJECT('icon', c.icon, 'text', c.text, 'color', c.color, 'desc', c.descr) FROM page_blocks f JOIN ( SELECT 1 AS ord, '👥' AS icon, '1,000+' AS text, '#ea580c' AS color, 'ลูกค้าที่ดูแล' AS descr UNION ALL SELECT 2, '🏅', '6+', '#ea580c', 'ปีประสบการณ์' UNION ALL SELECT 3, '🏆', 'MDRT', '#1f2937', 'มาตรฐานระดับโลก' UNION ALL SELECT 4, '🎓', 'Professional', '#1f2937', 'Financial Consultant' ) c WHERE f.user_id IS NULL AND f.parent_id IS NULL AND f.type = 'features';

INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data) SELECT NULL, a.id, 'card', c.ord, 1, JSON_OBJECT('icon', c.icon, 'text', c.text, 'color', c.color, 'desc', c.descr) FROM page_blocks a JOIN ( SELECT 1 AS ord, '🥇' AS icon, '2022' AS text, '#ea580c' AS color, 'MDRT Qualifier' AS descr UNION ALL SELECT 2, '🏆', '2023', '#ea580c', 'Top Unit Manager' UNION ALL SELECT 3, '🎖️', '2024', '#ea580c', 'Financial Advisor Award' UNION ALL SELECT 4, '👑', '2025', '#ea580c', 'Leadership Achievement' ) c WHERE a.user_id IS NULL AND a.parent_id IS NULL AND a.type = 'awards';


/* ---------- ขั้นที่ 5: ตรวจผล ----------
   ต้องได้: user_id ยอมให้ว่าง = YES
            บลอค 7 แถว เรียง 1-7 ไม่มี reviews
            features 4 การ์ด / awards 4 การ์ด
            เห็นตารางทั้ง page_blocks และ block_images */

SHOW COLUMNS FROM page_blocks LIKE 'user_id';

SELECT sort_order AS `ลำดับ`, type AS `ชนิดบลอค`, COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.title')), JSON_UNQUOTE(JSON_EXTRACT(data, '$.heading'))) AS `หัวข้อ`, (SELECT COUNT(*) FROM page_blocks c WHERE c.parent_id = b.id) AS `การ์ดลูก` FROM page_blocks b WHERE user_id IS NULL AND parent_id IS NULL ORDER BY sort_order;

SELECT p.type AS `บลอคแม่`, COUNT(*) AS `จำนวนการ์ด` FROM page_blocks ch JOIN page_blocks p ON p.id = ch.parent_id WHERE ch.type = 'card' GROUP BY p.type;

SHOW TABLES LIKE '%block%';
