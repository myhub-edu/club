/**
 * SCIENCE & IT CLUB - NOTIFICATIONS ENGINE v2.0
 * • Real-time RTDB listeners for instant in-app updates
 * • Browser/Android Web Notification API for OS-level push
 * • Batched mark-all-read using Firebase multi-path update
 * • Smart deduplication of global + personal notifications
 * • Correct unread badge on bell icon
 */

/** Low-level push helpers used by auth.js and other modules */
window.ClubNotifs = {
  _pushPersonal: async function(uid, { title, message, priority = 'normal', url = '' }) {
    if (!uid) return;
    try {
      // Smart dedup: if identical title was sent in the last 20 seconds, skip duplicate.
      // If title is Welcome, ensure it is only sent once per user lifetime.
      const existing = (await ClubDB.get(`notifications/users/${uid}`)) || {};
      const isWelcome = title && title.includes('Welcome');
      const duplicate = Object.values(existing).some(n => {
        if (!n) return false;
        if (isWelcome && n.title && n.title.includes('Welcome')) return true;
        return n.title === title && (Date.now() - (n.createdAt || 0)) < 20000;
      });
      if (duplicate) return;
    } catch (_) {}

    const payload = { title, message, priority, createdAt: Date.now(), createdBy: 'System', uid };
    if (url) payload.url = url;
    await ClubDB.push(`notifications/users/${uid}`, payload);
    // Show OS notification if we have permission
    if (window.ClubWebPush) {
      const defUrl = window.location.pathname.includes('/admin/') ? '../notifications.html' : 'notifications.html';
      ClubWebPush.show(title, message, { urgent: priority === 'important', url: url || defUrl });
    }
  },
  _pushGlobal: async function({ title, message, priority = 'normal', createdBy = 'Club Administration', url = '' }) {
    try {
      const existing = (await ClubDB.get('notifications/global')) || {};
      const duplicate = Object.values(existing).some(n =>
        n && n.title === title && (Date.now() - (n.createdAt || 0)) < 20000
      );
      if (duplicate) return;
    } catch (_) {}

    const payload = { title, message, priority, createdAt: Date.now(), createdBy };
    if (url) payload.url = url;
    await ClubDB.push('notifications/global', payload);
    if (window.ClubWebPush) {
      const defUrl = window.location.pathname.includes('/admin/') ? '../notifications.html' : 'notifications.html';
      ClubWebPush.show(title, message, { urgent: priority === 'important', url: url || defUrl });
    }
  },

  /**
   * Notify every admin and headAdmin user.
   * @param {string} title  - Notification title
   * @param {string} message - Notification body
   * @param {string} [url]  - Admin page to open on click (relative to /admin/)
   * @param {string} [priority] - 'normal' | 'important'
   */
  notifyAllAdmins: async function(title, message, url = 'messages.html', priority = 'important', excludeUid = null) {
    try {
      const users = (await ClubDB.get('users')) || {};
      let adminIds = Object.values(users)
        .filter(u => u && (u.role === 'admin' || u.role === 'headAdmin'))
        .map(u => u.uid);

      if (adminIds.length === 0) {
        // Fallback: check admins node
        const adminsNode = (await ClubDB.get('admins')) || {};
        adminIds.push(...Object.keys(adminsNode));
        const headNode = (await ClubDB.get('headAdmin')) || {};
        Object.keys(headNode).forEach(id => { if (!adminIds.includes(id)) adminIds.push(id); });
      }

      if (excludeUid) {
        adminIds = adminIds.filter(id => id !== excludeUid);
      }

      const payload = {
        title,
        message,
        priority,
        createdAt: Date.now(),
        createdBy: 'Club System',
        adminUrl: url
      };

      await Promise.all(adminIds.map(uid =>
        ClubDB.push(`notifications/users/${uid}`, payload).catch(() => {})
      ));

      // OS push for admins currently browsing
      if (window.ClubWebPush && ClubWebPush._canPush()) {
        const currentUser = window.ClubAuth && ClubAuth.currentUser;
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'headAdmin') && currentUser.uid !== excludeUid) {
          const adminPref = window.location.pathname.includes('/admin/') ? '' : 'admin/';
          ClubWebPush.show(title, message, {
            urgent: priority === 'important',
            url: adminPref + url,
            tag: 'admin_' + Date.now()
          });
        }
      }
    } catch (err) {
      console.warn('notifyAllAdmins error:', err);
    }
  },

  /**
   * Broadcast a global notification to ALL club members/students.
   * Used when admin publishes, updates, or removes events/announcements.
   * @param {string} title - Notification title
   * @param {string} message - Notification body
   * @param {string} [url] - Page to open when user taps notification
   * @param {string} [priority] - 'normal' | 'important'
   */
  notifyAllMembers: async function(title, message, url = 'events.html', priority = 'normal') {
    try {
      // Push to global notifications feed (all members see this)
      const payload = {
        title,
        message,
        priority,
        createdAt: Date.now(),
        createdBy: 'Club Administration',
        url
      };
      await ClubDB.push('notifications/global', payload);

      // Also push OS-level web notification if admin is online & browser has permission
      if (window.ClubWebPush && ClubWebPush._canPush()) {
        ClubWebPush.show(title, message, {
          urgent: priority === 'important',
          url,
          tag: 'event_update_' + Date.now()
        });
      }
    } catch (err) {
      console.warn('notifyAllMembers error:', err);
    }
  }
};

window.ClubNotifications = {
  notifications: [],
  unreadCount: 0,
  _unsubscribeGlobal: null,
  _unsubscribePersonal: null,
  _lastShownNotifTime: 0,

  init: async function() {
    this.bindUI();

    // Wait for Firebase auth to resolve before first fetch so logged-in
    // members always get their personal notifications on page load.
    if (typeof firebase !== 'undefined' && firebase.auth) {
      await new Promise((resolve) => {
        if (firebase.auth().currentUser) { resolve(); return; }
        let done = false;
        const unsub = firebase.auth().onAuthStateChanged(() => {
          if (!done) { done = true; try { unsub(); } catch (_) {} resolve(); }
        });
        setTimeout(() => { if (!done) { done = true; try { unsub(); } catch (_) {} resolve(); } }, 2500);
      });
    }

    // Seed _lastShownNotifTime so old notifications don't trigger OS pop-ups on load.
    this._lastShownNotifTime = Date.now();

    await this.fetchAndRender();
    this._startRealtimeListeners();

    // Ask for Web Push permission once per session
    if (window.ClubWebPush) {
      ClubWebPush.promptOnce();
    }

    // React to local store updates
    let _notifUpdateTimer = null;
    window.addEventListener('club-db-updated', () => {
      clearTimeout(_notifUpdateTimer);
      _notifUpdateTimer = setTimeout(() => this.fetchAndRender(), 800);
    });

    // Re-fetch and re-listen whenever auth resolves or changes
    document.addEventListener('club-auth-changed', () => {
      this.fetchAndRender();
      this._startRealtimeListeners();
    });
  },

  _startRealtimeListeners: function() {
    const user = window.ClubAuth && ClubAuth.currentUser;

    // Tear down old listeners
    if (this._unsubscribeGlobal) { try { this._unsubscribeGlobal(); } catch (_) {} }
    if (this._unsubscribePersonal) { try { this._unsubscribePersonal(); } catch (_) {} }

    // Always listen to global announcements in real time
    if (window.ClubDB && ClubDB.isLive()) {
      this._unsubscribeGlobal = ClubDB.onValue('notifications/global', () => {
        this.fetchAndRender();
      });

      if (user && user.uid) {
        this._unsubscribePersonal = ClubDB.onValue(`notifications/users/${user.uid}`, (val) => {
          this.fetchAndRender();
          // Show OS notification for brand-new personal notifs
          if (val && typeof val === 'object') {
            const entries = Object.values(val);
            const newest = entries.reduce((a, b) => ((b.createdAt || 0) > (a.createdAt || 0) ? b : a), {});
            if (newest && newest.createdAt && newest.createdAt > this._lastShownNotifTime && newest.createdAt > (Date.now() - 30000)) {
              this._lastShownNotifTime = newest.createdAt;
              if (window.ClubWebPush) {
                const notifPref = window.location.pathname.includes('/admin/') ? '../notifications.html' : 'notifications.html';
                ClubWebPush.show(newest.title || 'New Notification', newest.message || '', {
                  urgent: newest.priority === 'important',
                  url: notifPref,
                  tag: 'personal_' + newest.createdAt
                });
              }
            }
          }
        });
      }
    }
  },

  bindUI: function() {
    const bellBtn      = document.getElementById('notifBellBtn');
    const notifDropdown= document.getElementById('notifDropdown');
    const markAllBtn   = document.getElementById('markAllReadBtn');

    if (bellBtn && notifDropdown) {
      bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = notifDropdown.classList.contains('show');
        notifDropdown.classList.toggle('show', !isOpen);
        // Auto-mark visible as read when opening
        if (!isOpen) setTimeout(() => this.markAllAsRead(), 1000);
        const userMenu = document.getElementById('userMenuDropdown');
        if (userMenu) userMenu.classList.remove('show');
      });
    }

    if (markAllBtn) {
      markAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.markAllAsRead();
      });
    }

    document.addEventListener('click', (e) => {
      if (notifDropdown && !notifDropdown.contains(e.target) && e.target !== bellBtn) {
        notifDropdown.classList.remove('show');
      }
    });
  },

  fetchAndRender: async function() {
    const user = window.ClubAuth && ClubAuth.currentUser;
    const uid = user ? user.uid : null;

    const [globalNotifs, userNotifs, readReceipts] = await Promise.all([
      ClubDB.get('notifications/global').catch(() => ({})),
      uid ? ClubDB.get(`notifications/users/${uid}`).catch(() => ({})) : Promise.resolve({}),
      uid ? ClubDB.get(`notificationReads/${uid}`).catch(() => ({})) : Promise.resolve({})
    ]);

    const g = globalNotifs || {};
    const u = userNotifs || {};
    const reads = readReceipts || {};
    const list = [];
    const seenKeys = new Set();

    // 1. Personal notifications
    Object.entries(u).forEach(([key, item]) => {
      if (!item || typeof item !== 'object') return;
      const dedupeKey = (item.title || '').trim().toLowerCase() + '|' + (item.message || '').trim().toLowerCase();
      seenKeys.add(dedupeKey);
      list.push({ id: key, ...item, type: 'personal', isRead: !!reads[key] });
    });

    // 2. Global announcements (visible to all members & guests)
    Object.entries(g).forEach(([key, item]) => {
      if (!item || typeof item !== 'object') return;
      const dedupeKey = (item.title || '').trim().toLowerCase() + '|' + (item.message || '').trim().toLowerCase();
      if (seenKeys.has(dedupeKey)) return; // Deduplicate if broadcast was also sent personally
      seenKeys.add(dedupeKey);
      list.push({ id: key, ...item, type: 'global', isRead: !!reads[key] });
    });

    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    this.notifications = list;
    this.unreadCount = list.filter(n => !n.isRead).length;

    this.updateBadges();
    this.renderDropdown();
    this.renderFullPageList();
  },

  updateBadges: function() {
    const badge = document.getElementById('unreadNotifCount');
    if (!badge) return;
    if (this.unreadCount > 0) {
      badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  },

  getTargetUrl: function(n) {
    if (!n) return 'notifications.html';
    const isInAdmin = window.location.pathname.includes('/admin/');
    const rootPrefix = isInAdmin ? '../' : '';
    const adminPrefix = isInAdmin ? '' : 'admin/';

    // Admin-directed notifications
    if (n.adminUrl) {
      const rawAdmin = String(n.adminUrl).replace(/^\/+/, '');
      return adminPrefix + rawAdmin;
    }

    // Explicit URL provided on notification object
    if (n.url) {
      const rawUrl = String(n.url).trim().replace(/^\/+/, '');
      if (rawUrl && rawUrl !== 'notifications.html') {
        return rootPrefix + rawUrl;
      }
    }

    // Contextual smart auto-detection from notification title and content
    const text = ((n.title || '') + ' ' + (n.message || '')).toLowerCase();

    // 1. Head Admin reply / messages
    if (text.includes('reply') || text.includes('advisor replied') || text.includes('head admin') || text.includes('message thread')) {
      return rootPrefix + 'contact-admin.html';
    }
    // 2. Events & workshops
    if (text.includes('event') || text.includes('workshop') || text.includes('hackathon') || text.includes('seminar') || text.includes('webinar')) {
      return rootPrefix + 'events.html';
    }
    // 3. Projects
    if (text.includes('project') || text.includes('showcase')) {
      return rootPrefix + 'projects.html';
    }
    // 4. Student project ideas
    if (text.includes('idea') || text.includes('proposal')) {
      return rootPrefix + 'submit-idea.html';
    }
    // 5. Student Voices & Testimonials
    if (text.includes('testimonial') || text.includes('voice') || text.includes('review') || text.includes('feedback')) {
      return rootPrefix + 'voices.html';
    }
    // 6. Moments & Photo Archive
    if (text.includes('moment') || text.includes('photo') || text.includes('gallery') || text.includes('archive')) {
      return rootPrefix + 'moments.html';
    }
    // 7. Learning Resources
    if (text.includes('resource') || text.includes('learning') || text.includes('tutorial') || text.includes('guide')) {
      return rootPrefix + 'resources.html';
    }
    // 8. Welcome or Profile
    if (text.includes('welcome') || text.includes('profile')) {
      return rootPrefix + 'profile.html';
    }

    return rootPrefix + 'notifications.html';
  },

  handleNotifClick: function(event, notifId, targetUrl) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (notifId) {
      this.markAsRead(notifId);
    }
    if (targetUrl) {
      setTimeout(() => {
        window.location.href = targetUrl;
      }, 60);
    }
  },

  renderDropdown: function() {
    const container = document.getElementById('notifList');
    if (!container) return;

    if (this.notifications.length === 0) {
      container.innerHTML = `<li style="padding:1.25rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">🔔 No notifications right now.</li>`;
      return;
    }

    const isInAdmin = window.location.pathname.includes('/admin/');
    const getIcon = (n) => n.priority === 'important' ? '🚨' : (n.type === 'personal' ? '👤' : '📢');
    const shown  = this.notifications.slice(0, 6);
    const extra  = this.notifications.length - shown.length;

    container.innerHTML = shown.map(n => {
      const targetUrl = this.getTargetUrl(n);
      const safeUrl = this.esc(targetUrl);
      return `
        <li class="notif-item ${n.isRead ? '' : 'unread'}" data-notif-id="${n.id}" onclick="ClubNotifications.handleNotifClick(event, '${n.id}', '${safeUrl}')">
          <div class="notif-item-title">
            <span>${getIcon(n)} ${this.esc(n.title)}</span>
            <span class="notif-item-time">${this.timeAgo(n.createdAt)}</span>
          </div>
          <div class="notif-item-desc">${this.esc(n.message)}</div>
          <div class="notif-item-actions">
            <a href="${safeUrl}" class="notif-view-btn" onclick="ClubNotifications.handleNotifClick(event, '${n.id}', '${safeUrl}')">
              View More →
            </a>
          </div>
        </li>
      `;
    }).join('') + (extra > 0 ? `<li style="padding:0.6rem 1rem; text-align:center; font-size:0.8rem; background:rgba(0,0,0,0.15);"><a href="${isInAdmin ? '../' : ''}notifications.html" style="color:var(--accent-cyan); font-weight:600; text-decoration:none;">View all ${this.notifications.length} notifications →</a></li>` : '');
  },

  renderFullPageList: function() {
    const container = document.getElementById('fullNotificationList');
    if (!container) return;

    if (this.notifications.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align:center; padding:3rem 1.5rem;">
          <div style="font-size:3rem; margin-bottom:1rem;">🔔</div>
          <h3>All Caught Up!</h3>
          <p style="color:var(--text-muted); margin-top:0.5rem;">No notifications yet. Announcements & personal updates will appear here.</p>
        </div>`;
      return;
    }

    container.innerHTML = this.notifications.map(n => {
      const targetUrl = this.getTargetUrl(n);
      const safeUrl = this.esc(targetUrl);
      return `
      <div class="card" style="margin-bottom:1rem; border-left:${n.isRead ? '1px solid var(--border-subtle)' : '4px solid ' + (n.priority==='important' ? 'var(--accent-rose)' : 'var(--accent-cyan)')}; transition: opacity 0.3s;" id="notif-card-${n.id}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem; gap:1rem; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            ${n.priority === 'important' ? '<span class="badge badge-rose">🚨 Urgent</span>' : '<span class="badge badge-cyan">📢 Update</span>'}
            ${n.type === 'personal' ? '<span class="badge badge-purple">👤 Personal</span>' : ''}
            <h4 style="font-size:1rem; color:var(--text-primary);">${this.esc(n.title)}</h4>
          </div>
          <span style="font-size:0.72rem; color:var(--text-muted); white-space:nowrap;">${n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</span>
        </div>
        <p style="font-size:0.92rem; margin-bottom:0.75rem; color:var(--text-secondary); line-height:1.55;">${this.esc(n.message)}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.78rem; color:var(--text-muted); flex-wrap:wrap; gap:0.5rem; margin-top:0.5rem;">
          <span>By: ${this.esc(n.createdBy || 'Club Administration')}</span>
          <div style="display:flex; align-items:center; gap:0.65rem;">
            <a href="${safeUrl}" class="notif-view-btn" style="padding:0.32rem 0.8rem; font-size:0.8rem;" onclick="ClubNotifications.handleNotifClick(event, '${n.id}', '${safeUrl}')">
              View More →
            </a>
            ${!n.isRead
              ? `<button class="btn btn-sm btn-outline" onclick="ClubNotifications.markAsRead('${n.id}')">Mark as read ✓</button>`
              : `<span style="color:var(--accent-emerald); font-size:0.82rem; margin-left:0.25rem;">✓ Read</span>`}
          </div>
        </div>
      </div>
    `;
    }).join('');
  },

  markAsRead: async function(notifId) {
    const user = window.ClubAuth && ClubAuth.currentUser;
    // Optimistic UI update
    const n = this.notifications.find(n => n.id === notifId);
    if (n) n.isRead = true;
    this.unreadCount = Math.max(0, this.unreadCount - 1);
    this.updateBadges();
    const card = document.getElementById('notif-card-' + notifId);
    if (card) card.style.borderLeft = '1px solid var(--border-subtle)';

    if (user && user.uid) {
      await ClubDB.set(`notificationReads/${user.uid}/${notifId}`, true);
    }
    this.renderDropdown();
    this.renderFullPageList();
  },

  markAllAsRead: async function() {
    const user = window.ClubAuth && ClubAuth.currentUser;
    const unread = this.notifications.filter(n => !n.isRead);
    if (unread.length === 0) return;

    // Optimistic
    unread.forEach(n => n.isRead = true);
    this.unreadCount = 0;
    this.updateBadges();
    this.renderDropdown();
    this.renderFullPageList();

    // Persist if logged in
    if (user && user.uid) {
      await Promise.all(
        unread.map(n => ClubDB.set(`notificationReads/${user.uid}/${n.id}`, true))
      );
    }
    if (typeof showToast === 'function') showToast("All notifications marked as read.", "success");
  },

  timeAgo(ts) {
    if (!ts) return '';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60)   return 'just now';
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    if (s < 86400)return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  },

  esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.innerText = String(str);
    return d.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ClubNotifications.init();
});
