/**
 * SCIENCE & IT CLUB - GLOBAL DAILY ATTENDANCE SYSTEM
 * 
 * Automatically records and stores daily website attendance in Firebase Realtime Database
 * according to Nepali Date (Bikram Sambat - B.S.), Day, Nepal Standard Time (UTC+05:45),
 * and Time Slots (Morning "बिहान" & Night "राति").
 * 
 * Works universally for:
 *  - Existing signed-up students
 *  - Newly registering students
 *  - Club Admins & Head Admins
 *  - All visitors upon authentication
 * 
 * Multi-Target Firebase Storage:
 *  - /attendance/{adDate}/{uid}
 *  - /attendance_bs/{bsDate}/{uid}
 *  - /users/{uid}/attendance/{adDate}
 *  - /users/{uid}/lastAttendance
 *  - /attendance_summary/{adDate}
 */

(function () {
  'use strict';

  // Prevent duplicate initialization
  if (window.__ClubAttendanceInitialized) return;
  window.__ClubAttendanceInitialized = true;

  // ── 1. BIKRAM SAMBAT (B.S.) CALENDAR ENGINE ────────────────────────────────
  // Accurate month days table for Bikram Sambat years 2070 to 2095 BS
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
    2090: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
    2091: [31, 31, 32, 31, 31, 31, 30, 29, 30, 30, 29, 30],
    2092: [30, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    2093: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2094: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2095: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30]
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

  function toDevanagari(num) {
    return String(num).replace(/[0-9]/g, (d) => DEVANAGARI_DIGITS[d]);
  }

  const pad2 = (n) => String(n).padStart(2, '0');

  /**
   * Converts any JavaScript Date to full Nepali Date, Day, Time, and Slot details
   * based on Nepal Standard Time (UTC+05:45).
   */
  function getNepaliDateTime(date = new Date()) {
    try {
      // Format exact parts in Asia/Kathmandu timezone (UTC+5:45)
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

      // Day of week index (0 = Sunday ... 6 = Saturday)
      const dayIndex = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();

      // Reference anchor: 2018-04-14 AD = 2075-01-01 BS
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
      } else {
        // Fallback for earlier dates
        while (diffDays < 0) {
          bsMonthIndex--;
          if (bsMonthIndex < 0) {
            bsMonthIndex = 11;
            bsYear--;
          }
          const daysInCurMonth = (BS_MONTH_DAYS[bsYear] && BS_MONTH_DAYS[bsYear][bsMonthIndex]) || 30;
          diffDays += daysInCurMonth;
        }
        bsDay += diffDays;
      }

      const bsMonthNumber = bsMonthIndex + 1;
      const monthInfo = NEPALI_MONTHS[bsMonthIndex] || { en: 'Month', np: 'महिना' };
      const dayInfo = NEPALI_DAYS[dayIndex] || { en: 'Day', np: 'दिन' };

      // ── TIME SLOTS: Morning (बिहान) vs Afternoon (दिउँसो) vs Night (राति) ──
      // Morning: 04:00 AM - 11:59 AM
      // Afternoon: 12:00 PM - 04:59 PM
      // Night / Evening: 05:00 PM - 03:59 AM
      let slot = 'day';
      let slotNepali = 'दिउँसो';
      let isMorning = false;
      let isNight = false;
      let isAfternoon = false;

      if (hour >= 4 && hour < 12) {
        slot = 'morning';
        slotNepali = 'बिहान';
        isMorning = true;
      } else if (hour >= 12 && hour < 17) {
        slot = 'afternoon';
        slotNepali = 'दिउँसो';
        isAfternoon = true;
      } else {
        slot = 'night';
        slotNepali = 'राति';
        isNight = true;
      }

      const h12 = hour % 12 || 12;
      const ampm = hour < 12 ? 'AM' : 'PM';
      const time12 = `${pad2(h12)}:${pad2(minute)}:${pad2(second)} ${ampm}`;
      const time24 = `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;

      const adDateFormatted = `${y}-${pad2(m)}-${pad2(d)}`;
      const bsDateFormatted = `${bsYear}-${pad2(bsMonthNumber)}-${pad2(bsDay)}`;
      const bsDateDevanagari = `${toDevanagari(bsDay)} ${monthInfo.np} ${toDevanagari(bsYear)}`;
      const bsDateDisplay = `${bsDay} ${monthInfo.en} ${bsYear}`;
      const nepaliFullDateDisplay = `${dayInfo.np}, ${toDevanagari(bsDay)} ${monthInfo.np} ${toDevanagari(bsYear)}`;

      return {
        // Gregorian in Nepal Time
        adDate: adDateFormatted,
        year: y,
        month: m,
        day: d,
        dayNameEn: dayInfo.en,

        // Bikram Sambat (B.S.)
        bsDate: bsDateFormatted,
        bsYear: bsYear,
        bsMonth: bsMonthNumber,
        bsDay: bsDay,
        bsMonthNameEn: monthInfo.en,
        bsMonthNameNp: monthInfo.np,
        bsDateDisplay: bsDateDisplay,
        bsDateDevanagari: bsDateDevanagari,
        nepaliFullDateDisplay: nepaliFullDateDisplay,
        nepaliDay: dayInfo.np,
        nepaliDayCombined: `${dayInfo.np} (${dayInfo.en})`,

        // Time Details
        hour,
        minute,
        second,
        time12,
        time24,
        timezone: 'Asia/Kathmandu (UTC+05:45)',

        // Shift / Slot Flags
        slot,
        slotNepali,
        isMorning,
        isNight,
        isAfternoon
      };
    } catch (err) {
      console.warn('[ClubAttendance] Date format fallback:', err);
      const now = new Date();
      const isoDate = now.toISOString().slice(0, 10);
      return {
        adDate: isoDate,
        bsDate: isoDate,
        bsDateDisplay: isoDate,
        bsDateDevanagari: isoDate,
        nepaliDay: 'दिन',
        nepaliDayCombined: 'Day',
        time12: now.toLocaleTimeString(),
        time24: now.toTimeString().slice(0, 8),
        slot: now.getHours() < 12 ? 'morning' : 'night',
        slotNepali: now.getHours() < 12 ? 'बिहान' : 'राति',
        isMorning: now.getHours() < 12,
        isNight: now.getHours() >= 17 || now.getHours() < 4,
        isAfternoon: now.getHours() >= 12 && now.getHours() < 17,
        timezone: 'Asia/Kathmandu (UTC+05:45)'
      };
    }
  }

  // ── 2. DEVICE & CLIENT INFO ───────────────────────────────────────────────
  function getClientDevice() {
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'Mobile (Android)';
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'Mobile (iOS)';
    if (/mobile/i.test(ua)) return 'Mobile Device';
    if (window.innerWidth <= 768) return 'Tablet/Mobile';
    return 'Desktop PC';
  }

  // ── 3. ATTENDANCE RECORDING CONTROLLER ────────────────────────────────────
  let _isRecording = false;
  let _lastRecordTimestamp = 0;

  /**
   * Resolves the current user identity across ClubAuth session, localStorage, and Firebase Auth
   */
  function resolveActiveUser() {
    // 1. Direct ClubAuth user
    if (window.ClubAuth && ClubAuth.currentUser && ClubAuth.currentUser.uid) {
      return ClubAuth.currentUser;
    }
    // 2. Local storage session
    try {
      const saved = localStorage.getItem('CLUB_CURRENT_USER_SESSION');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.uid) return parsed;
      }
    } catch (_) {}
    // 3. Firebase Auth currentUser
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      const fbUser = firebase.auth().currentUser;
      return {
        uid: fbUser.uid,
        displayName: fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'Member'),
        email: fbUser.email || '',
        photoURL: fbUser.photoURL || 'assets/logo/club_logo.png',
        role: 'member'
      };
    }
    return null;
  }

  /**
   * Main function: Records attendance to Firebase Realtime Database
   * @param {boolean} force - If true, bypasses throttle check
   */
  async function recordAttendance(force = false) {
    if (_isRecording) return;

    const user = resolveActiveUser();
    if (!user || !user.uid) {
      // User is not signed in yet; will be recorded as soon as they log in or register
      return;
    }

    const nepaliInfo = getNepaliDateTime(new Date());
    const throttleKey = `att_throttled_${user.uid}_${nepaliInfo.adDate}_${nepaliInfo.slot}`;

    // Throttling: If already recorded in this exact date & slot within the last 15 minutes,
    // skip writing to avoid redundant network overhead during rapid tab navigation
    const lastSlotTime = Number(sessionStorage.getItem(throttleKey) || 0);
    const now = Date.now();
    if (!force && lastSlotTime && now - lastSlotTime < 15 * 60 * 1000) {
      return;
    }

    _isRecording = true;

    try {
      const uid = user.uid;
      const displayName = user.displayName || user.name || (user.email ? user.email.split('@')[0] : 'Member');
      const email = user.email || '';
      const role = user.role || 'member';
      const grade = user.grade || '';
      const section = user.section || '';
      const photoURL = user.photoURL || 'assets/logo/club_logo.png';
      const device = getClientDevice();
      const currentPage = (typeof window !== 'undefined' && window.location && window.location.pathname) ? (window.location.pathname.split('/').pop() || 'index.html') : 'index.html';

      // ── Step A: Read today's existing attendance (if any) to preserve earlier morning/night records
      let existingRecord = null;
      const adRecordPath = `attendance/${nepaliInfo.adDate}/${uid}`;

      if (window.ClubDB && typeof ClubDB.get === 'function') {
        try {
          existingRecord = await ClubDB.get(adRecordPath);
        } catch (_) {}
      }

      if (!existingRecord && typeof firebase !== 'undefined' && firebase.database) {
        try {
          const snap = await firebase.database().ref(adRecordPath).once('value');
          if (snap && snap.exists()) existingRecord = snap.val();
        } catch (_) {}
      }

      // If still not found, check the user's personal attendance path
      if (!existingRecord && typeof firebase !== 'undefined' && firebase.database) {
        try {
          const userSnap = await firebase.database().ref(`users/${uid}/attendance/${nepaliInfo.adDate}`).once('value');
          if (userSnap && userSnap.exists()) existingRecord = userSnap.val();
        } catch (_) {}
      }

      // ── Step B: Build/Merge the Attendance Record ──────────────────────────
      const isFirstVisitToday = !existingRecord;
      const totalVisits = (existingRecord && existingRecord.totalVisitsToday ? existingRecord.totalVisitsToday : 0) + 1;

      // Preserve or initialize morning shift
      const morningData = (existingRecord && existingRecord.morning) || {
        attended: false,
        firstVisit: '',
        lastVisit: '',
        visits: 0
      };

      // Preserve or initialize night shift
      const nightData = (existingRecord && existingRecord.night) || {
        attended: false,
        firstVisit: '',
        lastVisit: '',
        visits: 0
      };

      // Preserve or initialize afternoon shift
      const afternoonData = (existingRecord && existingRecord.afternoon) || {
        attended: false,
        firstVisit: '',
        lastVisit: '',
        visits: 0
      };

      // Update current slot details
      if (nepaliInfo.isMorning) {
        morningData.attended = true;
        morningData.firstVisit = morningData.firstVisit || nepaliInfo.time12;
        morningData.lastVisit = nepaliInfo.time12;
        morningData.visits = (morningData.visits || 0) + 1;
        morningData.nepaliTime = nepaliInfo.time12;
      } else if (nepaliInfo.isNight) {
        nightData.attended = true;
        nightData.firstVisit = nightData.firstVisit || nepaliInfo.time12;
        nightData.lastVisit = nepaliInfo.time12;
        nightData.visits = (nightData.visits || 0) + 1;
        nightData.nepaliTime = nepaliInfo.time12;
      } else if (nepaliInfo.isAfternoon) {
        afternoonData.attended = true;
        afternoonData.firstVisit = afternoonData.firstVisit || nepaliInfo.time12;
        afternoonData.lastVisit = nepaliInfo.time12;
        afternoonData.visits = (afternoonData.visits || 0) + 1;
        afternoonData.nepaliTime = nepaliInfo.time12;
      }

      // Construct complete comprehensive attendance payload
      const attendancePayload = {
        uid: uid,
        studentName: displayName,
        displayName: displayName,
        email: email,
        role: role,
        grade: grade,
        section: section,
        photoURL: photoURL,

        // Status
        status: 'Present',
        statusNepali: 'उपस्थित',

        // Nepali Date & Day
        nepaliDate: nepaliInfo.bsDate,
        nepaliDateDevanagari: nepaliInfo.bsDateDevanagari,
        nepaliDateFormatted: nepaliInfo.bsDateDisplay,
        nepaliFullDate: nepaliInfo.nepaliFullDateDisplay,
        nepaliYear: nepaliInfo.bsYear,
        nepaliMonth: nepaliInfo.bsMonthNameNp,
        nepaliMonthEn: nepaliInfo.bsMonthNameEn,
        nepaliDay: nepaliInfo.nepaliDay,
        nepaliDayCombined: nepaliInfo.nepaliDayCombined,

        // Gregorian Date
        date: nepaliInfo.adDate,
        adDate: nepaliInfo.adDate,

        // Timezone & Timestamps
        timezone: nepaliInfo.timezone,
        firstOpenedAt: (existingRecord && existingRecord.firstOpenedAt) || now,
        firstOpenedTime: (existingRecord && existingRecord.firstOpenedTime) || nepaliInfo.time12,
        lastOpenedAt: now,
        lastOpenedTime: nepaliInfo.time12,
        lastOpenedSlot: nepaliInfo.slot,
        lastOpenedSlotNepali: nepaliInfo.slotNepali,

        // Morning & Night Records
        morning: morningData,
        night: nightData,
        afternoon: afternoonData,

        // Visit Stats & Session Info
        totalVisitsToday: totalVisits,
        lastPageOpened: currentPage,
        device: device,
        updatedAt: now
      };

      // ── Step C: Multi-Target Firebase Storage (Fail-Safe & Comprehensive) ──
      const writePromises = [];

      // Write to live Firebase Database directly if available
      if (typeof firebase !== 'undefined' && firebase.database) {
        const db = firebase.database();

        // 1. Central attendance node by AD Date (/attendance/2026-09-29/{uid})
        writePromises.push(
          db.ref(`attendance/${nepaliInfo.adDate}/${uid}`).set(attendancePayload).catch((e) => {
            console.warn('[ClubAttendance] Write /attendance note:', e.message);
          })
        );

        // 2. Central attendance node by Nepali BS Date (/attendance_bs/2083-06-13/{uid})
        writePromises.push(
          db.ref(`attendance_bs/${nepaliInfo.bsDate}/${uid}`).set(attendancePayload).catch((e) => {
            console.warn('[ClubAttendance] Write /attendance_bs note:', e.message);
          })
        );

        // 3. Guaranteed user's own profile node (/users/{uid}/attendance/{adDate})
        //    (Always permitted by default Firebase rules)
        writePromises.push(
          db.ref(`users/${uid}/attendance/${nepaliInfo.adDate}`).set(attendancePayload).catch((e) => {
            console.warn('[ClubAttendance] Write users/attendance note:', e.message);
          })
        );

        // 4. Update user's lastAttendance pointer
        writePromises.push(
          db.ref(`users/${uid}/lastAttendance`).set({
            date: nepaliInfo.adDate,
            bsDate: nepaliInfo.bsDate,
            bsDateDevanagari: nepaliInfo.bsDateDevanagari,
            nepaliDay: nepaliInfo.nepaliDay,
            time: nepaliInfo.time12,
            slot: nepaliInfo.slot,
            slotNepali: nepaliInfo.slotNepali,
            timestamp: now
          }).catch(() => {})
        );

        // 5. Update daily summary counter (/attendance_summary/{adDate})
        writePromises.push(
          db.ref(`attendance_summary/${nepaliInfo.adDate}/lastUpdated`).set(now).catch(() => {})
        );
        writePromises.push(
          db.ref(`attendance_summary/${nepaliInfo.adDate}/date`).set(nepaliInfo.adDate).catch(() => {})
        );
        writePromises.push(
          db.ref(`attendance_summary/${nepaliInfo.adDate}/bsDate`).set(nepaliInfo.bsDate).catch(() => {})
        );
        writePromises.push(
          db.ref(`attendance_summary/${nepaliInfo.adDate}/nepaliDateDevanagari`).set(nepaliInfo.bsDateDevanagari).catch(() => {})
        );
        writePromises.push(
          db.ref(`attendance_summary/${nepaliInfo.adDate}/nepaliDay`).set(nepaliInfo.nepaliDay).catch(() => {})
        );
      }

      // Also mirror to ClubDB unified store (handles local caching & offline sync)
      if (window.ClubDB && typeof ClubDB.set === 'function') {
        writePromises.push(
          ClubDB.set(`attendance/${nepaliInfo.adDate}/${uid}`, attendancePayload).catch(() => {})
        );
      }

      await Promise.allSettled(writePromises);

      // Save throttling mark in sessionStorage
      sessionStorage.setItem(throttleKey, String(now));
      sessionStorage.setItem('last_attendance_date', nepaliInfo.adDate);
      _lastRecordTimestamp = now;

      // Broadcast attendance recorded event for any UI listeners
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
        try {
          window.dispatchEvent(
            new CustomEvent('club-attendance-recorded', {
              detail: {
                user: displayName,
                uid: uid,
                nepaliDate: nepaliInfo.bsDate,
                nepaliDay: nepaliInfo.nepaliDay,
                nepaliTime: nepaliInfo.time12,
                slot: nepaliInfo.slot,
                record: attendancePayload
              }
            })
          );
        } catch (_) {}
      }

      console.log(
        `%c[ClubAttendance] ✅ Attendance Recorded: ${displayName} | ${nepaliInfo.bsDateDevanagari} (${nepaliInfo.nepaliDay}) | ${nepaliInfo.time12} [${nepaliInfo.slotNepali}]`,
        'color: #00f2fe; font-weight: bold;'
      );
    } catch (err) {
      console.warn('[ClubAttendance] Error recording attendance:', err);
    } finally {
      _isRecording = false;
    }
  }

  // ── 4. QUERY API (FOR ADMIN, DASHBOARD & USERS) ───────────────────────────
  window.ClubAttendance = {
    /** Get current Nepali Date, BS Date, Day, Time, and Slot info */
    getNepaliDateTime: () => getNepaliDateTime(new Date()),

    /** Manually trigger attendance record */
    recordNow: (force = true) => recordAttendance(force),

    /**
     * Get all student attendance records for a specific date (AD 'YYYY-MM-DD' or BS 'YYYY-MM-DD')
     * Defaults to today's date in Nepal.
     */
    getRecordsForDate: async function (dateStr) {
      const nepaliToday = getNepaliDateTime(new Date());
      const targetDate = dateStr || nepaliToday.adDate;

      // Try reading by AD date first
      if (window.ClubDB && typeof ClubDB.get === 'function') {
        const res = await ClubDB.get(`attendance/${targetDate}`);
        if (res && Object.keys(res).length > 0) return res;
        // Try reading by BS date
        const resBs = await ClubDB.get(`attendance_bs/${targetDate}`);
        if (resBs && Object.keys(resBs).length > 0) return resBs;
      }

      if (typeof firebase !== 'undefined' && firebase.database) {
        try {
          const snap = await firebase.database().ref(`attendance/${targetDate}`).once('value');
          if (snap && snap.exists()) return snap.val();

          const snapBs = await firebase.database().ref(`attendance_bs/${targetDate}`).once('value');
          if (snapBs && snapBs.exists()) return snapBs.val();
        } catch (_) {}
      }

      return {};
    },

    /** Get today's attendance roster */
    getTodayRecords: async function () {
      const today = getNepaliDateTime(new Date());
      return this.getRecordsForDate(today.adDate);
    },

    /**
     * Get attendance history for a specific student UID
     */
    getUserAttendance: async function (uid) {
      if (!uid) {
        const u = resolveActiveUser();
        if (!u) return {};
        uid = u.uid;
      }
      if (typeof firebase !== 'undefined' && firebase.database) {
        try {
          const snap = await firebase.database().ref(`users/${uid}/attendance`).once('value');
          if (snap && snap.exists()) return snap.val();
        } catch (_) {}
      }
      if (window.ClubDB && typeof ClubDB.get === 'function') {
        return (await ClubDB.get(`users/${uid}/attendance`)) || {};
      }
      return {};
    },

    /** Format any Date to Nepali BS string */
    formatNepaliDate: (date = new Date()) => {
      const d = getNepaliDateTime(date);
      return `${d.bsDateDevanagari} (${d.nepaliDay})`;
    }
  };

  // ── 5. AUTOMATIC EVENT HOOKS ──────────────────────────────────────────────
  // Trigger A: Page load / script init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => recordAttendance(false), 500);
    });
  } else {
    setTimeout(() => recordAttendance(false), 300);
  }

  // Trigger B: ClubAuth state changed (fired after user logs in, registers, or restores session)
  document.addEventListener('club-auth-changed', (e) => {
    if (e.detail && e.detail.user) {
      setTimeout(() => recordAttendance(false), 200);
    }
  });

  // Trigger C: Firebase Auth state changed (fired directly by Firebase SDK)
  if (typeof firebase !== 'undefined' && firebase.auth) {
    try {
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          setTimeout(() => recordAttendance(false), 400);
        }
      });
    } catch (_) {}
  }

  // Trigger D: Visibility change (when user returns to the tab after hours or next morning)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const nepaliNow = getNepaliDateTime(new Date());
      const lastRecordedDate = sessionStorage.getItem('last_attendance_date');
      // If date changed or 30 minutes elapsed, verify attendance
      if (lastRecordedDate !== nepaliNow.adDate || Date.now() - _lastRecordTimestamp > 30 * 60 * 1000) {
        recordAttendance(false);
      }
    }
  });

  // Trigger E: Heartbeat check every 15 minutes to automatically catch midnight transition
  // and morning/night slot transitions in Nepal
  setInterval(() => {
    const nepaliNow = getNepaliDateTime(new Date());
    const lastRecordedDate = sessionStorage.getItem('last_attendance_date');
    if (lastRecordedDate !== nepaliNow.adDate) {
      recordAttendance(true);
    }
  }, 15 * 60 * 1000);

})();
