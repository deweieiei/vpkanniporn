/* ============================================================
 *  i18n.js — ระบบหลายภาษา (ไทย/อังกฤษ) สำหรับเว็บ VP Kanniporn
 *
 *  วิธีใช้ในหน้า HTML:
 *    1) ใส่ <script src="/i18n.js"></script> ก่อน </body> (ก่อน script อื่นของหน้า)
 *    2) ติดข้อความที่จะแปล:  <h1 data-i18n="appt.title">นัดปรึกษา...</h1>
 *       - ข้อความปกติ:      data-i18n="key"
 *       - placeholder:      data-i18n-ph="key"
 *       - HTML ข้างใน:      data-i18n-html="key"
 *    3) ในโค้ด JS ของหน้า ใช้  t('key')  เพื่อดึงข้อความตามภาษาปัจจุบัน
 *    4) ถ้าหน้ามีเนื้อหาที่ render เอง (เช่น การ์ด) ให้ฟัง event 'i18n:changed'
 *       แล้ว render ใหม่ด้วย t()  (ปุ่มสลับภาษาจะยิง event นี้ทุกครั้งที่เปลี่ยน)
 *
 *  ▶ เพิ่มภาษาใหม่ (เช่น จีน 'zh'):
 *      - เพิ่ม object  zh: { ...คีย์เหมือน th/en... }  ใน DICT ด้านล่าง
 *      - เพิ่ม  { code:'zh', short:'中' }  ใน LANGS
 *    เท่านี้ปุ่มสลับภาษาจะขึ้นให้อัตโนมัติ
 * ============================================================ */
(function () {
  'use strict';

  // ภาษาที่รองรับ (เพิ่มที่นี่เพื่อให้ปุ่มขึ้น)
  const LANGS = [
    { code: 'th', short: 'TH' },
    { code: 'en', short: 'EN' },
  ];

  // ===== พจนานุกรมข้อความ =====
  const DICT = {
    th: {
      'common.back': '← กลับ',
      'common.backAgent': '← กลับหน้าตัวแทน',
      'nav.home': 'หน้าหลัก',
      'nav.plans': 'แบบประกัน',
      'nav.search': 'ค้นหาตัวแทน',
      'common.optional': '(ถ้ามี)',
      'login.title': 'เข้าสู่ระบบ',
      'login.subtitle': 'สำหรับตัวแทน FWD เท่านั้น',
      'login.labelEmail': 'อีเมล',
      'login.phEmail': 'you@example.com',
      'login.labelPassword': 'รหัสผ่าน',
      'login.phPassword': '••••••••',
      'login.submit': 'เข้าสู่ระบบ',
      'login.backSearch': 'ดูหน้าค้นหาตัวแทน →',
      'login.errorGeneric': 'เกิดข้อผิดพลาด',
      'login.success': 'สำเร็จ! กำลังเข้าสู่ระบบ...',
      'login.errorConnect': 'ไม่สามารถเชื่อมต่อ server ได้',
      'search.title': 'ค้นหาตัวแทน',
      'search.subtitle': 'ค้นหาสำนักงานตัวแทนดิจิทัลใกล้คุณ',
      'search.name': 'รหัสตัวแทน / ชื่อ-นามสกุล',
      'search.province': 'เลือกจังหวัด',
      'search.branch': 'สาขา',
      'search.button': 'ค้นหา',
      'search.reset': 'ล้างค้นหา',
      'search.results': 'ผลการค้นหาตัวแทนดิจิทัล จำนวน',
      'search.items': 'รายการ',
      'plans.title': 'เลือกแผนที่เหมาะกับคุณ',
      'plans.subtitle': 'แบบประกันจากตัวแทน FWD',
      'plans.all': 'ทั้งหมด',
      'plans.empty': '😔 ยังไม่มีแบบประกันในหมวดนี้ — <a href="/#contact" class="text-orange-500 hover:underline">ติดต่อสอบถามตัวแทนได้เลย</a>',
      'plans.by': 'โดย',
      'plans.viewDetails': 'ดูรายละเอียด ➔',
      'common.footer': '© 2026 VP Kanniporn Office | สำนักงานตัวแทน FWD Insurance',
      'agent.viewProfile': 'ดูโปรไฟล์',
      'agent.viewProfileAgent': 'ดูโปรไฟล์ตัวแทน ➔',
      'plan.backAll': '← กลับไปดูแบบประกันทั้งหมด',
      'plan.notFound': 'ไม่พบแบบประกันนี้',
      'plan.interested': 'สนใจแบบนี้',

      // ---- ฟอร์มนัดปรึกษาออนไลน์ (appointment.html) ----
      'appt.title': 'นัดปรึกษาออนไลน์ฟรี',
      'appt.subtitle': 'เลือกวันและเวลาที่สะดวก ทีมงานจะติดต่อกลับเพื่อยืนยันการนัดหมาย',
      'appt.sec.contact': 'ข้อมูลผู้ติดต่อ',
      'appt.sec.datetime': 'วันและเวลาที่ต้องการนัด',
      'appt.sec.channel': 'ช่องทางการนัดหมาย',
      'appt.f.fullname': 'ชื่อ-นามสกุล',
      'appt.f.phone': 'เบอร์โทรศัพท์',
      'appt.f.lineid': 'LINE ID',
      'appt.f.pickdate': 'เลือกวันนัดหมาย',
      'appt.f.picktime': 'เลือกเวลาที่สะดวก',
      'appt.consent': 'ข้าพเจ้ายินยอมให้ตัวแทนติดต่อกลับเพื่อยืนยันการนัดหมาย และยินยอมให้เก็บและใช้ข้อมูลส่วนบุคคลเพื่อการให้บริการตามนโยบายความเป็นส่วนตัว',
      'appt.submit': 'ยืนยันนัดหมาย',
      'appt.sending': 'กำลังส่ง...',
      'appt.success.title': 'ส่งคำขอนัดหมายเรียบร้อย',
      'appt.success.msg': 'ทีมงานจะติดต่อกลับเพื่อยืนยันการนัดหมายโดยเร็วที่สุดครับ/ค่ะ',
      'appt.ph.fullname': 'เช่น สมชาย ใจดี',
      'appt.ph.phone': '08X-XXX-XXXX',
      'appt.ph.lineid': '@yourid หรือ line id',
      'appt.ch.phone': '📞 โทรศัพท์',
      'appt.ch.linecall': '💬 LINE Call',
      'appt.ch.meet': '🎥 Google Meet',
      'appt.ch.zoom': '💻 Zoom',
      'appt.err.fullname': 'กรุณากรอกชื่อ-นามสกุล',
      'appt.err.phone': 'กรุณากรอกเบอร์โทรศัพท์',
      'appt.err.date': 'กรุณาเลือกวันนัดหมาย',
      'appt.err.slot': 'กรุณาเลือกเวลาที่สะดวก',
      'appt.err.channel': 'กรุณาเลือกช่องทางการนัดหมาย',
      'appt.err.consent': 'กรุณายินยอมก่อนส่งข้อมูล',
      'appt.err.send': 'ส่งข้อมูลไม่สำเร็จ',

      // ---- ฟอร์มติดต่อสอบถาม (contact.html) ----
      'ct.title': 'สนใจรับคำปรึกษาและวางแผนประกัน',
      'ct.subtitlePre': 'กรอกข้อมูลด้านล่าง',
      'ct.subtitleAgent': 'แล้ว {name} จะติดต่อกลับ',
      'ct.f.fullname': 'ชื่อ-นามสกุล',
      'ct.f.phone': 'เบอร์โทรศัพท์',
      'ct.f.birth': 'วันเดือนปีเกิด',
      'ct.f.purpose': 'วัตถุประสงค์ในการทำประกัน',
      'ct.f.purposeHint': '(เลือกได้หลายข้อ)',
      'ct.f.budget': 'งบประมาณเบี้ยประกันที่ต้องการ',
      'ct.f.budgetHint': '(ไม่บังคับ)',
      'ct.f.note': 'รายละเอียดเพิ่มเติม',
      'ct.f.noteHint': '(ถ้ามี)',
      'ct.consent': 'ข้าพเจ้ายินยอมให้ตัวแทนติดต่อกลับเพื่อให้คำแนะนำและนำเสนอแบบประกันที่เหมาะสม พร้อมยินยอมให้เก็บและใช้ข้อมูลส่วนบุคคลตามนโยบายความเป็นส่วนตัว เพื่อวัตถุประสงค์ในการให้บริการและติดต่อกลับเท่านั้น',
      'ct.submit': 'ส่งข้อมูลติดต่อ',
      'ct.sending': 'กำลังส่ง...',
      'ct.success.title': 'ส่งข้อมูลเรียบร้อยแล้ว',
      'ct.success.msg': 'ขอบคุณสำหรับความสนใจ ตัวแทนจะติดต่อกลับโดยเร็วที่สุดครับ/ค่ะ',
      'ct.ph.fullname': 'เช่น สมชาย ใจดี',
      'ct.ph.phone': '08X-XXX-XXXX',
      'ct.ph.budget': 'เช่น 20,000 บาท/ปี หรือ ยังไม่แน่ใจ',
      'ct.ph.note': 'ระบุความต้องการเพิ่มเติม เช่น ช่วงเวลาที่สะดวกให้ติดต่อกลับ',
      'ct.ph.other': 'ระบุวัตถุประสงค์อื่นๆ ที่ต้องการ',
      'ct.p.life': 'คุ้มครองชีวิต',
      'ct.p.health': 'ค่ารักษาพยาบาล',
      'ct.p.ci': 'โรคร้ายแรง',
      'ct.p.savings': 'สะสมทรัพย์',
      'ct.p.retire': 'วางแผนเกษียณ',
      'ct.p.tax': 'ลดหย่อนภาษี',
      'ct.p.legacy': 'วางแผนมรดก',
      'ct.p.other': 'อื่นๆ (ระบุ)',
      'ct.err.fullname': 'กรุณากรอกชื่อ-นามสกุล',
      'ct.err.phone': 'กรุณากรอกเบอร์โทรศัพท์',
      'ct.err.birth': 'กรุณาเลือกวันเดือนปีเกิด',
      'ct.err.purpose': 'กรุณาเลือกวัตถุประสงค์อย่างน้อย 1 ข้อ',
      'ct.err.other': 'กรุณาระบุวัตถุประสงค์ "อื่นๆ"',
      'ct.err.consent': 'กรุณายินยอมให้ติดต่อกลับก่อนส่ง',
      'ct.err.send': 'ส่งข้อมูลไม่สำเร็จ',
    },

    en: {
      'common.back': '← Back',
      'common.backAgent': '← Back to agent',
      'nav.home': 'Home',
      'nav.plans': 'Plans',
      'nav.search': 'Agent search',
      'common.optional': '(optional)',
      'login.title': 'Sign in',
      'login.subtitle': 'For FWD agents only',
      'login.labelEmail': 'Email',
      'login.phEmail': 'you@example.com',
      'login.labelPassword': 'Password',
      'login.phPassword': '••••••••',
      'login.submit': 'Sign in',
      'login.backSearch': 'Browse agents →',
      'login.errorGeneric': 'An error occurred',
      'login.success': 'Success! Signing in...',
      'login.errorConnect': 'Cannot connect to server',
      'search.title': 'Find an agent',
      'search.subtitle': 'Search digital agent offices near you',
      'search.name': 'Agent ID / name',
      'search.province': 'Select province',
      'search.branch': 'Branch',
      'search.button': 'Search',
      'search.reset': 'Reset',
      'search.results': 'Search results',
      'search.items': 'items',
      'plans.title': 'Choose the right plan',
      'plans.subtitle': 'Insurance plans from FWD agents',
      'plans.all': 'All',
      'plans.empty': '😔 No plans found in this category — <a href="/#contact" class="text-orange-500 hover:underline">contact an agent</a>',
      'common.footer': '© 2026 VP Kanniporn Office | FWD Insurance agent office',
      'plans.by': 'by',
      'plans.viewDetails': 'View details ➔',
      'agent.viewProfile': 'View profile',
      'agent.viewProfileAgent': 'View agent profile ➔',
      'plan.backAll': '← Back to all plans',
      'plan.notFound': 'Plan not found',
      'plan.interested': 'Interested',

      // ---- appointment.html ----
      'appt.title': 'Free Online Consultation',
      'appt.subtitle': 'Choose a convenient date and time — our team will call back to confirm your appointment.',
      'appt.sec.contact': 'Your contact info',
      'appt.sec.datetime': 'Preferred date & time',
      'appt.sec.channel': 'Appointment channel',
      'appt.f.fullname': 'Full name',
      'appt.f.phone': 'Phone number',
      'appt.f.lineid': 'LINE ID',
      'appt.f.pickdate': 'Choose a date',
      'appt.f.picktime': 'Choose a time slot',
      'appt.consent': 'I consent to being contacted by the agent to confirm this appointment, and to the collection and use of my personal data for service purposes in accordance with the privacy policy.',
      'appt.submit': 'Confirm appointment',
      'appt.sending': 'Sending...',
      'appt.success.title': 'Appointment request sent',
      'appt.success.msg': 'Our team will call back to confirm your appointment as soon as possible.',
      'appt.ph.fullname': 'e.g. John Smith',
      'appt.ph.phone': '08X-XXX-XXXX',
      'appt.ph.lineid': '@yourid or line id',
      'appt.ch.phone': '📞 Phone',
      'appt.ch.linecall': '💬 LINE Call',
      'appt.ch.meet': '🎥 Google Meet',
      'appt.ch.zoom': '💻 Zoom',
      'appt.err.fullname': 'Please enter your full name',
      'appt.err.phone': 'Please enter your phone number',
      'appt.err.date': 'Please choose a date',
      'appt.err.slot': 'Please choose a time slot',
      'appt.err.channel': 'Please choose an appointment channel',
      'appt.err.consent': 'Please give consent before submitting',
      'appt.err.send': 'Failed to send',

      // ---- contact.html ----
      'ct.title': 'Get advice & insurance planning',
      'ct.subtitlePre': 'Fill in the details below',
      'ct.subtitleAgent': 'and {name} will get back to you',
      'ct.f.fullname': 'Full name',
      'ct.f.phone': 'Phone number',
      'ct.f.birth': 'Date of birth',
      'ct.f.purpose': 'Insurance objectives',
      'ct.f.purposeHint': '(select all that apply)',
      'ct.f.budget': 'Desired premium budget',
      'ct.f.budgetHint': '(optional)',
      'ct.f.note': 'Additional details',
      'ct.f.noteHint': '(if any)',
      'ct.consent': 'I consent to being contacted by the agent to receive advice and suitable insurance proposals, and to the collection and use of my personal data in accordance with the privacy policy, solely for service and callback purposes.',
      'ct.submit': 'Send contact info',
      'ct.sending': 'Sending...',
      'ct.success.title': 'Submitted successfully',
      'ct.success.msg': 'Thank you for your interest. The agent will get back to you as soon as possible.',
      'ct.ph.fullname': 'e.g. John Smith',
      'ct.ph.phone': '08X-XXX-XXXX',
      'ct.ph.budget': 'e.g. 20,000 THB/year or not sure yet',
      'ct.ph.note': 'Add any details, e.g. a good time to call back',
      'ct.ph.other': 'Specify your other objective',
      'ct.p.life': 'Life protection',
      'ct.p.health': 'Medical expenses',
      'ct.p.ci': 'Critical illness',
      'ct.p.savings': 'Savings',
      'ct.p.retire': 'Retirement planning',
      'ct.p.tax': 'Tax deduction',
      'ct.p.legacy': 'Legacy planning',
      'ct.p.other': 'Other (specify)',
      'ct.err.fullname': 'Please enter your full name',
      'ct.err.phone': 'Please enter your phone number',
      'ct.err.birth': 'Please choose your date of birth',
      'ct.err.purpose': 'Please select at least one objective',
      'ct.err.other': 'Please specify the "Other" objective',
      'ct.err.consent': 'Please give consent before submitting',
      'ct.err.send': 'Failed to send',
    },
  };

  function getLang() {
    const l = localStorage.getItem('lang');
    return DICT[l] ? l : 'th';
  }
  function tr(key, lang) {
    const L = DICT[lang] || DICT.th;
    if (L && L[key] != null) return L[key];
    if (DICT.th[key] != null) return DICT.th[key];
    return key;
  }
  // ดึงข้อความตามภาษาปัจจุบัน (ใช้ในโค้ด JS ของหน้า)
  window.t = function (key) { return tr(key, getLang()); };
  window.i18nLang = getLang;

  function apply(lang) {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = tr(el.getAttribute('data-i18n'), lang);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', tr(el.getAttribute('data-i18n-ph'), lang));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.setAttribute('title', tr(el.getAttribute('data-i18n-title'), lang));
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(function (el) {
      el.setAttribute('alt', tr(el.getAttribute('data-i18n-alt'), lang));
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = tr(el.getAttribute('data-i18n-html'), lang);
    });
  }

  function setLang(lang) {
    if (!DICT[lang]) return;
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    apply(lang);
    updateSwitcher(lang);
    window.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: lang } }));
  }
  window.setLang = setLang;

  // เรียกให้ apply ใหม่ (เผื่อหน้าเพิ่ง render element ใหม่)
  window.applyI18n = function () { apply(getLang()); };

  function buildSwitcher() {
    if (document.getElementById('lang-switcher')) return;
    const wrap = document.createElement('div');
    wrap.id = 'lang-switcher';
    wrap.style.cssText = 'position:fixed;bottom:14px;left:14px;z-index:9999;display:flex;gap:2px;background:#fff;border:1px solid #e5e7eb;border-radius:999px;padding:3px;box-shadow:0 4px 16px rgba(0,0,0,0.15);font-family:inherit;';
    LANGS.forEach(function (l) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.lang = l.code;
      b.textContent = l.short;
      b.style.cssText = 'border:none;background:transparent;border-radius:999px;padding:5px 11px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:#6b7280;transition:background .15s,color .15s;';
      b.addEventListener('click', function () { setLang(l.code); });
      wrap.appendChild(b);
    });
    document.body.appendChild(wrap);
  }
  function updateSwitcher(lang) {
    document.querySelectorAll('#lang-switcher button').forEach(function (b) {
      const on = b.dataset.lang === lang;
      b.style.background = on ? '#FF6B00' : 'transparent';
      b.style.color = on ? '#fff' : '#6b7280';
    });
  }

  function init() {
    buildSwitcher();
    const l = getLang();
    document.documentElement.lang = l;
    apply(l);
    updateSwitcher(l);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
