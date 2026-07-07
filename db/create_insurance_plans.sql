-- สร้างตาราง insurance_plans (เวอร์ชันไม่มีหมวดหมู่ — ตรงกับโค้ดปัจจุบัน)
-- แก้บั๊ก "บันทึกแบบประกันไม่ได้ / 500": production ยังไม่มีตารางนี้เลย
--
-- รันบน HostAtom phpMyAdmin: เลือก database vpkann_database -> tab SQL -> paste -> Go
-- ปลอดภัยรันซ้ำได้ (CREATE TABLE IF NOT EXISTS)
--
-- หมายเหตุ: อย่ารันไฟล์เก่า migration_insurance_plans.sql เพราะไฟล์นั้น
--          จะสร้าง category_id NOT NULL + ตาราง insurance_categories กลับมา
--          ซึ่งโค้ดตอนนี้เลิกใช้หมวดหมู่แล้ว (จะทำให้บันทึกไม่ได้อีก)

CREATE TABLE IF NOT EXISTS insurance_plans (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NOT NULL,          -- เจ้าของแบบประกัน (ตัวแทน)
  title         VARCHAR(255) NOT NULL,          -- ชื่อแบบประกัน
  summary       VARCHAR(500) NULL,              -- คำอธิบายสั้น
  content_html  MEDIUMTEXT   NULL,              -- เนื้อหารายละเอียด
  cover_image   VARCHAR(255) NULL,              -- รูปปก (path)
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  view_count    INT UNSIGNED NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_plans_user (user_id),
  CONSTRAINT fk_plans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
