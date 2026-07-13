/* Small fetch wrapper + auth-token helpers. Plain JS, no build step. */

const TOKEN_KEY = "webore_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/**
 * @param {string} path e.g. "/auth/login"
 * @param {RequestInit & { auth?: boolean }} [options]
 */
async function api(path, options = {}) {
  const { auth = true, headers, ...rest } = options;
  const token = getToken();

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new Error((body && body.error) || "Something went wrong. Please try again.");
  }
  return body;
}

/** Reads the current user (if a token is stored) and updates the navbar. */
async function loadCurrentUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await api("/auth/me");
    return res.user;
  } catch {
    setToken(null);
    return null;
  }
}

function logoutUser() {
  setToken(null);
  window.location.href = "index.html";
}
