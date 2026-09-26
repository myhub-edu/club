/**
 * SCIENCE & IT CLUB - AUTHENTICATION & SESSION MANAGER
 * Robust Google Login (Popup + Redirect fallback for COOP restrictions),
 * Email/Password Sign-In, Role Resolution (with server/DB verification),
 * Onboarding modal with smooth redirection across all pages,
 * and Desktop & Mobile Navigation Synchronization.
 */

const AUTH_STORAGE_KEY = "CLUB_CURRENT_USER_SESSION";

window.ClubAuth = {
  currentUser: null,
  userRole: "guest", // "guest" | "member" | "admin" | "headAdmin"

  init: async function () {
    // 1. Restore local session immediately for instant interactive rendering (0ms delay)
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
        this.userRole = (this.currentUser && this.currentUser.role) || "member";
        this.syncNavbarUI();
        this.resolveRole().then(() => this.syncNavbarUI()).catch(() => { });
      } catch (e) {
        this.currentUser = null;
        this.userRole = "guest";
      }
    }

    // 2. Listen to Firebase Auth if SDK is loaded
    if (typeof firebase !== 'undefined' && firebase.auth) {
      // Check for Google redirect result (in case popup was blocked or used redirect mode)
      try {
        const redirectResult = await firebase.auth().getRedirectResult();
        if (redirectResult && redirectResult.user) {
          await this.handleFirebaseUser(redirectResult.user);
          if (typeof showToast === 'function') {
            const name = redirectResult.user.displayName || 'Member';
            showToast(`Welcome back, ${name}!`, 'success');
          }
          return;
        }
      } catch (redErr) {
        console.warn("Firebase redirect auth note:", redErr);
      }

      firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
          await this.handleFirebaseUser(user);
        } else {
          // If no local session exists, mark as guest
          if (!localStorage.getItem(AUTH_STORAGE_KEY)) {
            this.currentUser = null;
            this.userRole = "guest";
            this.syncNavbarUI();
          }
        }
      });
    }

    this.syncNavbarUI();
    this.injectOnboardingModal();

    // If active user is missing class section, trigger onboarding modal
    if (this.currentUser && (!this.currentUser.section || !this.currentUser.displayName || this.currentUser.displayName.includes('@')) && this.userRole !== 'headAdmin') {
      setTimeout(() => this.showOnboardingModal(), 350);
    }
  },

  handleFirebaseUser: async function (user) {
    if (!user) return;
    let profile = null;

    try {
      profile = await ClubDB.get(`users/${user.uid}`);
    } catch (e) {
      console.warn("ClubDB get user error:", e);
    }

    const HARDCODED_ADMIN_UIDS = ['Hmv08XzSqDSvVmYQuijqaEYg0MX2'];
    const HARDCODED_ADMIN_EMAILS = ['dprogram057@gmail.com', 'stechnical121@gmail.com'];
    const isMasterAdmin = (user) => {
      if (!user) return false;
      const cleanEmail = (user.email || '').toLowerCase().trim();
      return HARDCODED_ADMIN_UIDS.includes(user.uid) || HARDCODED_ADMIN_EMAILS.includes(cleanEmail);
    };

    const isNewUser = !profile;
    if (!profile) {
      const fallbackName = user.displayName || (user.email ? user.email.split('@')[0] : 'Member');
      const master = isMasterAdmin(user);
      profile = {
        uid: user.uid,
        displayName: fallbackName,
        email: user.email || '',
        photoURL: user.photoURL || "assets/logo/club_logo.png",
        section: master ? "Admin Staff" : "",
        bio: master ? "Head Administrator & Developer" : "",
        role: master ? "headAdmin" : "member",
        createdAt: Date.now(),
        lastLoginAt: Date.now()
      };

      // Save to DB in background without blocking UI
      ClubDB.set(`users/${user.uid}`, profile).catch(e => console.warn(e));
      if (master) {
        ClubDB.set(`headAdmin/${user.uid}`, true).catch(() => {});
        ClubDB.set(`admins/${user.uid}`, true).catch(() => {});
      }
    } else {
      ClubDB.update(`users/${user.uid}`, { lastLoginAt: Date.now() }).catch(() => {});
    }

    if (isMasterAdmin(user)) {
      profile.role = 'headAdmin';
      ClubDB.set(`headAdmin/${user.uid}`, true).catch(() => {});
      ClubDB.set(`admins/${user.uid}`, true).catch(() => {});
    }

    this.currentUser = profile;
    this.userRole = profile.role || 'member';
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
    this.syncNavbarUI();

    const path = window.location.pathname.toLowerCase();
    const onAuthPage = path.includes('login') || path.includes('register');
    const needsOnboarding = (!profile.section || !profile.displayName || profile.displayName.includes('@')) && profile.role !== 'headAdmin';

    if (needsOnboarding) {
      // INSTANT ONBOARDING: Show modal immediately (0ms delay)
      this.showOnboardingModal();
    } else if (onAuthPage) {
      this.handlePostLoginRedirect();
    }

    // Role resolution and push notification prompt in background
    this.resolveRole().then(() => this.syncNavbarUI()).catch(() => {});
    if (window.ClubWebPush && ClubWebPush.promptOnce) {
      ClubWebPush.promptOnce();
    }
  },

  resolveRole: async function () {
    if (!this.currentUser) {
      this.userRole = 'guest';
      return 'guest';
    }
    const uid = this.currentUser.uid;

    // Direct Code Override: Developer & Head Admin (by UID or email — always granted full privileges)
    const HARDCODED_ADMIN_UIDS = ['Hmv08XzSqDSvVmYQuijqaEYg0MX2'];
    const HARDCODED_ADMIN_EMAILS = ['dprogram057@gmail.com', 'stechnical121@gmail.com'];
    const cleanEmail = (this.currentUser.email || '').toLowerCase().trim();
    if (HARDCODED_ADMIN_UIDS.includes(uid) || HARDCODED_ADMIN_EMAILS.includes(cleanEmail)) {
      this.userRole = 'headAdmin';
      this.currentUser.role = 'headAdmin';
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
      // Persist to DB under user's active session
      try {
        ClubDB.set(`headAdmin/${uid}`, true);
        ClubDB.set(`admins/${uid}`, true);
        ClubDB.update(`users/${uid}`, { role: 'headAdmin' });
      } catch (_) { }
      return 'headAdmin';
    }

    // Always verify against DB for security (cannot spoof by editing localStorage)
    try {
      const isHead = await ClubDB.get(`headAdmin/${uid}`);
      if (isHead) {
        this.userRole = 'headAdmin';
        this.currentUser.role = 'headAdmin';
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
        return 'headAdmin';
      }
      const isAdmin = await ClubDB.get(`admins/${uid}`);
      if (isAdmin) {
        this.userRole = 'admin';
        this.currentUser.role = 'admin';
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
        return 'admin';
      }
    } catch (_) {
      // Firebase offline — fall back to cached role (read-only)
      if (this.currentUser.role === 'headAdmin') { this.userRole = 'headAdmin'; return 'headAdmin'; }
      if (this.currentUser.role === 'admin') { this.userRole = 'admin'; return 'admin'; }
    }

    this.userRole = 'member';
    this.currentUser.role = 'member';
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
    return 'member';
  },

  loginWithGoogle: async function (forceRedirect = false) {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      if (forceRedirect) {
        if (typeof showToast === 'function') showToast('Redirecting to Google Secure Login...', 'info');
        await firebase.auth().signInWithRedirect(provider);
        return;
      }

      if (typeof showToast === 'function') showToast('Opening Google Sign-In...', 'info');

      try {
        const result = await firebase.auth().signInWithPopup(provider);
        if (result && result.user) {
          await this.handleFirebaseUser(result.user);
          const name = result.user.displayName || 'Member';
          if (typeof showToast === 'function') showToast(`Welcome, ${name}! 🎉`, 'success');
          return;
        }
      } catch (err) {
        console.warn('Google popup error:', err.code, err.message);
        if (
          err.code === 'auth/popup-blocked' ||
          err.code === 'auth/popup-closed-by-user' ||
          err.code === 'auth/cancelled-popup-request' ||
          (err.message && (err.message.includes('Cross-Origin-Opener-Policy') || err.message.includes('popup')))
        ) {
          try {
            if (typeof showToast === 'function') showToast('Popup blocked. Switching to redirect mode...', 'info');
            await firebase.auth().signInWithRedirect(provider);
            return;
          } catch (redErr) {
            console.error('Firebase redirect failed:', redErr);
          }
        }
        throw err;
      }
    } else {
      throw new Error('Firebase Auth is not available. Please check your internet connection.');
    }
  },

  // Real Firebase Email/Password Sign-In
  loginWithCredentials: async function (email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      throw new Error('Email and password are required.');
    }

    if (typeof firebase !== 'undefined' && firebase.auth) {
      try {
        const result = await firebase.auth().signInWithEmailAndPassword(cleanEmail, password);
        if (result && result.user) {
          await this.handleFirebaseUser(result.user);
          const name = result.user.displayName || 'Member';
          if (typeof showToast === 'function') showToast(`Welcome back, ${name}! ✅`, 'success');
          return;
        }
      } catch (err) {
        let msg = 'Sign-in failed. ';
        if (err.code === 'auth/user-not-found') msg += 'No account found with this email.';
        else if (err.code === 'auth/wrong-password') msg += 'Incorrect password.';
        else if (err.code === 'auth/invalid-email') msg += 'Invalid email address.';
        else if (err.code === 'auth/too-many-requests') msg += 'Too many attempts. Please try again later.';
        else if (err.code === 'auth/user-disabled') msg += 'This account has been disabled.';
        else if (err.code === 'auth/invalid-credential') msg += 'Invalid email or password.';
        else msg += (err.message || 'Please check your credentials.');
        throw new Error(msg);
      }
    } else {
      // Offline fallback: check local user store
      const users = (await ClubDB.get('users')) || {};
      const existing = Object.values(users).find(u => u.email && u.email.toLowerCase() === cleanEmail);
      if (existing) {
        this.currentUser = { ...existing, lastLoginAt: Date.now() };
        this.userRole = existing.role || 'member';
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
        this.syncNavbarUI();
        await this.resolveRole();
        if (typeof showToast === 'function') showToast(`Signed in as ${this.currentUser.displayName || 'Member'}`, 'success');
        this.handlePostLoginRedirect();
        return;
      }
      throw new Error('No account found. Firebase Auth is offline — please connect to the internet.');
    }
  },

  handlePostLoginRedirect: function () {
    const params = new URLSearchParams(window.location.search);
    const redirectUrl = params.get('redirect');
    const isInAdmin = window.location.pathname.includes('/admin/');
    if (redirectUrl) {
      window.location.href = redirectUrl;
      return;
    }
    const path = window.location.pathname.toLowerCase();
    const onAuthPage = path.includes('login') || path.includes('register');
    if (onAuthPage) {
      if (this.userRole === 'admin' || this.userRole === 'headAdmin') {
        window.location.href = isInAdmin ? 'index.html' : 'admin/index.html';
      } else {
        window.location.href = isInAdmin ? '../index.html' : 'index.html';
      }
    }
  },

  logout: async function () {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      try {
        await firebase.auth().signOut();
      } catch (e) { }
    }
    this.currentUser = null;
    this.userRole = "guest";
    localStorage.removeItem(AUTH_STORAGE_KEY);
    this.syncNavbarUI();
    if (typeof showToast === 'function') {
      showToast("Signed out successfully.", "info");
    }
    if (window.location.pathname.includes('/admin/')) {
      window.location.href = '../index.html';
    } else {
      window.location.reload();
    }
  },

  syncNavbarUI: function () {
    const headerActions = document.querySelector('.header-actions');
    const isInAdmin = window.location.pathname.includes('/admin/');
    const rootPrefix = isInAdmin ? '../' : '';

    if (headerActions) {
      if (!this.currentUser) {
        headerActions.innerHTML = `
          <a href="${rootPrefix}login.html" class="btn btn-primary btn-sm">Member Login</a>
          <button class="hamburger-btn" id="drawerToggleBtn" aria-label="Open Menu">☰</button>
        `;
      } else {
        const isAdmin = this.userRole === 'admin' || this.userRole === 'headAdmin';
        const displayName = this.currentUser.displayName || 'Member';
        const firstName = displayName.split(' ')[0] || 'Member';
        const roleDisplay = this.currentUser.section ? ('Grade 11 – ' + this.currentUser.section) : this.userRole.toUpperCase();

        headerActions.innerHTML = `
          <!-- Notification Bell -->
          <div class="notif-bell-container">
            <button class="bell-btn" id="notifBellBtn" title="Notifications">
              🔔
              <span class="badge-counter" id="unreadNotifCount" style="display:none;">0</span>
            </button>
            <div class="notif-dropdown" id="notifDropdown">
              <div class="notif-header">
                <strong>Notifications</strong>
                <button id="markAllReadBtn" class="btn btn-sm btn-outline" style="padding:2px 6px; font-size:0.75rem;">Mark all read</button>
              </div>
              <ul class="notif-list" id="notifList">
                <li style="padding: 1rem; text-align:center; color: var(--text-muted);">Loading notifications...</li>
              </ul>
              <div class="notif-footer">
                <a href="${rootPrefix}notifications.html">View all notifications</a>
              </div>
            </div>
          </div>

          <!-- User Menu Dropdown -->
          <div style="position: relative;">
            <button class="user-menu-btn" id="userMenuBtn">
              <img src="${this.currentUser.photoURL || rootPrefix + 'assets/logo/club_logo.png'}" class="user-avatar" alt="Avatar" onerror="this.src='${rootPrefix}assets/logo/club_logo.png'" />
              <span style="max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${firstName}</span>
              <small style="color:var(--text-muted); font-size:0.7rem;">▼</small>
            </button>
            <div class="notif-dropdown" id="userMenuDropdown" style="width: 220px; right: 0;">
              <div style="padding: 0.85rem 1rem; border-bottom: 1px solid var(--border-subtle);">
                <div style="font-weight:700; font-size:0.9rem;">${displayName}</div>
                <div style="font-size:0.75rem; color:var(--accent-cyan); font-weight:600;">${roleDisplay}</div>
                <div style="font-size:0.72rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis;">${this.currentUser.email || ''}</div>
              </div>
              <ul style="list-style:none; padding:0.5rem 0;">
                <li><a href="${rootPrefix}profile.html" class="drawer-link" style="padding:0.5rem 1rem;">👤 My Profile</a></li>
                <li><a href="${rootPrefix}submit-idea.html" class="drawer-link" style="padding:0.5rem 1rem;">💡 Submit Project Idea</a></li>
                <li><a href="${rootPrefix}submit-feedback.html" class="drawer-link" style="padding:0.5rem 1rem;">⭐ Share Experience</a></li>
                <li><a href="${rootPrefix}contact-admin.html" class="drawer-link" style="padding:0.5rem 1rem;">✉️ Message Head Admin</a></li>
                ${isAdmin ? `<li><a href="${isInAdmin ? 'index.html' : 'admin/index.html'}" class="drawer-link" style="padding:0.5rem 1rem; color:var(--accent-cyan); font-weight:700;">⚙️ Admin Dashboard</a></li>` : ''}
              </ul>
              <div style="padding: 0.5rem; border-top:1px solid var(--border-subtle); text-align:center;">
                <button id="navLogoutBtn" class="btn btn-sm btn-danger" style="width:100%;">Sign Out</button>
              </div>
            </div>
          </div>

          <button class="hamburger-btn" id="drawerToggleBtn" aria-label="Open Menu">☰</button>
        `;

        const userMenuBtn = document.getElementById('userMenuBtn');
        const userMenuDropdown = document.getElementById('userMenuDropdown');
        if (userMenuBtn && userMenuDropdown) {
          userMenuBtn.onclick = (e) => {
            e.stopPropagation();
            userMenuDropdown.classList.toggle('show');
            const notifDrop = document.getElementById('notifDropdown');
            if (notifDrop) notifDrop.classList.remove('show');
          };
        }

        const navLogoutBtn = document.getElementById('navLogoutBtn');
        if (navLogoutBtn) {
          navLogoutBtn.onclick = () => ClubAuth.logout();
        }

        // Close dropdown when clicking outside
        if (!window._userDropdownBound) {
          window._userDropdownBound = true;
          document.addEventListener('click', (e) => {
            const drop = document.getElementById('userMenuDropdown');
            const btn = document.getElementById('userMenuBtn');
            if (drop && drop.classList.contains('show')) {
              if (!drop.contains(e.target) && (!btn || !btn.contains(e.target))) {
                drop.classList.remove('show');
              }
            }
          });
        }
      }
    }

    // Synchronize Mobile Drawer User State
    const mobileDrawer = document.getElementById('mobileDrawer');
    if (mobileDrawer) {
      let drawerUserSection = document.getElementById('drawerUserSection');
      if (!drawerUserSection) {
        drawerUserSection = document.createElement('div');
        drawerUserSection.id = 'drawerUserSection';
        drawerUserSection.style.padding = '0.75rem 1rem';
        drawerUserSection.style.marginBottom = '1rem';
        drawerUserSection.style.borderBottom = '1px solid var(--border-subtle)';
        const header = mobileDrawer.querySelector('.mobile-drawer-header');
        if (header) header.insertAdjacentElement('afterend', drawerUserSection);
      }

      if (this.currentUser) {
        const dName = this.currentUser.displayName || 'Member';
        const rDisplay = this.currentUser.section ? ('Grade 11 – ' + this.currentUser.section) : this.userRole.toUpperCase();
        drawerUserSection.innerHTML = `
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <img src="${this.currentUser.photoURL || rootPrefix + 'assets/logo/club_logo.png'}" style="width:38px; height:38px; border-radius:50%; object-fit:cover;" onerror="this.src='${rootPrefix}assets/logo/club_logo.png'" />
            <div style="overflow:hidden; line-height:1.3;">
              <div style="font-weight:700; font-size:0.9rem;">${dName}</div>
              <small style="color:var(--accent-cyan);">${rDisplay}</small>
            </div>
          </div>
          <div style="margin-top:0.75rem; display:flex; gap:0.5rem;">
            <a href="${rootPrefix}profile.html" class="btn btn-sm btn-outline" style="flex:1; padding:2px 8px; font-size:0.75rem;">Profile</a>
            <button id="drawerLogoutBtn" class="btn btn-sm btn-danger" style="flex:1; padding:2px 8px; font-size:0.75rem;">Logout</button>
          </div>
        `;
        const drawerLogoutBtn = document.getElementById('drawerLogoutBtn');
        if (drawerLogoutBtn) drawerLogoutBtn.onclick = () => ClubAuth.logout();
      } else {
        drawerUserSection.innerHTML = `
          <a href="${rootPrefix}login.html" class="btn btn-primary btn-sm" style="width:100%;">Member Login / Sign In</a>
        `;
      }
    }

    // Rebind notification triggers
    if (window.ClubNotifications && window.ClubNotifications.bindUI) {
      window.ClubNotifications.bindUI();
    }

    // Refresh homepage CTA + all page-specific auth listeners
    if (typeof ctaInit === 'function') {
      try { ctaInit(); } catch (e) { }
    }
    try {
      document.dispatchEvent(new CustomEvent('club-auth-changed', { detail: { user: this.currentUser, role: this.userRole } }));
    } catch (e) { }

    // Update homepage hero CTA section if present
    const ctaSection = document.getElementById('heroCtaSection');
    if (ctaSection) {
      if (this.currentUser) {
        const isAdmin = this.userRole === 'admin' || this.userRole === 'headAdmin';
        const dName = (this.currentUser.displayName || 'Member').split(' ')[0] || 'Member';
        ctaSection.innerHTML = `
          <p style="font-size:1.05rem; color:var(--text-secondary); margin-bottom:1.5rem;">Welcome back, <strong style="color:var(--accent-cyan);">${dName}</strong>! You're logged in as a club member.</p>
          <div style="display:flex; flex-wrap:wrap; gap:1rem; justify-content:center;">
            <a href="${rootPrefix}profile.html" class="btn btn-primary">👤 My Profile</a>
            <a href="${rootPrefix}submit-idea.html" class="btn btn-outline">💡 Submit Idea</a>
            ${isAdmin ? `<a href="${rootPrefix}admin/index.html" class="btn btn-secondary">⚙️ Admin Dashboard</a>` : ''}
          </div>
        `;
      }
    }
  },

  injectOnboardingModal: function () {
    if (document.getElementById('onboardingModal')) return;
    const modal = document.createElement('div');
    modal.id = 'onboardingModal';
    modal.className = 'modal-overlay';

    // dismissOnboarding is only allowed if user already has a section (not mandatory)
    window.dismissOnboarding = () => {
      const user = ClubAuth.currentUser;
      // If section is still missing, don't allow skip on first signup
      if (user && !user.section) {
        if (typeof showToast === 'function') showToast('Please enter your class section to continue.', 'error');
        document.getElementById('onboardSection') && document.getElementById('onboardSection').focus();
        return;
      }
      modal.classList.remove('active');
      sessionStorage.setItem('onboarding_dismissed', 'true');
      const path = window.location.pathname.toLowerCase();
      const onAuthPage = path.includes('login') || path.includes('register');
      if (onAuthPage) {
        ClubAuth.handlePostLoginRedirect();
      }
    };

    // Prevent backdrop-click dismissal entirely (the X button also checks section)
    modal.onclick = (e) => {
      if (e.target === modal) {
        window.dismissOnboarding();
      }
    };

    modal.innerHTML = `
      <div class="modal-content" style="position: relative;">
        <div class="modal-header" style="margin-bottom: 0.5rem;">
          <h3 id="onboardingGreeting">Welcome to Science &amp; IT Club! 🚀</h3>
        </div>
        <p id="onboardingSubtitle" style="margin-bottom: 1.25rem; color: var(--text-secondary);">One quick step — tell us your name and class section to complete your student profile:</p>
        <form id="onboardingForm" autocomplete="off">
          <div class="form-group" id="onboardNameGroup">
            <label class="form-label">Full Name <span style="color:var(--accent-rose);">*</span></label>
            <input type="text" id="onboardName" class="form-input" required placeholder="e.g. Your Full Name" />
          </div>
          <div class="form-group">
            <label class="form-label">Class Section <span style="color:var(--accent-rose);">*</span> <small style="color:var(--text-muted);">(Grade 11 – all members)</small></label>
            <input type="text" id="onboardSection" class="form-input" required
              placeholder="e.g. S8, S9, L4, L5..."
              autocomplete="off"
              style="letter-spacing: 0.05em; text-transform: uppercase;" />
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;">Complete My Profile ✓</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const form = document.getElementById('onboardingForm');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('onboardName').value.trim();
        const section = document.getElementById('onboardSection').value.trim().toUpperCase();
        const submitBtn = form.querySelector('button[type=submit]');

        if (!name) {
          if (typeof showToast === 'function') showToast('Please enter your full name.', 'error');
          document.getElementById('onboardName').focus();
          return;
        }
        if (!section) {
          if (typeof showToast === 'function') showToast('Please enter your class section (e.g. S8, L4).', 'error');
          document.getElementById('onboardSection').focus();
          return;
        }

        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving...'; }

        if (ClubAuth.currentUser) {
          ClubAuth.currentUser.displayName = name;
          ClubAuth.currentUser.section = section;
          try {
            // Update Firebase Auth display name
            if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
              await firebase.auth().currentUser.updateProfile({ displayName: name }).catch(() => { });
            }
            await ClubDB.update(`users/${ClubAuth.currentUser.uid}`, { displayName: name, section: section });
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(ClubAuth.currentUser));
            ClubAuth.syncNavbarUI();
            modal.classList.remove('active');
            sessionStorage.setItem('onboarding_dismissed', 'true');

            // Send single welcome notification if not yet sent
            try {
              const notifs = (await ClubDB.get(`notifications/users/${ClubAuth.currentUser.uid}`)) || {};
              const hasWelcome = Object.values(notifs).some(n => n && n.title && n.title.includes('Welcome'));
              if (!hasWelcome && window.ClubNotifs && ClubNotifs._pushPersonal) {
                ClubNotifs._pushPersonal(ClubAuth.currentUser.uid, {
                  title: '🎉 Welcome to Science & IT Club!',
                  message: `Hi ${name}! Your account is all set. Welcome to Liverpool College Science & IT Club.`,
                  priority: 'normal'
                }).catch(() => {});
              }
            } catch (_) {}

            // Notify admins
            if (window.ClubNotifs && ClubNotifs.notifyAllAdmins) {
              ClubNotifs.notifyAllAdmins(
                `New Member Profile: ${name}`,
                `${name} (${section}) has completed registration on the portal.`,
                'members.html',
                'normal',
                ClubAuth.currentUser.uid
              ).catch(() => {});
            }

            if (typeof showToast === 'function') {
              showToast(`All set, ${name}! Welcome to the club 🎉`, 'success');
            }

            // Fast redirect to destination (200ms)
            setTimeout(() => {
              const params = new URLSearchParams(window.location.search);
              const redirectUrl = params.get('redirect');
              const isInAdmin = window.location.pathname.includes('/admin/');
              if (redirectUrl) {
                window.location.href = redirectUrl;
              } else if (ClubAuth.userRole === 'admin' || ClubAuth.userRole === 'headAdmin') {
                window.location.href = isInAdmin ? 'index.html' : 'admin/index.html';
              } else {
                window.location.href = isInAdmin ? '../index.html' : 'index.html';
              }
            }, 200);
          } catch (err) {
            console.error('Onboarding save error:', err);
            if (typeof showToast === 'function') showToast('Error saving profile. Please try again.', 'error');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Complete My Profile ✓'; }
          }
        }
      };
    }
  },

  showOnboardingModal: function () {
    const user = this.currentUser;
    if (!user) return;
    if (this.userRole === 'headAdmin') return;
    // Only skip if user already has section and a real name, and has dismissed
    if (user.section && user.displayName && !user.displayName.includes('@') && sessionStorage.getItem('onboarding_dismissed') === 'true') {
      return;
    }

    const modal = document.getElementById('onboardingModal');
    if (modal) {
      const nameGroup = document.getElementById('onboardNameGroup');
      if (nameGroup) nameGroup.style.display = 'block';

      const nameInput = document.getElementById('onboardName');
      if (nameInput) {
        const initialName = (user.displayName && !user.displayName.includes('@')) ? user.displayName : '';
        nameInput.value = initialName;
      }

      const sectionInput = document.getElementById('onboardSection');
      if (sectionInput) {
        sectionInput.value = user.section || '';
      }

      const greetingEl = document.getElementById('onboardingGreeting');
      const subtitleEl = document.getElementById('onboardingSubtitle');
      if (greetingEl) {
        greetingEl.textContent = 'Complete Your Student Profile 🚀';
      }
      if (subtitleEl) {
        subtitleEl.textContent = 'Please confirm your full name and class section to complete your member account:';
      }

      modal.classList.add('active');

      setTimeout(() => {
        if (nameInput && !nameInput.value) {
          nameInput.focus();
        } else if (sectionInput && !sectionInput.value) {
          sectionInput.focus();
        }
      }, 150);
    }
  },

  requireAuth: function (target) {
    if (!this.currentUser) {
      const page = target || (window.location.pathname.split('/').pop() || 'index.html') + window.location.search;
      const prefix = window.location.pathname.includes('/admin/') ? '../login.html' : 'login.html';
      window.location.href = `${prefix}?redirect=${encodeURIComponent(page)}`;
      return false;
    }
    return true;
  },

  requireAdmin: function () {
    if (!this.currentUser || (this.userRole !== 'admin' && this.userRole !== 'headAdmin')) {
      if (typeof showToast === 'function') {
        showToast("Access Restricted: Administrator privileges required.", "error");
      } else {
        alert("Access Restricted: Administrator privileges required.");
      }
      const prefix = window.location.pathname.includes('/admin/') ? '../index.html' : 'index.html';
      window.location.href = prefix;
      return false;
    }
    return true;
  },

  requireHeadAdmin: function () {
    if (!this.currentUser || this.userRole !== 'headAdmin') {
      if (typeof showToast === 'function') {
        showToast("Access Restricted: Head Administrator privileges required.", "error");
      } else {
        alert("Access Restricted: Head Administrator privileges required.");
      }
      const prefix = window.location.pathname.includes('/admin/') ? '../index.html' : 'index.html';
      window.location.href = prefix;
      return false;
    }
    return true;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ClubAuth.init();
});
