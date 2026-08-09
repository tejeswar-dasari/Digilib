// DigiLib API configuration
// Keep all frontend API calls pointed at the deployed Express backend.
// You can override this before shared.js loads with window.DIGILIB_API_BASE.
window.DIGILIB_API_BASE = window.DIGILIB_API_BASE || 'https://digilib-backend-v0r2.onrender.com';

function digilibApiUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    const base = String(window.DIGILIB_API_BASE || '').replace(/\/+$/, '');
    const cleanPath = String(path || '').replace(/^\/+/, '');
    return `${base}/${cleanPath}`;
}
window.digilibApiUrl = digilibApiUrl;
window.digilibApiFetch = function(path, options = {}) {
    const opts = { ...options, headers: { ...(options.headers || {}) } };
    const token = localStorage.getItem('digilib_auth_token');
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    return fetch(digilibApiUrl(path), opts);
};

// Reusable Global DigiLib Loading Component
function showDigilibLoader(titleText = 'Opening Resources...', subtitleText = 'DIGITAL ACADEMIC LIBRARY') {
    let loader = document.getElementById('digilib-global-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'digilib-global-loader';
        loader.className = 'fixed inset-0 z-[999999] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center transition-opacity duration-300 opacity-0 pointer-events-none';
        loader.innerHTML = `
            <div class="relative flex flex-col items-center max-w-sm w-full space-y-6">
                <!-- Outer Animated Ring & Logo -->
                <div class="relative w-24 h-24 flex items-center justify-center">
                    <div class="absolute inset-0 rounded-full border-4 border-brand-500/20 border-t-brand-500 border-r-amber-500 animate-spin"></div>
                    <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-amber-500 p-0.5 shadow-2xl shadow-brand-500/30 flex items-center justify-center animate-pulse">
                        <div class="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-white">
                            <svg class="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- Text Content -->
                <div class="space-y-2">
                    <h3 id="digilib-loader-title" class="text-xl font-black text-white tracking-tight">Opening Resources...</h3>
                    <p id="digilib-loader-subtitle" class="text-xs font-bold uppercase tracking-widest text-amber-400/90">DIGITAL ACADEMIC LIBRARY</p>
                </div>

                <!-- Animated Loading Bar -->
                <div class="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
                    <div class="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-500 via-amber-400 to-brand-500 rounded-full w-full animate-[pulse_1s_infinite]"></div>
                </div>
            </div>
        `;
        document.body.appendChild(loader);
    }

    const titleEl = document.getElementById('digilib-loader-title');
    const subEl = document.getElementById('digilib-loader-subtitle');
    if (titleEl) titleEl.textContent = titleText;
    if (subEl) subEl.textContent = subtitleText;

    loader.classList.remove('pointer-events-none', 'opacity-0');
    loader.classList.add('opacity-100');
}
window.showDigilibLoader = showDigilibLoader;

function hideDigilibLoader() {
    const loader = document.getElementById('digilib-global-loader');
    if (loader) {
        loader.classList.remove('opacity-100');
        loader.classList.add('opacity-0', 'pointer-events-none');
    }
}
window.hideDigilibLoader = hideDigilibLoader;

// Clean Standard Empty Resource State Renderer
function renderEmptyResourceState(requestCategory = 'General', requestTitle = '') {
    const params = new URLSearchParams();
    if (requestCategory) params.set('branch', requestCategory);
    if (requestTitle) params.set('title', requestTitle);
    const reqUrl = `request.html?${params.toString()}`;

    return `
        <div class="sm:col-span-2 lg:col-span-3 text-center py-16 px-6 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div class="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                <i data-lucide="folder-search" class="w-8 h-8"></i>
            </div>
            <div class="space-y-1">
                <h3 class="text-lg font-black text-slate-900 dark:text-white">No Resources Available</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">We couldn't find materials matching your filters.</p>
            </div>
            <div class="pt-2">
                <a href="${reqUrl}" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-xs shadow-md shadow-brand-500/20 hover:-translate-y-0.5 transition-all">
                    <i data-lucide="plus-circle" class="w-4 h-4"></i>
                    <span>Request This Material</span>
                </a>
            </div>
        </div>
    `;
}
window.renderEmptyResourceState = renderEmptyResourceState;

// Sort Helper for Resource Lists
function sortResources(list, sortBy = 'newest') {
    if (!Array.isArray(list)) return [];
    const copy = [...list];
    if (sortBy === 'oldest') {
        return copy.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    }
    if (sortBy === 'clicks') {
        return copy.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
    }
    if (sortBy === 'name') {
        return copy.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    // Default: newest
    return copy.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}
window.sortResources = sortResources;

// High-Speed Resource Fetcher with Client SWR Memory Cache
window.DigiLibResourceCache = window.DigiLibResourceCache || new Map();

async function fetchFastResources(url) {
    const apiUrl = digilibApiUrl(url);
    if (window.DigiLibResourceCache.has(apiUrl)) {
        const cached = window.DigiLibResourceCache.get(apiUrl);
        // Revalidate asynchronously in background if older than 30s
        if (Date.now() - cached.timestamp > 30000) {
            fetch(apiUrl).then(async r => {
                const contentType = r.headers.get('content-type') || '';
                if (r.ok && contentType.includes('application/json')) {
                    try { return await r.json(); } catch(e) { return null; }
                }
                return null;
            }).then(data => {
                if (data && Array.isArray(data)) {
                    window.DigiLibResourceCache.set(apiUrl, { data, timestamp: Date.now() });
                }
            }).catch(() => {});
        }
        return cached.data;
    }

    try {
        const res = await fetch(apiUrl);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
            try {
                const data = await res.json();
                if (Array.isArray(data)) {
                    window.DigiLibResourceCache.set(apiUrl, { data, timestamp: Date.now() });
                    return data;
                }
            } catch (jsonErr) {
                console.warn("JSON parse warning for resources fetch:", jsonErr);
            }
        }
    } catch (e) {
        if (window.DigiLibResourceCache.has(apiUrl)) {
            return window.DigiLibResourceCache.get(apiUrl).data;
        }
    }
    return [];
}
window.fetchFastResources = fetchFastResources;

function prefetchResources(url) {
    if (!window.DigiLibResourceCache.has(apiUrl)) {
        fetchFastResources(url).catch(() => {});
    }
}
window.prefetchResources = prefetchResources;

// Debounce helper for lag-free instant search filtering
function debounce(fn, delay = 120) {
    let timer = null;
    return function (...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}
window.debounce = debounce;

// Initialize theme on page load
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || localStorage.getItem('color-theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.onclick = function(e) {
            e.preventDefault();
            const isDark = document.documentElement.classList.toggle('dark');
            const newTheme = isDark ? 'dark' : 'light';
            localStorage.setItem('theme', newTheme);
            localStorage.setItem('color-theme', newTheme);
            if (window.lucide) {
                lucide.createIcons();
            }
        };
    }
}

// Show toast notifications
function showToast(msg, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-5 right-5 z-[99999] flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const isErr = type === 'error';
    const isSucc = type === 'success';
    const bgClass = isErr ? 'bg-rose-600' : isSucc ? 'bg-emerald-600' : 'bg-brand-600';

    toast.className = `px-4 py-3 rounded-xl text-xs font-bold text-white shadow-xl flex items-center gap-2 pointer-events-auto transition-all transform translate-y-0 opacity-100 ${bgClass}`;
    toast.innerHTML = `<i data-lucide="${isErr ? 'alert-circle' : 'check-circle'}" class="w-4 h-4"></i><span>${msg}</span>`;
    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Toggle mobile drawer
function toggleMobileDrawer() {
    const drawer = document.getElementById('mobile-drawer');
    const overlay = document.getElementById('mobile-drawer-overlay');
    if (!drawer || !overlay) return;

    if (drawer.classList.contains('-translate-y-full')) {
        overlay.classList.remove('hidden');
        setTimeout(() => {
            overlay.classList.remove('opacity-0');
            drawer.classList.remove('-translate-y-full');
        }, 10);
    } else {
        drawer.classList.add('-translate-y-full');
        overlay.classList.add('opacity-0');
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 300);
    }
}

// Track Resource Click Counter
async function trackClick(id) {
    if (!id) return;
    try {
        await window.digilibApiFetch(`/resources/${id}/click`, { method: 'POST' });
    } catch (e) {
        // Fallback or ignore network issue
    }
}

// Restore the signed-in profile from the backend on every page.
// localStorage is only a display cache; the backend token is authoritative.
async function syncAuthenticatedUser() {
    const token = localStorage.getItem('digilib_auth_token');
    if (!token) return null;

    try {
        const response = await window.digilibApiFetch('/me');
        if (!response.ok) {
            localStorage.removeItem('digilib_auth_token');
            localStorage.removeItem('digilib_is_admin');
            localStorage.removeItem('adminLoggedIn');
            return null;
        }

        const user = await response.json();
        localStorage.setItem('student', JSON.stringify(user));
        localStorage.setItem('digilib_user_name', user.name || '');
        localStorage.setItem('digilib_user_email', user.email || '');
        localStorage.setItem('digilib_user_roll', user.roll || '');
        localStorage.setItem('digilib_user_branch', user.branch || '');
        localStorage.setItem('digilib_is_admin', user.role === 'admin' ? 'true' : 'false');

        if (user.role === 'admin') {
            localStorage.setItem('adminLoggedIn', 'true');
            localStorage.setItem('adminEmail', user.email || '');
        } else {
            localStorage.removeItem('adminLoggedIn');
            localStorage.removeItem('adminEmail');
        }

        if (typeof updateProfilePanelUI === 'function') {
            updateProfilePanelUI(user);
        }

        checkAdminStatus();
        return user;
    } catch (error) {
        console.warn('Profile sync failed:', error);
        return null;
    }
}
window.syncAuthenticatedUser = syncAuthenticatedUser;

// Check admin status & update navbar
function checkAdminStatus() {
    const isAdmin = localStorage.getItem('digilib_is_admin') === 'true';
    const adminNavLinks = document.querySelectorAll('#nav-admin-link, .admin-only-link');
    adminNavLinks.forEach(el => {
        if (isAdmin) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}

// Toggle Profile Modal
function toggleProfileDropdown() {
    let profileModal = document.getElementById('profile-modal');
    if (!profileModal) {
        profileModal = document.createElement('div');
        profileModal.id = 'profile-modal';
        profileModal.className = 'fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-all duration-300 opacity-0 pointer-events-none';
        
        const savedStudent = (() => { try { return JSON.parse(localStorage.getItem('student') || 'null'); } catch (_) { return null; } })();
        const userName = localStorage.getItem('digilib_user_name') || savedStudent?.name || 'Guest User';
        const userEmail = localStorage.getItem('digilib_user_email') || savedStudent?.email || 'Sign in to access your saved profile';
        const isAdmin = localStorage.getItem('digilib_is_admin') === 'true';

        profileModal.innerHTML = `
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl relative transform scale-95 transition-transform duration-300">
                <button onclick="toggleProfileDropdown()" class="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-white">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>

                <div class="flex flex-col items-center text-center space-y-3 pt-2">
                    <div class="w-16 h-16 rounded-full bg-brand-600 text-white flex items-center justify-center text-2xl font-extrabold shadow-lg shadow-brand-500/20">
                        ${userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-slate-900 dark:text-white">${userName}</h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${userEmail}</p>
                    </div>

                    ${isAdmin ? `
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <i data-lucide="shield-check" class="w-3.5 h-3.5"></i> Admin Access Verified
                        </span>
                    ` : ''}

                    <div class="w-full pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2.5">
                        <a href="request.html" onclick="toggleProfileDropdown()" class="w-full py-2.5 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-bold text-center transition-all flex items-center justify-center gap-2">
                            <i data-lucide="help-circle" class="w-4 h-4 text-brand-500"></i> My Requested Resources
                        </a>
                        <a href="contribute.html" onclick="toggleProfileDropdown()" class="w-full py-2.5 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-bold text-center transition-all flex items-center justify-center gap-2">
                            <i data-lucide="plus-circle" class="w-4 h-4 text-emerald-500"></i> Contribute New Material
                        </a>
                        ${isAdmin ? `
                            <a href="admin.html" onclick="toggleProfileDropdown()" class="w-full py-2.5 px-4 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs text-center transition-all flex items-center justify-center gap-2">
                                <i data-lucide="shield" class="w-4 h-4"></i> Open Admin Panel
                            </a>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(profileModal);
        if (window.lucide) lucide.createIcons();
    }

    if (profileModal.classList.contains('opacity-0')) {
        profileModal.classList.remove('opacity-0', 'pointer-events-none');
        profileModal.querySelector('div').classList.remove('scale-95');
    } else {
        profileModal.classList.add('opacity-0', 'pointer-events-none');
        profileModal.querySelector('div').classList.add('scale-95');
    }
}

// Auto-run common setup on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    checkAdminStatus();
    setupPageTransitionListeners();
    hidePageLoader();
});

window.addEventListener('load', () => {
    hidePageLoader();
});

window.addEventListener('pageshow', () => {
    hidePageLoader();
});

// Global DigiLib Loader Overlay Component
let globalHideLoaderTimer = null;

function ensureGlobalLoaderElement() {
    let loader = document.getElementById('pwa-app-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'pwa-app-loader';
        if (document.body) {
            document.body.appendChild(loader);
        }
    }
    loader.className = 'fixed inset-0 z-[999999] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-none transition-opacity duration-300 ease-in-out pointer-events-auto opacity-0';
    return loader;
}

function showPageLoader(statusText = 'Opening DigiLib...', subtitleText = 'DIGITAL ACADEMIC LIBRARY') {
    if (globalHideLoaderTimer) {
        clearTimeout(globalHideLoaderTimer);
        globalHideLoaderTimer = null;
    }

    const loader = ensureGlobalLoaderElement();
    const displayMsg = statusText || 'Opening DigiLib...';
    const subMsg = subtitleText || 'DIGITAL ACADEMIC LIBRARY';

    const statusEl = document.getElementById('pwa-loader-status');
    const subEl = document.getElementById('pwa-loader-subtitle');

    // Smoothly update text in place if loader is already open
    if (loader.style.display === 'flex' && loader.classList.contains('opacity-100') && statusEl) {
        statusEl.textContent = displayMsg;
        if (subEl) subEl.textContent = subMsg;
        return;
    }

    loader.innerHTML = `
        <div class="relative flex flex-col items-center justify-center max-w-xs w-full space-y-4 p-4 text-center">
            <!-- Ambient Purple/Blue Radial Glow -->
            <div class="absolute -z-10 w-48 h-48 bg-indigo-600/25 rounded-full blur-3xl animate-pulse pointer-events-none"></div>

            <!-- Brand Logo Box -->
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 p-0.5 shadow-xl shadow-indigo-500/30 flex items-center justify-center">
                <div class="w-full h-full bg-slate-950/50 rounded-[14px] flex items-center justify-center backdrop-blur-sm">
                    <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                </div>
            </div>

            <!-- Brand Heading & Tagline -->
            <div class="space-y-1 text-center">
                <h1 class="text-xl font-extrabold text-white tracking-tight">Digilib</h1>
                <p id="pwa-loader-subtitle" class="text-[10px] font-bold tracking-[0.22em] text-indigo-300 uppercase">${subMsg}</p>
            </div>

            <!-- Ring Spinner -->
            <div class="relative w-11 h-11 my-2 flex items-center justify-center">
                <div class="absolute inset-0 rounded-full border-2 border-indigo-900/60"></div>
                <div class="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-400 border-r-purple-400 animate-spin"></div>
            </div>

            <!-- Dynamic Status Text -->
            <div class="space-y-1 text-center">
                <p id="pwa-loader-status" class="text-xs sm:text-sm font-semibold text-slate-200 tracking-wide animate-pulse">${displayMsg}</p>
            </div>
        </div>
    `;

    loader.style.display = 'flex';
    requestAnimationFrame(() => {
        loader.classList.remove('opacity-0', 'pointer-events-none');
        loader.classList.add('opacity-100', 'pointer-events-auto');
    });
}

function hidePageLoader() {
    const loader = document.getElementById('pwa-app-loader');
    if (!loader) return;

    loader.classList.remove('opacity-100', 'pointer-events-auto');
    loader.classList.add('opacity-0', 'pointer-events-none');

    if (globalHideLoaderTimer) clearTimeout(globalHideLoaderTimer);
    globalHideLoaderTimer = setTimeout(() => {
        if (loader && loader.classList.contains('opacity-0')) {
            loader.style.display = 'none';
        }
    }, 320);
}

function getGridLoaderHTML() {
    return `<div class="sm:col-span-2 lg:col-span-3 text-center py-8 text-slate-400 dark:text-slate-500 font-medium text-xs">Loading resources from repository...</div>`;
}

window.showPageLoader = showPageLoader;
window.hidePageLoader = hidePageLoader;
window.hidePwaAppLoader = hidePageLoader;
window.getGridLoaderHTML = getGridLoaderHTML;

function setupPageTransitionListeners() {
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('blob:') || href.startsWith('data:')) {
            return;
        }

        const isDownload = link.hasAttribute('download') || (link.getAttribute('onclick') && link.getAttribute('onclick').includes('trackClick'));
        const text = (link.textContent || '').toLowerCase();

        if (link.getAttribute('target') === '_blank' || isDownload) {
            if (isDownload || text.includes('download')) {
                showPageLoader('Preparing download...', 'DIGITAL ACADEMIC LIBRARY');
                setTimeout(hidePageLoader, 1500);
            } else if (text.includes('youtube') || href.includes('youtube.com') || href.includes('youtu.be')) {
                showPageLoader('Loading YouTube resources...', 'DIGITAL ACADEMIC LIBRARY');
                setTimeout(hidePageLoader, 1500);
            } else if (text.includes('website') || href.startsWith('http')) {
                showPageLoader('Opening website...', 'DIGITAL ACADEMIC LIBRARY');
                setTimeout(hidePageLoader, 1500);
            }
            return;
        }

        // Internal page navigation
        let status = 'Opening DigiLib...';
        const h = href.toLowerCase();

        if (h.includes('branch=cse') || (h.includes('btech.html') && h.includes('cse'))) status = 'Opening CSE...';
        else if (h.includes('branch=ece') || (h.includes('btech.html') && h.includes('ece'))) status = 'Opening ECE...';
        else if (h.includes('branch=eee') || (h.includes('btech.html') && h.includes('eee'))) status = 'Opening EEE...';
        else if (h.includes('branch=mech') || h.includes('mechanical')) status = 'Opening Mechanical...';
        else if (h.includes('branch=civil') || h.includes('civil')) status = 'Opening Civil...';
        else if (h.includes('btech.html')) status = 'Opening B.Tech...';
        else if (h.includes('school.html')) status = 'Opening School...';
        else if (h.includes('intermediate.html')) status = 'Opening Inter & Diploma...';
        else if (h.includes('books.html')) status = 'Opening Books & Novels...';
        else if (h.includes('contribute.html')) status = 'Opening Contribute...';
        else if (h.includes('request.html')) status = 'Opening Resource Request...';
        else if (h.includes('admin.html')) status = 'Opening Admin Dashboard...';

        showPageLoader(status, 'DIGITAL ACADEMIC LIBRARY');
    });
}

// Helper to determine dynamic action button based on resource material type
function getResourceActionInfo(item) {
    if (!item) return { text: 'Download File', icon: 'download', isExternal: false };

    const matType = ((item.materialType || item.type || item.genre || item.category || '') + '').toLowerCase().trim();
    const format = ((item.format || '') + '').toLowerCase().trim();
    const url = ((item.url || item.fileUrl || item.targetLink || '') + '').toLowerCase().trim();

    // 1. YouTube Channels
    if (
        matType.includes('youtube') || 
        matType.includes('yt channel') || 
        matType === 'yt' ||
        format.includes('youtube') || 
        url.includes('youtube.com') || 
        url.includes('youtu.be')
    ) {
        return { text: 'Watch on YouTube', icon: 'youtube', isExternal: true };
    }

    // 2. Websites
    if (
        matType.includes('website') || 
        matType === 'web' || 
        matType.includes('web link') || 
        format.includes('website')
    ) {
        return { text: 'Visit Website', icon: 'globe', isExternal: true };
    }

    // 3. Downloadable Resources: Notes, Mid Papers, Previous Year Papers, Semester Papers,
    // Study Materials, Lab Manuals, Assignments, Question Banks, Textbooks, PPT Slides, etc.
    return { text: 'Download File', icon: 'download', isExternal: false };
}

// Helper to determine resource badge label, color, and icon
function getResourceBadgeInfo(item) {
    const type = ((item.materialType || item.type || '') + '').toLowerCase().trim();
    const format = ((item.format || '') + '').toLowerCase().trim();
    const url = ((item.url || '') + '').toLowerCase().trim();

    if (type.includes('youtube') || url.includes('youtube.com') || url.includes('youtu.be')) {
        return { label: 'YouTube', colorClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', icon: 'youtube' };
    }
    if (type.includes('ppt') || format.includes('ppt')) {
        return { label: 'PPT Slides', colorClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20', icon: 'presentation' };
    }
    if (type.includes('website') || type.includes('web')) {
        return { label: 'Website', colorClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20', icon: 'globe' };
    }
    if (type.includes('book') || type.includes('textbook')) {
        return { label: 'Book', colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: 'book-open' };
    }
    if (type.includes('syllabus')) {
        return { label: 'Syllabus', colorClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', icon: 'file-spreadsheet' };
    }
    if (type.includes('paper') || type.includes('pyq') || type.includes('mid') || type.includes('semester')) {
        return { label: 'Exam Paper', colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: 'file-question' };
    }
    if (type.includes('notes')) {
        return { label: 'Notes', colorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20', icon: 'file-text' };
    }
    if (type.includes('manual') || type.includes('lab')) {
        return { label: 'Lab Manual', colorClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20', icon: 'flask-conical' };
    }
    if (type.includes('assignment')) {
        return { label: 'Assignment', colorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', icon: 'check-square' };
    }
    return { label: item.materialType || item.type || 'Resource', colorClass: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20', icon: 'file' };
}

// Material type matcher logic
function matchMaterialType(resType, filterValue) {
    if (!filterValue || filterValue === 'All' || filterValue === 'All Resources' || filterValue === 'All Material Types') return true;
    if (!resType) return false;

    const rt = resType.toLowerCase().trim();
    const fv = filterValue.toLowerCase().trim();

    if (fv === 'notes') return rt.includes('note');
    if (fv === 'previous year papers' || fv === 'previous papers') return rt.includes('previous') || rt.includes('pyq') || rt.includes('paper');
    if (fv === 'mid papers') return rt.includes('mid');
    if (fv === 'semester papers') return rt.includes('sem') || rt.includes('university') || rt.includes('semester');
    if (fv === 'study materials') return rt.includes('study') || rt.includes('material');
    if (fv === 'lab manuals') return rt.includes('lab') || rt.includes('manual');
    if (fv === 'assignments') return rt.includes('assignment');
    if (fv === 'question banks') return rt.includes('question') || rt.includes('bank');
    if (fv === 'syllabus') return rt.includes('syllabus');
    if (fv === 'reference books' || fv === 'books' || fv === 'textbooks') return rt.includes('book') || rt.includes('textbook') || rt.includes('novel');
    if (fv === 'ppt') return rt.includes('ppt') || rt.includes('slide');
    if (fv === 'websites' || fv === 'website links') return rt.includes('website') || rt.includes('web') || rt.includes('link');
    if (fv === 'youtube channels' || fv === 'youtube links' || fv === 'youtube') return rt.includes('youtube') || rt.includes('yt') || rt.includes('channel') || rt.includes('playlist');

    return rt.includes(fv);
}
window.matchMaterialType = matchMaterialType;

// Unified Resource Card Builder
function renderStandardResourceCard(item) {
    const actionInfo = getResourceActionInfo(item);

    // Always route downloadable files through the backend /download endpoint.
    // This lets the backend send the original uploaded filename (including its
    // extension) via Content-Disposition instead of exposing the Cloudinary
    // public URL, which can otherwise cause browsers to save files with a
    // generated/generic name. External websites/YouTube links still open directly.
    let targetUrl = item.url || item.fileUrl || item.targetLink || '';
    const resourceId = item._id || item.id;

    if (actionInfo.isExternal) {
        // Keep external resources on their original URL.
        if (targetUrl && !/^https?:\/\//i.test(targetUrl) && !targetUrl.startsWith('blob:')) {
            targetUrl = digilibApiUrl(targetUrl);
        }
    } else if (resourceId) {
        // Backend download endpoint preserves the original filename.
        targetUrl = digilibApiUrl(`/download/${resourceId}`);
    } else if (targetUrl) {
        if (!/^https?:\/\//i.test(targetUrl) && !targetUrl.startsWith('blob:') && !targetUrl.startsWith('/')) {
            targetUrl = digilibApiUrl(targetUrl);
        }
    } else {
        targetUrl = '#';
    }
    const badgeInfo = getResourceBadgeInfo(item);

    // Format date
    let dateStr = 'Recently Added';
    if (item.createdAt) {
        try {
            const d = new Date(item.createdAt);
            if (!isNaN(d.getTime())) {
                dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }
        } catch(e) {}
    }

    // Determine primary context label
    const contextTag = item.branch || item.classLevel || item.stream || item.category || 'Academic';
    const yearSemStr = [item.year, item.semester].filter(Boolean).join(' • ');

    // Extract regulation if embedded in year or explicitly stored
    let regulationTag = item.regulation || '';
    if (!regulationTag && item.year && item.year.includes('R2')) {
        const regMatch = item.year.match(/\((R\d+)\)/);
        if (regMatch) regulationTag = regMatch[1];
    }

    const clicks = item.clicks || 0;
    const downloads = item.downloads || clicks;
    const fileSize = item.fileSize || (item.format ? item.format : 'PDF');

    const displayType = item.materialType || item.type || 'Study Material';

    return `
        <div class="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 hover:border-brand-500 dark:hover:border-brand-500 transition-all flex flex-col justify-between group shadow-sm hover:shadow-xl relative overflow-hidden">
            <!-- Top Badges Row -->
            <div class="space-y-3">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${badgeInfo.colorClass} border flex items-center gap-1">
                            <i data-lucide="${badgeInfo.icon}" class="w-3 h-3"></i> ${badgeInfo.label}
                        </span>
                        <span class="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            ${contextTag}
                        </span>
                        ${regulationTag ? `
                            <span class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                ${regulationTag}
                            </span>
                        ` : ''}
                    </div>
                    <span class="text-[11px] font-bold text-slate-400 flex items-center gap-1" title="Views">
                        <i data-lucide="eye" class="w-3.5 h-3.5"></i> ${clicks}
                    </span>
                </div>

                <!-- Title & Subject -->
                <div>
                    <h3 class="text-sm font-extrabold text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        ${item.name || 'Untitled Resource'}
                    </h3>
                    <div class="flex items-center gap-2 mt-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 flex-wrap">
                        ${item.subject ? `<span class="text-brand-600 dark:text-brand-400 font-bold">${item.subject}</span>` : ''}
                        ${item.subject && yearSemStr ? `<span class="text-slate-300 dark:text-slate-700">•</span>` : ''}
                        ${yearSemStr ? `<span>${yearSemStr}</span>` : ''}
                    </div>
                </div>

                <!-- Detailed Metadata Line -->
                <div class="pt-2 flex items-center gap-2.5 text-[11px] font-medium text-slate-400 border-t border-slate-100 dark:border-slate-800/60 flex-wrap">
                    <span class="flex items-center gap-1" title="Upload Date">
                        <i data-lucide="calendar" class="w-3 h-3 text-slate-400"></i> ${dateStr}
                    </span>
                    <span>•</span>
                    <span class="flex items-center gap-1" title="File Size / Format">
                        <i data-lucide="file-check" class="w-3 h-3 text-slate-400"></i> ${fileSize}
                    </span>
                    <span>•</span>
                    <span class="flex items-center gap-1" title="Downloads">
                        <i data-lucide="download" class="w-3 h-3 text-slate-400"></i> ${downloads} dl
                    </span>
                </div>
            </div>

            <!-- Footer Action Button -->
            <div class="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <span class="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider truncate max-w-[120px]">
                    ${displayType}
                </span>
                <a href="${targetUrl}" target="_blank" ${actionInfo.icon === 'download' ? 'download' : ''} onclick="trackClick('${item._id || item.id}')" class="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all shrink-0">
                    <span>${actionInfo.text}</span>
                    <i data-lucide="${actionInfo.icon}" class="w-3.5 h-3.5"></i>
                </a>
            </div>
        </div>
    `;
}

window.getResourceActionInfo = getResourceActionInfo;
window.getResourceBadgeInfo = getResourceBadgeInfo;
window.renderStandardResourceCard = renderStandardResourceCard;

// Shared Matcher Utilities for Resilient Filtering across all pages
function matchMaterialType(resType, filterType) {
    if (!filterType || filterType === 'All') return true;
    if (!resType) return true;
    const r = resType.toLowerCase();
    const f = filterType.toLowerCase();
    if (r === f) return true;
    if (f === 'notes' && (r.includes('note') || r.includes('pdf'))) return true;
    if (f === 'previous year papers' || f === 'mid papers' || f === 'semester papers' || f === 'previous papers') {
        if (r.includes('pyq') || r.includes('paper') || r.includes('previous') || r.includes('mid') || r.includes('question') || r.includes('board')) return true;
    }
    if (f === 'study materials' && (r.includes('material') || r.includes('guide') || r.includes('book'))) return true;
    if (f === 'websites' && (r.includes('website') || r.includes('link') || r.includes('portal'))) return true;
    if (f === 'youtube links' || f === 'youtube channels') {
        if (r.includes('youtube') || r.includes('video') || r.includes('channel')) return true;
    }
    return r.includes(f) || f.includes(r);
}
window.matchMaterialType = matchMaterialType;

function matchBtechSemester(item, semVal) {
    if (!semVal || semVal === 'All') return true;
    const itemSem = (item.semester || '').toLowerCase();
    const itemYear = (item.year || '').toLowerCase();
    const itemName = (item.name || '').toLowerCase();

    if (semVal === '1-1' || semVal === '1.1') {
        if (itemSem.includes('1-1') || itemSem.includes('1.1') || itemSem.includes('1st sem') || (itemYear.includes('1st') && itemSem.includes('1st')) || itemName.includes('1-1') || itemName.includes('1st sem')) return true;
    } else if (semVal === '1-2' || semVal === '1.2') {
        if (itemSem.includes('1-2') || itemSem.includes('1.2') || itemSem.includes('2nd sem') || (itemYear.includes('1st') && itemSem.includes('2nd')) || itemName.includes('1-2') || itemName.includes('2nd sem')) return true;
    } else if (semVal === '2-1' || semVal === '2.1') {
        if (itemSem.includes('2-1') || itemSem.includes('2.1') || (itemYear.includes('2nd') && itemSem.includes('1st')) || itemName.includes('2-1')) return true;
    } else if (semVal === '2-2' || semVal === '2.2') {
        if (itemSem.includes('2-2') || itemSem.includes('2.2') || (itemYear.includes('2nd') && itemSem.includes('2nd')) || itemName.includes('2-2')) return true;
    } else if (semVal === '3-1' || semVal === '3.1') {
        if (itemSem.includes('3-1') || itemSem.includes('3.1') || (itemYear.includes('3rd') && itemSem.includes('1st')) || itemName.includes('3-1')) return true;
    } else if (semVal === '3-2' || semVal === '3.2') {
        if (itemSem.includes('3-2') || itemSem.includes('3.2') || (itemYear.includes('3rd') && itemSem.includes('2nd')) || itemName.includes('3-2')) return true;
    } else if (semVal === '4-1' || semVal === '4.1') {
        if (itemSem.includes('4-1') || itemSem.includes('4.1') || (itemYear.includes('4th') && itemSem.includes('1st')) || itemName.includes('4-1')) return true;
    } else if (semVal === '4-2' || semVal === '4.2') {
        if (itemSem.includes('4-2') || itemSem.includes('4.2') || (itemYear.includes('4th') && itemSem.includes('2nd')) || itemName.includes('4-2')) return true;
    }

    return itemSem.includes(semVal.toLowerCase()) || itemName.includes(semVal.toLowerCase());
}
window.matchBtechSemester = matchBtechSemester;

function matchBtechRegulation(item, regVal) {
    if (!regVal || regVal === 'All') return true;
    const reg = regVal.toLowerCase();
    const itemReg = (item.regulation || '').toLowerCase();
    const itemName = (item.name || '').toLowerCase();
    const itemYear = (item.year || '').toLowerCase();
    const itemDesc = (item.details || item.description || '').toLowerCase();

    return itemReg.includes(reg) || itemName.includes(reg) || itemYear.includes(reg) || itemDesc.includes(reg);
}
window.matchBtechRegulation = matchBtechRegulation;

function matchBtechBranch(item, branch) {
    if (!branch || branch === 'All') return true;
    const itemBranch = (item.branch || '').toLowerCase();
    const targetBranch = branch.toLowerCase().replace(' branch', '').trim();

    if (!itemBranch) return true;

    if (targetBranch.includes('information technology') || targetBranch === 'it' || targetBranch.includes('it (')) {
        return itemBranch.includes('information technology') || itemBranch.includes('it');
    }
    if (targetBranch.includes('ai & ml') || targetBranch.includes('artificial intelligence') || targetBranch.includes('machine learning') || targetBranch.includes('ai/ml')) {
        return itemBranch.includes('ai & ml') || itemBranch.includes('ai') || itemBranch.includes('ml') || itemBranch.includes('artificial intelligence');
    }
    if (targetBranch.includes('computer science') || targetBranch.includes('cse')) {
        return itemBranch.includes('computer science') || itemBranch.includes('cse');
    }
    if (targetBranch.includes('electronics') || targetBranch.includes('ece')) {
        return itemBranch.includes('electronics') || itemBranch.includes('ece');
    }
    if (targetBranch.includes('electrical') || targetBranch.includes('eee')) {
        return itemBranch.includes('electrical') || itemBranch.includes('eee');
    }
    if (targetBranch.includes('mechanical')) {
        return itemBranch.includes('mechanical') || itemBranch.includes('mech');
    }
    if (targetBranch.includes('civil')) {
        return itemBranch.includes('civil');
    }

    return itemBranch.includes(targetBranch) || targetBranch.includes(itemBranch);
}
window.matchBtechBranch = matchBtechBranch;

// Request Permissions Helper: Checks if current user is Admin OR original requester
function canUserDeleteRequest(req) {
    if (!req) return false;
    const isAdmin = localStorage.getItem('digilib_is_admin') === 'true';
    if (isAdmin) return true;

    const userEmail = (localStorage.getItem('digilib_user_email') || '').toLowerCase().trim();
    const userName = (localStorage.getItem('digilib_user_name') || '').toLowerCase().trim();

    // Students may delete/cancel only requests that belong to their logged-in email.
    if (userEmail && req.userEmail && req.userEmail.toLowerCase().trim() === userEmail) return true;
    return false;
}
window.canUserDeleteRequest = canUserDeleteRequest;

// Auto-updates request count badges across all page navbars
async function updateNavRequestCount() {
    try {
        const res = await window.digilibApiFetch('/requests');
        if (res.ok) {
            const requests = await res.json();
            const count = Array.isArray(requests) ? requests.length : 0;
            const badges = document.querySelectorAll('#nav-request-count, .nav-req-count');
            badges.forEach(badge => {
                if (count > 0) {
                    badge.textContent = count;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            });
        }
    } catch (e) {}
}
window.updateNavRequestCount = updateNavRequestCount;

// Fulfill Request Action: Redirects user to contribution page prefilled with requested material
function fulfillRequest(reqId, resourceTitle, branch) {
    const params = new URLSearchParams();
    if (reqId) params.set('fulfillId', reqId);
    if (resourceTitle) params.set('title', resourceTitle);
    if (branch) params.set('branch', branch);
    window.location.href = `contribute.html?${params.toString()}`;
}
window.fulfillRequest = fulfillRequest;

document.addEventListener('DOMContentLoaded', async () => {
    checkAdminStatus();
    await syncAuthenticatedUser();
    updateNavRequestCount();
});


