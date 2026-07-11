/**
 * Small ERP — Core JavaScript
 * Shared utilities for all HTMX pages.
 */

// ─── Frappe API Helper ──────────────────────────────────────────────────
// ─── CSRF Token Resolution ─────────────────────────────────────────────
function getCSRFToken() {
    // Priority 1: frappe global (set on Frappe desk pages)
    if (window.frappe && frappe.csrf_token) {
        return frappe.csrf_token;
    }
    // Priority 2: window._csrf_token (set via inline script in base template)
    if (window._csrf_token) {
        return window._csrf_token;
    }
    // Priority 3: meta tag
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta && meta.getAttribute('content')) {
        return meta.getAttribute('content');
    }
    // Priority 4: cookie
    return getCookie('csrf_token');
}

function getCookie(name) {
    const v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
    return v ? v[2] : '';
}

// ─── Frappe API Helper ──────────────────────────────────────────────────
async function frappeCall(method, args = {}, httpMethod = 'POST') {
    const params = new URLSearchParams();
    for (const key in args) {
        let val = args[key];
        if (typeof val === 'object') val = JSON.stringify(val);
        params.append(key, val);
    }

    let url = `/api/method/${method}`;
    const headers = {
        'Accept': 'application/json',
    };

    const fetchOpts = { method: httpMethod, headers: headers };

    if (httpMethod.toUpperCase() === 'GET') {
        const query = params.toString();
        if (query) url += `?${query}`;
    } else {
        // POST / PUT
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        const csrf = getCSRFToken();
        if (csrf) {
            headers['X-Frappe-CSRF-Token'] = csrf;
        }
        fetchOpts.body = params.toString();
    }

    const response = await fetch(url, fetchOpts);

    if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
            const errData = await response.json();
            errMsg = errData._server_messages
                ? JSON.parse(errData._server_messages)[0]
                : errData.message || errMsg;
            if (typeof errMsg === 'object' && errMsg.message) errMsg = errMsg.message;
            if (typeof errMsg === 'string') {
                errMsg = errMsg.replace(/<[^>]*>/g, '').replace(/"/g, '');
            }
        } catch(e) {}
        throw new Error(errMsg);
    }

    const data = await response.json();
    return data.message;
}


// ─── Toast Notifications ────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}


// ─── Drawer (Side Panel) ────────────────────────────────────────────────
function openDrawer(title, htmxUrl) {
    const overlay = document.getElementById('drawer-overlay');
    const drawer = document.getElementById('drawer');
    const drawerTitle = document.getElementById('drawer-title');
    const drawerBody = document.getElementById('drawer-body');

    if (drawerTitle) drawerTitle.textContent = title || 'Details';
    if (!htmxUrl) {
        drawerBody.innerHTML = '<div class="content-loading"><div class="spinner"></div></div>';
    }

    overlay.classList.add('open');
    drawer.classList.add('open');

    // Trap focus inside drawer
    document.body.style.overflow = 'hidden';
}

function closeDrawer() {
    const overlay = document.getElementById('drawer-overlay');
    const drawer = document.getElementById('drawer');

    overlay.classList.remove('open');
    drawer.classList.remove('open');
    document.body.style.overflow = '';
}

// Close drawer on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
});


// ─── Pagination Renderer ────────────────────────────────────────────────
function buildPaginatedUrl(apiUrl, page, extraParams) {
    const params = new URLSearchParams({ page: String(page) });
    if (extraParams) {
        Object.keys(extraParams).forEach((key) => {
            const val = extraParams[key];
            if (val !== null && val !== undefined && val !== '') {
                params.set(key, val);
            }
        });
    }
    return `${apiUrl}?${params.toString()}`;
}

function renderPagination(containerId, currentPage, totalPages, apiUrl, targetSelector, extraParams) {
    const container = document.getElementById(containerId);
    if (!container || totalPages <= 1) {
        if (container) container.innerHTML = '';
        return;
    }

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    let html = '<div class="pagination">';

    if (currentPage > 1) {
        html += `<button class="page-btn" 
                    hx-get="${buildPaginatedUrl(apiUrl, currentPage - 1, extraParams)}"
                    hx-target="${targetSelector}"
                    hx-swap="innerHTML">‹</button>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}"
                    hx-get="${buildPaginatedUrl(apiUrl, i, extraParams)}"
                    hx-target="${targetSelector}"
                    hx-swap="innerHTML">${i}</button>`;
    }

    if (currentPage < totalPages) {
        html += `<button class="page-btn"
                    hx-get="${buildPaginatedUrl(apiUrl, currentPage + 1, extraParams)}"
                    hx-target="${targetSelector}"
                    hx-swap="innerHTML">›</button>`;
    }

    html += '</div>';
    container.innerHTML = html;

    if (typeof htmx !== 'undefined') {
        htmx.process(container);
    }
}


// ─── Keyboard Shortcuts ─────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
    // Ctrl+K → Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const search = document.getElementById('global-search');
        if (search) search.focus();
    }

    // Ctrl+N → New Sale (POS)
    if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.shiftKey) {
        // Only if not in an input
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            window.location.href = '/ops/pos';
        }
    }
});


// ─── Global HTMX Error Handler ──────────────────────────────────────────
document.body.addEventListener('htmx:configRequest', function(evt) {
    const csrf = getCSRFToken();
    if (csrf) {
        evt.detail.headers['X-Frappe-CSRF-Token'] = csrf;
    }
});

document.body.addEventListener('htmx:responseError', function(evt) {
    console.error('HTMX error:', evt.detail);
    showToast('Request failed. Please try again.', 'error');
});

document.body.addEventListener('htmx:sendError', function() {
    showToast('Network error. Check your connection.', 'error');
});

// ─── Prevent HTMX from swapping raw JSON as HTML ────────────────────────
// Our API endpoints return JSON; the page-specific afterRequest handlers
// parse and render it. This prevents the brief flash of raw JSON text.
document.body.addEventListener('htmx:beforeSwap', function(evt) {
    const ct = evt.detail.xhr.getResponseHeader('Content-Type') || '';
    if (ct.includes('application/json')) {
        evt.detail.shouldSwap = false;
    }
});

// ─── Global Smart Search (JSON → dropdown) ─────────────────────────────
function navigateSmartSearchResult(doctype, name) {
    const routes = {
        Item: '/ops/inventory',
        Customer: '/ops/customers',
        'Sales Invoice': '/ops/orders',
        'Sales Order': '/ops/orders',
    };
    const path = routes[doctype] || '/ops';
    window.location.href = path;
}

function renderSmartSearchResults(containerId, results) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!results || results.length === 0) {
        container.innerHTML = '<div class="search-result-item" style="cursor:default;color:var(--text-muted);">No results found</div>';
        return;
    }

    container.innerHTML = results.map((r) => {
        const label = r.label || r.name || '';
        const dtype = r.doctype || '';
        const safeName = (r.name || '').replace(/'/g, "\\'");
        const safeDtype = dtype.replace(/'/g, "\\'");
        return `<div class="search-result-item" onclick="navigateSmartSearchResult('${safeDtype}', '${safeName}')">` +
            `<span class="result-type">${dtype}</span> ${label}` +
            '</div>';
    }).join('');
}

document.body.addEventListener('htmx:afterRequest', function(evt) {
    const path = (evt.detail.pathInfo && evt.detail.pathInfo.requestPath) || '';
    if (!path.includes('ai_agent.smart_search')) return;

    try {
        const resp = JSON.parse(evt.detail.xhr.responseText).message;
        const results = resp.results || [];
        const isMobile = evt.detail.elt && evt.detail.elt.id === 'mobile-global-search';
        renderSmartSearchResults(isMobile ? 'mobile-search-results' : 'search-results', results);
    } catch (e) {
        console.error('Smart search parse error', e);
    }
});


// ─── Auto-refresh Dashboard KPIs every 5 minutes ───────────────────────
if (window.location.pathname === '/ops' || window.location.pathname === '/ops/') {
    setInterval(() => {
        const kpiContainer = document.getElementById('kpi-container');
        if (kpiContainer) {
            htmx.trigger(kpiContainer, 'load');
        }
    }, 5 * 60 * 1000);
}

// ─── Sidebar Collapse (Desktop) ──────────────────────────────────────
function updateSidebarCollapseIcon() {
    const sidebar = document.getElementById('sidebar');
    const icon = document.getElementById('sidebar-collapse-icon');
    const btn = document.getElementById('sidebar-collapse-btn');
    if (!sidebar || !icon) return;

    const collapsed = sidebar.classList.contains('collapsed');
    icon.setAttribute('data-lucide', collapsed ? 'chevrons-right' : 'chevrons-left');
    if (btn) {
        btn.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
        btn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function toggleSidebarCollapse() {
    const shell = document.querySelector('.app-shell');
    const sidebar = document.getElementById('sidebar');
    const collapsed = sidebar.classList.toggle('collapsed');
    shell.classList.toggle('sidebar-collapsed', collapsed);
    localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
    updateSidebarCollapseIcon();
}

document.addEventListener('DOMContentLoaded', function() {
    if (localStorage.getItem('sidebarCollapsed') === '1' && window.innerWidth > 768) {
        const shell = document.querySelector('.app-shell');
        const sidebar = document.getElementById('sidebar');
        if (sidebar && shell) {
            sidebar.classList.add('collapsed');
            shell.classList.add('sidebar-collapsed');
        }
    }
    updateSidebarCollapseIcon();
});

// ─── POS Tab Switching (Mobile) ──────────────────────────────────────
function showPOSTab(tab) {
    const itemsPanel = document.getElementById('pos-items-panel');
    const cartPanel = document.getElementById('pos-cart-panel');
    if (itemsPanel) itemsPanel.style.display = tab === 'items' ? 'flex' : 'none';
    if (cartPanel) cartPanel.style.display = tab === 'cart' ? 'flex' : 'none';
    
    document.querySelectorAll('.pos-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`.pos-tab[data-tab="${tab}"]`);
    if (activeTab) activeTab.classList.add('active');
}

// ─── Bottom Nav "More" Sheet ─────────────────────────────────────────
function toggleMoreSheet() {
    const sheet = document.getElementById('more-sheet');
    const overlay = document.getElementById('sheet-overlay');
    if (sheet) sheet.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open');
}
