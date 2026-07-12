-- ============================================================
--  Migration: ลำดับตัวเลือกในเมนูปุ่ม "รับคำปรึกษาฟรี"
--
--    consult_order = ลำดับการแสดงตัวเลือกในเมนู (คั่นด้วยจุลภาค)
--                    ค่าที่ใช้ได้: call (📞 โทร), contact (📝 สร้างรายการติดต่อ), line (💬 LINE)
--                    ค่าเริ่มต้น 'call,contact,line'
--                    เจ้าของจัดเรียงใหม่ได้ในหน้าแก้ไข Hero
--
--  วิธีรัน: phpMyAdmin -> เลือก database vpkann_database -> tab SQL -> วาง -> Go
-- ============================================================

ALTER TABLE users
  ADD COLUMN consult_order VARCHAR(50) NOT NULL DEFAULT 'call,contact,line';
