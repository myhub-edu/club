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
      // Ensure session stays permanently in browser storage until the user explicitly signs out
      try {
        await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      } catch (e) {
        console.warn("[ClubAuth] setPersistence note:", e);
      }

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
          // Verify with Firebase server that this user account still exists
          // (Handles when an admin deletes the user in Firebase Console)
          try {
            await user.reload();
          } catch (reloadErr) {
            if (reloadErr && (
              reloadErr.code === 'auth/user-not-found' ||
              reloadErr.code === 'auth/user-disabled' ||
              reloadErr.code === 'auth/invalid-user-token'
            )) {
              console.warn("[ClubAuth] User account no longer exists in Firebase Auth. Logging out.");
              await firebase.auth().signOut().catch(() => {});
              this.currentUser = null;
              this.userRole = "guest";
              localStorage.removeItem(AUTH_STORAGE_KEY);
              this.syncNavbarUI();
              document.dispatchEvent(new CustomEvent('club-auth-changed', {
                detail: { role: 'guest', user: null }
              }));
              if (window.location.pathname.includes('/admin/')) {
                window.location.href = '../login.html';
              }
              return;
            }
          }

          // User is confirmed valid by Firebase
          await this.handleFirebaseUser(user);
        } else {
          // Firebase confirmed: NO user is logged in (signed out, or auth accounts deleted in Firebase)
          if (this.currentUser || localStorage.getItem(AUTH_STORAGE_KEY)) {
            console.log("[ClubAuth] Firebase Auth is logged out. Clearing local session.");
            this.currentUser = null;
            this.userRole = "guest";
            localStorage.removeItem(AUTH_STORAGE_KEY);
            this.syncNavbarUI();
            document.dispatchEvent(new CustomEvent('club-auth-changed', {
              detail: { role: 'guest', user: null }
            }));
            if (window.location.pathname.includes('/admin/')) {
              window.location.href = '../login.html';
            }
          }
        }
      });
    }

    this.syncNavbarUI();
    this.injectOnboardingModal();

    // If active user is missing class section, trigger onboarding modal
    // Only show if profile is genuinely incomplete (never show to users who already filled everything in)
    const _u = this.currentUser;
    const _profileIncomplete = _u && this.userRole !== 'headAdmin' &&
      (!_u.section || !_u.grade || !_u.displayName || _u.displayName.includes('@'));
    if (_profileIncomplete) {
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
        grade: master ? "" : "11",
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
      if (user.email) profile.email = user.email;
      ClubDB.set(`headAdmin/${user.uid}`, true).catch(() => {});
      ClubDB.set(`admins/${user.uid}`, true).catch(() => {});
      ClubDB.update(`users/${user.uid}`, { role: 'headAdmin', email: profile.email || 'dprogram057@gmail.com' }).catch(() => {});
    }

    this.currentUser = profile;
    this.userRole = profile.role || 'member';
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
    this.syncNavbarUI();

    // Notify listeners (e.g. login.html banner) that auth state is now resolved
    document.dispatchEvent(new CustomEvent('club-auth-changed', {
      detail: { role: this.userRole, user: profile }
    }));

    const path = window.location.pathname.toLowerCase();
    const onAuthPage = path.includes('login') || path.includes('register');
    const needsOnboarding = (!profile.section || !profile.grade || !profile.displayName || profile.displayName.includes('@')) && profile.role !== 'headAdmin';

    if (needsOnboarding) {
      // INSTANT ONBOARDING: Show modal immediately (0ms delay)
      this.showOnboardingModal();
    } else {
      // Profile is complete: mark onboarding as done so it never shows again this session
      sessionStorage.setItem('onboarding_dismissed', 'true');
      if (onAuthPage) {
        this.handlePostLoginRedirect();
      }
    }

    // Role resolution and push notification prompt in background
    this.resolveRole().then((r) => {
      this.syncNavbarUI();
      // Prompt admins too if notifications are still default
      if ((r === 'admin' || r === 'headAdmin') && window.ClubWebPush && ClubWebPush.promptOnce) {
        ClubWebPush.promptOnce(true, 1000);
      }
    }).catch(() => {});

    // Check if user just completed details: ask again immediately
    if (sessionStorage.getItem('just_completed_details') === 'true') {
      sessionStorage.removeItem('just_completed_details');
      if (window.ClubWebPush && ClubWebPush.promptOnce) {
        ClubWebPush.promptOnce(true, 1000);
      }
    } else if (!needsOnboarding && window.ClubWebPush && ClubWebPush.promptOnce) {
      // Ask after login (bypassing pre-login snooze for users who didn't allow earlier)
      ClubWebPush.promptOnce(true, 1500);
    }
  },

  resolveRole: async function () {
    if (!this.currentUser) {
      this.userRole = 'guest';
      return 'guest';
    }
    const uid = this.currentUser.uid;

    // Direct Code Override: Master emails always get headAdmin (hardcoded in code, unforgeable)
    const HARDCODED_ADMIN_UIDS = ['Hmv08XzSqDSvVmYQuijqaEYg0MX2'];
    const HARDCODED_ADMIN_EMAILS = ['dprogram057@gmail.com', 'stechnical121@gmail.com'];
    let authEmail = '';
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      authEmail = (firebase.auth().currentUser.email || '').toLowerCase().trim();
    }
    const cleanEmail = (this.currentUser.email || authEmail || '').toLowerCase().trim();
    if (HARDCODED_ADMIN_UIDS.includes(uid) || HARDCODED_ADMIN_EMAILS.includes(cleanEmail) || HARDCODED_ADMIN_EMAILS.includes(authEmail)) {
      this.userRole = 'headAdmin';
      this.currentUser.role = 'headAdmin';
      if (!this.currentUser.email && (cleanEmail || authEmail)) {
        this.currentUser.email = cleanEmail || authEmail;
      }
      this.currentUser._roleTrusted = true; // mark as verified by code, not DB profile
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
      try {
        ClubDB.set(`headAdmin/${uid}`, true);
        ClubDB.set(`admins/${uid}`, true);
        ClubDB.update(`users/${uid}`, { role: 'headAdmin', email: this.currentUser.email });
      } catch (_) { }
      return 'headAdmin';
    }

    // Verify against /admins and /headAdmin nodes in DB (cannot be self-edited by regular users)
    try {
      const isHead = await ClubDB.get(`headAdmin/${uid}`);
      if (isHead) {
        this.userRole = 'headAdmin';
        this.currentUser.role = 'headAdmin';
        this.currentUser._roleTrusted = true;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
        return 'headAdmin';
      }
      const isAdmin = await ClubDB.get(`admins/${uid}`);
      if (isAdmin) {
        this.userRole = 'admin';
        this.currentUser.role = 'admin';
        this.currentUser._roleTrusted = true;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
        return 'admin';
      }
      // DB confirmed: not in admins or headAdmin → always member regardless of profile field
      this.currentUser._roleTrusted = false;
    } catch (_) {
      // Firebase offline — ONLY trust cached role if it was verified by DB check (_roleTrusted flag)
      // Never trust users.role alone (user can self-edit their own profile field)
      if (this.currentUser._roleTrusted) {
        if (this.currentUser.role === 'headAdmin') { this.userRole = 'headAdmin'; return 'headAdmin'; }
        if (this.currentUser.role === 'admin') { this.userRole = 'admin'; return 'admin'; }
      }
    }

    this.userRole = 'member';
    this.currentUser.role = 'member';
    this.currentUser._roleTrusted = false;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.currentUser));
    return 'member';
  },

  loginWithGoogle: async function (forceRedirect = false) {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      try {
        await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      } catch (_) {}

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
        await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      } catch (_) {}

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
        const gPrefix = this.currentUser.grade ? ('Grade ' + this.currentUser.grade) : 'Grade 11';
        const roleDisplay = this.currentUser.section ? (`${gPrefix} – ${this.currentUser.section}`) : (this.currentUser.grade ? gPrefix : this.userRole.toUpperCase());

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
        const gPre = this.currentUser.grade ? ('Grade ' + this.currentUser.grade) : 'Grade 11';
        const rDisplay = this.currentUser.section ? (`${gPre} – ${this.currentUser.section}`) : (this.currentUser.grade ? gPre : this.userRole.toUpperCase());
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
      <div class="modal-content" style="position: relative; max-width: 440px; width: 92%;">
        <div class="modal-header" style="margin-bottom: 0.5rem;">
          <h3 id="onboardingGreeting" style="font-size: 1.25rem;">Welcome to Science &amp; IT Club! 🚀</h3>
        </div>
        <p id="onboardingSubtitle" style="margin-bottom: 1.25rem; color: var(--text-secondary); font-size: 0.88rem; line-height: 1.5;">One quick step — tell us your name, grade, class section and WhatsApp number to complete your student profile:</p>
        <form id="onboardingForm" autocomplete="off">
          <div class="form-group" id="onboardNameGroup">
            <label class="form-label" style="font-size: 0.82rem;">Full Name <span style="color:var(--accent-rose);">*</span></label>
            <input type="text" id="onboardName" class="form-input" required placeholder="e.g. Your Full Name" />
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; margin-bottom: 0.5rem;">
            <div class="form-group">
              <label class="form-label" style="font-size: 0.82rem;">Grade <span style="color:var(--accent-rose);">*</span></label>
              <select id="onboardGrade" class="form-select" required style="cursor: pointer; width: 100%; background: var(--bg-surface-elevated); color: var(--text-primary); font-size: 0.9rem;">
                <option value="11" style="background:#131b2e; color:#fff;">Grade 11</option>
                <option value="12" style="background:#131b2e; color:#fff;">Grade 12</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 0.82rem;">Class Section <span style="color:var(--accent-rose);">*</span></label>
              <input type="text" id="onboardSection" class="form-input" required
                placeholder="e.g. S8, S9, L4..."
                autocomplete="off"
                style="letter-spacing: 0.05em; text-transform: uppercase; width: 100%; font-size: 0.9rem;" />
            </div>
          </div>
          <div class="form-group" style="margin-bottom: 0.5rem;">
            <label class="form-label" style="font-size: 0.82rem;">📱 WhatsApp / Phone <small style="color:var(--text-muted);">(optional, only visible to admins)</small></label>
            <input type="tel" id="onboardPhone" class="form-input"
              placeholder="e.g. +977 98XXXXXXXX"
              autocomplete="tel"
              style="font-size: 0.9rem;" />
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.75rem; padding: 0.75rem;">Complete My Profile ✓</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const form = document.getElementById('onboardingForm');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('onboardName').value.trim();
        const grade = (document.getElementById('onboardGrade')?.value || '11').trim();
        const section = document.getElementById('onboardSection').value.trim().toUpperCase();
        const phone = (document.getElementById('onboardPhone')?.value || '').trim();
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
          ClubAuth.currentUser.grade = grade;
          ClubAuth.currentUser.section = section;
          if (phone) ClubAuth.currentUser.phone = phone;
          try {
            // Update Firebase Auth display name
            if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
              await firebase.auth().currentUser.updateProfile({ displayName: name }).catch(() => { });
            }
            const updatePayload = { displayName: name, grade: grade, section: section };
            if (phone) updatePayload.phone = phone;
            await ClubDB.update(`users/${ClubAuth.currentUser.uid}`, updatePayload);
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(ClubAuth.currentUser));
            ClubAuth.syncNavbarUI();
            modal.classList.remove('active');
            sessionStorage.setItem('onboarding_dismissed', 'true');
            sessionStorage.setItem('just_completed_details', 'true');

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
              const phoneText = phone ? ` | 📱 ${phone}` : '';
              ClubNotifs.notifyAllAdmins(
                `New Member Profile: ${name}`,
                `${name} (Grade ${grade} – ${section}${phoneText}) has completed registration on the portal.`,
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
    // Skip if user profile is already complete (name + grade + section filled in)
    // This is the primary gate — sessionStorage flag is secondary (for partial-profile users who skip)
    const profileComplete = user.section && user.grade && user.displayName && !user.displayName.includes('@');
    if (profileComplete) {
      sessionStorage.setItem('onboarding_dismissed', 'true');
      return;
    }
    // If user dismissed the modal voluntarily this session (and still has incomplete profile), respect that
    if (sessionStorage.getItem('onboarding_dismissed') === 'true') {
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

      const gradeSelect = document.getElementById('onboardGrade');
      if (gradeSelect) {
        gradeSelect.value = user.grade || '11';
      }

      const sectionInput = document.getElementById('onboardSection');
      if (sectionInput) {
        sectionInput.value = user.section || '';
      }

      const phoneInput = document.getElementById('onboardPhone');
      if (phoneInput) {
        phoneInput.value = user.phone || '';
      }

      const greetingEl = document.getElementById('onboardingGreeting');
      const subtitleEl = document.getElementById('onboardingSubtitle');
      if (greetingEl) {
        greetingEl.textContent = 'Complete Your Student Profile 🚀';
      }
      if (subtitleEl) {
        subtitleEl.textContent = 'Please confirm your name, grade, class section and WhatsApp number:';
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
