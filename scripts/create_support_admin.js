/**
 * สร้าง (หรืออัปเดต) บัญชี Support Admin 1 บัญชี
 *
 * วิธีใช้:
 *   node scripts/create_support_admin.js <email> <password> [ชื่อ] [นามสกุล]
 *
 * ตัวอย่าง:
 *   node scripts/create_support_admin.js support@vpkanniporn.com "MyStrongPass#2026" ทีมงาน ซัพพอร์ต
 *
 * ถ้ามีอีเมลนี้อยู่แล้ว จะอัปเดตรหัสผ่าน + ตั้ง role = support_admin ให้
 * (รันซ้ำได้ ปลอดภัย ใช้รีเซ็ตรหัสผ่านก็ได้)
 *
 * ต้องตั้งค่า .env (DB_*) ให้เชื่อม MySQL ได้ก่อน และรัน migration_support_admin.sql แล้ว
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');

async function main() {
  const [, , email, password, firstName = 'Support', lastName = 'Admin'] = process.argv;

  if (!email || !password) {
    console.error('❌ ต้องระบุ email และ password');
    console.error('   node scripts/create_support_admin.js <email> <password> [ชื่อ] [นามสกุล]');
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('❌ รูปแบบอีเมลไม่ถูกต้อง:', email);
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('❌ รหัสผ่านควรยาวอย่างน้อย 8 ตัวอักษร');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);

  if (existing.length > 0) {
    await pool.query(
      `UPDATE users
         SET password_hash = ?, role = 'support_admin', is_active = 1,
             first_name = ?, last_name = ?
       WHERE email = ?`,
      [hash, firstName, lastName, email]
    );
    console.log(`✓ อัปเดตบัญชี Support Admin เดิมแล้ว: ${email} (id ${existing[0].id})`);
  } else {
    const [result] = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
       VALUES (?, ?, ?, ?, 'support_admin', 1)`,
      [email, hash, firstName, lastName]
    );
    console.log(`✓ สร้างบัญชี Support Admin ใหม่แล้ว: ${email} (id ${result.insertId})`);
  }

  console.log('  เข้าหน้าจัดการที่:  /support-admin');
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('เกิดข้อผิดพลาด:', err.message);
  process.exit(1);
});
