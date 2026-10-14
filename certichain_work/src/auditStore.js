export const AUDIT_LOG_KEY = "certichain-audit-logs";

function currentUser() {
  try {
    const value = JSON.parse(localStorage.getItem("certichain-session-user") || "null");
    return value?.email || value?.name || "Authorized Institution";
  } catch {
    return "Authorized Institution";
  }
}

export function loadAuditLogs() {
  try {
    const data = JSON.parse(localStorage.getItem(AUDIT_LOG_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function addAuditLog(action, details = {}, actor = currentUser()) {
  const entry = {
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    at: new Date().toISOString(),
    actor,
    action,
    ...details,
  };
  const logs = [entry, ...loadAuditLogs()].slice(0, 5000);
  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(logs));
  window.dispatchEvent(new CustomEvent("certichain:audit-updated"));
  return entry;
}

export function clearAuditLogs() {
  localStorage.removeItem(AUDIT_LOG_KEY);
  window.dispatchEvent(new CustomEvent("certichain:audit-updated"));
}
