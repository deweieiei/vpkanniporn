/**
 * สร้าง (หรือรีเซ็ตรหัสผ่าน) บัญชี SupperAdmin — role = 'admin'
 * ล็อกอินที่ /support-admin ด้วย "ชื่อผู้ใช้" (ไม่ใช่อีเมล)
 *
 * วิธีใช้:
 *   node scripts/create_supperadmin.js [username] [password]
 *
 * ไม่ใส่อาร์กิวเมนต์ = ใช้ค่าเริ่มต้น  username: admin  password: 1234
 * ตัวอย่างเปลี่ยนรหัส:  node scripts/create_supperadmin.js admin "รหัสใหม่ที่ปลอดภัย"
 *
 * ต้องตั้งค่า .env (DB_*) ให้เชื่อม MySQL ได้ก่อน
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');

async function main() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || '1234';

  const hash = await bcrypt.hash(password, 10);

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [username]);

  if (existing.length > 0) {
    await pool.query(
      `UPDATE users
         SET password_hash = ?, role = 'admin', is_active = 1
       WHERE email = ?`,
      [hash, username]
    );
    console.log(`✓ รีเซ็ตรหัสผ่าน SupperAdmin แล้ว: ${username} (id ${existing[0].id})`);
  } else {
    const [result] = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
       VALUES (?, ?, 'Supper', 'Admin', 'admin', 1)`,
      [username, hash]
    );
    console.log(`✓ สร้างบัญชี SupperAdmin ใหม่แล้ว: ${username} (id ${result.insertId})`);
  }

  console.log('  เข้าหน้าจัดการที่:  /support-admin');
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('เกิดข้อผิดพลาด:', err.message);
  process.exit(1);
});
