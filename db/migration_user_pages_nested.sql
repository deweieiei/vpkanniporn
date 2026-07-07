-- ============================================================
--  Migration: user_pages ซ้อนชั้นได้ไม่จำกัด (recursive tree)
--  เพิ่มคอลัมน์ parent_id เพื่อให้ 1 หน้า (บลอค) สร้างบลอคย่อย "ข้างใน" ตัวเองได้อีก
--
--    parent_id = NULL  → บลอคชั้นบนสุด (เปรียบเป็น "จังหวัด")
--                        แสดงในโปรไฟล์ ส่วน "คุณกำลังมองหาอะไรอยู่?"
--    parent_id = X     → บลอคย่อยที่อยู่ข้างในหน้า X ("อำเภอ" / "ตำบล" / ... ลึกได้เรื่อยๆ)
--
--  โครงเปรียบเทียบ:  โปรไฟล์(ประเทศ) → จังหวัด → อำเภอ → ตำบล → ...
--
--  ลบหน้าแม่ 1 หน้า → ลบลูก-หลานทั้งสายอัตโนมัติ (ON DELETE CASCADE)
--
--  ▶ วิธีรัน: phpMyAdmin → เลือก database (vpkann_database) → แท็บ SQL → วางทั้งหมด → Go
--    รันครั้งเดียว บน DB ที่มีตาราง user_pages อยู่แล้ว (รัน migration_user_pages.sql ไปแล้ว)
--    แถวเดิมที่มีอยู่จะได้ parent_id = NULL = เป็นบลอคชั้นบนสุดโดยอัตโนมัติ
-- ============================================================

ALTER TABLE user_pages
  ADD COLUMN parent_id INT UNSIGNED NULL AFTER user_id,
  ADD KEY idx_user_pages_parent (parent_id, sort_order),
  ADD CONSTRAINT fk_user_pages_parent
      FOREIGN KEY (parent_id) REFERENCES user_pages(id) ON DELETE CASCADE;
