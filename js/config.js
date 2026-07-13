/**
 * WebOre front-end config.
 *
 * If you serve the "site" folder with the included Node/Express server
 * (server/index.js), leave this as an empty string — the API lives on
 * the same origin at /api/...
 *
 * If you ever host the HTML files somewhere else (e.g. plain static
 * hosting) and run the API server elsewhere, put its full URL here,
 * e.g. "https://api.yourdomain.com"
 */
const API_BASE = "";

/**
 * Social login setup — fill these in to turn on "Continue with Google / Facebook".
 * Until you do, the buttons show a friendly message instead of failing silently.
 *
 * Google:   Google Cloud Console → APIs & Services → Credentials → Create OAuth
 *           client ID (Web application) → add your site's URL under
 *           "Authorized JavaScript origins" → paste the Client ID below
 *           (or, easier, paste it into Admin → Settings → "Google Client ID"
 *           once the site is running — no file editing needed).
 *
 * Facebook: developers.facebook.com → My Apps → Create App → Consumer →
 *           add "Facebook Login" product → Settings → Basic → App ID below
 *           (or, easier, paste it into Admin → Settings → "Facebook App ID").
 *           Add your site's URL under Facebook Login → Settings → Valid OAuth
 *           Redirect URIs / Allowed Domains.
 *
 * These two act only as a fallback — if the admin panel's Settings page has
 * values saved, those win (see js/main.js's loadPublicSettings()).
 */
const GOOGLE_CLIENT_ID = "64676272437-bjl4nnqekk7og2u6l3ki0gab7m1eqc4i.apps.googleusercontent.com";
const FACEBOOK_APP_ID = "";
