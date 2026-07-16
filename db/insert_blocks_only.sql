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

INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data) SELECT NULL, f.id, 'card', c.ord, 1, JSON_OBJECT('icon', c.icon, 'text', c.text, 'color', c.color, 'desc', c.descr) FROM page_blocks f JOIN ( SELECT 1 AS ord, '👥' AS icon, '1,000+' AS text, '#ea580c' AS color, 'ลูกค้าที่ดูแล' AS descr UNION ALL SELECT 2, '🏅', '6+', '#ea580c', 'ปีประสบการณ์' UNION ALL SELECT 3, '🏆', 'MDRT', '#1f2937', 'มาตรฐานระดับโลก' UNION ALL SELECT 4, '🎓', 'Professional', '#1f2937', 'Financial Consultant' ) c WHERE f.user_id IS NULL AND f.parent_id IS NULL AND f.type = 'features';

INSERT INTO page_blocks (user_id, parent_id, type, sort_order, is_visible, data) SELECT NULL, a.id, 'card', c.ord, 1, JSON_OBJECT('icon', c.icon, 'text', c.text, 'color', c.color, 'desc', c.descr) FROM page_blocks a JOIN ( SELECT 1 AS ord, '🥇' AS icon, '2022' AS text, '#ea580c' AS color, 'MDRT Qualifier' AS descr UNION ALL SELECT 2, '🏆', '2023', '#ea580c', 'Top Unit Manager' UNION ALL SELECT 3, '🎖️', '2024', '#ea580c', 'Financial Advisor Award' UNION ALL SELECT 4, '👑', '2025', '#ea580c', 'Leadership Achievement' ) c WHERE a.user_id IS NULL AND a.parent_id IS NULL AND a.type = 'awards';

SELECT sort_order, type, is_visible FROM page_blocks WHERE parent_id IS NULL ORDER BY sort_order;
