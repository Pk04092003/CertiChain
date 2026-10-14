export const USERS_KEY = "certichain-users";
export const SESSION_KEY = "certichain-session-user";
export const TOKEN_KEY = "certichain-admin-token";

const API_BASE = String(import.meta.env.VITE_API_URL || "https://certichain-1-xc8l.onrender.com").replace(/\/$/, "");

const DEFAULT_ADMIN = {
  id: "USR-ADMIN",
  name: "CertiChain Admin",
  email: "admin@certichain.local",
  role: "Admin",
};

export function loadUsers() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return session?.email ? [{ ...DEFAULT_ADMIN, ...session, role: "Admin" }] : [DEFAULT_ADMIN];
  } catch {
    return [DEFAULT_ADMIN];
  }
}

export async function login(email, password) {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: String(email || "").trim(), password: String(password || "") }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Unable to sign in as administrator.");
  if (!data?.token || !data?.user) throw new Error("Administrator session could not be created.");

  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...data.user, role: "Admin" }));
  localStorage.setItem("certichain-current-issuer", data.user.email);
  window.dispatchEvent(new CustomEvent("certichain:auth-updated"));
  return data.user;
}

export function getAdminToken() {
  try { return String(localStorage.getItem(TOKEN_KEY) || "").trim(); } catch { return ""; }
}

export function authHeaders(extra = {}) {
  const token = getAdminToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

export function getSessionUser() {
  try {
    const token = getAdminToken();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (token && session?.email && session?.role === "Admin") return session;
    if (session) localStorage.removeItem(SESSION_KEY);
    if (!token) localStorage.removeItem(TOKEN_KEY);
  } catch {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
  return null;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent("certichain:auth-updated"));
}

// Profile changes are deliberately local-only in this client. The authoritative
// admin credentials live in Render environment variables; this function keeps
// compatibility with the existing Settings UI and session display.
export function saveUser(user) {
  const current = getSessionUser() || DEFAULT_ADMIN;
  const merged = { ...current, ...(user || {}), id: "USR-ADMIN", role: "Admin" };
  localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent("certichain:auth-updated"));
  return [merged];
}

export function getDefaultAdmin() {
  return { ...DEFAULT_ADMIN };
}
