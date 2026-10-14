export const PENDING_EMAIL_BATCH_KEY = "certichain-pending-email-batch";

export function savePendingEmailBatch(batch) {
  const value = {
    id: batch?.id || `batch-${Date.now()}`,
    certificateIds: Array.isArray(batch?.certificateIds) ? batch.certificateIds.filter(Boolean) : [],
    templateName: batch?.templateName || "Certificate template",
    createdAt: batch?.createdAt || new Date().toISOString(),
  };
  try {
    localStorage.setItem(PENDING_EMAIL_BATCH_KEY, JSON.stringify(value));
  } catch (error) {
    console.error("Unable to save pending email batch:", error);
  }
  return value;
}

export function loadPendingEmailBatch() {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_EMAIL_BATCH_KEY) || "null");
    return value && Array.isArray(value.certificateIds) ? value : null;
  } catch {
    return null;
  }
}

export function clearPendingEmailBatch() {
  try {
    localStorage.removeItem(PENDING_EMAIL_BATCH_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}
