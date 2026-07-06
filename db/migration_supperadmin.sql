-- ============================================================
--  Migration: Support Admin + ระบบจัดการเนื้อหาหน้า index (site_content)
--  รันบน HostAtom phpMyAdmin: เลือก database vpkann_database -> tab SQL -> paste -> Go
--  ปลอดภัยรันซ้ำได้ (ไม่ลบข้อมูลเดิม) — ใช้ IF NOT EXISTS / INSERT IGNORE
-- ============================================================

-- 1) เพิ่ม role 'support_admin' ให้ตาราง users
--    (ของเดิมมี admin/agent/user อยู่แล้ว — เพิ่มตัวใหม่ต่อท้าย ไม่กระทบข้อมูลเก่า)
ALTER TABLE users
  MODIFY COLUMN role ENUM('admin','agent','user','support_admin')
  NOT NULL DEFAULT 'user';

-- 2) ตารางเก็บเนื้อหาหน้า index (key -> ค่า)
--    section/label = ไว้ให้หน้า editor จัดกลุ่ม + แสดงป้ายภาษาไทยให้ Support Admin
--    content_type  = text (ข้อความ) หรือ image (path รูปที่อัปโหลด)
CREATE TABLE IF NOT EXISTS site_content (
  content_key   VARCHAR(64)  NOT NULL,
  section       VARCHAR(48)  NOT NULL DEFAULT 'ทั่วไป',
  label         VARCHAR(160) NOT NULL,
  content_type  ENUM('text','image') NOT NULL DEFAULT 'text',
  content_value MEDIUMTEXT   NULL,
  sort_order    INT          NOT NULL DEFAULT 0,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (content_key),
  KEY idx_content_section (section, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) ค่าตั้งต้น = ข้อความ/รูปที่อยู่บนหน้า index ตอนนี้
--    INSERT IGNORE = ถ้ามี key อยู่แล้วจะข้าม ไม่ทับค่าที่ Support Admin แก้ไว้
INSERT IGNORE INTO site_content (content_key, section, label, content_type, content_value, sort_order) VALUES
  -- ===== ส่วนหัว / แบรนด์ =====
  ('brand_office_title', 'ส่วนหัว (แบรนด์)', 'ชื่อสำนักงาน (มุมซ้ายบน)',        'text', 'สำนักงานตัวแทน FWD', 10),
  ('brand_name',         'ส่วนหัว (แบรนด์)', 'ชื่อทีม/แบรนด์',                    'text', 'VP Kanniporn', 20),
  ('brand_badge',        'ส่วนหัว (แบรนด์)', 'ป้ายเล็ก (badge)',                 'text', 'Elite Agent Office', 30),

  -- ===== แบนเนอร์หลัก (Hero) =====
  ('hero_title',       'แบนเนอร์หลัก', 'หัวเรื่องใหญ่',                'text', 'วางแผนวันนี้ เพื่ออนาคตที่คุณเลือกได้', 10),
  ('hero_tagline',     'แบนเนอร์หลัก', 'คำโปรยภาษาอังกฤษ',            'text', 'Plan Today, Live Your Future', 20),
  ('hero_subtagline',  'แบนเนอร์หลัก', 'คำโปรยรอง',                    'text', 'เพราะทุกเป้าหมายในชีวิต ควรมีแผนที่มั่นคงรองรับ', 30),
  ('hero_cat_1',       'แบนเนอร์หลัก', 'ป้ายหมวด 1',                  'text', 'ประกันชีวิต', 40),
  ('hero_cat_2',       'แบนเนอร์หลัก', 'ป้ายหมวด 2',                  'text', 'สุขภาพ', 50),
  ('hero_cat_3',       'แบนเนอร์หลัก', 'ป้ายหมวด 3',                  'text', 'การออม', 60),
  ('hero_cat_4',       'แบนเนอร์หลัก', 'ป้ายหมวด 4',                  'text', 'มรดก', 70),
  ('hero_btn_consult', 'แบนเนอร์หลัก', 'ปุ่มซ้าย (ปรึกษาฟรี)',        'text', 'รับคำปรึกษาฟรี (FREE CONSULTATION)', 80),
  ('hero_btn_book',    'แบนเนอร์หลัก', 'ปุ่มขวา (นัดหมาย)',           'text', 'นัดหมายออนไลน์ (BOOK APPOINTMENT)', 90),

  -- ===== บริการ =====
  ('services_title',    'บริการ', 'หัวข้อส่วนบริการ',    'text', 'เลือกแผนที่เหมาะกับคุณ', 10),
  ('services_subtitle', 'บริการ', 'คำโปรยส่วนบริการ',    'text', 'คุณกำลังมองหาอะไรอยู่?', 20),
  ('service_1_th', 'บริการ', 'การ์ด 1 - ชื่อไทย',      'text', 'ประกันสุขภาพ', 30),
  ('service_1_en', 'บริการ', 'การ์ด 1 - ชื่ออังกฤษ',   'text', 'Health Insurance', 31),
  ('service_2_th', 'บริการ', 'การ์ด 2 - ชื่อไทย',      'text', 'ประกันชีวิต', 40),
  ('service_2_en', 'บริการ', 'การ์ด 2 - ชื่ออังกฤษ',   'text', 'Life Insurance', 41),
  ('service_3_th', 'บริการ', 'การ์ด 3 - ชื่อไทย',      'text', 'ประกันสะสมทรัพย์', 50),
  ('service_3_en', 'บริการ', 'การ์ด 3 - ชื่ออังกฤษ',   'text', 'Savings Insurance', 51),
  ('service_4_th', 'บริการ', 'การ์ด 4 - ชื่อไทย',      'text', 'ประกันบำนาญ', 60),
  ('service_4_en', 'บริการ', 'การ์ด 4 - ชื่ออังกฤษ',   'text', 'Retirement Planning', 61),
  ('service_5_th', 'บริการ', 'การ์ด 5 - ชื่อไทย',      'text', 'ประกันกลุ่ม', 70),
  ('service_5_en', 'บริการ', 'การ์ด 5 - ชื่ออังกฤษ',   'text', 'Group Insurance', 71),
  ('service_6_th', 'บริการ', 'การ์ด 6 - ชื่อไทย',      'text', 'วางแผนมรดก', 80),
  ('service_6_en', 'บริการ', 'การ์ด 6 - ชื่ออังกฤษ',   'text', 'Legacy Planning', 81),

  -- ===== ทำไมต้องเรา (สถิติ) =====
  ('whyus_title',    'ทำไมต้องเรา', 'หัวข้อ',        'text', 'ทำไมต้องวางแผนกับเรา', 10),
  ('whyus_subtitle', 'ทำไมต้องเรา', 'คำโปรย',        'text', 'ประสบการณ์และมาตรฐานที่ลูกค้าไว้วางใจ', 20),
  ('stat_1_num',   'ทำไมต้องเรา', 'สถิติ 1 - ตัวเลข',   'text', '1,000+', 30),
  ('stat_1_label', 'ทำไมต้องเรา', 'สถิติ 1 - คำอธิบาย', 'text', 'ลูกค้าที่ดูแล', 31),
  ('stat_2_num',   'ทำไมต้องเรา', 'สถิติ 2 - ตัวเลข',   'text', '6+', 40),
  ('stat_2_label', 'ทำไมต้องเรา', 'สถิติ 2 - คำอธิบาย', 'text', 'ปีประสบการณ์', 41),
  ('stat_3_num',   'ทำไมต้องเรา', 'สถิติ 3 - ตัวเลข',   'text', 'MDRT', 50),
  ('stat_3_label', 'ทำไมต้องเรา', 'สถิติ 3 - คำอธิบาย', 'text', 'มาตรฐานระดับโลก', 51),
  ('stat_4_num',   'ทำไมต้องเรา', 'สถิติ 4 - ตัวเลข',   'text', 'Pro', 60),
  ('stat_4_label', 'ทำไมต้องเรา', 'สถิติ 4 - คำอธิบาย', 'text', 'Financial Consultant', 61),

  -- ===== แนะนำที่ปรึกษา + แผนยอดนิยม =====
  -- (ชื่อ/คำคม/ช่องทางติดต่อของกวิสรา ดึงจากโปรไฟล์ตัวแทนอัตโนมัติ แก้ที่หน้าโปรไฟล์)
  ('profile_heading',   'แนะนำที่ปรึกษา', 'หัวข้อส่วนแนะนำ',   'text', 'รู้จักที่ปรึกษาของคุณ', 10),
  ('popular_heading',   'แนะนำที่ปรึกษา', 'หัวข้อแผนยอดนิยม',  'text', 'แผนยอดนิยม', 20),
  ('popular_1_title', 'แนะนำที่ปรึกษา', 'แผน 1 - ชื่อ',      'text', 'Health Protection', 30),
  ('popular_1_desc',  'แนะนำที่ปรึกษา', 'แผน 1 - คำอธิบาย',  'text', 'ดูแลค่ารักษาพยาบาล', 31),
  ('popular_2_title', 'แนะนำที่ปรึกษา', 'แผน 2 - ชื่อ',      'text', 'Wealth Builder', 40),
  ('popular_2_desc',  'แนะนำที่ปรึกษา', 'แผน 2 - คำอธิบาย',  'text', 'ออมเงินสร้างอนาคต', 41),
  ('popular_3_title', 'แนะนำที่ปรึกษา', 'แผน 3 - ชื่อ',      'text', 'Legacy Planning', 50),
  ('popular_3_desc',  'แนะนำที่ปรึกษา', 'แผน 3 - คำอธิบาย',  'text', 'ส่งต่อมรดกให้คนที่รัก', 51),
  ('popular_4_title', 'แนะนำที่ปรึกษา', 'แผน 4 - ชื่อ',      'text', 'Retirement Income', 60),
  ('popular_4_desc',  'แนะนำที่ปรึกษา', 'แผน 4 - คำอธิบาย',  'text', 'รายได้หลังเกษียณ', 61),

  -- ===== รีวิวลูกค้า =====
  ('reviews_title',    'รีวิวลูกค้า', 'หัวข้อ',   'text', 'เรื่องราวจากลูกค้าของเรา', 10),
  ('reviews_subtitle', 'รีวิวลูกค้า', 'คำโปรย',   'text', 'เสียงจริงจากผู้ที่วางใจให้เราดูแล', 20),
  ('review_1_text', 'รีวิวลูกค้า', 'รีวิว 1 - ข้อความ', 'text', 'อธิบายเข้าใจง่าย ไม่ยัดเยียดการขาย แนะนำสิ่งที่เหมาะสมกับเราจริงๆ ค่ะ', 30),
  ('review_1_name', 'รีวิวลูกค้า', 'รีวิว 1 - ชื่อผู้รีวิว', 'text', '— คุณภัทรา / กรุงเทพฯ', 31),
  ('review_2_text', 'รีวิวลูกค้า', 'รีวิว 2 - ข้อความ', 'text', 'ช่วยวางแผนให้บรรลุเป้าหมาย ทำให้ครอบครัวมีความมั่นคงและอบอุ่นใจมากค่ะ', 40),
  ('review_2_name', 'รีวิวลูกค้า', 'รีวิว 2 - ชื่อผู้รีวิว', 'text', '— คุณวิทยา / นนทบุรี', 41),
  ('review_3_text', 'รีวิวลูกค้า', 'รีวิว 3 - ข้อความ', 'text', 'ดูแลดีมาก แม้หลังจากทำสัญญาแล้วก็ยังคอยติดตามและให้คำแนะนำเสมอ', 50),
  ('review_3_name', 'รีวิวลูกค้า', 'รีวิว 3 - ชื่อผู้รีวิว', 'text', '— คุณนิตยา / สมุทรปราการ', 51),

  -- ===== ความสำเร็จและรางวัล =====
  ('ach_title',    'รางวัล', 'หัวข้อ',   'text', 'ความสำเร็จและรางวัล', 10),
  ('ach_subtitle', 'รางวัล', 'คำโปรย',   'text', 'ผลงานที่ได้รับการยอมรับจากองค์กรชั้นนำ', 20),
  ('ach_1', 'รางวัล', 'รางวัล 1', 'text', '2022 — MDRT Qualifier', 30),
  ('ach_2', 'รางวัล', 'รางวัล 2', 'text', '2023 — Top Unit Manager / Elite Agent', 40),
  ('ach_3', 'รางวัล', 'รางวัล 3', 'text', '2024 — Financial Advisor Award', 50),
  ('ach_4', 'รางวัล', 'รางวัล 4', 'text', '2025 — Leadership Achievement', 60),

  -- ===== ร่วมงาน (Career) =====
  ('career_bg_image',  'ร่วมงาน', 'รูปพื้นหลังส่วนร่วมงาน', 'image', '', 5),
  ('career_title',     'ร่วมงาน', 'หัวข้อ',   'text', 'กำลังมองหาอาชีพที่เติบโตไปพร้อมกับคุณอยู่หรือไม่?', 10),
  ('career_benefit_1', 'ร่วมงาน', 'ข้อดี 1', 'text', '💼 สร้างรายได้', 20),
  ('career_benefit_2', 'ร่วมงาน', 'ข้อดี 2', 'text', '👥 สร้างทีมงาน', 30),
  ('career_benefit_3', 'ร่วมงาน', 'ข้อดี 3', 'text', '🚀 สร้างธุรกิจของตัวเอง', 40),
  ('career_btn',       'ร่วมงาน', 'ปุ่มสมัคร', 'text', 'สมัครเป็นตัวแทน FWD', 50),

  -- ===== ปิดท้าย (CTA) =====
  ('cta_title',   'ปิดท้าย', 'หัวข้อ',       'text', 'พร้อมเริ่มต้นวางแผนกับเราไหม?', 10),
  ('cta_quote',   'ปิดท้าย', 'คำคม',         'text', 'อนาคตที่ดี เริ่มต้นจากการตัดสินใจในวันนี้ ให้เราช่วยออกแบบแผนที่เหมาะกับชีวิตของคุณ', 20),
  ('cta_line',    'ปิดท้าย', 'ปุ่ม LINE',    'text', '💬 LINE Official: @kavisara.fwd', 30),
  ('cta_call',    'ปิดท้าย', 'ปุ่มโทร',      'text', '📞 โทรหาเรา: 062-239-7362', 40),
  ('cta_appoint', 'ปิดท้าย', 'ปุ่มนัดหมาย',  'text', '📅 นัดหมายปรึกษาฟรี! ไม่มีค่าใช้จ่าย', 50),

  -- ===== ท้ายเว็บ (Footer) =====
  ('footer_logo',      'ท้ายเว็บ', 'โลโก้ตัวอักษร', 'text', 'FWD Insurance', 10),
  ('footer_line1',     'ท้ายเว็บ', 'บรรทัด 1',      'text', 'Beyond Protection • Beyond Wealth • Beyond Possibilities', 20),
  ('footer_line2',     'ท้ายเว็บ', 'บรรทัด 2',      'text', 'FWD Elite Financial Consultant | กวิสรา จงเจริญ — Unit Manager', 30),
  ('footer_copyright', 'ท้ายเว็บ', 'ลิขสิทธิ์',      'text', '© 2026 VP Kanniporn Office | สำนักงานตัวแทน FWD Insurance', 40);

-- 4) บัญชี SupperAdmin (role = 'admin')
--    ล็อกอินที่ /support-admin ด้วย  ชื่อผู้ใช้: admin  รหัสผ่าน: 1234
--    password_hash ด้านล่าง = bcrypt ของ '1234' (เข้ารหัสแล้ว ปลอดภัยเก็บใน git)
--    *** แนะนำ: หลัง deploy เปลี่ยนรหัสผ่านด้วย node scripts/create_supperadmin.js admin <รหัสใหม่> ***
--    INSERT IGNORE = ถ้ามี user 'admin' อยู่แล้วจะข้าม (ไม่ทับรหัสเดิม)
INSERT IGNORE INTO users (email, password_hash, first_name, last_name, role, is_active)
VALUES ('admin', '$2a$10$8HXHIHfo6XK9qmxnTZzTKukDhwCwe2P750L7iswVTkGrBJs17Vx0.', 'Supper', 'Admin', 'admin', 1);
