-- ============================================================
--  ตาราง page_views — สถิติการเข้าชมเว็บไซต์ (Traffic) ต่อตัวแทน
--  1 แถว = 1 ครั้งที่มีคนเปิดหน้าใดหน้าหนึ่งของตัวแทน
--
--    user_id     = ตัวแทนเจ้าของหน้า (อ้างอิง users.id)
--    visitor_id  = รหัสผู้ชม (สุ่มเก็บใน localStorage ฝั่งผู้ชม) → ใช้นับ "ผู้ใช้งานจริง"
--    page_key    = คีย์หน้าแบบคงที่ เช่น 'profile', 'page:38', 'contact', 'appointment', 'home'
--    page_title  = ชื่อหน้าไว้แสดง เช่น 'หน้าโปรไฟล์', 'ประกันสุขภาพ'
--
--  Page Views     = COUNT(*)                         (นับทุกครั้ง)
--  Unique Visitors= COUNT(DISTINCT visitor_id)       (คนจริงไม่ซ้ำ)
--  Total Visitors = COUNT(DISTINCT visitor_id+วันที่) (จำนวนครั้งเข้าชมแบบนับ 1 คน/วัน)
--
--  ▶ วิธีรัน: phpMyAdmin → เลือก database (vpkann_database) → แท็บ SQL → วาง → Go
--    ต้องมีตาราง users อยู่ก่อน
-- ============================================================

CREATE TABLE IF NOT EXISTS page_views (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  visitor_id  VARCHAR(40)  NOT NULL,
  page_key    VARCHAR(80)  NOT NULL,
  page_title  VARCHAR(200) NULL,
  path        VARCHAR(255) NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pv_user_time (user_id, created_at),
  KEY idx_pv_user_visitor (user_id, visitor_id),
  KEY idx_pv_user_page (user_id, page_key),
  CONSTRAINT fk_pv_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
