/**
 * SCIENCE & IT CLUB - ATTENDANCE REVIEW & INTELLIGENCE PANEL
 * Pure Fetch / Read-Only Client Application
 * Fully Self-Contained — No external local file dependencies
 */

(function () {
  'use strict';

  // ── 1. CONFIGURATION & STATE ──────────────────────────────────────────────
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDUKFe5a4_FshRAgMAxp297hae2bPlJTDs",
    authDomain: "studio-8470850847-5d1ba.firebaseapp.com",
    projectId: "studio-8470850847-5d1ba",
    storageBucket: "studio-8470850847-5d1ba.firebasestorage.app",
    messagingSenderId: "35752428546",
    appId: "1:35752428546:web:3d0ab0e5cb5f0dca83531b",
    databaseURL: "https://studio-8470850847-5d1ba-default-rtdb.asia-southeast1.firebasedatabase.app"
  };

  // Feature Launch Date: Attendance tracking officially launched on 2026-09-29 (2083-06-13 BS)
  const FEATURE_LAUNCH_DATE_STR = "2026-09-29";
  const FEATURE_LAUNCH_DATE_TIME = new Date("2026-09-29T00:00:00+05:45").getTime();

  // App State
  let allStudents = [];
  let attendanceByDate = {}; // { 'YYYY-MM-DD': { uid: record } }
  let studentHistory = {};   // { uid: { 'YYYY-MM-DD': record } }
  let selectedDateStr = "";  // Defaults to today's date in Nepal
  let activeTab = "all";     // "all" | "present" | "absent" | "morning" | "night"
  let searchQuery = "";
  let selectedGrade = "";
  let selectedSection = "";
  let sortBy = "name-asc";
  let activeView = "grid";   // "grid" | "table"

  // Active student being inspected in modal
  let currentModalUid = null;
  let calCurrentYear = 2026;
  let calCurrentMonth = 8; // 0-indexed (8 = September)

  // ── 2. BIKRAM SAMBAT CALENDAR ENGINE ──────────────────────────────────────
  const BS_MONTH_DAYS = {
    2070: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    2071: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2072: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2073: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2074: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    2075: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2078: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2082: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2083: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2084: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2085: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2086: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2087: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],
    2088: [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30],
    2089: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
    2090: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30]
  };

  const NEPALI_MONTHS = [
    { en: 'Baishakh', np: 'बैशाख' },
    { en: 'Jestha', np: 'जेठ' },
    { en: 'Ashadh', np: 'असार' },
    { en: 'Shrawan', np: 'साउन' },
    { en: 'Bhadra', np: 'भदौ' },
    { en: 'Ashwin', np: 'असोज' },
    { en: 'Kartik', np: 'कात्तिक' },
    { en: 'Mangsir', np: 'मंसिर' },
    { en: 'Poush', np: 'पुस' },
    { en: 'Magh', np: 'माघ' },
    { en: 'Falgun', np: 'फागुन' },
    { en: 'Chaitra', np: 'चैत' }
  ];

  const NEPALI_DAYS = [
    { en: 'Sunday', np: 'आइतबार' },
    { en: 'Monday', np: 'सोमबार' },
    { en: 'Tuesday', np: 'मंगलबार' },
    { en: 'Wednesday', np: 'बुधबार' },
    { en: 'Thursday', np: 'बिहिबार' },
    { en: 'Friday', np: 'शुक्रबार' },
    { en: 'Saturday', np: 'शनिबार' }
  ];

  const DEVANAGARI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  const toDevanagari = (num) => String(num).replace(/[0-9]/g, (d) => DEVANAGARI_DIGITS[d]);
  const pad2 = (n) => String(n).padStart(2, '0');

  function getNepaliDateTime(date = new Date()) {
    try {
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kathmandu',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
      });
      const parts = dtf.formatToParts(date);
      const partMap = {};
      for (const p of parts) partMap[p.type] = p.value;

      const y = parseInt(partMap.year, 10);
      const m = parseInt(partMap.month, 10);
      const d = parseInt(partMap.day, 10);
      const hour = parseInt(partMap.hour, 10);
      const minute = parseInt(partMap.minute, 10);
      const second = parseInt(partMap.second, 10);

      const dayIndex = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
      const refUtc = Date.UTC(2018, 3, 14);
      const targetUtc = Date.UTC(y, m - 1, d);
      let diffDays = Math.round((targetUtc - refUtc) / 86400000);

      let bsYear = 2075;
      let bsMonthIndex = 0;
      let bsDay = 1;

      if (diffDays >= 0) {
        while (diffDays > 0) {
          const daysInCurMonth = (BS_MONTH_DAYS[bsYear] && BS_MONTH_DAYS[bsYear][bsMonthIndex]) || 30;
          if (diffDays >= daysInCurMonth) {
            diffDays -= daysInCurMonth;
            bsMonthIndex++;
            if (bsMonthIndex > 11) {
              bsMonthIndex = 0;
              bsYear++;
            }
          } else {
            bsDay += diffDays;
            diffDays = 0;
          }
        }
      }

      const bsMonthNumber = bsMonthIndex + 1;
      const monthInfo = NEPALI_MONTHS[bsMonthIndex] || { en: 'Month', np: 'महिना' };
      const dayInfo = NEPALI_DAYS[dayIndex] || { en: 'Day', np: 'दिन' };

      const h12 = hour % 12 || 12;
      const ampm = hour < 12 ? 'AM' : 'PM';
      const time12 = `${pad2(h12)}:${pad2(minute)}:${pad2(second)} ${ampm}`;
      const adDateFormatted = `${y}-${pad2(m)}-${pad2(d)}`;
      const bsDateFormatted = `${bsYear}-${pad2(bsMonthNumber)}-${pad2(bsDay)}`;
      const bsDateDevanagari = `${toDevanagari(bsDay)} ${monthInfo.np} ${toDevanagari(bsYear)}`;
      const bsDateDisplay = `${bsDay} ${monthInfo.en} ${bsYear}`;
      const nepaliFullDateDisplay = `${dayInfo.np}, ${toDevanagari(bsDay)} ${monthInfo.np} ${toDevanagari(bsYear)}`;

      return {
        adDate: adDateFormatted,
        year: y,
        month: m,
        day: d,
        bsDate: bsDateFormatted,
        bsYear: bsYear,
        bsMonth: bsMonthNumber,
        bsDay: bsDay,
        bsMonthNameNp: monthInfo.np,
        bsMonthNameEn: monthInfo.en,
        bsDateDisplay: bsDateDisplay,
        bsDateDevanagari: bsDateDevanagari,
        nepaliFullDate: nepaliFullDateDisplay,
        nepaliDay: dayInfo.np,
        nepaliDayCombined: `${dayInfo.np} (${dayInfo.en})`,
        time12: time12,
        hour: hour
      };
    } catch (_) {
      const now = new Date();
      const iso = now.toISOString().slice(0, 10);
      return {
        adDate: iso,
        bsDate: iso,
        bsDateDevanagari: iso,
        bsDateDisplay: iso,
        nepaliFullDate: iso,
        nepaliDay: 'दिन',
        nepaliDayCombined: 'Day',
        time12: now.toLocaleTimeString(),
        hour: now.getHours()
      };
    }
  }

  // ── 3. DATE UTILITIES & ELIGIBLE DAYS GENERATOR ───────────────────────────
  function parseDateToNepalString(dateObj) {
    return getNepaliDateTime(dateObj).adDate;
  }

  /**
   * Generates array of all date strings 'YYYY-MM-DD' between startDateStr and endDateStr (inclusive)
   */
  function generateDateRange(startDateStr, endDateStr) {
    const list = [];
    const curr = new Date(startDateStr + 'T00:00:00Z');
    const end = new Date(endDateStr + 'T00:00:00Z');
    while (curr <= end) {
      list.push(curr.toISOString().slice(0, 10));
      curr.setUTCDate(curr.getUTCDate() + 1);
    }
    return list;
  }

  /**
   * Evaluates student's baseline tracking start date:
   *  - If student registered ON or BEFORE feature launch (2026-09-29): tracking starts on 2026-09-29!
   *  - If student registers AFTER feature launch: tracking starts on their registration date!
   */
  function getStudentTrackingStartDate(user) {
    if (!user || !user.createdAt) {
      return FEATURE_LAUNCH_DATE_STR;
    }
    const regTimestamp = Number(user.createdAt);
    if (isNaN(regTimestamp) || regTimestamp <= FEATURE_LAUNCH_DATE_TIME) {
      return FEATURE_LAUNCH_DATE_STR;
    }
    const regDate = new Date(regTimestamp);
    return parseDateToNepalString(regDate);
  }

  // ── 4. FIREBASE INITIALIZATION & AUTH HANDSHAKE ───────────────────────────
  let firebaseApp = null;
  let firebaseDb = null;
  let firebaseAuth = null;
  let _authReadyPromise = null;
  let _authResolved = false;

  try {
    if (typeof firebase !== 'undefined') {
      firebaseApp = !firebase.apps.length ? firebase.initializeApp(FIREBASE_CONFIG) : firebase.app();
      firebaseDb = firebase.database();
      firebaseAuth = firebase.auth();

      // Ensure session is shared across domain
      try {
        firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
      } catch (_) {}

      // Automatically detect if user is already signed in on this domain
      firebaseAuth.onAuthStateChanged((user) => {
        _authResolved = true;
        if (user) {
          console.log("[AttendancePanel] Auth session restored from domain:", user.email || user.displayName || user.uid);
          hideAuthNotice();
          fetchAllData();
        } else {
          console.log("[AttendancePanel] No active auth session yet.");
        }
      });
    }
  } catch (err) {
    console.warn("[AttendancePanel] Firebase init:", err.message);
  }

  function ensureAuthReady(timeoutMs = 2800) {
    if (!firebaseAuth) return Promise.resolve(null);
    if (firebaseAuth.currentUser) return Promise.resolve(firebaseAuth.currentUser);
    if (_authResolved) return Promise.resolve(firebaseAuth.currentUser);

    if (!_authReadyPromise) {
      _authReadyPromise = new Promise((resolve) => {
        let done = false;
        const finish = (user) => {
          if (!done) {
            done = true;
            _authResolved = true;
            resolve(user);
          }
        };
        const unsub = firebaseAuth.onAuthStateChanged((user) => {
          if (user) {
            try { unsub(); } catch (_) {}
            finish(user);
          }
        });
        setTimeout(() => {
          finish(firebaseAuth.currentUser || null);
        }, timeoutMs);
      });
    }
    return _authReadyPromise;
  }

  function showAuthNotice() {
    const banner = document.getElementById('authNoticeBanner');
    if (banner) banner.style.display = 'block';
  }

  function hideAuthNotice() {
    const banner = document.getElementById('authNoticeBanner');
    if (banner) banner.style.display = 'none';
  }

  async function signInWithGoogle() {
    if (!firebaseAuth) {
      alert("Firebase Auth is not available.");
      return;
    }
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await firebaseAuth.signInWithPopup(provider);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        try {
          const provider = new firebase.auth.GoogleAuthProvider();
          await firebaseAuth.signInWithRedirect(provider);
        } catch (e2) {
          alert("Sign-in note: " + e2.message);
        }
      }
    }
  }

  // ── 5. DATA FETCHING (READ-ONLY ENGINE) ────────────────────────────────────
  async function fetchAllData() {
    showLoading(true);
    const todayInfo = getNepaliDateTime(new Date());
    if (!selectedDateStr) {
      selectedDateStr = todayInfo.adDate;
      const dateInput = document.getElementById('selectedDateInput');
      if (dateInput) dateInput.value = selectedDateStr;
    }

    try {
      // Step A: Wait for Firebase Auth to finish checking the browser's IndexedDB session
      const currentUser = await ensureAuthReady(2200);

      // 1. Fetch all users (/users)
      let usersMap = {};
      let permissionDenied = false;

      if (firebaseDb) {
        try {
          const snap = await firebaseDb.ref('users').once('value');
          if (snap && snap.exists()) usersMap = snap.val();
        } catch (e) {
          if (e && e.message && e.message.toLowerCase().includes('permission')) {
            permissionDenied = true;
          }
          console.warn("[AttendancePanel] Users fetch note:", e.message);
        }
      }

      // Fallback check in local storage if online DB was restricted or offline
      if (Object.keys(usersMap).length === 0) {
        try {
          const cached = localStorage.getItem('CLUB_WEB_DB_STORE_V5');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.users) usersMap = parsed.users;
          }
        } catch (_) { }
      }

      // 2. Fetch all attendance (/attendance)
      let attendanceTree = {};
      if (firebaseDb) {
        try {
          const snap = await firebaseDb.ref('attendance').once('value');
          if (snap && snap.exists()) attendanceTree = snap.val();
        } catch (e) {
          if (e && e.message && e.message.toLowerCase().includes('permission')) {
            permissionDenied = true;
          }
          console.warn("[AttendancePanel] Attendance fetch note:", e.message);
        }
      }

      // Check fallback cached attendance
      if (Object.keys(attendanceTree).length === 0) {
        try {
          const cached = localStorage.getItem('CLUB_WEB_DB_STORE_V5');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.attendance) attendanceTree = parsed.attendance;
          }
        } catch (_) { }
      }

      // If user is truly not logged in and permission was denied
      if (permissionDenied && !currentUser && Object.keys(usersMap).length === 0) {
        showAuthNotice();
      } else {
        hideAuthNotice();
      }

      // Save global attendance mapping
      attendanceByDate = attendanceTree || {};

      // 3. Process every student and build comprehensive history
      const processedStudents = [];
      const historyMap = {};

      const userEntries = Object.entries(usersMap);
      for (const [uid, u] of userEntries) {
        if (!u) continue;
        const student = { ...u, uid: uid };
        const trackingStart = getStudentTrackingStartDate(student);

        // Build list of all eligible tracking days up to today
        const eligibleDates = generateDateRange(trackingStart, todayInfo.adDate);

        // Gather all attendance records for this student
        studentHistory[uid] = studentHistory[uid] || {};
        let presentDaysCount = 0;
        let morningVisitsTotal = 0;
        let nightVisitsTotal = 0;

        // Check central attendance tree for this student
        for (const dateKey of eligibleDates) {
          const dayRecord = attendanceByDate[dateKey] && attendanceByDate[dateKey][uid];
          // Also check user's internal attendance node if available
          const internalRecord = student.attendance && student.attendance[dateKey];
          const record = dayRecord || internalRecord;

          if (record) {
            studentHistory[uid][dateKey] = record;
            presentDaysCount++;
            if (record.morning && record.morning.attended) morningVisitsTotal += (record.morning.visits || 1);
            if (record.night && record.night.attended) nightVisitsTotal += (record.night.visits || 1);
          }
        }

        const totalEligible = eligibleDates.length;
        const absentDaysCount = Math.max(0, totalEligible - presentDaysCount);
        const attendanceRate = totalEligible > 0 ? Math.round((presentDaysCount / totalEligible) * 100) : 100;

        // Today / Selected date attendance record
        const selectedDateRecord = (attendanceByDate[selectedDateStr] && attendanceByDate[selectedDateStr][uid]) ||
          (student.attendance && student.attendance[selectedDateStr]) || null;

        student.trackingStartDate = trackingStart;
        student.eligibleDates = eligibleDates;
        student.presentDaysCount = presentDaysCount;
        student.absentDaysCount = absentDaysCount;
        student.attendanceRate = attendanceRate;
        student.morningVisitsTotal = morningVisitsTotal;
        student.nightVisitsTotal = nightVisitsTotal;
        student.selectedDateRecord = selectedDateRecord;
        student.isPresentOnSelectedDate = !!selectedDateRecord;

        processedStudents.push(student);
      }

      allStudents = processedStudents;

      // Update dynamic filter dropdowns (Grades & Sections)
      populateFilterDropdowns();

      // Render summary cards & roster
      renderSummaryCards();
      renderRoster();
    } catch (err) {
      console.error("[AttendancePanel] Data processing error:", err);
    } finally {
      showLoading(false);
    }
  }

  // ── 6. UI RENDERING & FILTERING ───────────────────────────────────────────
  function populateFilterDropdowns() {
    const gradeSelect = document.getElementById('gradeFilter');
    const sectionSelect = document.getElementById('sectionFilter');
    if (!gradeSelect || !sectionSelect) return;

    const grades = new Set();
    const sections = new Set();

    allStudents.forEach((s) => {
      if (s.grade) grades.add(String(s.grade).trim());
      if (s.section) sections.add(String(s.section).trim());
    });

    // Populate Grades
    const curGrade = gradeSelect.value;
    gradeSelect.innerHTML = `<option value="">All Classes/Grades</option>`;
    Array.from(grades).sort().forEach((g) => {
      gradeSelect.innerHTML += `<option value="${g}">Grade ${g}</option>`;
    });
    gradeSelect.value = curGrade;

    // Populate Sections
    const curSec = sectionSelect.value;
    sectionSelect.innerHTML = `<option value="">All Sections</option>`;
    Array.from(sections).sort().forEach((sec) => {
      sectionSelect.innerHTML += `<option value="${sec}">Section ${sec}</option>`;
    });
    sectionSelect.value = curSec;
  }

  function renderSummaryCards() {
    const totalCount = allStudents.length;
    let presentCount = 0;
    let morningCount = 0;
    let nightCount = 0;

    allStudents.forEach((s) => {
      if (s.isPresentOnSelectedDate) {
        presentCount++;
        const rec = s.selectedDateRecord;
        if (rec && rec.morning && rec.morning.attended) morningCount++;
        if (rec && rec.night && rec.night.attended) nightCount++;
      }
    });

    const absentCount = Math.max(0, totalCount - presentCount);
    const presentRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
    const absentRate = totalCount > 0 ? Math.round((absentCount / totalCount) * 100) : 0;

    // Update Counts
    setText('statTotalStudents', totalCount);
    setText('statPresentToday', presentCount);
    setText('statAbsentToday', absentCount);
    setText('statMorningActive', morningCount);
    setText('statNightActive', nightCount);

    setText('subPresentToday', `${presentRate}% attendance on ${selectedDateStr}`);
    setText('subAbsentToday', `${absentRate}% unrecorded on ${selectedDateStr}`);

    // Update Tab Counts
    setText('tabCountAll', totalCount);
    setText('tabCountPresent', presentCount);
    setText('tabCountAbsent', absentCount);
    setText('tabCountMorning', morningCount);
    setText('tabCountNight', nightCount);
  }

  function getFilteredAndSortedStudents() {
    let list = [...allStudents];

    // Filter by Active Tab
    if (activeTab === 'present') {
      list = list.filter((s) => s.isPresentOnSelectedDate);
    } else if (activeTab === 'absent') {
      list = list.filter((s) => !s.isPresentOnSelectedDate);
    } else if (activeTab === 'morning') {
      list = list.filter((s) => s.selectedDateRecord && s.selectedDateRecord.morning && s.selectedDateRecord.morning.attended);
    } else if (activeTab === 'night') {
      list = list.filter((s) => s.selectedDateRecord && s.selectedDateRecord.night && s.selectedDateRecord.night.attended);
    }

    // Filter by Class / Grade
    if (selectedGrade) {
      list = list.filter((s) => String(s.grade).trim() === selectedGrade);
    }

    // Filter by Section
    if (selectedSection) {
      list = list.filter((s) => String(s.section).trim() === selectedSection);
    }

    // Filter by Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const name = (s.displayName || s.name || '').toLowerCase();
        const email = (s.email || '').toLowerCase();
        const phone = (s.phone || s.whatsapp || '').toLowerCase();
        const grade = (s.grade || '').toLowerCase();
        const section = (s.section || '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q) || grade.includes(q) || section.includes(q);
      });
    }

    // Sort
    list.sort((a, b) => {
      const nameA = (a.displayName || a.name || '').toLowerCase();
      const nameB = (b.displayName || b.name || '').toLowerCase();

      switch (sortBy) {
        case 'name-asc':
          return nameA.localeCompare(nameB);
        case 'name-desc':
          return nameB.localeCompare(nameA);
        case 'rate-desc':
          return b.attendanceRate - a.attendanceRate;
        case 'rate-asc':
          return a.attendanceRate - b.attendanceRate;
        case 'present-desc':
          return b.presentDaysCount - a.presentDaysCount;
        default:
          return 0;
      }
    });

    return list;
  }

  function renderRoster() {
    const list = getFilteredAndSortedStudents();
    const gridContainer = document.getElementById('studentsGrid');
    const tableBody = document.getElementById('rosterTableBody');
    const emptyState = document.getElementById('emptyState');

    if (list.length === 0) {
      if (gridContainer) gridContainer.style.display = 'none';
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 3rem; color:var(--text-muted);">No students match this filter criteria.</td></tr>`;
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // 1. Render Grid Cards
    if (gridContainer) {
      gridContainer.style.display = activeView === 'grid' ? 'grid' : 'none';
      gridContainer.innerHTML = list.map((s) => renderStudentCardHtml(s)).join('');
    }

    // 2. Render Table Rows
    if (tableBody) {
      const tableWrapper = document.getElementById('tableWrapper');
      if (tableWrapper) tableWrapper.style.display = activeView === 'table' ? 'block' : 'none';
      tableBody.innerHTML = list.map((s) => renderStudentTableRowHtml(s)).join('');
    }
  }

  function renderStudentCardHtml(s) {
    const isPresent = s.isPresentOnSelectedDate;
    const rec = s.selectedDateRecord;
    const cardClass = isPresent ? 'is-present' : 'is-absent';

    const statusBadge = isPresent
      ? `<span class="today-status-badge badge-present">✔ PRESENT (${rec.lastOpenedTime || rec.time12 || 'Logged In'})</span>`
      : `<span class="today-status-badge badge-absent">✖ ABSENT on ${selectedDateStr}</span>`;

    const gradeLabel = s.grade ? `Gr ${s.grade} ${s.section ? '• ' + s.section : ''}` : (s.section || 'Student');
    const phone = s.phone || s.whatsapp || '';
    const phoneHtml = phone
      ? `<a href="https://wa.me/${phone.replace(/[^0-9]/g, '')}" target="_blank" class="wa-link" title="Chat on WhatsApp">📱 ${phone}</a>`
      : '<span style="color:var(--text-muted);">—</span>';

    // Morning & Night slots on selected date
    const morningAttended = rec && rec.morning && rec.morning.attended;
    const nightAttended = rec && rec.night && rec.night.attended;
    const shiftsHtml = isPresent
      ? `<div style="display:flex;gap:4px;margin-bottom:0.75rem;">
           <span class="stat-badge ${morningAttended ? 'badge-morning' : 'badge-outline'}" style="font-size:0.7rem;">
             ${morningAttended ? '🌅 Morning: ' + rec.morning.firstVisit : '🌅 Morning: None'}
           </span>
           <span class="stat-badge ${nightAttended ? 'badge-night' : 'badge-outline'}" style="font-size:0.7rem;">
             ${nightAttended ? '🌙 Night: ' + rec.night.firstVisit : '🌙 Night: None'}
           </span>
         </div>`
      : '';

    // Lifetime Meter Color
    const rateColor = s.attendanceRate >= 80 ? 'var(--present-green)' : s.attendanceRate >= 50 ? 'var(--morning-amber)' : 'var(--absent-red)';

    return `
      <div class="student-card ${cardClass}">
        <div class="student-card-header">
          <img src="${s.photoURL || 'club_logo.png'}" class="student-avatar" onerror="this.src='club_logo.png'" alt="${s.displayName || 'Student'}" />
          <div class="student-info">
            <h3 class="student-name" title="${s.displayName || 'Member'}">${s.displayName || 'Member'}</h3>
            <span class="student-role-tag role-${s.role || 'member'}">${(s.role || 'member').toUpperCase()}</span>
          </div>
        </div>

        ${statusBadge}
        ${shiftsHtml}

        <div class="student-meta-list">
          <div class="meta-row">
            <span class="label">Class &amp; Section</span>
            <span class="val">${gradeLabel}</span>
          </div>
          <div class="meta-row">
            <span class="label">Phone / WhatsApp</span>
            <span class="val">${phoneHtml}</span>
          </div>
          <div class="meta-row">
            <span class="label">Email</span>
            <span class="val" style="font-size:0.75rem;">${s.email || '—'}</span>
          </div>
          <div class="meta-row">
            <span class="label">Tracking Since</span>
            <span class="val" style="font-size:0.75rem;color:var(--accent-cyan);">${s.trackingStartDate}</span>
          </div>
        </div>

        <!-- Lifetime Progress Bar -->
        <div class="lifetime-progress-wrap">
          <div class="progress-labels">
            <span>Lifetime Rate: <strong>${s.attendanceRate}%</strong></span>
            <span>${s.presentDaysCount} Present / ${s.eligibleDates.length} Days</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${s.attendanceRate}%; background: ${rateColor};"></div>
          </div>
        </div>

        <div class="student-card-actions">
          <button class="btn btn-primary btn-sm" onclick="window.AttendanceApp.openStudentModal('${s.uid}')">
            📅 View Calendar &amp; Profile
          </button>
        </div>
      </div>
    `;
  }

  function renderStudentTableRowHtml(s) {
    const isPresent = s.isPresentOnSelectedDate;
    const rec = s.selectedDateRecord;
    const statusPill = isPresent
      ? `<span class="stat-badge badge-present">✔ Present (${rec.lastOpenedTime || rec.time12 || 'Yes'})</span>`
      : `<span class="stat-badge badge-absent">✖ Absent</span>`;

    const phone = s.phone || s.whatsapp || '';
    const phoneHtml = phone
      ? `<a href="https://wa.me/${phone.replace(/[^0-9]/g, '')}" target="_blank" class="wa-link">📱 ${phone}</a>`
      : '—';

    const morningHtml = rec && rec.morning && rec.morning.attended ? `🌅 ${rec.morning.firstVisit}` : '—';
    const nightHtml = rec && rec.night && rec.night.attended ? `🌙 ${rec.night.firstVisit}` : '—';
    const rateColor = s.attendanceRate >= 80 ? 'var(--present-green)' : s.attendanceRate >= 50 ? 'var(--morning-amber)' : 'var(--absent-red)';

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:0.75rem;">
            <img src="${s.photoURL || 'club_logo.png'}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;" onerror="this.src='club_logo.png'" />
            <div>
              <strong style="display:block;">${s.displayName || 'Member'}</strong>
              <small style="color:var(--text-muted);">${(s.role || 'member').toUpperCase()}</small>
            </div>
          </div>
        </td>
        <td>${s.grade ? `Gr ${s.grade} – ${s.section || 'General'}` : (s.section || '—')}</td>
        <td>${phoneHtml}</td>
        <td style="font-size:0.8rem;word-break:break-all;">${s.email || '—'}</td>
        <td>${statusPill}</td>
        <td style="font-size:0.78rem;">${morningHtml}</td>
        <td style="font-size:0.78rem;">${nightHtml}</td>
        <td>
          <span style="font-weight:700;color:${rateColor};">${s.attendanceRate}%</span>
          <small style="color:var(--text-muted);display:block;">${s.presentDaysCount}/${s.eligibleDates.length}d</small>
        </td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="window.AttendanceApp.openStudentModal('${s.uid}')">
            Calendar
          </button>
        </td>
      </tr>
    `;
  }

  // ── 7. STUDENT DETAIL & INTERACTIVE CALENDAR MODAL ─────────────────────────
  function openStudentModal(uid) {
    const student = allStudents.find((s) => s.uid === uid);
    if (!student) return;
    currentModalUid = uid;

    // Populate Profile Header
    setImage('modalStudentAvatar', student.photoURL || 'club_logo.png');
    setText('modalStudentName', student.displayName || 'Student Profile');
    setText('modalStudentRole', (student.role || 'member').toUpperCase());

    const gradeSec = student.grade ? `Class: Grade ${student.grade} (Section ${student.section || '—'})` : (student.section || 'Class: Science & IT Member');
    setText('modalStudentGradeSec', gradeSec);

    const phone = student.phone || student.whatsapp || '';
    const phoneEl = document.getElementById('modalStudentPhone');
    if (phoneEl) {
      phoneEl.innerHTML = phone
        ? `Phone: <a href="https://wa.me/${phone.replace(/[^0-9]/g, '')}" target="_blank" class="wa-link">📱 ${phone} (WhatsApp)</a>`
        : `Phone: <span style="color:var(--text-muted);">Not provided</span>`;
    }

    setText('modalStudentEmail', `Email: ${student.email || 'Not provided'}`);

    const joinedDateStr = student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'N/A';
    setText('modalStudentJoined', `Joined: ${joinedDateStr} • Tracking Base: ${student.trackingStartDate}`);

    // Populate Lifetime Summary
    setText('mStatRate', `${student.attendanceRate}%`);
    setText('mStatPresent', `${student.presentDaysCount} Days`);
    setText('mStatAbsent', `${student.absentDaysCount} Days`);
    setText('mStatEligible', `${student.eligibleDates.length} Days`);
    setText('mStatMorning', `${student.morningVisitsTotal} Opens`);
    setText('mStatNight', `${student.nightVisitsTotal} Opens`);

    // Reset Calendar to Current Year/Month
    const today = getNepaliDateTime(new Date());
    calCurrentYear = today.year;
    calCurrentMonth = today.month - 1; // 0-indexed

    renderStudentCalendar(student);
    renderStudentLogsTable(student);

    // Hide any previous single-day inspection card
    const dayCard = document.getElementById('dayInspectionCard');
    if (dayCard) dayCard.classList.remove('active');

    // Show modal
    const modal = document.getElementById('studentCalendarModal');
    if (modal) modal.classList.add('active');
  }

  function renderStudentCalendar(student) {
    if (!student) return;
    const calGrid = document.getElementById('calendarGrid');
    const calTitle = document.getElementById('calendarMonthTitle');
    if (!calGrid || !calTitle) return;

    // Gregorian Month details
    const firstDayOfMonth = new Date(calCurrentYear, calCurrentMonth, 1);
    const startDayIndex = firstDayOfMonth.getDay(); // 0 = Sun
    const daysInMonth = new Date(calCurrentYear, calCurrentMonth + 1, 0).getDate();

    const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const curMonthName = monthNamesEn[calCurrentMonth];

    // Reference Nepali Date for 15th of this month to display Nepali BS Month Name
    const midMonthDate = new Date(calCurrentYear, calCurrentMonth, 15);
    const nepaliInfo = getNepaliDateTime(midMonthDate);

    calTitle.innerHTML = `📅 ${curMonthName} ${calCurrentYear} <span style="color:var(--text-muted);font-size:0.9rem;font-weight:500;">(${nepaliInfo.bsMonthNameNp} ${nepaliInfo.bsYear} BS)</span>`;

    const todayDateStr = getNepaliDateTime(new Date()).adDate;
    const trackingStart = student.trackingStartDate; // 'YYYY-MM-DD'
    const studentHistoryMap = studentHistory[student.uid] || {};

    let gridHtml = '';

    // Empty cells before start of month
    for (let i = 0; i < startDayIndex; i++) {
      gridHtml += `<div class="cal-cell empty"></div>`;
    }

    // Days in Month
    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(calCurrentYear, calCurrentMonth, day);
      const dateStr = parseDateToNepalString(cellDate);
      const dayNepaliInfo = getNepaliDateTime(cellDate);

      let cellClass = '';
      let badgeLabel = '';
      let isClickable = false;

      if (dateStr > todayDateStr) {
        // Future date
        cellClass = 'is-future';
      } else if (dateStr < trackingStart) {
        // Before student joined or feature launch date
        cellClass = 'is-pre-reg';
        badgeLabel = 'Pre-join';
      } else {
        // Eligible Tracking Day: MUST BE PRESENT (GREEN) OR ABSENT (RED)!
        const rec = studentHistoryMap[dateStr];
        if (rec) {
          // 🟢 PRESENT: GREEN
          cellClass = 'is-present';
          badgeLabel = '✔ Present';
        } else {
          // 🔴 ABSENT: RED
          cellClass = 'is-absent';
          badgeLabel = '✖ Absent';
        }
        isClickable = true;
      }

      const onClickAttr = isClickable ? `onclick="window.AttendanceApp.inspectCalendarDay('${student.uid}', '${dateStr}')"` : '';

      gridHtml += `
        <div class="cal-cell ${cellClass}" ${onClickAttr} title="${dateStr} (${dayNepaliInfo.nepaliDay})">
          <div class="cal-day-num">${day}</div>
          <div class="cal-bs-num">${dayNepaliInfo.bsDay} ${dayNepaliInfo.bsMonthNameNp}</div>
          <div class="cal-cell-badges">
            <span class="cal-badge-pill">${badgeLabel}</span>
          </div>
        </div>
      `;
    }

    calGrid.innerHTML = gridHtml;
  }

  function inspectCalendarDay(uid, dateStr) {
    const student = allStudents.find((s) => s.uid === uid);
    if (!student) return;

    const dayCard = document.getElementById('dayInspectionCard');
    if (!dayCard) return;

    const dObj = new Date(dateStr + 'T12:00:00Z');
    const nepaliInfo = getNepaliDateTime(dObj);
    const rec = (studentHistory[uid] && studentHistory[uid][dateStr]) || null;

    const isPresent = !!rec;
    const statusText = isPresent
      ? `<span class="stat-badge badge-present" style="font-size:0.9rem;">✔ PRESENT (उपस्थित)</span>`
      : `<span class="stat-badge badge-absent" style="font-size:0.9rem;">✖ ABSENT (अनुपस्थित)</span>`;

    let detailsHtml = '';
    if (isPresent) {
      const m = rec.morning && rec.morning.attended;
      const n = rec.night && rec.night.attended;
      detailsHtml = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.75rem;margin-top:0.75rem;">
          <div style="background:rgba(0,0,0,0.25);padding:0.75rem;border-radius:8px;border:1px solid var(--border-subtle);">
            <div style="color:var(--text-muted);font-size:0.75rem;">🌅 MORNING SESSION</div>
            <div style="font-weight:700;color:${m ? 'var(--morning-amber)' : 'var(--text-muted)'};">
              ${m ? `Attended (${rec.morning.firstVisit})` : 'Did not open'}
            </div>
            ${m ? `<small style="color:var(--text-secondary);">${rec.morning.visits} session(s)</small>` : ''}
          </div>
          <div style="background:rgba(0,0,0,0.25);padding:0.75rem;border-radius:8px;border:1px solid var(--border-subtle);">
            <div style="color:var(--text-muted);font-size:0.75rem;">🌙 NIGHT SESSION</div>
            <div style="font-weight:700;color:${n ? 'var(--night-indigo)' : 'var(--text-muted)'};">
              ${n ? `Attended (${rec.night.firstVisit})` : 'Did not open'}
            </div>
            ${n ? `<small style="color:var(--text-secondary);">${rec.night.visits} session(s)</small>` : ''}
          </div>
        </div>
        <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.75rem;">
          First visit: <strong>${rec.firstOpenedTime || '—'}</strong> • Last visit: <strong>${rec.lastOpenedTime || '—'}</strong> • Device: <strong>${rec.device || 'Web Browser'}</strong>
        </div>
      `;
    } else {
      detailsHtml = `
        <p style="font-size:0.82rem;color:var(--text-secondary);margin-top:0.5rem;">
          No website visits or login activity were recorded on this day.
        </p>
      `;
    }

    dayCard.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
        <div>
          <h4 style="margin:0;font-size:1.05rem;color:var(--text-primary);">
            ${nepaliInfo.nepaliFullDate}
          </h4>
          <span style="font-size:0.8rem;color:var(--text-muted);">${dateStr} (${nepaliInfo.nepaliDayCombined})</span>
        </div>
        <div>${statusText}</div>
      </div>
      ${detailsHtml}
    `;

    dayCard.classList.add('active');
  }

  function renderStudentLogsTable(student) {
    const tbody = document.getElementById('modalLogsTableBody');
    if (!tbody || !student) return;

    // Show logs in reverse chronological order (latest date first)
    const reversedDates = [...student.eligibleDates].reverse();
    const historyMap = studentHistory[student.uid] || {};

    tbody.innerHTML = reversedDates.map((dateStr) => {
      const dObj = new Date(dateStr + 'T12:00:00Z');
      const nep = getNepaliDateTime(dObj);
      const rec = historyMap[dateStr];
      const isPresent = !!rec;

      const badge = isPresent
        ? `<span class="stat-badge badge-present">✔ Present</span>`
        : `<span class="stat-badge badge-absent">✖ Absent</span>`;

      const timeOpened = isPresent ? (rec.lastOpenedTime || rec.time12 || '—') : '—';
      const morningStr = rec && rec.morning && rec.morning.attended ? `🌅 ${rec.morning.firstVisit}` : '—';
      const nightStr = rec && rec.night && rec.night.attended ? `🌙 ${rec.night.firstVisit}` : '—';

      return `
        <tr>
          <td><strong>${dateStr}</strong></td>
          <td>${nep.nepaliDay}</td>
          <td>${nep.bsDateDevanagari}</td>
          <td>${badge}</td>
          <td>${timeOpened}</td>
          <td style="font-size:0.78rem;">${morningStr}</td>
          <td style="font-size:0.78rem;">${nightStr}</td>
        </tr>
      `;
    }).join('');
  }

  // ── 8. EXPORT TO CSV ──────────────────────────────────────────────────────
  function exportRosterToCsv() {
    const list = getFilteredAndSortedStudents();
    if (list.length === 0) {
      alert("No students to export.");
      return;
    }

    const headers = [
      "Student Name",
      "Class/Grade",
      "Section",
      "Phone/WhatsApp",
      "Email",
      `Status on ${selectedDateStr}`,
      "Morning Visit",
      "Night Visit",
      "Lifetime Attendance Rate (%)",
      "Days Present",
      "Total Tracked Days",
      "Tracking Base Date"
    ];

    const rows = list.map((s) => {
      const isPresent = s.isPresentOnSelectedDate;
      const rec = s.selectedDateRecord;
      const morningStr = rec && rec.morning && rec.morning.attended ? rec.morning.firstVisit : "None";
      const nightStr = rec && rec.night && rec.night.attended ? rec.night.firstVisit : "None";

      return [
        `"${(s.displayName || s.name || '').replace(/"/g, '""')}"`,
        `"${s.grade || ''}"`,
        `"${s.section || ''}"`,
        `"${s.phone || s.whatsapp || ''}"`,
        `"${s.email || ''}"`,
        `"${isPresent ? 'Present' : 'Absent'}"`,
        `"${morningStr}"`,
        `"${nightStr}"`,
        `"${s.attendanceRate}%"`,
        `"${s.presentDaysCount}"`,
        `"${s.eligibleDates.length}"`,
        `"${s.trackingStartDate}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_report_${selectedDateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  // ── 9. HELPERS & EVENT LISTENERS ──────────────────────────────────────────
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setImage(id, src) {
    const el = document.getElementById(id);
    if (el) el.src = src;
  }

  function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = show ? 'block' : 'none';
  }

  function startLiveClock() {
    const clockEl = document.getElementById('liveNepalClock');
    const dateEl = document.getElementById('liveNepaliDate');

    const update = () => {
      const info = getNepaliDateTime(new Date());
      if (clockEl) clockEl.textContent = info.time12;
      if (dateEl) dateEl.textContent = info.nepaliFullDate;
    };
    update();
    setInterval(update, 1000);
  }

  // ── 10. PUBLIC API / WINDOW EXPORT ────────────────────────────────────────
  window.AttendanceApp = {
    fetchAllData,
    openStudentModal,
    inspectCalendarDay,
    exportRosterToCsv,
    signInWithGoogle,

    prevMonth: () => {
      calCurrentMonth--;
      if (calCurrentMonth < 0) {
        calCurrentMonth = 11;
        calCurrentYear--;
      }
      const s = allStudents.find((u) => u.uid === currentModalUid);
      if (s) renderStudentCalendar(s);
    },

    nextMonth: () => {
      calCurrentMonth++;
      if (calCurrentMonth > 11) {
        calCurrentMonth = 0;
        calCurrentYear++;
      }
      const s = allStudents.find((u) => u.uid === currentModalUid);
      if (s) renderStudentCalendar(s);
    }
  };

  // ── 11. INITIALIZATION ON DOM READY ───────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    startLiveClock();

    // Date Picker Change
    const dateInput = document.getElementById('selectedDateInput');
    if (dateInput) {
      dateInput.addEventListener('change', (e) => {
        selectedDateStr = e.target.value;
        fetchAllData();
      });
    }

    // Tab Buttons
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.getAttribute('data-tab') || 'all';
        renderRoster();
      });
    });

    // Search Input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderRoster();
      });
    }

    // Grade Filter
    const gradeSelect = document.getElementById('gradeFilter');
    if (gradeSelect) {
      gradeSelect.addEventListener('change', (e) => {
        selectedGrade = e.target.value;
        renderRoster();
      });
    }

    // Section Filter
    const sectionSelect = document.getElementById('sectionFilter');
    if (sectionSelect) {
      sectionSelect.addEventListener('change', (e) => {
        selectedSection = e.target.value;
        renderRoster();
      });
    }

    // Sort Dropdown
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        sortBy = e.target.value;
        renderRoster();
      });
    }

    // View Toggle
    const btnGridView = document.getElementById('btnGridView');
    const btnTableView = document.getElementById('btnTableView');
    if (btnGridView && btnTableView) {
      btnGridView.addEventListener('click', () => {
        activeView = 'grid';
        btnGridView.classList.add('active');
        btnTableView.classList.remove('active');
        renderRoster();
      });
      btnTableView.addEventListener('click', () => {
        activeView = 'table';
        btnTableView.classList.add('active');
        btnGridView.classList.remove('active');
        renderRoster();
      });
    }

    // Modal Close
    const closeBtn = document.getElementById('modalCloseBtn');
    const modal = document.getElementById('studentCalendarModal');
    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('active'));
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    }

    // Refresh Button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => fetchAllData());
    }

    // Export CSV Button
    const exportBtn = document.getElementById('exportCsvBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => exportRosterToCsv());
    }

    // Fetch initial data
    fetchAllData();
  });

})();
