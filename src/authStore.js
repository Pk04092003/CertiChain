export const USERS_KEY = "certichain-users";
export const SESSION_KEY = "certichain-session-user";

const DEFAULT_USERS = [
  { id: "USR-ADMIN", name: "CertiChain Admin", email: "admin@certichain.local", role: "Institution Admin", password: "admin123" },
  { id: "USR-ISSUER", name: "Certificate Issuer", email: "issuer@certichain.local", role: "Issuer", password: "issuer123" },
  { id: "USR-VIEWER", name: "Verification Viewer", email: "viewer@certichain.local", role: "Viewer", password: "viewer123" },
];

export function loadUsers() {
  try {
    const data = JSON.parse(localStorage.getItem(USERS_KEY) || "null");
    if (Array.isArray(data) && data.length) return data;
  } catch {
    // Use defaults below.
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
  return DEFAULT_USERS;
}

export function login(email, password) {
  const user = loadUsers().find((item) => item.email.toLowerCase() === String(email).trim().toLowerCase() && item.password === password);
  if (!user) throw new Error("Invalid email or password.");
  const session = { id: user.id, name: user.name, email: user.email, role: user.role };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem("certichain-current-issuer", session.email);
  window.dispatchEvent(new CustomEvent("certichain:auth-updated"));
  return session;
}

export function getSessionUser() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (session?.email) return session;
  } catch {
    // fallback below
  }
  return null;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent("certichain:auth-updated"));
}

export function saveUser(user) {
  const users = loadUsers();
  const next = users.some((item) => item.id === user.id)
    ? users.map((item) => item.id === user.id ? { ...item, ...user } : item)
    : [...users, user];
  localStorage.setItem(USERS_KEY, JSON.stringify(next));
  return next;
}
