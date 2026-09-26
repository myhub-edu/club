/**
 * SCIENCE & IT CLUB - FIREBASE & UNIFIED DATA STORE v3.0
 * Supports Live Firebase Realtime DB + Seamless Offline/Demo Store
 * Fixed: Push returns consistent {id}, real-time onValue, timeout tuned,
 *        root-path get, smart merge, browser Web Notification API integration.
 */

const firebaseConfig = {
  apiKey: "AIzaSyDUKFe5a4_FshRAgMAxp297hae2bPlJTDs",
  authDomain: "studio-8470850847-5d1ba.firebaseapp.com",
  projectId: "studio-8470850847-5d1ba",
  storageBucket: "studio-8470850847-5d1ba.firebasestorage.app",
  messagingSenderId: "35752428546",
  appId: "1:35752428546:web:3d0ab0e5cb5f0dca83531b",
  databaseURL: "https://studio-8470850847-5d1ba-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// ── Seed Data (Pure online schema: all collections start empty) ──────────────
const SEED_DATA = {
  users: {},
  admins: {
    "Hmv08XzSqDSvVmYQuijqaEYg0MX2": true
  },
  headAdmin: {
    "Hmv08XzSqDSvVmYQuijqaEYg0MX2": true
  },
  projects: {},
  events: {},
  moments: {},
  voices: {},
  feedback: {},
  ideas: {},
  resources: {},
  notifications: {
    global: {},
    users: {}
  },
  notificationReads: {},
  messages: {},
  leadership: {}, // Pure online collection: zero fake face data
  settings: {
    clubName: "Science & IT Club",
    institution: "Liverpool International Secondary College",
    schedule: "Tuesdays & Fridays, 3:30 PM - 5:00 PM",
    labLocation: "Innovation Center (Room 204) & Maker Lab",
    tagline: "Empowering Students to Engineer Tomorrow",
    contactEmail: "stem-club@liverpool.edu",
    noticeBanner: ""
  }
};

// ── Firebase Init ─────────────────────────────────────────────────────────
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let isFirebaseLive = false;

try {
  if (typeof firebase !== 'undefined') {
    firebaseApp = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
    firebaseAuth = firebase.auth();
    firebaseDb = firebase.database();
    isFirebaseLive = true;
  }
} catch (e) {
  console.warn("Firebase init note:", e.message);
}

// ── Local Store (V5: Pure Online Mirror - Zero offline mock injection) ────
const LOCAL_STORAGE_KEY = "CLUB_WEB_DB_STORE_V5";
// Clear stale V1-V4 cache
['CLUB_WEB_DB_STORE_V1', 'CLUB_WEB_DB_STORE_V2', 'CLUB_WEB_DB_STORE_V3', 'CLUB_WEB_DB_STORE_V4'].forEach(k => {
  try { localStorage.removeItem(k); } catch (_) {}
});

function getLocalStore() {
  try {
    const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!existing) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SEED_DATA));
      return JSON.parse(JSON.stringify(SEED_DATA)); // deep clone
    }
    const data = JSON.parse(existing);
    let updated = false;

    // Purge any residual hardcoded fake IDs
    const DEMO_PROJECTS = ['proj001', 'proj002', 'proj003'];
    const DEMO_EVENTS = ['event001', 'event002'];
    const DEMO_MOMENTS = ['mom001', 'mom002', 'mom003', 'mom004'];
    const DEMO_VOICES = ['voice001', 'voice002'];
    const DEMO_RESOURCES = ['res001', 'res002', 'res003'];
    const DEMO_LEADERS = ['lead001', 'lead002', 'lead003'];
    const DEMO_IDS = ['demo-member-1', 'demo-admin-1', 'demo-head-1'];

    if (data.projects) {
      DEMO_PROJECTS.forEach(id => { if (data.projects[id]) { delete data.projects[id]; updated = true; } });
    }
    if (data.events) {
      DEMO_EVENTS.forEach(id => { if (data.events[id]) { delete data.events[id]; updated = true; } });
    }
    if (data.moments) {
      DEMO_MOMENTS.forEach(id => { if (data.moments[id]) { delete data.moments[id]; updated = true; } });
    }
    if (data.voices) {
      DEMO_VOICES.forEach(id => { if (data.voices[id]) { delete data.voices[id]; updated = true; } });
    }
    if (data.resources) {
      DEMO_RESOURCES.forEach(id => { if (data.resources[id]) { delete data.resources[id]; updated = true; } });
    }
    if (data.leadership) {
      DEMO_LEADERS.forEach(id => { if (data.leadership[id]) { delete data.leadership[id]; updated = true; } });
    }
    if (data.users) {
      DEMO_IDS.forEach(id => { if (data.users[id]) { delete data.users[id]; updated = true; } });
    }
    if (data.admins) {
      DEMO_IDS.forEach(id => { if (data.admins[id]) { delete data.admins[id]; updated = true; } });
    }
    if (data.headAdmin) {
      DEMO_IDS.forEach(id => { if (data.headAdmin[id]) { delete data.headAdmin[id]; updated = true; } });
    }
    if (data.notifications && data.notifications.global) {
      if (data.notifications.global['noti001']) { delete data.notifications.global['noti001']; updated = true; }
      if (data.notifications.global['noti002']) { delete data.notifications.global['noti002']; updated = true; }
    }

    // Ensure collections exist as objects
    for (const key of ['projects', 'events', 'moments', 'voices', 'feedback', 'ideas', 'resources', 'users', 'admins', 'headAdmin', 'settings', 'leadership']) {
      if (!data[key]) { data[key] = {}; updated = true; }
    }
    if (!data.notificationReads) { data.notificationReads = {}; updated = true; }
    if (!data.notifications) { data.notifications = { global: {}, users: {} }; updated = true; }
    if (!data.notifications.global) { data.notifications.global = {}; updated = true; }
    if (!data.notifications.users) { data.notifications.users = {}; updated = true; }

    if (!data.admins['Hmv08XzSqDSvVmYQuijqaEYg0MX2']) {
      data.admins['Hmv08XzSqDSvVmYQuijqaEYg0MX2'] = true;
      updated = true;
    }
    if (!data.headAdmin['Hmv08XzSqDSvVmYQuijqaEYg0MX2']) {
      data.headAdmin['Hmv08XzSqDSvVmYQuijqaEYg0MX2'] = true;
      updated = true;
    }
    if (updated) localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    return data;
  } catch (err) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SEED_DATA));
    return JSON.parse(JSON.stringify(SEED_DATA));
  }
}

function saveLocalStore(store, notify = true) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  } catch(e) { /* quota exceeded – silently skip */ }
  // Only broadcast changes made by write operations, NOT background reads
  if (notify) {
    window.dispatchEvent(new CustomEvent('club-db-updated', { detail: store }));
  }
}

/** Traverse an object by path array, return { parent, key, value } */
function pathTraverse(obj, parts) {
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (curr === null || typeof curr !== 'object') return null;
    if (!curr[parts[i]]) curr[parts[i]] = {};
    curr = curr[parts[i]];
  }
  return curr;
}

window.SEED_DATA = SEED_DATA;

// ── Image Compression ─────────────────────────────────────────────────────
window.compressImageToBase64 = function(file, maxWidth = 800, maxHeight = 600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file selected"));
    if (!file.type || !file.type.startsWith('image/')) return reject(new Error("File must be an image"));
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error("Image decoding failed"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsDataURL(file);
  });
};

// ── Date Utilities ────────────────────────────────────────────────────────
window.ClubDates = {
  getTodayFormatted() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${mm}/${dd}/${d.getFullYear()}`;
  },
  parseDateString(str) {
    if (!str) return new Date();
    str = String(str).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
      const [p1, p2, y] = str.split('/').map(Number);
      return p1 > 12 ? new Date(y, p2 - 1, p1) : new Date(y, p1 - 1, p2);
    }
    const d = new Date(str);
    return isNaN(d) ? new Date() : d;
  },
  formatDisplay(str) {
    if (!str) return '';
    const d = this.parseDateString(str);
    return isNaN(d) ? str : d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  }
};

// ── Browser Web Notification Wrapper ────────────────────────────────────
window.ClubWebPush = {
  _canPush() {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted';
  },

  async requestPermission() {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
      const result = await Notification.requestPermission();
      return result === 'granted';
    } catch (_) {
      return false;
    }
  },

  /** Show an OS-level browser/Android notification */
  show(title, body, options = {}) {
    if (!this._canPush()) return null;
    try {
      const isInAdmin = window.location.pathname.includes('/admin/');
      const prefix = isInAdmin ? '../' : '';
      const logoUrl = prefix + 'assets/logo/club_logo.png';
      const n = new Notification(title, {
        body,
        icon: logoUrl,
        badge: logoUrl,
        tag: options.tag || ('club_' + Date.now()),
        requireInteraction: options.urgent || false,
        silent: false,
        ...options
      });
      // Click → navigate to the right page with URL normalization
      if (options.url) {
        let destUrl = String(options.url).trim();
        // If navigation was triggered from an admin page and url is relative to site root
        if (isInAdmin && !destUrl.startsWith('http') && !destUrl.startsWith('../') && !destUrl.startsWith('/admin') && !destUrl.startsWith('admin/')) {
          if (destUrl.startsWith('/')) destUrl = '..' + destUrl;
          else destUrl = '../' + destUrl;
        }
        // Defensive normalization for any paths missing .html extension
        if (destUrl.includes('event?') && !destUrl.includes('event.html?')) destUrl = destUrl.replace('event?', 'event.html?');
        else if (destUrl.includes('project?') && !destUrl.includes('project.html?')) destUrl = destUrl.replace('project?', 'project.html?');
        else if (destUrl.includes('events?') && !destUrl.includes('events.html?')) destUrl = destUrl.replace('events?', 'events.html?');
        else if (destUrl.includes('projects?') && !destUrl.includes('projects.html?')) destUrl = destUrl.replace('projects?', 'projects.html?');

        n.onclick = () => {
          window.focus();
          window.location.href = destUrl;
          try { n.close(); } catch (_) {}
        };
      }
      return n;
    } catch (e) {
      console.warn('[ClubWebPush] show notification failed:', e);
      return null;
    }
  },

  /** Renders an interactive, user-gesture permission prompt banner */
  showPromptBanner(force = false) {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;
    if (document.getElementById('clubPushBanner')) return;

    // Check if dismissed recently (24-hour snooze) — bypassed when forced (after login, details entered, admins)
    if (!force) {
      const dismissedUntil = localStorage.getItem('club_push_prompt_dismissed');
      if (dismissedUntil && dismissedUntil !== 'granted' && Date.now() < Number(dismissedUntil)) return;
    } else {
      localStorage.removeItem('club_push_prompt_dismissed');
    }

    const banner = document.createElement('div');
    banner.id = 'clubPushBanner';
    banner.className = 'club-push-banner';
    banner.innerHTML = `
      <div style="display: flex; gap: 0.85rem; align-items: flex-start;">
        <div style="font-size: 1.6rem; line-height: 1; padding-top: 2px;">🔔</div>
        <div style="flex: 1;">
          <div style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 0.25rem;">Enable Club Notifications?</div>
          <div style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.45;">
            Get instant alerts for new events, project blueprints, and announcements.
          </div>
        </div>
        <button id="clubPushBannerClose" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.1rem; line-height: 1; padding: 2px 4px;" title="Dismiss">✕</button>
      </div>
      <div style="display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center;">
        <button id="clubPushDismissBtn" class="btn btn-secondary btn-sm" style="padding: 0.35rem 0.85rem; font-size: 0.8rem;">Not Now</button>
        <button id="clubPushAllowBtn" class="btn btn-primary btn-sm" style="padding: 0.35rem 0.95rem; font-size: 0.8rem; font-weight: 600;">Enable Alerts</button>
      </div>
    `;

    document.body.appendChild(banner);

    const closeBanner = (days = 1) => {
      localStorage.setItem('club_push_prompt_dismissed', String(Date.now() + (days * 86400000)));
      banner.style.transition = 'opacity 0.3s, transform 0.3s';
      banner.style.opacity = '0';
      banner.style.transform = 'translateY(20px)';
      setTimeout(() => banner.remove(), 320);
    };

    const closeBtn = document.getElementById('clubPushBannerClose');
    if (closeBtn) closeBtn.onclick = () => closeBanner(1);

    const dismissBtn = document.getElementById('clubPushDismissBtn');
    if (dismissBtn) dismissBtn.onclick = () => closeBanner(1);

    const allowBtn = document.getElementById('clubPushAllowBtn');
    if (allowBtn) {
      allowBtn.onclick = async () => {
        // Direct click handler provides valid user gesture for browser permission prompt
        const granted = await window.ClubWebPush.requestPermission();
        if (granted) {
          localStorage.setItem('club_push_prompt_dismissed', 'granted');
          banner.remove();
          if (typeof showToast === 'function') {
            showToast('🔔 Notifications enabled! You will now receive club updates.', 'success');
          }
          window.ClubWebPush.show('Notifications Enabled 🎉', 'You will now receive alerts for new club projects and events!');
        } else {
          closeBanner(1);
          if (typeof showToast === 'function') {
            showToast('Notifications blocked or denied. You can re-enable anytime in browser settings.', 'info');
          }
        }
      };
    }
  },

  /** Called after login, page load, onboarding, or admin access to offer notification enablement */
  promptOnce(force = false, delayMs = 1500) {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;
    // Delay slightly so the page content and layout are visible first
    setTimeout(() => {
      this.showPromptBanner(force);
    }, delayMs);
  }
};

// ── ClubDB ────────────────────────────────────────────────────────────────
// Helper: ensure Firebase Auth has resolved its initial auth state before DB queries
let _authReadyPromise = null;
let _authResolved = false;

if (typeof firebase !== 'undefined' && firebase.auth) {
  try {
    firebase.auth().onAuthStateChanged((user) => {
      _authResolved = true;
      _authReadyPromise = Promise.resolve(user);
    });
  } catch (_) {}
}

function ensureAuthReady(timeoutMs = 2200) {
  if (!isFirebaseLive || !firebaseAuth) return Promise.resolve(null);
  if (firebaseAuth.currentUser) return Promise.resolve(firebaseAuth.currentUser);
  if (_authResolved) return Promise.resolve(firebaseAuth.currentUser);

  if (!_authReadyPromise) {
    _authReadyPromise = new Promise((resolve) => {
      let done = false;
      const finish = (user) => {
        if (!done) {
          done = true;
          _authResolved = true;
          try { unsub(); } catch (_) {}
          resolve(user);
        }
      };
      const unsub = firebaseAuth.onAuthStateChanged((user) => {
        if (user) finish(user);
      });
      setTimeout(() => {
        finish(firebaseAuth.currentUser || null);
      }, timeoutMs);
    });
  }
  return _authReadyPromise;
}

window.ClubDB = {
  isLive: () => isFirebaseLive,

  // ─ GET ─────────────────────────────────────────────────────────────────
  get: async function(path) {
    const store = getLocalStore();

    // Shortcut: empty path = return whole store
    if (!path || path === '/') return store;

    const parts = path.split('/').filter(Boolean);

    // Fast local read first
    let local = store;
    for (const p of parts) {
      if (local === null || typeof local !== 'object') { local = undefined; break; }
      local = local[p];
    }

    // Attempt live RTDB read (waits for auth handshake if needed)
    if (isFirebaseLive && firebaseDb) {
      try {
        await ensureAuthReady(1800);
        const snap = await Promise.race([
          firebaseDb.ref(path).once('value'),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4500))
        ]);
        if (snap && snap.exists()) {
          const val = snap.val();
          // Firebase is the single source of truth: replace local cache directly
          const parent = pathTraverse(store, parts);
          if (parent) parent[parts[parts.length - 1]] = val;
          saveLocalStore(store, false); // notify=false: read-only cache update
          return val;
        } else {
          // Online node is empty / deleted
          const parent = pathTraverse(store, parts);
          if (parent) {
            if (parts.length === 1) {
              parent[parts[0]] = {};
            } else {
              delete parent[parts[parts.length - 1]];
            }
          }
          saveLocalStore(store, false);
          return parts.length === 1 ? {} : null;
        }
      } catch (err) {
        if (err && err.message && err.message.toLowerCase().includes('permission')) {
          console.warn(`[ClubDB] Firebase permission denied on "${path}". Verify Firebase Security Rules.`);
          // Only dispatch the UI warning event if the user is genuinely NOT logged in.
          // When logged in, this is a transient startup error (auth token not yet propagated) — ignore it.
          const isLoggedIn = !!(window.ClubAuth && ClubAuth.currentUser);
          if (!isLoggedIn) {
            window.dispatchEvent(new CustomEvent('club-permission-denied', { detail: { path, message: err.message } }));
          }
        }
        /* Fall back to local cache on network/permission error */
      }
    }

    if (local !== undefined) return local;

    // Fallback: SEED_DATA
    let seed = SEED_DATA;
    for (const p of parts) {
      if (!seed || typeof seed !== 'object') { seed = undefined; break; }
      seed = seed[p];
    }
    return seed !== undefined ? seed : (parts.length === 1 ? {} : null);
  },

  // ─ SET ─────────────────────────────────────────────────────────────────
  set: async function(path, value) {
    if (isFirebaseLive && firebaseDb) {
      try {
        await ensureAuthReady(1200);
        await Promise.race([
          firebaseDb.ref(path).set(value),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Set timeout')), 4000))
        ]);
      } catch (err) {
        console.warn(`[ClubDB.set] Firebase write note on "${path}":`, err.message);
        if (err && err.message && err.message.toLowerCase().includes('permission')) {
          const isLoggedIn = !!(window.ClubAuth && ClubAuth.currentUser);
          if (!isLoggedIn) {
            window.dispatchEvent(new CustomEvent('club-permission-denied', { detail: { path, message: err.message } }));
          }
        }
      }
    }

    const store = getLocalStore();
    const parts = path.split('/').filter(Boolean);
    const parent = pathTraverse(store, parts);
    if (parent !== null) parent[parts[parts.length - 1]] = value;
    saveLocalStore(store);
    return value;
  },

  // ─ PUSH ────────────────────────────────────────────────────────────────
  push: async function(path, value) {
    let id;

    if (isFirebaseLive && firebaseDb) {
      try {
        await ensureAuthReady(1200);
        const ref = firebaseDb.ref(path).push();
        id = ref.key;
        const withId = { ...value, id: id };
        await Promise.race([
          ref.set(withId),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Push timeout')), 4000))
        ]);
        // Cache locally
        const store = getLocalStore();
        const parts = (path + '/' + id).split('/').filter(Boolean);
        const parent = pathTraverse(store, parts);
        if (parent) parent[parts[parts.length - 1]] = withId;
        saveLocalStore(store);
        return withId;
      } catch (err) {
        console.warn(`[ClubDB.push] Firebase push error on "${path}":`, err.message);
        if (err && err.message && err.message.toLowerCase().includes('permission')) {
          const isLoggedIn = !!(window.ClubAuth && ClubAuth.currentUser);
          if (!isLoggedIn) {
            window.dispatchEvent(new CustomEvent('club-permission-denied', { detail: { path, message: err.message } }));
          }
          throw err;
        }
      }
    }

    // Fallback if offline
    id = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const withId = { ...value, id: id };
    const store = getLocalStore();
    const parts = (path + '/' + id).split('/').filter(Boolean);
    const parent = pathTraverse(store, parts);
    if (parent) parent[parts[parts.length - 1]] = withId;
    saveLocalStore(store);
    return withId;
  },

  // ─ UPDATE ──────────────────────────────────────────────────────────────
  update: async function(path, updates) {
    if (isFirebaseLive && firebaseDb) {
      try {
        await ensureAuthReady(1200);
        await Promise.race([
          firebaseDb.ref(path).update(updates),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Update timeout')), 4000))
        ]);
      } catch (err) {
        console.warn(`[ClubDB.update] Firebase update note on "${path}":`, err.message);
      }
    }

    const store = getLocalStore();
    const parts = path.split('/').filter(Boolean);
    let curr = store;
    for (const p of parts) {
      if (!curr[p] || typeof curr[p] !== 'object') curr[p] = {};
      curr = curr[p];
    }
    Object.assign(curr, updates);
    saveLocalStore(store);
    return curr;
  },

  // ─ REMOVE ──────────────────────────────────────────────────────────────
  remove: async function(path) {
    if (isFirebaseLive && firebaseDb) {
      try {
        await ensureAuthReady(1200);
        await Promise.race([
          firebaseDb.ref(path).remove(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Remove timeout')), 4000))
        ]);
      } catch (err) {
        console.warn(`[ClubDB.remove] Firebase remove note on "${path}":`, err.message);
      }
    }

    const store = getLocalStore();
    const parts = path.split('/').filter(Boolean);
    const parent = pathTraverse(store, parts);
    if (parent && parts.length) delete parent[parts[parts.length - 1]];
    saveLocalStore(store);
  },

  // ─ ON VALUE (real-time listener) ───────────────────────────────────────
  onValue: function(path, callback) {
    // Initial fetch from online
    this.get(path).then(val => callback(val !== undefined ? val : {}));

    // Local-store change listener
    let _localHandlerTimer = null;
    const localHandler = () => {
      clearTimeout(_localHandlerTimer);
      _localHandlerTimer = setTimeout(() => {
        this.get(path).then(val => callback(val !== undefined ? val : {}));
      }, 300);
    };
    window.addEventListener('club-db-updated', localHandler);

    // Live RTDB listener
    let fbCallback = null;
    if (isFirebaseLive && firebaseDb) {
      ensureAuthReady(1500).then(() => {
        try {
          fbCallback = (snap) => {
            const exists = snap && snap.exists();
            const val = exists ? snap.val() : (path.indexOf('/') === -1 ? {} : null);
            const store = getLocalStore();
            const parts = path.split('/').filter(Boolean);
            const parent = pathTraverse(store, parts);
            if (parent) {
              if (val !== null) {
                parent[parts[parts.length - 1]] = val;
              } else {
                delete parent[parts[parts.length - 1]];
              }
            }
            saveLocalStore(store, false);
            callback(val !== null ? val : {});
          };
          firebaseDb.ref(path).on('value', fbCallback, (err) => {
            if (err && err.message && err.message.toLowerCase().includes('permission')) {
              console.warn(`[ClubDB onValue] Firebase permission denied on "${path}". Verify Firebase Security Rules.`);
              const isLoggedIn = !!(window.ClubAuth && ClubAuth.currentUser);
              if (!isLoggedIn) {
                window.dispatchEvent(new CustomEvent('club-permission-denied', { detail: { path, message: err.message } }));
              }
            }
          });
        } catch (_) {}
      });
    }

    // Return unsubscribe fn
    return () => {
      clearTimeout(_localHandlerTimer);
      window.removeEventListener('club-db-updated', localHandler);
      if (isFirebaseLive && firebaseDb && fbCallback) {
        try { firebaseDb.ref(path).off('value', fbCallback); } catch (_) {}
      }
    };
  }
};
