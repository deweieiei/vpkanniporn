-- ============================================================
--  ตรวจอาการ ระบบบลอค — ★ อ่านอย่างเดียว ไม่แก้ไขอะไรทั้งสิ้น ★
--  2026-07-16
--
--  ▶ วิธีใช้: phpMyAdmin → เลือก database → แท็บ SQL → วางทั้งไฟล์ → Go
--            แล้วส่งผลลัพธ์ทั้ง 4 ตารางกลับมาให้ผมดู
--
--  ปลอดภัย: มีแต่คำสั่ง SELECT/SHOW — ไม่มี INSERT/UPDATE/DELETE/DROP/ALTER
-- ============================================================


-- 1) ตารางของระบบบลอค มีอะไรบ้าง (ควรมี 2 ตาราง: page_blocks + block_images)
SELECT TABLE_NAME AS `ตารางที่มี`, TABLE_ROWS AS `จำนวนแถว(ประมาณ)`
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('page_blocks', 'block_images');


-- 2) ★ สำคัญที่สุด ★ คอลัมน์ user_id ยอมให้เป็น NULL ไหม
--    ถ้า `ยอมให้ว่าง` = NO  → นี่คือต้นตอปัญหา (ตารางถูกสร้างด้วยไฟล์เวอร์ชันเก่าของผม)
SELECT COLUMN_NAME AS `คอลัมน์`,
       COLUMN_TYPE AS `ชนิด`,
       IS_NULLABLE AS `ยอมให้ว่าง`,
       COLUMN_DEFAULT AS `ค่าเริ่มต้น`
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'page_blocks'
  AND COLUMN_NAME IN ('user_id', 'parent_id');


-- 3) ตอนนี้มีบลอคอะไรอยู่บ้าง (ดูว่า user_id / parent_id เป็นค่าอะไร)
SELECT id,
       user_id    AS `user_id`,
       parent_id  AS `parent_id`,
       type       AS `ชนิดบลอค`,
       sort_order AS `ลำดับ`,
       is_visible AS `แสดง`,
       LEFT(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.title')),
                     JSON_UNQUOTE(JSON_EXTRACT(data, '$.heading')),
                     JSON_UNQUOTE(JSON_EXTRACT(data, '$.text')), '-'), 40) AS `หัวข้อ`
FROM page_blocks
ORDER BY id;


-- 4) นับรวม: บลอคอยู่ที่ user_id ไหนบ้าง
SELECT COALESCE(CAST(user_id AS CHAR), '(NULL = หน้าแรกของเว็บ)') AS `อยู่ที่ user_id`,
       COUNT(*) AS `จำนวนบลอค`
FROM page_blocks
GROUP BY user_id;
