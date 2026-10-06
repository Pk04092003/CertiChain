export const USERS_KEY = "certichain-users";
export const SESSION_KEY = "certichain-session-user";

const DEFAULT_ADMIN = {
  id: "USR-ADMIN",
  name: "CertiChain Admin",
  email: "admin@certichain.local",
  role: "Admin",
  password: "admin123",
};

function normaliseUsers(users) {
  const admin =
    (Array.isArray(users) ? users : []).find((item) => String(item?.role || "").toLowerCase() === "admin") ||
    (Array.isArray(users) ? users : []).find((item) => String(item?.role || "").toLowerCase() === "institution admin");

  return [{
    ...DEFAULT_ADMIN,
    ...(admin || {}),
    role: "Admin",
  }];
}

export function loadUsers() {
  try {
    const data = JSON.parse(localStorage.getItem(USERS_KEY) || "null");
    const migrated = normaliseUsers(data);
    localStorage.setItem(USERS_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    const defaults = [DEFAULT_ADMIN];
    localStorage.setItem(USERS_KEY, JSON.stringify(defaults));
    return defaults;
  }
}

export function login(email, password) {
  const user = loadUsers().find(
    (item) =>
      item.email.toLowerCase() === String(email).trim().toLowerCase() &&
      item.password === password &&
      item.role === "Admin"
  );

  if (!user) throw new Error("Invalid admin email or password.");

  const session = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: "Admin",
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem("certichain-current-issuer", session.email);
  window.dispatchEvent(new CustomEvent("certichain:auth-updated"));
  return session;
}

export function getSessionUser() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (session?.email && session?.role === "Admin") return session;

    // Remove legacy Issuer/Viewer sessions so they cannot continue to access
    // administrator pages after the role model migration.
    if (session) localStorage.removeItem(SESSION_KEY);
  } catch {
    localStorage.removeItem(SESSION_KEY);
  }
  return null;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent("certichain:auth-updated"));
}

export function saveUser(user) {
  const current = loadUsers()[0];
  const merged = {
    ...current,
    ...(user || {}),
    id: current.id,
    role: "Admin",
  };
  localStorage.setItem(USERS_KEY, JSON.stringify([merged]));

  const session = getSessionUser();
  if (session?.id === merged.id) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        id: merged.id,
        name: merged.name,
        email: merged.email,
        role: "Admin",
      })
    );
    window.dispatchEvent(new CustomEvent("certichain:auth-updated"));
  }

  return [merged];
}

export function getDefaultAdmin() {
  return { ...DEFAULT_ADMIN };
}
