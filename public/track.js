/* track.js — บันทึกการเข้าชมหน้า (สถิติ Traffic)
 * ใช้: ใส่ <script src="/track.js"></script> แล้วเรียก
 *      trackView(userId, pageKey, pageTitle)
 * เมื่อรู้ว่าหน้านี้เป็นของตัวแทนคนไหน (best-effort, ไม่ทำหน้าเว็บพัง)
 */
(function () {
  'use strict';
  function visitorId() {
    var vid = localStorage.getItem('vid');
    if (!vid) {
      vid = 'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem('vid', vid); } catch (e) { /* ignore */ }
    }
    return vid;
  }
  window.trackView = function (userId, pageKey, pageTitle) {
    userId = Number(userId);
    if (!userId) return;
    try {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          user_id: userId,
          visitor_id: visitorId(),
          page_key: pageKey || 'unknown',
          page_title: pageTitle || null,
          path: location.pathname,
        }),
      }).catch(function () {});
    } catch (e) { /* ไม่ให้ tracking ทำหน้าพัง */ }
  };
})();
