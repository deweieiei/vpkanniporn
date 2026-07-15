// ============================================================
//  บีบอัดรูปฝั่งเบราว์เซอร์ก่อนอัปโหลด (ไม่ต้องพึ่งไลบรารีบนเซิร์ฟเวอร์)
//  ย่อด้านที่ยาวสุดไม่เกิน maxDim แล้วบันทึกเป็น JPEG คุณภาพ quality
//  → รูปเล็กลงมาก อัปโหลดเร็ว + คนเน็ตช้าโหลดไว
//  ใช้:  const small = await compressImage(file);
// ============================================================
async function compressImage(file, maxDim = 1600, quality = 0.82) {
  try {
    if (!file || !file.type || !file.type.startsWith('image/')) return file;
    if (file.type === 'image/gif') return file; // ไม่แตะ gif (ภาพเคลื่อนไหว)
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
    });
    const img = await new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl;
    });
    const big = Math.max(img.width, img.height) || 0;
    if (!big) return file;
    // เล็กอยู่แล้ว + ไฟล์ไม่ใหญ่ → ใช้ไฟล์เดิม
    if (big <= maxDim && file.size <= 600 * 1024) return file;
    const scale = Math.min(1, maxDim / big);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); // กันพื้นโปร่งใส (PNG) กลายเป็นดำใน JPEG
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file; // ถ้าไม่เล็กลง ใช้ไฟล์เดิม
    const name = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch (e) {
    return file; // ถ้าพลาด อัปไฟล์เดิม (ไม่ให้ผู้ใช้ติดขัด)
  }
}
