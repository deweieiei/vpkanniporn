-- แก้บั๊ก "บันทึกแบบประกันไม่ได้" (บันทึกไม่สำเร็จ / 500)
-- สาเหตุ: โค้ด (dashboard.html + routes/plans.js) เลิกใช้หมวดหมู่แล้ว
--         แต่ตาราง insurance_plans ยังมี category_id NOT NULL อยู่
--         → INSERT ที่ไม่ส่ง category_id เลยถูก MySQL ปฏิเสธ
--
-- รันบน HostAtom phpMyAdmin: เลือก database vpkann_database -> tab SQL -> paste -> Go
--
-- วิธีนี้เป็นแบบ "ปลอดภัย ไม่ทำลายข้อมูล": แค่ทำให้ category_id เป็น NULL ได้
-- (ถ้าอยากลบคอลัมน์ทิ้งถาวร ดูส่วนล่างสุด — เลือกอย่างใดอย่างหนึ่ง)

-- ===== ตัวเลือก A (แนะนำ): ทำให้ category_id ไม่บังคับกรอก =====
-- FK ยังอยู่ได้ เพราะ MySQL ไม่ตรวจ FK กับค่า NULL
ALTER TABLE insurance_plans
  MODIFY COLUMN category_id INT UNSIGNED NULL;


-- ===== ตัวเลือก B (ลบหมวดหมู่ทิ้งถาวร) =====
-- ถ้าแน่ใจว่าจะไม่กลับมาใช้หมวดหมู่อีกเลย ให้ลบ comment 3 บรรทัดล่างนี้ออก
-- แล้วรันแทนตัวเลือก A (ต้องลบ FK ก่อน ถึงจะลบคอลัมน์ได้)
--
-- ALTER TABLE insurance_plans DROP FOREIGN KEY fk_plans_category;
-- ALTER TABLE insurance_plans DROP INDEX idx_plans_category;
-- ALTER TABLE insurance_plans DROP COLUMN category_id;
