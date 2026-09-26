/**
 * SCIENCE & IT CLUB - SHARED ADMIN LOGIC
 * Authentication gating, sidebar toggle, stats synchronizer, toast alerts, and action helpers.
 */

// Normalize /admin URL to /admin/ to prevent broken relative URLs
if (window.location.pathname.endsWith('/admin')) {
  window.location.replace(window.location.pathname + '/' + window.location.search);
}

// ── Admin Toast Notification (defined here so all admin pages work without main.js) ──
window.showToast = function(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem;';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const colors = {
    success: 'rgba(16,185,129,0.15)',
    error:   'rgba(239,68,68,0.15)',
    info:    'rgba(6,182,212,0.15)',
    warning: 'rgba(245,158,11,0.15)'
  };
  const borders = {
    success: '#10b981', error: '#ef4444', info: '#06b2d4', warning: '#f59e0b'
  };
  const toast = document.createElement('div');
  toast.style.cssText = `
    background:${colors[type]||colors.info};
    border:1px solid ${borders[type]||borders.info};
    border-radius:10px;
    padding:0.75rem 1.1rem;
    color:#f8fafc;
    font-size:0.88rem;
    display:flex;
    align-items:center;
    gap:0.6rem;
    backdrop-filter:blur(12px);
    box-shadow:0 4px 20px rgba(0,0,0,0.3);
    max-width:340px;
    animation:fadeInUp 0.3s ease;
    transition:opacity 0.3s,transform 0.3s;
  `;
  toast.innerHTML = `<span style="font-size:1rem;">${icons[type]||icons.info}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(16px)';
    setTimeout(() => toast.remove(), 320);
  }, 3800);
};

// ── Global Modal Helpers (also used by admin pages) ──
window.openModal = window.openModal || function(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
};
window.closeModal = window.closeModal || function(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
};
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

window.AdminApp = {
  init: async function() {
    // Reliable auth check: wait for Firebase onAuthStateChanged OR local session
    // (whichever comes first, with a max 3s timeout)
    await this._waitForAuth();

    const user = ClubAuth.currentUser;
    if (!user) {
      const page = 'admin/' + (window.location.pathname.split('/').pop() || 'index.html') + window.location.search;
      window.location.href = '../login.html?redirect=' + encodeURIComponent(page);
      return;
    }

    const HARDCODED_ADMIN_UIDS = ['Hmv08XzSqDSvVmYQuijqaEYg0MX2'];
    const HARDCODED_ADMIN_EMAILS = ['dprogram057@gmail.com', 'stechnical121@gmail.com'];
    const isHardcoded = user && (
      HARDCODED_ADMIN_UIDS.includes(user.uid) ||
      HARDCODED_ADMIN_EMAILS.includes((user.email || '').toLowerCase().trim())
    );
    const role = isHardcoded ? 'headAdmin' : (ClubAuth.userRole || user.role || '');
    if (isHardcoded) {
      ClubAuth.userRole = 'headAdmin';
      user.role = 'headAdmin';
      try {
        localStorage.setItem('CLUB_CURRENT_USER_SESSION', JSON.stringify(user));
        ClubDB.set(`headAdmin/${user.uid}`, true);
        ClubDB.set(`admins/${user.uid}`, true);
      } catch (_) {}
    } else if (role !== 'admin' && role !== 'headAdmin') {
      showToast('Access Denied: Administrator privileges required.', 'error');
      setTimeout(() => { window.location.href = '../index.html'; }, 1500);
      return;
    }

    this.updateAdminHeader();
    this.bindSidebar();
    this.refreshBadgeCounts();
    document.dispatchEvent(new CustomEvent('club-auth-changed', { detail: { user, role } }));
  },

  /** Wait for live Firebase Auth to confirm session with server (max 2.5s) */
  _waitForAuth: function() {
    const HARDCODED_ADMIN_UIDS = ['Hmv08XzSqDSvVmYQuijqaEYg0MX2'];
    const HARDCODED_ADMIN_EMAILS = ['dprogram057@gmail.com', 'stechnical121@gmail.com'];

    // 1. Instant local restore for immediate UI rendering
    try {
      const saved = localStorage.getItem('CLUB_CURRENT_USER_SESSION');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.uid) {
          const isMaster = HARDCODED_ADMIN_UIDS.includes(parsed.uid) ||
            HARDCODED_ADMIN_EMAILS.includes((parsed.email || '').toLowerCase().trim());
          if (isMaster) parsed.role = 'headAdmin';
          if (!ClubAuth.currentUser) {
            ClubAuth.currentUser = parsed;
            ClubAuth.userRole = parsed.role || 'member';
          }
        }
      }
    } catch (_) {}

    // 2. Wait for live Firebase Auth state to confirm token with Firebase server
    return new Promise((resolve) => {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        if (firebase.auth().currentUser) {
          resolve();
          return;
        }
        let done = false;
        const unsub = firebase.auth().onAuthStateChanged((fbUser) => {
          if (!done) {
            done = true;
            try { unsub(); } catch (_) {}
            resolve();
          }
        });
        setTimeout(() => {
          if (!done) {
            done = true;
            try { unsub(); } catch (_) {}
            resolve();
          }
        }, 2500);
        return;
      }
      resolve();
    });
  },

  updateAdminHeader: function() {
    const user = ClubAuth.currentUser;
    if (!user) return;

    const nameEl   = document.getElementById('adminCurrentUserName');
    const roleEl   = document.getElementById('adminCurrentUserRole');
    const avatarEl = document.getElementById('adminCurrentUserAvatar');

    if (nameEl)   nameEl.textContent = user.displayName || user.email || 'Admin';
    if (roleEl) {
      const role = ClubAuth.userRole || user.role || 'admin';
      roleEl.textContent = role === 'headAdmin' ? 'HEAD ADMIN' : role.toUpperCase();
      roleEl.className = role === 'headAdmin' ? 'badge badge-rose' : 'badge badge-purple';
    }
    if (avatarEl) avatarEl.src = user.photoURL || '../assets/logo/club_logo.png';

    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) logoutBtn.onclick = () => ClubAuth.logout();
  },

  bindSidebar: function() {
    const toggleBtn = document.getElementById('adminSidebarToggle');
    const sidebar   = document.getElementById('adminSidebar') || document.querySelector('.admin-sidebar');
    const overlay   = document.getElementById('adminSidebarOverlay');

    function openSidebar() {
      if (sidebar) sidebar.classList.add('active');
      if (overlay) overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
      if (sidebar) sidebar.classList.remove('active');
      if (overlay) overlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    if (toggleBtn) toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar && sidebar.classList.contains('active') ? closeSidebar() : openSidebar();
    });

    if (overlay) overlay.addEventListener('click', closeSidebar);

    // Close on nav link click (mobile)
    if (sidebar) {
      sidebar.querySelectorAll('.admin-nav-item').forEach(link => {
        link.addEventListener('click', () => {
          if (window.innerWidth <= 991) closeSidebar();
        });
      });
    }
  },

  refreshBadgeCounts: async function() {
    try {
      const ideas = (await ClubDB.get('ideas')) || {};
      const pendingIdeas = Object.values(ideas).filter(i => i.status === 'pending').length;
      const ideaBadge = document.getElementById('sidebarPendingIdeasBadge');
      if (ideaBadge) {
        ideaBadge.textContent = pendingIdeas;
        ideaBadge.style.display = pendingIdeas > 0 ? 'inline-block' : 'none';
      }
    } catch (e) {}

    try {
      const [feedback, voices] = await Promise.all([
        ClubDB.get('feedback').catch(() => ({})),
        ClubDB.get('voices').catch(() => ({}))
      ]);
      const pendingFb = Object.values(feedback || {}).filter(f => f && f.status === 'pending').length;
      const pendingV = Object.values(voices || {}).filter(v => v && v.status === 'pending').length;
      const totalPending = pendingFb + pendingV;
      const voiceBadge = document.getElementById('sidebarPendingVoicesBadge');
      if (voiceBadge) {
        voiceBadge.textContent = totalPending;
        voiceBadge.style.display = totalPending > 0 ? 'inline-block' : 'none';
      }
    } catch (e) {}

    try {
      const messages = (await ClubDB.get('messages')) || {};
      const unreadMsgs = Object.values(messages).filter(m => m.status === 'unread').length;
      const msgBadge = document.getElementById('sidebarUnreadMsgsBadge');
      if (msgBadge) {
        msgBadge.textContent = unreadMsgs;
        msgBadge.style.display = unreadMsgs > 0 ? 'inline-block' : 'none';
      }
    } catch (e) {}

    try {
      const members = (await ClubDB.get('users')) || {};
      const memberCount = Object.keys(members).length;
      const memberBadge = document.getElementById('sidebarMemberCount');
      if (memberBadge) memberBadge.textContent = memberCount;
    } catch (e) {}
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AdminApp.init();
});
