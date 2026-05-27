// FWD Main Navigation
// ใช้: ใส่ <div id="main-nav"></div> ในหน้าที่ต้องการ แล้ว <script src="/nav.js"></script>
// เพิ่มเมนูใหม่ → แก้ array NAV_ITEMS ด้านล่าง

(function () {
    const NAV_ITEMS = [
        { path: '/',         label: 'หน้าหลัก',      icon: '🏠', exact: true },
        { path: '/search',   label: 'ค้นหาตัวแทน',   icon: '🔍' },
        { path: '/packages', label: 'แพกเกจประกัน',  icon: '📦' },
        // เพิ่มเมนูใหม่ที่นี่ในอนาคต เช่น:
        // { path: '/news',   label: 'ข่าวสาร',        icon: '📰' },
        // { path: '/contact', label: 'ติดต่อเรา',     icon: '📞' },
    ];

    const ACTIVE_CLS = 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md';
    const INACTIVE_CLS = 'bg-white border border-orange-300 text-orange-600 hover:bg-orange-50';

    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';

    function isActive(item) {
        if (item.exact) return currentPath === item.path;
        return currentPath === item.path || currentPath.startsWith(item.path + '/');
    }

    const nav = document.createElement('nav');
    nav.className = 'max-w-6xl mx-auto px-4 mt-3';
    nav.innerHTML = `
        <div class="flex flex-wrap items-center gap-2">
            ${NAV_ITEMS.map(item => {
                const active = isActive(item);
                const cls = active ? ACTIVE_CLS : INACTIVE_CLS;
                return `<a href="${item.path}" class="${cls} font-medium text-xs px-4 py-2 rounded-lg flex items-center gap-1 transition whitespace-nowrap">
                    <span>${item.icon}</span> ${item.label}
                </a>`;
            }).join('')}
        </div>
    `;

    const placeholder = document.getElementById('main-nav');
    if (placeholder) {
        placeholder.replaceWith(nav);
    } else {
        // ถ้าไม่มี placeholder ให้ใส่หลัง header
        const header = document.querySelector('header');
        if (header && header.parentNode) header.parentNode.insertBefore(nav, header.nextSibling);
    }
})();
