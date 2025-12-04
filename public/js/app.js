const API_BASE = '/api';
const NOTIFICATION_PREFS_KEY = 'skillswap_notification_prefs';

function getNotificationPrefs() {
    try {
        const prefs = localStorage.getItem(NOTIFICATION_PREFS_KEY);
        return prefs ? JSON.parse(prefs) : {
            sessionRequests: true,
            sessionStatus: true,
            messages: true,
            reviews: true,
            announcements: true
        };
    } catch (e) {
        return {
            sessionRequests: true,
            sessionStatus: true,
            messages: true,
            reviews: true,
            announcements: true
        };
    }
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

function setCookie(name, value) {
    document.cookie = `${name}=${value}; path=/`;
}

function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

let sessionInvalidated = false;

async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const defaults = {
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
    };

    const config = { ...defaults, ...options };
    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (response.status === 401 && !sessionInvalidated) {
            sessionInvalidated = true;
            clearSessionCookies();
            if (navBadgeInterval) {
                clearInterval(navBadgeInterval);
                navBadgeInterval = null;
            }
            const currentPage = window.location.pathname;
            if (currentPage !== '/login.html' && currentPage !== '/register.html' && currentPage !== '/index.html') {
                window.location.href = '/login.html?expired=1';
            }
        }
        
        return { response, data };
    } catch (error) {
        console.error('API call failed:', error);
        return { error: error.message };
    }
}

function clearSessionCookies() {
    deleteCookie('sessionId');
    deleteCookie('sessionToken');
}

function isLoggedIn() {
    const cookie = getCookie('sessionId');
    return cookie !== null && cookie !== '';
}

async function requireAuth() {
    if (sessionInvalidated) {
        return false;
    }

    if (!isLoggedIn()) {
        window.location.href = '/login.html';
        return false;
    }

    try {
        const { data, response } = await apiCall('/dashboard');
        if (sessionInvalidated) {
            return false;
        }
        
        if (data.error) {
            if (data.error === 'Unauthorized' || response?.status === 401) {
                return false;
            }

            if (data.banned || response?.status === 403) {
                const reason = encodeURIComponent(data.banReason || 'Your account has been banned from using SkillSwap. Please contact the administrator if you believe this is an error.');
                window.location.href = `/banned.html?reason=${reason}`;
                return false;
            }
        }

        const { data: banData } = await apiCall('/auth/check-ban');
        if (banData && banData.banned) {
            const reason = encodeURIComponent(banData.reason || 'Your account has been banned from using SkillSwap. Please contact the administrator if you believe this is an error.');
            window.location.href = `/banned.html?reason=${reason}`;
            return false;
        }

        return true;
    } catch (error) {
        return isLoggedIn() && !sessionInvalidated;
    }
}

async function updateNav() {
    const navLinks = document.getElementById('navLinks');
    if (!navLinks) return;

    if (isLoggedIn()) {

        try {
            const { data } = await apiCall('/dashboard');
            if (!data) throw new Error('No data');
            const isAdmin = data.user?.isAdmin || false;
            const prefs = getNotificationPrefs();

            let unreadCount = 0;
            let sessionCount = 0;
            
            // Only fetch message count if messages notifications are enabled
            if (prefs.messages) {
                try {
                    const { data: msgData } = await apiCall('/messages/unread-count');
                    if (msgData && msgData.count && msgData.count > 0) {
                        unreadCount = msgData.count;
                    }
                } catch (e) {}
            }

            // Only fetch session count if session notifications are enabled
            if (prefs.sessionRequests || prefs.sessionStatus) {
                try {
                    const { data: sessionData } = await apiCall('/sessions/notification-count');
                    if (sessionData && sessionData.count && sessionData.count > 0) {
                        sessionCount = sessionData.count;
                    }
                } catch (e) {}
            }

            const badgeStyle = 'border-radius: 12px; padding: 0.125rem 0.5rem; font-size: 0.75rem; font-weight: bold; margin-left: 4px;';
            
            // Only show badges if respective notifications are enabled
            const showSessionBadge = (prefs.sessionRequests || prefs.sessionStatus) && sessionCount > 0;
            const showMessageBadge = prefs.messages && unreadCount > 0;
            
            navLinks.innerHTML = `
                <li><a href="/dashboard.html">Dashboard <span id="nav-session-badge" style="background: var(--warning); color: white; ${badgeStyle} display: ${showSessionBadge ? 'inline' : 'none'};">${sessionCount}</span></a></li>
                <li><a href="/search.html">Search Tutors</a></li>
                <li><a href="/profile.html">My Profile</a></li>
                <li><a href="/messages.html">Messages <span id="nav-message-badge" style="background: var(--danger); color: white; ${badgeStyle} display: ${showMessageBadge ? 'inline' : 'none'};">${unreadCount}</span></a></li>
                ${isAdmin ? '<li><a href="/admin.html">Admin</a></li>' : ''}
                <li><a href="#" onclick="logout()">Logout</a></li>
            `;
        } catch (error) {

            navLinks.innerHTML = `
                <li><a href="/dashboard.html">Dashboard</a></li>
                <li><a href="/search.html">Search Tutors</a></li>
                <li><a href="/profile.html">My Profile</a></li>
                <li><a href="/messages.html">Messages</a></li>
                <li><a href="#" onclick="logout()">Logout</a></li>
            `;
        }
    } else {
        navLinks.innerHTML = `
            <li><a href="/login.html">Login</a></li>
            <li><a href="/register.html">Register</a></li>
        `;
    }
}

async function logout() {
    sessionInvalidated = true;
    await apiCall('/auth/logout', { method: 'POST' });
    clearSessionCookies();
    window.location.href = '/index.html';
}

let navBadgeInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    updateNav();
    createNotificationContainer();
    
    const currentPage = window.location.pathname;
    const publicPages = ['/login.html', '/register.html', '/index.html', '/banned.html'];
    
    if (isLoggedIn() && !publicPages.includes(currentPage)) {
        navBadgeInterval = setInterval(updateNavBadges, 1000);
    }
});

async function updateNavBadges() {
    if (!isLoggedIn() || sessionInvalidated) return;
    
    const prefs = getNotificationPrefs();
    
    try {
        const sessionBadgeEl = document.getElementById('nav-session-badge');
        const messageBadgeEl = document.getElementById('nav-message-badge');
        
        // Only update session badge if session notifications are enabled
        if (sessionBadgeEl && !sessionInvalidated) {
            if (prefs.sessionRequests || prefs.sessionStatus) {
                try {
                    const { data: sessionData } = await apiCall('/sessions/notification-count');
                    if (sessionInvalidated) return;
                    if (sessionData && sessionData.count && sessionData.count > 0) {
                        sessionBadgeEl.textContent = sessionData.count;
                        sessionBadgeEl.style.display = 'inline';
                    } else {
                        sessionBadgeEl.style.display = 'none';
                    }
                } catch (e) {}
            } else {
                // Notifications disabled - hide the badge
                sessionBadgeEl.style.display = 'none';
            }
        }
        
        // Only update message badge if message notifications are enabled
        if (messageBadgeEl && !sessionInvalidated) {
            if (prefs.messages) {
                try {
                    const { data: msgData } = await apiCall('/messages/unread-count');
                    if (sessionInvalidated) return;
                    if (msgData && msgData.count && msgData.count > 0) {
                        messageBadgeEl.textContent = msgData.count;
                        messageBadgeEl.style.display = 'inline';
                    } else {
                        messageBadgeEl.style.display = 'none';
                    }
                } catch (e) {}
            } else {
                // Notifications disabled - hide the badge
                messageBadgeEl.style.display = 'none';
            }
        }
    } catch (e) {}
}

function createNotificationContainer() {
    if (!document.getElementById('notification-container')) {
        const container = document.createElement('div');
        container.id = 'notification-container';
        document.body.appendChild(container);
    }
}

function showNotification(message, type = 'info', title = '') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;

    let icon = 'ℹ️';
    let defaultTitle = 'Info';

    switch(type) {
        case 'success': icon = '✅'; defaultTitle = 'Success'; break;
        case 'error': icon = '❌'; defaultTitle = 'Error'; break;
        case 'warning': icon = '⚠️'; defaultTitle = 'Warning'; break;
    }

    if (!title) title = defaultTitle;

    toast.innerHTML = `
        <div class="notification-icon">${icon}</div>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    if (type === 'success') playSound('success');
    if (type === 'error') playSound('error');

    setTimeout(() => {
        toast.style.animation = 'fadeOutRight 0.3s ease-in forwards';
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 300);
    }, 5000);
}

function showConfirm(message, title = 'Please Confirm') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';

        overlay.innerHTML = `
            <div class="custom-confirm-box">
                <div class="confirm-title">${title}</div>
                <div class="confirm-message">${message}</div>
                <div class="confirm-actions">
                    <button class="btn btn-secondary" id="confirm-cancel-btn">Cancel</button>
                    <button class="btn btn-primary" id="confirm-ok-btn">Confirm</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const cancelBtn = overlay.querySelector('#confirm-cancel-btn');
        const okBtn = overlay.querySelector('#confirm-ok-btn');

        okBtn.focus();

        const close = (result) => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                if (overlay.parentElement) overlay.remove();
                resolve(result);
            }, 200);
        };

        cancelBtn.onclick = () => close(false);
        okBtn.onclick = () => close(true);

        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleEsc);
                close(false);
            }
        };
        document.addEventListener('keydown', handleEsc);

        overlay.onclick = (e) => {
            if (e.target === overlay) close(false);
        };
    });
}

function showPrompt(message, defaultValue = '', title = 'Input Required') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';

        overlay.innerHTML = `
            <div class="custom-confirm-box">
                <div class="confirm-title">${title}</div>
                <div class="confirm-message">${message}</div>
                <div class="form-group">
                    <input type="text" class="form-control" id="prompt-input" value="${defaultValue}">
                </div>
                <div class="confirm-actions">
                    <button class="btn btn-secondary" id="prompt-cancel-btn">Cancel</button>
                    <button class="btn btn-primary" id="prompt-ok-btn">OK</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const input = overlay.querySelector('#prompt-input');
        const cancelBtn = overlay.querySelector('#prompt-cancel-btn');
        const okBtn = overlay.querySelector('#prompt-ok-btn');

        input.focus();
        input.select();

        const close = (result) => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                if (overlay.parentElement) overlay.remove();
                resolve(result);
            }, 200);
        };

        cancelBtn.onclick = () => close(null);
        okBtn.onclick = () => close(input.value);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                close(input.value);
            }
        });

        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleEsc);
                close(null);
            }
        };
        document.addEventListener('keydown', handleEsc);

        overlay.onclick = (e) => {
            if (e.target === overlay) close(null);
        };
    });
}

function playSound(type) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);
        }
    } catch (e) {

    }
}
