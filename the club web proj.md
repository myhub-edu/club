# Executive Summary  
This plan outlines a **mobile-first Science & IT Club website** with clear user roles and a simple Firebase back end.  Public visitors see an inviting, responsive club site (Home, About, Projects, Events, Moments, Student Voices, Resources).  Members can optionally log in via Google (with a one-time form for name/grade) to access personal features (Notifications, Profile, Submit Idea/Feedback).  Admins (and a head admin) log in to a protected dashboard to manage content, members, and communications.  Firebase Realtime Database stores all text data (projects, events, testimonials, ideas, messages, notifications, etc.) while images live in fixed `/assets`.  Security Rules restrict reads/writes by role.  A real-time notification system (global and per-user) with unread-tracking lets admins broadcast to all or individuals.  Students can “Write to Head Admin” (messages) or submit project ideas and feedback; these are marked *pending* and reviewed by admins.  The site uses plain HTML/CSS/JS (no heavy frameworks) for fast load and broad compatibility.  Key pages and code skeletons (index, login, notifications, admin dashboard) are provided below.  Overall, the design emphasizes **simplicity, clarity and speed on mobile**, following mobile-first best practices.  

## User Roles and Access Levels  
- **Public (Guest)** – Can view all public pages (Home, About, Projects, Events, Moments, Student Voices, Resources) without logging in.  No personal data or functions.  
- **Member (Authenticated User)** – Logs in with Google (one-click).  On first login, prompted for name and class/section to complete profile.  Once logged in, sees **Notification** bell, **Profile** page, and options to submit feedback/ideas or message admin.  Cannot access admin controls.  
- **Admin** – A club teacher or lead student.  Uses the same Google sign-in.  After login, can access the **Admin Dashboard**.  Admins can create/edit Projects, Events, Moments, Resources, and Student Voices; approve or reject submitted Ideas/Feedback; send Notifications; and read member messages.  They *cannot* manage other admins.  
- **Head Admin** – Principal administrator (e.g. club advisor).  Has all Admin privileges plus a “Messages” inbox.  Can reply to students, manage admin accounts (add/remove admins), and toggle site settings.  

By isolating functionality per role, ordinary members see a clean site, while authenticated users get extra tools, and admins see a dedicated control panel.  

## Authentication & Onboarding  
- **Firebase Authentication (Google)** – Use Firebase Auth with Google Sign-In for one-click login.  The login page offers “Continue with Google” (FirebaseUI or a simple button).  After sign-in, save the user’s Google name/email, and check if a profile exists in `/users/{uid}`.  If not, show a short form (“Enter your full name” and “Class/Section”) before granting access, then write this data to the database along with `role:"member"`.  Users can also skip login (just close the prompt) to remain on public site.  
- **User Record** – Each user node (`/users/{uid}`) contains `{displayName, email, photoURL, grade, role, createdAt, lastLoginAt}`.  The `role` is `"member"`, `"admin"`, or `"headAdmin"`, but **do not trust the client** for this value – roles should be managed server-side (e.g. in a separate `/admins` list) for security.  

## Navigation & UX (Mobile-First)  
- **Navigation:** On mobile, use a hamburger or bottom-nav menu for ease of thumb tapping. The public header shows: “Home | About | Projects | Events | Moments | Voices | Resources” and a Login button.  After login, replace “Login” with a bell icon (🔔) and a user menu (“Profile / Logout”).  Simplify links so key content is one tap away.  
- **Home Page Layout:** Stack vertically, prioritising content. Start with a **Hero** (logo, tagline, CTA buttons). Then “What We Do” icons, an upcoming event banner, a featured projects slider, a captured-moments carousel, student testimonials (voices), and a final CTA (“Join the club” or “Submit Idea”).  Each section should have a clear heading and large touch targets.  
- **Content Prioritization:** On small screens, show only essentials up front. Use collapsible or secondary links for detailed info. Emphasise high-value items (current projects/events).  
- **Performance:** Optimize for speed – compress images (use WebP), minify CSS/JS, lazy-load offscreen content. Keep animations subtle. Faster loads improve retention and SEO (Google’s mobile-first indexing favors lean pages).  

## Data Model (Firebase Realtime DB)  
All data is text-based in JSON. Suggested structure (timestamps as Unix ms):  

```json
{
  "users": {
    "uid123": {
      "displayName": "Alice Example",
      "email": "alice@example.com",
      "photoURL": "https://...",
      "grade": "11",
      "role": "member",
      "createdAt": 1750000000000,
      "lastLoginAt": 1750000000000
    }
    // More users...
  },
  "admins": {
    "uidAdmin1": true,
    "uidAdmin2": true
  },
  "headAdmin": {
    "uidHead": true
  },
  "projects": {
    "proj001": {
      "title": "Robotics Bot",
      "slug": "robotics-bot",
      "category": "Robotics",
      "description": "Build a line-following robot.",
      "status": "in-progress",
      "coverImage": "/assets/projects/robotics-bot.webp",
      "technology": "Arduino, JavaScript",
      "createdAt": 1750001000000
    }
    // More projects...
  },
  "events": {
    "event001": {
      "title": "Science Exhibition",
      "date": "2026-10-05",
      "time": "14:00",
      "location": "Lab Hall",
      "description": "Annual science fair open to all.",
      "status": "upcoming",
      "coverImage": "/assets/events/exhibition.webp"
    }
    // More events...
  },
  "moments": {
    // We can keep moments in code (hardcoded array) since images are static.
    // Alternatively, text info could go here if needed.
  },
  "voices": {
    "voice001": {
      "displayName": "Bob Student",
      "grade": "12",
      "rating": 5,
      "message": "Joining the club helped me innovate!",
      "status": "approved",
      "createdAt": 1750002000000
    }
    // More testimonials (status=approved only shown publicly; others pending)
  },
  "feedback": {
    "fb001": {
      "uid": "uid123",
      "rating": 4,
      "message": "Love the workshops, but could use more math projects.",
      "status": "pending",
      "createdAt": 1750003000000
    }
    // Admin sees these to possibly publish/edit into voices
  },
  "ideas": {
    "idea001": {
      "uid": "uid123",
      "title": "Weather Station",
      "description": "Let's build a campus weather station!",
      "category": "Electronics",
      "status": "pending",
      "createdAt": 1750004000000
    }
    // Admin reviews these (can set status to accepted/rejected)
  },
  "resources": {
    "res001": {
      "title": "Intro to Python",
      "description": "Beginner Python tutorial",
      "category": "Programming",
      "url": "https://example.com/python-course"
    }
    // Links and study materials, editable by admin
  },
  "notifications": {
    "global": {
      "noti001": {
        "title": "Meeting Reminder",
        "message": "Club meeting tomorrow at 3pm in Room 101.",
        "priority": "normal",
        "createdAt": 1750005000000,
        "createdBy": "uidAdmin1"
      }
      // More broadcast notifications...
    },
    "users": {
      "uid123": {
        "noti002": {
          "title": "Project Approved",
          "message": "Your idea was approved for next science project!",
          "priority": "important",
          "createdAt": 1750006000000,
          "createdBy": "uidAdmin1"
        }
        // Personal notifications per user...
      }
    }
  },
  "notificationReads": {
    "uid123": {
      "noti001": true,
      "noti002": true
    },
    "uid456": {
      "noti001": true
    }
  },
  "messages": {
    "msg001": {
      "fromUid": "uid123",
      "subject": "Club Equipment Access",
      "message": "Can I use the 3D printer after school?",
      "status": "unread",
      "createdAt": 1750007000000,
      "replies": {
         "reply001": {
           "fromUid": "uidAdmin1",
           "message": "Yes, see me for a key.",
           "createdAt": 1750008000000
         }
      }
    }
    // Students can write one message per subject; admin replies under it
  }
}
```  

Each entity’s structure is simplified.  Images are **not stored in Firebase**; they reside in `/assets/...` and are referenced by file path.  (This avoids dealing with Storage uploads and simplifies security.)  Data is kept flat for easy queries (Firebase recommends avoiding deep nesting).

## Firebase Security Rules (Sketch)  
Use rules to enforce the above roles.  For example (in pseudo-JSON):  

```js
{
  "rules": {
    // Public data
    "projects":   { ".read": true, ".write": "root.child('admins').child(auth.uid).exists()" },
    "events":     { ".read": true, ".write": "root.child('admins').child(auth.uid).exists()" },
    "resources":  { ".read": true, ".write": "root.child('admins').child(auth.uid).exists()" },
    "voices":     { ".read": true, ".write": "root.child('admins').child(auth.uid).exists()" },
    
    // Testimonials / Student Voices:
    // (Members do not write directly; admins approve via rules/UI)
    
    // User-specific data
    "feedback": {
      "$fid": {
        ".read": "auth.uid === data.child('uid').val() || root.child('admins').child(auth.uid).exists()",
        ".write": "auth.uid === newData.child('uid').val()"
      }
    },
    "ideas": {
      "$iid": {
        ".read": "auth.uid === data.child('uid').val() || root.child('admins').child(auth.uid).exists()",
        ".write": "auth.uid === newData.child('uid').val()"
      }
    },
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"  // each user can edit own profile (initial form)
      }
    },
    "messages": {
      "$mid": {
        ".read": "auth.uid === data.child('fromUid').val() || root.child('headAdmin').child(auth.uid).exists()",
        ".write": "auth.uid === newData.child('fromUid').val()"
      }
    },
    "notifications": {
      ".read": "auth != null", 
      ".write": "root.child('admins').child(auth.uid).exists()"
      // (Admins push notifications; reading is filtered client-side)
    },
    "notificationReads": {
      "$uid": {
        "$nid": {
          ".write": "$uid === auth.uid" // user can mark their notifications as read
        }
      }
    }
  }
}
```  

- **Admins Only:** Rules like `root.child('admins').child(auth.uid).exists()` ensure only listed admins can write club data.  Head admin should be included in `admins` or a separate flag.  
- **Own Records:** Users can write only under `/feedback/$fid` or `/ideas/$iid` if `auth.uid === newData.uid` (and they appear in that node).  Similarly, `.write: "$uid===auth.uid"` on `/users/$uid` lets users save their own profile.  
- **Read Access:** Public lists (`projects`, `events`, `voices`) are open (`.read: true`). Personal items (`feedback`, `ideas`, `messages`) are locked to the owner (and admins).  
- **Validation (optional):** Use `.validate` rules to ensure fields like `rating` are numbers 1–5 or that `status` is one of the allowed strings.  

These rules prevent any user from elevating themselves to admin or reading others’ private data. Always test rules before launch.

## Notifications System  
Use the Realtime DB for live notifications. Store **broadcast** (global) messages under `/notifications/global` and **personal** ones under `/notifications/users/{uid}`.  Each notification has `{title, message, priority, createdAt, createdBy}`.  

- **Unread Tracking:** Maintain a `/notificationReads/{uid}/{notifId}: true` for each read notification. On login, the client pulls all global and user notifications and checks which IDs are *not* in `notificationReads` – those are unread (badge count).  Marking read simply writes `true` under that path.  (This mirrors a common pattern: the app “listens” on new notifications, and increments an unread count.)  
- **Admin Sending:** In the admin panel, a form “Create Notification” lets admins enter title/message, priority (normal/important), and an audience: *All Users* or *Single User*.  For broadcast, the app writes one new record under `/notifications/global` with a generated key.  For single user, write under `/notifications/users/{uid}`.  The front end shows these in chronological order, highlighting unread ones.  
- **UI Elements:** Show a bell icon 🔔 in the navbar with the unread count.  A dropdown or dedicated page lists recent notifications (with timestamps).  Example dropdown markup:  
  ```html
  <div class="notif-dropdown">
    <h3>Notifications</h3>
    <ul>
      <li class="unread"><strong>Science Expo</strong>: Don’t forget tomorrow! <span>1h ago</span></li>
      <li><strong>IT Workshop</strong>: New seats available. <span>Yesterday</span></li>
      <!-- etc. -->
    </ul>
    <a href="notifications.html">View all</a>
  </div>
  ```
  Clicking a notification marks it read.

## Student Messages, Ideas & Feedback  
- **Message to Head Admin:** A “Contact Head Admin” page has a form (Subject, Message) for logged-in students. Submissions write a new record under `/messages`. In the admin panel, the head admin sees an inbox of messages with status (unread/replied). They can open and reply. Replies append under `messages/{mid}/replies` and change `status: "replied"`. This keeps a threaded log.  
- **Ideas:** A “Submit Idea” page lets students propose new projects (title, description, category). On submit, an entry goes to `/ideas` with `status: "pending"`. In the admin UI (Ideas section), admins review entries and can accept (change status to “accepted” and possibly trigger a project creation) or reject (status=”rejected”).  
- **Feedback/Testimonial:** A “Share Your Experience” form collects a rating (1–5 stars) and a comment. This goes to `/feedback` with `status: "pending"`. Admins review in a “Student Voices” moderation panel: they can edit, approve (move to `/voices` with status approved), or discard.  Only approved entries appear on the public “Student Voices” page. This ensures quality and prevents spam (students cannot immediately publish publicly).  

All new submissions are timestamped. Students see “Thank you, your submission is pending approval” on submit.  

## Pages & File Structure  
Keep HTML files flat for simplicity. Example structure:  

```
/ (root)
├─ index.html               (Home page)
├─ about.html               (About the Club)
├─ projects.html            (Projects list)
├─ project.html             (Project details, by slug)
├─ events.html              (Events list)
├─ event.html               (Event details)
├─ moments.html             (Captured Moments gallery)
├─ voices.html              (Student Voices / Testimonials)
├─ resources.html           (Learning Resources)
├─ login.html               (Login/Google sign-in page)
├─ notifications.html       (User notifications page)
├─ profile.html             (User profile / basic info)
├─ submit-idea.html         (Form to submit an idea)
├─ submit-feedback.html     (Form to share experience)
└─ /admin/                  (Protected admin panel)
    ├─ index.html           (Admin Dashboard)
    ├─ members.html         (Member list & roles)
    ├─ projects.html        (Manage projects)
    ├─ events.html          (Manage events)
    ├─ voices.html          (Approve testimonials)
    ├─ notifications.html   (Send notifications)
    ├─ messages.html        (Head admin inbox)
    ├─ ideas.html           (Review student ideas)
    ├─ resources.html       (Manage resources)
    └─ settings.html        (Admin settings, e.g. add/remove admins)
```

**Assets & Code:**  
```
/css/            (stylesheets: global.css, navbar.css, admin.css, etc)
/js/             (firebase-config.js, auth.js, main.js, notifications.js, admin.js, etc)
/assets/logo/    (club logo files)
/assets/projects/ (project images)
/assets/events/  (event images)
/assets/moments/ (photos from events)
/assets/team/    (optional team photos)
```

- Use a single `global.css` for common styles and a separate `admin.css` for admin page tweaks.  
- Load Firebase libraries (app, auth, database) via CDN in each HTML.  
- Page templates should include meta tags for responsive `viewport` and content for SEO.  

## UX Wireframes (Mobile-First)  
- **Home (index.html):** Hero with club name/tagline and two big buttons (“Explore Club”, “Upcoming Events”). Below, icon cards (“Science”, “IT/Tech”, “Projects”, “Innovation”) in a 2×2 grid (touch-friendly). Then a featured event banner (full-width image), followed by a swipeable “Featured Projects” carousel (horizontal cards), a “Captured Moments” image carousel (auto-play with captions), and a “What Our Students Say” testimonial slider. End with a “Join the Club” CTA button.  Each section stacked vertically, large fonts and spacing for legibility.  
- **Projects/Events Pages:** List view with cards or list items (image, title, date/tag). Tapping an item goes to a detail page (project.html / event.html) showing description, images, and “Back” nav.  
- **Moments Page:** Grid of photos (two per row) that expand or carousel on tap.  
- **Student Voices:** List of testimonials (star rating + quote + name). Also a floating “+” button to “Share Your Experience” (opens feedback form).  
- **Member Pages (notifications.html, profile.html):** Accessible from the top navbar after login. Notifications page lists items with an icon (🔵 unread, ⚪️ read) and title/message snippet. Profile page shows the user’s name, email, grade, and logout button.  
- **Admin Dashboard (admin/index.html):** Large stat cards (“Total Members: 42”, “Projects: 5”, “Pending Messages: 3”, “Pending Ideas: 2”, etc) and a list of recent activity (e.g. “New member signed up”, “Testimonial approved”). Left sidebar or top nav for admin sections (Members, Projects, etc). Use minimal colour (e.g. accent from logo) and clear labels for each admin tool.  

All pages must be fully responsive. Use a fluid grid or flexbox. Ensure tap targets are at least ~40px. Font sizes should scale but remain legible (e.g. base 16px, larger for headings).  

## Performance, Accessibility & SEO  
- **Performance:** Compress and serve images in modern formats (WebP/AVIF). Minify CSS/JS and combine where possible. Lazy-load offscreen images (`<img loading="lazy">`). Avoid heavy libraries or large frameworks to keep payload small. Keep scripts at bottom or use `defer` so rendering isn’t blocked. PageSpeed optimization is critical on mobile networks.  
- **Accessibility:** Use semantic HTML (`<nav>`, `<main>`, `<button>`, etc). Provide `alt` text for images (e.g. lab photos). Ensure color contrast meets WCAG AA (dark text on light background). Make forms and links focusable and label-linked. Hamburger menu should be keyboard-navigable. Provide skip-links or landmarks.  
- **SEO:** Write meaningful `<title>` and `<meta description>` tags for each page. Use `<h1>` for page titles and proper heading hierarchy. Make URLs and slugs descriptive (e.g. `project.html?slug=robotics-bot`). Google uses mobile-first indexing, so a fast, mobile-friendly design directly boosts search ranking.  
- **Offline:** Basic caching can be added if desired (Cache-control for Firebase hosting) but not mandatory.  

## Build Phases  
1. **Wireframes & Mockups:** Sketch mobile layouts and finalise content hierarchy. Decide on color palette from logo.  
2. **Static Markup/CSS:** Build the HTML structure and CSS for key pages (header, footer, homepage sections, card styles). Test on various screen sizes.  
3. **Firebase Setup:** Create Firebase project, enable Realtime Database & Auth (Google). Deploy rules in test mode initially. Write `firebase-config.js`.  
4. **Load Dynamic Content:** Replace static text with data-driven content. For example, fetch `/projects` to list projects, `/events` for events, etc.  
5. **Authentication Flow:** Implement Google sign-in (`auth.js`). On success, store user in `/users` if new, then redirect. Protect member pages (notifications, profile, submit forms) by checking `auth.currentUser`.  
6. **Notifications:** Develop listener in `main.js` or `notifications.js` that reads both `/notifications/global` and `/notifications/users/uid`. Display count and list. Implement “mark as read” (writing to `/notificationReads`).  
7. **Feedback/Ideas/Messages:** Code submission forms. On submit, write to `/feedback`, `/ideas`, `/messages`. Show confirmation. Add admin UI to view these nodes.  
8. **Admin Panel:** Build admin HTML pages (in `/admin/`) with forms and tables. Use queries (e.g. `firebase.database().ref('feedback').once(...)`) to populate. Implement create/edit/delete actions. Show “Pending” badges for testimonials/ideas.  
9. **Security Rules:** Lock down the database – set rules as outlined above. Test with multiple user accounts (members vs admins).  
10. **Testing:** Use real phones and emulators. Check performance (Chrome DevTools audits). Validate accessibility (ChromeLighthouse). Fix any issues.  
11. **Deploy:** Host on Firebase Hosting or GitHub Pages (with Firebase proxy if needed). Update any CORS config. Launch!  

## Sample Page Templates  
Below are skeletons for key pages. Fill in with real content and Firebase logic as needed.

### index.html (Home page)  
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Science & IT Club – Liverpool College</title>
  <link rel="stylesheet" href="css/global.css" />
  <!-- Firebase scripts -->
  <script src="https://www.gstatic.com/firebasejs/9.x/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.x/firebase-auth.js"></script>
  <script src="js/firebase-config.js"></script>
  <script src="js/main.js" defer></script>
</head>
<body>
  <header>
    <nav>
      <a href="index.html">Home</a>
      <a href="about.html">About</a>
      <a href="projects.html">Projects</a>
      <a href="events.html">Events</a>
      <a href="moments.html">Moments</a>
      <a href="voices.html">Voices</a>
      <a href="resources.html">Resources</a>
      <a href="login.html">Login</a>
    </nav>
  </header>
  <main>
    <!-- Hero Section -->
    <section id="hero">
      <h1>Science & IT Club</h1>
      <p>Explore. Experiment. Create. Innovate.</p>
      <a href="#about" class="btn">About the Club</a>
      <a href="events.html" class="btn">Upcoming Events</a>
    </section>
    <!-- What We Do -->
    <section id="what-we-do">
      <h2>What We Do</h2>
      <div class="card-grid">
        <div class="card"><h3>🔬 Science</h3><p>Experiments and research.</p></div>
        <div class="card"><h3>💻 Technology</h3><p>Programming, AI, robotics.</p></div>
        <div class="card"><h3>🤖 Projects</h3><p>Hands-on building.</p></div>
        <div class="card"><h3>🚀 Innovation</h3><p>Turning ideas into reality.</p></div>
      </div>
    </section>
    <!-- (Upcoming event banner) -->
    <section id="upcoming-event">
      <h2>Next Event</h2>
      <!-- Filled dynamically via JS from Firebase -->
      <p>Loading upcoming event...</p>
    </section>
    <!-- (Featured Projects carousel) -->
    <section id="featured-projects">
      <h2>Featured Projects</h2>
      <div class="carousel">
        <!-- JS will populate project cards here -->
      </div>
    </section>
    <!-- (Captured Moments carousel) -->
    <section id="captured-moments">
      <h2>Captured Moments</h2>
      <div class="moment-carousel">
        <!-- Static images or JS populated -->
      </div>
    </section>
    <!-- (Student Voices testimonials) -->
    <section id="student-voices">
      <h2>What Students Say</h2>
      <div class="voice-slider">
        <!-- JS slider of approved testimonials -->
      </div>
    </section>
  </main>
  <footer>
    <p>© 2026 Liverpool International Secondary College – Science & IT Club</p>
  </footer>
</body>
</html>
```

### login.html (Google Sign-In)  
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Login - Science & IT Club</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="stylesheet" href="css/global.css" />
  <script src="https://www.gstatic.com/firebasejs/9.x/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.x/firebase-auth.js"></script>
  <script src="js/firebase-config.js"></script>
  <script src="js/auth.js" defer></script>
</head>
<body>
  <header>
    <a href="index.html">Home</a>
  </header>
  <main>
    <h1>Member Login</h1>
    <button id="googleLoginBtn">Continue with Google</button>
    <p>or <a href="index.html">go back to public site</a></p>
  </main>
  <footer>
    <p>© 2026 Science & IT Club</p>
  </footer>
</body>
</html>
```

### notifications.html (User Notifications)  
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Notifications - Science & IT Club</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="stylesheet" href="css/global.css" />
  <script src="https://www.gstatic.com/firebasejs/9.x/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.x/firebase-auth.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.x/firebase-database.js"></script>
  <script src="js/firebase-config.js"></script>
  <script src="js/notifications.js" defer></script>
</head>
<body>
  <header>
    <nav>
      <a href="index.html">Home</a>
      <a href="notifications.html" class="active">Notifications</a>
      <a href="profile.html">Profile</a>
      <button id="logoutBtn">Logout</button>
    </nav>
  </header>
  <main>
    <h1>Your Notifications</h1>
    <ul id="notificationList">
      <!-- JavaScript will append <li> items here for each notification -->
      <!-- Example:
      <li><span class="unread-dot"></span>
        <strong>Event Reminder:</strong> "Lab meeting tomorrow."<em>10m ago</em>
      </li>
      -->
    </ul>
    <button id="markAllRead">Mark all as read</button>
  </main>
</body>
</html>
```

### admin/index.html (Admin Dashboard)  
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Admin Dashboard - Science & IT Club</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="stylesheet" href="css/admin.css" />
  <script src="https://www.gstatic.com/firebasejs/9.x/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.x/firebase-auth.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.x/firebase-database.js"></script>
  <script src="js/firebase-config.js"></script>
  <script src="admin/js/admin.js" defer></script>
</head>
<body>
  <header>
    <h1>Admin Panel</h1>
    <nav>
      <a href="index.html">Dashboard</a>
      <a href="members.html">Members</a>
      <a href="projects.html">Projects</a>
      <a href="events.html">Events</a>
      <a href="voices.html">Voices</a>
      <a href="notifications.html">Notifications</a>
      <a href="messages.html">Messages</a>
      <a href="ideas.html">Ideas</a>
      <a href="resources.html">Resources</a>
      <a href="settings.html">Settings</a>
      <button id="adminLogoutBtn">Logout</button>
    </nav>
  </header>
  <main>
    <section id="stats">
      <h2>Statistics</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Members</h3>
          <p id="totalMembers">0</p>
        </div>
        <div class="stat-card">
          <h3>Projects</h3>
          <p id="totalProjects">0</p>
        </div>
        <div class="stat-card">
          <h3>Pending Messages</h3>
          <p id="pendingMessages">0</p>
        </div>
        <div class="stat-card">
          <h3>Pending Ideas</h3>
          <p id="pendingIdeas">0</p>
        </div>
      </div>
    </section>
    <section id="recent-activity">
      <h2>Recent Activity</h2>
      <ul>
        <!-- Example entries:
        <li>New idea submitted by Alice (5m ago)</li>
        <li>Project "Weather Station" approved (1h ago)</li>
        -->
      </ul>
    </section>
  </main>
</body>
</html>
```

Each code block above is a **template**. Add your actual content, data-binding and event handlers in the `<script>` files. For example, in `js/notifications.js`, listen to Firebase and populate the list.

## Performance & SEO Note  
By following **mobile-first principles** (prioritise content, simple nav, large tap targets) and optimizing assets, the site will load quickly even on slow connections.  Fast mobile pages improve SEO via Google’s mobile-first indexing.  Accessibility improvements (alt text, ARIA, keyboard nav) ensure all students can use the site.  

**Sources:** Best practices from mobile-first design (Figma resource library) were applied, and Firebase documentation for Auth and Security Rules guided the architecture.  The notification pattern follows a known Firebase approach of per-user listeners for real-time updates. 

