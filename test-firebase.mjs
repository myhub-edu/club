/**
 * SCIENCE & IT CLUB — Firebase Realtime DB + Auth REST API Tester
 * Tests ALL db paths with admin credentials (no browser required).
 *
 * Uses:
 *  - Firebase Auth REST API  → sign in with email/password → get idToken
 *  - Firebase RTDB REST API  → read/write every node in the rules
 *
 * Run: node test-firebase.mjs
 */

// ── CONFIG (from firebase-config.js) ─────────────────────────────────────────
const API_KEY = "AIzaSyDUKFe5a4_FshRAgMAxp297hae2bPlJTDs";
const DB_URL = "https://studio-8470850847-5d1ba-default-rtdb.asia-southeast1.firebasedatabase.app";
const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;

// ── Credentials — fill these in ──────────────────────────────────────────────
// These are the two master admin emails found in auth.js / admin.js
// We'll test with the FIRST one; the script prompts you if no token returned.
const ADMIN_EMAIL = "dprogram057@gmail.com";
const ADMIN_PASSWORD = "";

// ── Colours ──────────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

const pass = (msg) => console.log(`  ${C.green}✅ PASS${C.reset}  ${msg}`);
const fail = (msg) => console.log(`  ${C.red}❌ FAIL${C.reset}  ${msg}`);
const info = (msg) => console.log(`  ${C.cyan}ℹ️  INFO${C.reset}  ${msg}`);
const warn = (msg) => console.log(`  ${C.yellow}⚠️  WARN${C.reset}  ${msg}`);
const section = (title) => console.log(`\n${C.bold}${C.blue}══ ${title} ══${C.reset}`);

// ── HTTP helpers ─────────────────────────────────────────────────────────────
async function req(method, url, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);

  try {
    const r = await fetch(url, opts);
    let data;
    try { data = await r.json(); } catch { data = null; }
    return { status: r.status, ok: r.ok, data };
  } catch (e) {
    return { status: 0, ok: false, data: null, error: e.message };
  }
}

// Firebase RTDB REST: GET, PUT, POST, DELETE
const dbGet = (path, token) => req("GET", `${DB_URL}/${path}.json?auth=${token}`);
const dbPut = (path, body, token) => req("PUT", `${DB_URL}/${path}.json?auth=${token}`, body);
const dbPost = (path, body, token) => req("POST", `${DB_URL}/${path}.json?auth=${token}`, body);
const dbPatch = (path, body, token) => req("PATCH", `${DB_URL}/${path}.json?auth=${token}`, body);
const dbDelete = (path, token) => req("DELETE", `${DB_URL}/${path}.json?auth=${token}`);

// Unauthenticated requests
const dbGetAnon = (path) => req("GET", `${DB_URL}/${path}.json`);

// ── Results tracker ──────────────────────────────────────────────────────────
let passed = 0, failed = 0, warned = 0;
function check(label, result, expectOk = true) {
  const ok = expectOk ? result.ok : !result.ok;
  if (ok) {
    pass(label);
    passed++;
  } else {
    fail(`${label} — HTTP ${result.status} ${JSON.stringify(result.data)?.slice(0, 120)}`);
    failed++;
  }
}
function checkStatus(label, result, expectedStatus) {
  if (result.status === expectedStatus) {
    pass(`${label} — HTTP ${result.status}`);
    passed++;
  } else {
    fail(`${label} — Expected ${expectedStatus}, got ${result.status}: ${JSON.stringify(result.data)?.slice(0, 120)}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`${C.bold}${C.magenta}`);
  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║  SCIENCE & IT CLUB — Firebase Security Rules Tester  ║");
  console.log("╚═══════════════════════════════════════════════════════╝");
  console.log(C.reset);

  if (ADMIN_PASSWORD === "YOUR_PASSWORD_HERE") {
    console.error(`${C.red}${C.bold}ERROR: Please edit this file and set ADMIN_PASSWORD before running!${C.reset}`);
    console.error(`Open: ${import.meta.url}`);
    process.exit(1);
  }

  // ── STEP 1: Sign in ────────────────────────────────────────────────────────
  section("STEP 1 — Firebase Auth Sign-In");
  console.log(`  Signing in as ${C.cyan}${ADMIN_EMAIL}${C.reset}...`);

  const authRes = await req("POST", AUTH_URL, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    returnSecureToken: true
  });

  if (!authRes.ok || !authRes.data?.idToken) {
    fail(`Auth failed — ${JSON.stringify(authRes.data)}`);
    process.exit(1);
  }

  const TOKEN = authRes.data.idToken;
  const UID = authRes.data.localId;
  const EMAIL = authRes.data.email;

  pass(`Signed in as ${EMAIL}`);
  info(`UID: ${UID}`);
  info(`Token (first 40 chars): ${TOKEN.slice(0, 40)}...`);

  // ── STEP 2: Bootstrap headAdmin & admins nodes (like auth.js does on login) ─
  section("STEP 2 — Bootstrap headAdmin & admins nodes");
  console.log(`  ${C.gray}Writing headAdmin/${UID} and admins/${UID} (mirrors what auth.js does)...${C.reset}`);

  const r1 = await dbPut(`headAdmin/${UID}`, true, TOKEN);
  check(`PUT headAdmin/${UID} = true`, r1);

  const r2 = await dbPut(`admins/${UID}`, true, TOKEN);
  check(`PUT admins/${UID} = true`, r2);

  // Also write your own user profile (needed so 'banned' check doesn't fail)
  const profileData = {
    uid: UID, email: EMAIL,
    displayName: "Test Admin",
    section: "Admin Staff",
    role: "headAdmin",
    banned: false,
    createdAt: Date.now(),
    lastLoginAt: Date.now()
  };
  const r3 = await dbPut(`users/${UID}`, profileData, TOKEN);
  check(`PUT users/${UID} (own profile)`, r3);

  // ── STEP 3: PUBLIC READ (no auth) ─────────────────────────────────────────
  section("STEP 3 — Public Read (unauthenticated)");
  const publicPaths = ["projects", "events", "moments", "resources", "leadership", "settings", "voices"];
  for (const p of publicPaths) {
    const r = await dbGetAnon(p);
    check(`GET /${p} (anon)`, r);
  }

  // ── STEP 4: PUBLIC WRITE BLOCKED (no auth) ────────────────────────────────
  section("STEP 4 — Public Write BLOCKED (unauthenticated)");
  const blockWritePaths = ["projects", "events", "moments", "resources", "leadership", "settings"];
  for (const p of blockWritePaths) {
    const r = await req("PUT", `${DB_URL}/${p}/hack_test.json`, { hacked: true });
    check(`PUT /${p} (anon) → BLOCKED`, r, false /* expect fail */);
  }

  // ── STEP 5: ADMIN READ TESTS ──────────────────────────────────────────────
  section("STEP 5 — Admin Read Access");
  const adminReadPaths = [
    "users", `users/${UID}`,
    "admins", `admins/${UID}`,
    "headAdmin", `headAdmin/${UID}`,
    "ideas", "feedback", "messages",
    "voices", "notifications/global",
    `notifications/users/${UID}`,
    `notificationReads/${UID}`,
    "projects", "events", "moments", "resources", "leadership", "settings"
  ];
  for (const p of adminReadPaths) {
    const r = await dbGet(p, TOKEN);
    check(`GET /${p} (admin)`, r);
  }

  // ── STEP 6: ADMIN WRITE — Content Collections ─────────────────────────────
  section("STEP 6 — Admin Write: Content Collections");

  let testProjectId, testEventId, testMomentId, testResourceId, testLeadId;

  {
    const r = await dbPost("projects", { title: "Test Project", description: "Auto test", createdAt: Date.now() }, TOKEN);
    check("POST /projects (admin create)", r);
    if (r.ok && r.data?.name) testProjectId = r.data.name;
  }
  {
    const r = await dbPost("events", { title: "Test Event", date: "01/01/2027", createdAt: Date.now() }, TOKEN);
    check("POST /events (admin create)", r);
    if (r.ok && r.data?.name) testEventId = r.data.name;
  }
  {
    const r = await dbPost("moments", { caption: "Test Moment", createdAt: Date.now() }, TOKEN);
    check("POST /moments (admin create)", r);
    if (r.ok && r.data?.name) testMomentId = r.data.name;
  }
  {
    const r = await dbPost("resources", { title: "Test Resource", url: "https://example.com", createdAt: Date.now() }, TOKEN);
    check("POST /resources (admin create)", r);
    if (r.ok && r.data?.name) testResourceId = r.data.name;
  }
  {
    const r = await dbPost("leadership", { name: "Test Leader", role: "President", createdAt: Date.now() }, TOKEN);
    check("POST /leadership (admin create)", r);
    if (r.ok && r.data?.name) testLeadId = r.data.name;
  }
  {
    const r = await dbPut("settings", { clubName: "Science & IT Club", institution: "Liverpool Int'l", schedule: "Tue & Fri", labLocation: "Room 204", tagline: "Test", contactEmail: "test@test.com", noticeBanner: "" }, TOKEN);
    check("PUT /settings (headAdmin)", r);
  }

  // ── STEP 7: ADMIN WRITE — Voices ──────────────────────────────────────────
  section("STEP 7 — Admin Write: Voices");
  let testVoiceId;
  {
    const r = await dbPost("voices", { message: "Great club! Admin test.", rating: 5, uid: UID, createdAt: Date.now() }, TOKEN);
    check("POST /voices (admin create)", r);
    if (r.ok && r.data?.name) testVoiceId = r.data.name;
  }
  if (testVoiceId) {
    const r = await dbPatch(`voices/${testVoiceId}`, { status: "approved" }, TOKEN);
    check(`PATCH /voices/${testVoiceId} (admin approve)`, r);
  }

  // ── STEP 8: ADMIN WRITE — Notifications ───────────────────────────────────
  section("STEP 8 — Admin Write: Notifications");
  let globalNotifId;
  {
    const r = await dbPost("notifications/global", { title: "Test Announcement", message: "Automation test", createdAt: Date.now(), priority: "normal" }, TOKEN);
    check("POST /notifications/global (admin)", r);
    if (r.ok && r.data?.name) globalNotifId = r.data.name;
  }
  {
    const r = await dbPost(`notifications/users/${UID}`, { title: "Personal Test", message: "Auto test", createdAt: Date.now() }, TOKEN);
    check(`POST /notifications/users/${UID} (admin)`, r);
  }

  // ── STEP 9: ADMIN WRITE — Users/Admins/HeadAdmin ─────────────────────────
  section("STEP 9 — Admin Write: Users / Admins / HeadAdmin");
  {
    const r = await dbPatch(`users/${UID}`, { lastLoginAt: Date.now() }, TOKEN);
    check(`PATCH /users/${UID} (admin update self)`, r);
  }
  {
    const r = await dbPut(`admins/${UID}`, true, TOKEN);
    check(`PUT /admins/${UID} (headAdmin can write)`, r);
  }
  {
    const r = await dbPut(`headAdmin/${UID}`, true, TOKEN);
    check(`PUT /headAdmin/${UID} (headAdmin can write)`, r);
  }

  // ── STEP 10: ADMIN WRITE — Messages/Ideas/Feedback ────────────────────────
  section("STEP 10 — Admin Write: Messages, Ideas, Feedback");
  let testMsgId, testIdeaId, testFeedbackId;
  {
    const r = await dbPost("messages", { subject: "Test Subject", message: "Test message from admin", fromUid: UID, createdAt: Date.now(), status: "unread" }, TOKEN);
    check("POST /messages (admin create)", r);
    if (r.ok && r.data?.name) testMsgId = r.data.name;
  }
  {
    const r = await dbPost("ideas", { title: "My Idea", category: "AI", description: "This is a test idea from admin.", uid: UID, createdAt: Date.now(), status: "pending" }, TOKEN);
    check("POST /ideas (admin create)", r);
    if (r.ok && r.data?.name) testIdeaId = r.data.name;
  }
  {
    const r = await dbPost("feedback", { message: "Great club experience!", rating: 5, uid: UID, createdAt: Date.now(), status: "pending" }, TOKEN);
    check("POST /feedback (admin create)", r);
    if (r.ok && r.data?.name) testFeedbackId = r.data.name;
  }

  // ── STEP 11: NotificationReads (own UID only) ─────────────────────────────
  section("STEP 11 — Notification Read Receipts");
  {
    const r = await dbPut(`notificationReads/${UID}/someNotifId`, true, TOKEN);
    check(`PUT /notificationReads/${UID}/someNotifId (own)`, r);
  }
  {
    const r = await dbGet(`notificationReads/${UID}`, TOKEN);
    check(`GET /notificationReads/${UID} (own)`, r);
  }

  // ── STEP 12: SECURITY — Anon writes should be BLOCKED ────────────────────
  section("STEP 12 — Security: Unauthenticated writes BLOCKED");
  const blockAnon = [
    ["PUT", `users/${UID}`, { role: "headAdmin" }],
    ["POST", "ideas", { title: "Hack", category: "X", description: "Y", uid: "attacker" }],
    ["POST", "feedback", { message: "Hack", rating: 5, uid: "attacker" }],
    ["POST", "messages", { subject: "Hack", message: "Y", fromUid: "attacker" }],
    ["POST", "notifications/global", { title: "SPAM", message: "Attack" }],
    ["PUT", `admins/HACK_UID`, true],
    ["PUT", `headAdmin/HACK_UID`, true],
    ["PUT", "settings", { clubName: "HACKED" }],
  ];
  for (const [method, path, body] of blockAnon) {
    const r = await req(method, `${DB_URL}/${path}.json`, body);
    check(`${method} /${path} (anon) → BLOCKED`, r, false);
  }

  // ── STEP 13: CLEANUP — Remove test data ──────────────────────────────────
  section("STEP 13 — Cleanup Test Data");
  const toDelete = [
    testProjectId && `projects/${testProjectId}`,
    testEventId && `events/${testEventId}`,
    testMomentId && `moments/${testMomentId}`,
    testResourceId && `resources/${testResourceId}`,
    testLeadId && `leadership/${testLeadId}`,
    testVoiceId && `voices/${testVoiceId}`,
    testMsgId && `messages/${testMsgId}`,
    testIdeaId && `ideas/${testIdeaId}`,
    testFeedbackId && `feedback/${testFeedbackId}`,
    globalNotifId && `notifications/global/${globalNotifId}`,
    `notificationReads/${UID}/someNotifId`,
  ].filter(Boolean);

  for (const path of toDelete) {
    const r = await dbDelete(path, TOKEN);
    if (r.ok) {
      info(`Deleted /${path}`);
    } else {
      warn(`Could not delete /${path} — HTTP ${r.status}`);
      warned++;
    }
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log(`\n${C.bold}${"─".repeat(55)}${C.reset}`);
  console.log(`${C.bold}  TEST SUMMARY${C.reset}`);
  console.log(`${"─".repeat(55)}`);
  console.log(`  ${C.green}${C.bold}PASSED :${C.reset}  ${passed}`);
  console.log(`  ${C.red}${C.bold}FAILED :${C.reset}  ${failed}`);
  console.log(`  ${C.yellow}${C.bold}WARNED :${C.reset}  ${warned}`);
  console.log(`${"─".repeat(55)}\n`);

  if (failed === 0) {
    console.log(`${C.green}${C.bold}🎉 ALL TESTS PASSED — Firebase rules are working correctly!${C.reset}\n`);
  } else {
    console.log(`${C.red}${C.bold}⚠️  ${failed} test(s) failed — check the output above.${C.reset}\n`);
    console.log(`${C.yellow}Common fixes:
  1. Make sure you've deployed the new rules to Firebase Console
  2. Check your password is correct in ADMIN_PASSWORD
  3. Make sure ${ADMIN_EMAIL} is a real Firebase Auth user${C.reset}\n`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
