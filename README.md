# WebOre website

Plain HTML, CSS, and JavaScript — no build step, no React, no `.tsx` files.
Open any `.html` file in a text editor and change the text directly; refresh
the browser to see it.

## What's in here

```
index.html          Home
about.html           About
services.html        Services & pricing
portfolio.html        Portfolio (managed from the admin panel)
blog.html             Blog listing (managed from the admin panel)
blog-post.html        Single blog post
contact.html          Contact form
login.html           Client login (+ Google/Facebook)
signup.html          Client signup (+ Google/Facebook)
dashboard.html        Logged-in client area
admin.html            Internal admin area — Dashboard, Projects, Users, Pages,
                       Portfolio, Messages, Media, Blog, Analytics, Settings,
                       Security, Deploy (see "Admin panel" below)
legal/                Privacy, Terms, Cookies, Refunds, Payment, Revisions,
                       Support, Project Scope, Copyright, Disclaimer
css/style.css         All styling — one file, plain CSS (no Tailwind/build step)
js/                   Plain JavaScript — one small file per job (forms, auth, etc.)
server/               The backend (Node + Express) that powers login, the
                       client dashboard, the admin area, and the contact form
```

## Admin panel

Log in at `/login.html` with an admin account, then go to `/admin.html`.
The sidebar covers:

- **Dashboard** — request totals and a breakdown by project type.
- **Projects** — every client build request, with status and notes.
- **Users** — create/edit/delete admins, developers, and clients, and change
  roles.
- **Pages** — edit the heading/subtext shown on Home, About, Services, and
  Contact (updates the live site immediately, no code editing).
- **Portfolio** — add/edit/delete the projects shown on the public
  Portfolio page.
- **Messages** — contact form submissions.
- **Media** — upload images/video/PDFs; copy a file's URL into Portfolio,
  Blog, or Pages fields.
- **Blog** — write, save as draft, or publish posts to the public Blog page.
- **Analytics** — first-party visit counts (no third-party trackers), only
  counted for visitors who accept the analytics cookie.
- **Settings** — site name, SEO defaults, social links, **Google/Facebook
  login credentials**, and maintenance mode — all editable without touching
  a file.
- **Security** — change your password, see recent login attempts, download
  a database backup.
- **Deploy** — read-only status (git commit, Node version, uptime) for
  whichever server this is running on. There's no CI/CD pipeline wired up —
  deploying still means pushing your code to wherever you host this and
  restarting the process there.


To change any text, headline, or price: open the relevant `.html` file and
edit it directly — it's plain text between tags, no compiling required.
To change colors or spacing sitewide: edit `css/style.css`.

## Running it

The login system, client dashboard, admin area, and contact form all need
the small backend in `server/` to actually save and retrieve data. To run
everything (site + backend) with one command:

```
cd server
npm install
cp .env.example .env      # then open .env and set a real JWT_SECRET
npm start
```

Then open **http://localhost:4000** — that one server serves the whole site
*and* the API. There's nothing else to start.

The first time it runs, it creates a default admin account:
`admin@webore.com` / `Admin@123` — **log in and change this password's
account details right away**, or replace it in `server/db.js`. It is only
ever printed to your own server console now, never shown on the public
site (see "Bugs fixed" below).

### Hosting the HTML separately from the backend

If you ever want to host the plain HTML/CSS/JS files on one host (e.g. a
static host) and the `server/` folder somewhere else (e.g. a Node host),
open `js/config.js` and set `API_BASE` to your backend's full URL.

## Turning on "Continue with Google" / "Continue with Facebook"

The buttons are already built into `login.html` and `signup.html` — they
just need your own app credentials plugged in (this can't be done for you
sight-unseen, since it requires your own Google/Facebook developer accounts).

**Easiest: paste them into the admin panel.** Log in to `/admin.html` →
**Settings** → "Social login", paste in your Client ID / App ID, and save.
This takes effect immediately, sitewide, with no file editing or restart.

**Or, if you prefer editing files:** the same two values can be set in
`js/config.js` (`GOOGLE_CLIENT_ID`, `FACEBOOK_APP_ID`) as a fallback — the
Settings panel's values always take priority if both are set.

**Google**
1. Go to the Google Cloud Console → APIs & Services → Credentials.
2. Create an OAuth Client ID, type "Web application".
3. Add your site's URL (e.g. `https://yourdomain.com`) under
   "Authorized JavaScript origins".
4. Paste the Client ID into Admin → Settings (or `js/config.js` and
   `server/.env`, see above).

**Facebook**
1. Go to developers.facebook.com → My Apps → Create App → Consumer.
2. Add the "Facebook Login" product, and add your site's URL under its
   settings.
3. Paste the App ID into Admin → Settings (or `js/config.js`, see above).

Until these are filled in, the buttons show a friendly "not set up yet"
message instead of failing silently.

## What's new in this version

- **Full admin panel**, added to the existing Projects/Messages tabs:
  Users (all roles), Pages, Portfolio, Media, Blog, Analytics, Settings,
  Security, and Deploy — see "Admin panel" above.
- **Public Portfolio and Blog pages** (`portfolio.html`, `blog.html`,
  `blog-post.html`) so what you add in the admin panel actually shows up
  on the site, with nav links added everywhere.
- **Media library** with real file uploads (images, video, PDF), served
  from `server/uploads/`.
- **Settings-driven Google/Facebook login** — client IDs can now be pasted
  into Admin → Settings instead of only being editable in `js/config.js`
  (see "Turning on Google/Facebook login" below).
- **Maintenance mode** — a switch in Settings that shows visitors a holding
  page while keeping `/admin.html` and `/login.html` reachable.
- **First-party analytics** — page views are counted (only after a visitor
  accepts the analytics cookie) and summarized in the Analytics tab.
- **Login history and password change** under Security, plus a one-click
  database backup download.

## Bugs fixed in this version

- **The homepage "Tell us about your project…" box didn't actually send
  anything.** It only showed a fake "Sent" message after a timer — nothing
  was ever recorded. It now really submits to the contact system, same as
  the full Contact page.
- **The admin password was printed in plain text on the public login
  page.** Removed. (It's still logged once to your own server console on
  first run, for your own reference only.)
- **Fake testimonials, fake client names, and made-up stats** ("120+ sites
  shipped", invented team bios, etc.) have been removed from the Home and
  About pages and replaced with honest, non-fabricated content about how a
  project actually works.
- Business email updated to **webore1007@gmail.com** everywhere (footer,
  contact page, all policy documents).
- Tagline updated to **"Building Your Digital Presence"**.
- Added a full **cookie consent banner** (Accept all / Reject non-essential
  / Manage preferences) plus a dedicated Cookie Policy page.
- Added a **Legal section** (`legal/index.html`) with all ten policy
  documents you provided: Privacy Policy, Terms & Conditions, Cookie
  Policy, Refund & Cancellation Policy, Payment Policy, Revision Policy,
  Support Policy, Project Scope Policy, Copyright Notice, and Disclaimer —
  all linked from the site footer.
- Added working **Google and Facebook sign-in** (see setup above).

## Notes

- `server/webore.db` (the database) isn't included — a fresh one is
  created automatically the first time you run `npm start`.
- The "Terms & Conditions" PDF you provided had "Last Updated: [Date]"
  left as a placeholder — it's been set to 11 July 2026 to match your
  other policies. Update it whenever you actually revise the terms.
