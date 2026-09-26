/**
 * SCIENCE & IT CLUB - MAIN GLOBAL CLIENT CONTROLLER
 * Controls Navigation, Mobile Drawer, Bottom Bar, Modal Controls, Toast Alerts, and Homepage Dynamic Widgets.
 */

// Global Toast Notification Helper
window.showToast = function(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

// Global Modal Helpers
window.openModal = function(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.add('active');
};

window.closeModal = function(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove('active');
};

// Close modal when clicking overlay background
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // Setup Mobile Drawer
  setupMobileDrawer();

  // Highlight active links based on location pathname
  highlightActiveNavigation();

  // If on index.html, load homepage dynamic components
  if (document.getElementById('upcomingEventContainer') || document.getElementById('homeProjectsGrid')) {
    initHomePageDynamicSections();
  }

  // If on about.html, load dynamic leadership section
  if (document.getElementById('leadershipContainer')) {
    initLeadershipSection();
  }

  // Apply club settings across pages (notice banner, schedule, etc.)
  initClubSettings();

  // Listen for database updates to refresh widgets (debounced)
  let _dbUpdateTimer = null;
  window.addEventListener('club-db-updated', () => {
    clearTimeout(_dbUpdateTimer);
    _dbUpdateTimer = setTimeout(() => {
      if (document.getElementById('upcomingEventContainer') || document.getElementById('homeProjectsGrid')) {
        initHomePageDynamicSections();
      }
      if (document.getElementById('leadershipContainer')) {
        initLeadershipSection();
      }
      initClubSettings();
    }, 2000); // only re-render 2s after last write
  });
});

function setupMobileDrawer() {
  const toggleBtn = document.getElementById('drawerToggleBtn');
  const drawer = document.getElementById('mobileDrawer');
  const overlay = document.getElementById('mobileDrawerOverlay');
  const closeBtn = document.getElementById('drawerCloseBtn');

  function openDrawer() {
    if (drawer) drawer.classList.add('active');
    if (overlay) overlay.classList.add('active');
  }

  function closeDrawer() {
    if (drawer) drawer.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
  }

  if (toggleBtn) toggleBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);

  // Re-bind drawer toggle when auth changes re-render navbar
  document.addEventListener('click', (e) => {
    if (e.target.id === 'drawerToggleBtn' || e.target.closest('#drawerToggleBtn')) {
      openDrawer();
    }
  });
}

function highlightActiveNavigation() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link, .bottom-nav-item, .drawer-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && (href === currentPath || href.endsWith(currentPath))) {
      link.classList.add('active');
    }
  });
}

// Homepage Dynamic Sections
async function initHomePageDynamicSections() {
  // 1. Dynamic Upcoming Event Banner
  const eventContainer = document.getElementById('upcomingEventContainer');
  if (eventContainer) {
    const events = (await ClubDB.get('events')) || {};
    const eventList = Object.values(events).filter(e => e && e.status === 'upcoming');
    if (eventList.length > 0) {
      const next = eventList[0];
      eventContainer.innerHTML = `
        <div class="card" style="display: grid; grid-template-columns: 1fr; gap: 1.5rem; align-items: center; border: 1px solid var(--border-glow); background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.7) 100%);">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; align-items: center;">
            <img src="${next.coverImage || 'assets/logo/club_logo.png'}" alt="${next.title || 'Event'}" style="width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: var(--radius-sm);" />
            <div>
              <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
                <span class="badge badge-cyan">Upcoming Highlight</span>
                <span class="badge badge-purple">${next.date || 'Soon'}</span>
              </div>
              <h3 style="margin-bottom: 0.75rem;">${next.title}</h3>
              <p style="margin-bottom: 1rem;">${next.description || ''}</p>
              <div style="display: flex; gap: 1rem; align-items: center; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">
                <span>📍 ${next.location || 'College Hall'}</span>
                <span>⏰ ${next.time || 'TBD'}</span>
              </div>
              <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                <a href="event?id=${next.id}" class="btn btn-primary btn-sm">Event Details & RSVP</a>
                <a href="events.html" class="btn btn-outline btn-sm">All Events</a>
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      eventContainer.innerHTML = `
        <div class="card" style="text-align: center; padding: 3rem 2rem; border: 1px solid var(--border-glow); background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.7) 100%);">
          <div style="font-size: 2.5rem; margin-bottom: 1rem;">📅</div>
          <span class="badge badge-amber" style="margin-bottom: 0.75rem; display: inline-block;">Coming Soon</span>
          <h3 style="margin-bottom: 0.75rem;">Next Event Being Planned</h3>
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem; max-width: 480px; margin-left: auto; margin-right: auto;">
            Our team is currently finalizing the next exciting workshop, hackathon, or expo. Check back soon &mdash; something great is coming!
          </p>
          <a href="events.html" class="btn btn-outline btn-sm">Browse Past Events →</a>
        </div>
      `;
    }
  }

  // 2. Featured Projects Grid
  const projectsGrid = document.getElementById('homeProjectsGrid');
  if (projectsGrid) {
    const projects = (await ClubDB.get('projects')) || {};
    const projList = Object.values(projects).slice(0, 3);
    if (projList.length > 0) {
      projectsGrid.innerHTML = projList.map(p => `
        <div class="card" style="display: flex; flex-direction: column;">
          <img src="${p.coverImage || 'assets/logo/club_logo.png'}" alt="${p.title}" class="card-media" />
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span class="badge badge-cyan">${p.category || 'General'}</span>
            <span class="badge ${p.status === 'completed' ? 'badge-emerald' : 'badge-amber'}">${p.status || 'in-progress'}</span>
          </div>
          <h4 style="margin-bottom: 0.5rem; font-size: 1.15rem;">${p.title}</h4>
          <p style="font-size: 0.88rem; margin-bottom: 1rem; line-height: 1.5; flex: 1;">${p.description || ''}</p>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1.25rem;">
            <strong>Tech:</strong> ${p.technology || 'Engineering'}
          </div>
          <a href="project?id=${p.id}" class="btn btn-secondary btn-sm" style="width: 100%;">View Project Blueprint</a>
        </div>
      `).join('');
    } else {
      projectsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem 1.5rem;">
          <div style="font-size: 2rem; margin-bottom: 0.75rem;">🔬</div>
          <h4 style="margin-bottom: 0.5rem;">Projects Coming Soon</h4>
          <p style="color: var(--text-muted); font-size: 0.88rem;">Student prototypes will be showcased here once published.</p>
        </div>
      `;
    }
  }

  // 3. Captured Moments Preview
  const momentsContainer = document.getElementById('homeMomentsGrid');
  if (momentsContainer) {
    const moments = (await ClubDB.get('moments')) || {};
    const momList = Object.values(moments).slice(0, 4);
    if (momList.length > 0) {
      momentsContainer.innerHTML = momList.map(m => `
        <div class="card" style="padding: 0.75rem; cursor: pointer;" onclick="window.location.href='moments.html'">
          <img src="${m.image || 'assets/logo/club_logo.png'}" alt="${m.title}" style="width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: var(--radius-sm); margin-bottom: 0.5rem;" />
          <h5 style="font-size: 0.95rem; margin-bottom: 0.25rem;">${m.title}</h5>
          <p style="font-size: 0.78rem; color: var(--text-muted);">${m.caption || ''}</p>
        </div>
      `).join('');
    } else {
      momentsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem 1.5rem;">
          <div style="font-size: 2rem; margin-bottom: 0.75rem;">📸</div>
          <h4 style="margin-bottom: 0.5rem;">Gallery Coming Soon</h4>
          <p style="color: var(--text-muted); font-size: 0.88rem;">Photos from our lab sessions and events will appear here.</p>
        </div>
      `;
    }
  }

  // 4. Student Voices Testimonials
  const voicesContainer = document.getElementById('homeVoicesGrid');
  if (voicesContainer) {
    const voices = (await ClubDB.get('voices')) || {};
    const voiceList = Object.values(voices).filter(v => v && v.status === 'approved').slice(0, 3);
    if (voiceList.length > 0) {
      voicesContainer.innerHTML = voiceList.map(v => {
        const text = v.message || v.quote || v.review || v.feedback || v.comment || '';
        return `
          <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="color: var(--accent-amber); font-size: 1.1rem; margin-bottom: 0.75rem;">
                ${'\u2605'.repeat(v.rating || 5)}${'\u2606'.repeat(5 - (v.rating || 5))}
              </div>
              <p style="font-style: italic; font-size: 0.92rem; margin-bottom: 1.25rem; color: var(--text-primary);">
                "${text}"
              </p>
            </div>
            <div style="border-top: 1px solid var(--border-subtle); padding-top: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
              <strong style="font-size: 0.9rem;">${v.displayName || 'Member'}</strong>
              <span style="font-size: 0.78rem; color: var(--text-muted);">${v.section ? 'Grade 11 \u2013 ' + v.section : (v.grade || 'Member')}</span>
            </div>
          </div>
        `;
      }).join('');
    } else {
      voicesContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem 1.5rem;">
          <div style="font-size: 2rem; margin-bottom: 0.75rem;">\u2605</div>
          <h4 style="margin-bottom: 0.5rem;">Voices Coming Soon</h4>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 1.25rem;">Be the first to share your club experience!</p>
          <a href="submit-feedback.html" class="btn btn-sm btn-primary">Share Your Experience \u2b50</a>
        </div>
      `;
    }
  }
}

// 5. Dynamic Leadership Team Section (about.html)
async function initLeadershipSection() {
  const container = document.getElementById('leadershipContainer');
  if (!container) return;

  const leaders = (await ClubDB.get('leadership')) || {};
  const leaderList = Object.values(leaders);
  if (leaderList.length === 0) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 3rem 2rem; border: 1px solid var(--border-subtle); background: rgba(15, 23, 42, 0.6);">
        <div style="font-size: 2.5rem; margin-bottom: 1rem;">👥</div>
        <span class="badge badge-cyan" style="margin-bottom: 0.75rem; display: inline-block;">Executive Committee</span>
        <h3 style="margin-bottom: 0.75rem;">Leadership Roster Coming Soon</h3>
        <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto; font-size: 0.92rem; line-height: 1.6;">
          Club executive committee appointments, faculty advisors, and student coordinators for the current session will appear here once appointed online.
        </p>
      </div>
    `;
    return;
  }

  const accents = ['var(--accent-purple)', 'var(--accent-cyan)', 'var(--accent-emerald)', 'var(--accent-amber)'];

  container.innerHTML = leaderList.map((leader, idx) => {
    const accent = accents[idx % accents.length];
    const photo = leader.photo || 'assets/logo/club_logo.png';
    return `
      <div class="card" style="text-align: center; display: flex; flex-direction: column; align-items: center;">
        <img src="${photo}" alt="${leader.name}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin: 0 auto 1rem; border: 2px solid ${accent};" onerror="this.src='assets/logo/club_logo.png'" />
        <h4 style="margin-bottom: 0.25rem;">${leader.name}</h4>
        <div style="color: ${accent}; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem;">${leader.role}</div>
        ${leader.section ? `<div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.75rem;">${leader.section}</div>` : `<div style="margin-bottom: 0.75rem;"></div>`}
        <p style="font-size: 0.85rem; line-height: 1.5; color: var(--text-secondary);">${leader.bio || ''}</p>
      </div>
    `;
  }).join('');
}

// 6. Dynamic Club Settings Binder (Notice Banner, Schedule & Lab Location)
async function initClubSettings() {
  const seed = window.SEED_DATA || {};
  let settings = await ClubDB.get('settings');
  if (!settings || Object.keys(settings).length === 0) {
    settings = seed.settings || {};
  }

  // Notice Banner
  if (settings.noticeBanner && settings.noticeBanner.trim()) {
    let banner = document.getElementById('globalNoticeBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'globalNoticeBanner';
      banner.style.cssText = 'background: linear-gradient(90deg, #1e1b4b, #311042); border-bottom: 1px solid var(--border-glow); padding: 0.6rem 1rem; text-align: center; font-size: 0.88rem; color: #f8fafc; position: relative; z-index: 99;';
      const header = document.querySelector('.site-header');
      if (header && header.parentNode) {
        header.parentNode.insertBefore(banner, header.nextSibling);
      }
    }
    banner.innerHTML = `<span style="margin-right: 0.5rem;">📢</span><strong>Notice:</strong> ${settings.noticeBanner}`;
  } else {
    const existing = document.getElementById('globalNoticeBanner');
    if (existing) existing.remove();
  }

  // FAQ schedule and lab location in about.html if present
  const faqLoc = document.getElementById('faqScheduleLocation');
  if (faqLoc && (settings.schedule || settings.labLocation)) {
    faqLoc.textContent = `Our practical workshops run on ${settings.schedule || 'Tuesdays & Fridays (3:30 PM - 5:00 PM)'} in the ${settings.labLocation || 'Innovation Lab (Room 204) & Maker Hub'}.`;
  }
}

