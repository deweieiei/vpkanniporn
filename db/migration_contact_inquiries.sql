-- ============================================================
--  ตาราง contact_inquiries — ผู้สนใจกรอกฟอร์ม "ติดต่อสอบถาม / ขอคำปรึกษา"
--  1 แถว = 1 คนที่กรอกฟอร์มถึงตัวแทน 1 คน
--
--    user_id   = ตัวแทนที่ถูกติดต่อ (อ้างอิง users.id)
--    purposes  = วัตถุประสงค์ (JSON array) เช่น ["คุ้มครองชีวิต","ลดหย่อนภาษี"]
--    consent   = ยินยอมให้ติดต่อกลับ/เก็บข้อมูล (1 = ยินยอม)
--    is_read   = เจ้าของเปิดอ่านแล้วหรือยัง (เผื่อทำหน้าจัดการทีหลัง)
--
--  ▶ วิธีรัน: phpMyAdmin → เลือก database (vpkann_database) → แท็บ SQL → วาง → Go
--    ต้องมีตาราง users อยู่ก่อน (รัน db/schema.sql แล้ว)
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_inquiries (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,                 -- ตัวแทนที่ถูกติดต่อ
  full_name   VARCHAR(150) NOT NULL,                 -- 1. ชื่อ-นามสกุล
  phone       VARCHAR(30)  NOT NULL,                 -- 2. เบอร์โทรศัพท์
  birthdate   DATE         NOT NULL,                 -- 3. วันเดือนปีเกิด
  purposes    JSON         NULL,                     -- 4. วัตถุประสงค์ (เลือกได้หลายข้อ)
  budget      VARCHAR(100) NULL,                     -- 5. งบประมาณเบี้ยประกัน (ไม่บังคับ)
  note        TEXT         NULL,                     -- 6. รายละเอียดเพิ่มเติม (ไม่บังคับ)
  consent      TINYINT(1)   NOT NULL DEFAULT 0,      -- ยินยอมให้ติดต่อกลับ/เก็บข้อมูล
  is_read      TINYINT(1)   NOT NULL DEFAULT 0,      -- เจ้าของอ่านแล้วหรือยัง
  contacted_at DATETIME     NULL,                    -- เวลาที่ตัวแทนกด "ติดต่อกลับแล้ว" (NULL = ยังไม่ติดต่อ = รายการใหม่)
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- เวลาที่ลูกค้าส่งฟอร์มเข้ามา
  PRIMARY KEY (id),
  KEY idx_contact_user (user_id, created_at),
  CONSTRAINT fk_contact_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
