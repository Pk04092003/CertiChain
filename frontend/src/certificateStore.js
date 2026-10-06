export const ISSUED_CERTIFICATES_KEY = "certichain-issued-certificates";
export const ISSUED_TEMPLATE_SNAPSHOTS_KEY = "certichain-issued-template-snapshots";
export const CURRENT_ISSUER_KEY = "certichain-current-issuer";
export const DEFAULT_ISSUER = "0x7a...91F2";

function hashString(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function loadTemplateSnapshots() {
  try {
    const value = JSON.parse(localStorage.getItem(ISSUED_TEMPLATE_SNAPSHOTS_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function snapshotIdForTemplate(template) {
  if (!template || typeof template !== "object") return null;
  try {
    return `snapshot-${template.id || "template"}-${hashString(JSON.stringify(template))}`;
  } catch {
    return null;
  }
}

function storeTemplateSnapshot(template, snapshots) {
  const snapshotId = snapshotIdForTemplate(template);
  if (!snapshotId) return null;
  if (!snapshots[snapshotId]) snapshots[snapshotId] = template;
  return snapshotId;
}

function compactIssuedRecord(record, snapshots) {
  if (!record || typeof record !== "object") return record;

  const next = { ...record };
  const snapshotId = next.templateSnapshotId || storeTemplateSnapshot(next.template, snapshots);
  if (snapshotId) next.templateSnapshotId = snapshotId;

  // Large templates (especially templates containing base64 images) must not be
  // duplicated into every participant record. Keep one immutable snapshot and
  // reference it from each issued certificate.
  delete next.template;
  return next;
}

function hydrateIssuedRecord(record, snapshots) {
  if (!record || typeof record !== "object") return record;
  if (record.template || !record.templateSnapshotId) return record;
  const snapshot = snapshots[record.templateSnapshotId];
  return snapshot ? { ...record, template: snapshot } : record;
}

export function getCurrentIssuer() {
  try {
    return localStorage.getItem(CURRENT_ISSUER_KEY) || DEFAULT_ISSUER;
  } catch {
    return DEFAULT_ISSUER;
  }
}

export function loadIssuedCertificates() {
  try {
    const records = JSON.parse(localStorage.getItem(ISSUED_CERTIFICATES_KEY) || "[]");
    const snapshots = loadTemplateSnapshots();
    return (Array.isArray(records) ? records : []).map((record) => hydrateIssuedRecord(record, snapshots));
  } catch {
    return [];
  }
}

export function saveIssuedCertificates(records) {
  const next = Array.isArray(records) ? records : [];
  const snapshots = loadTemplateSnapshots();
  const compacted = next.map((record) => compactIssuedRecord(record, snapshots));

  try {
    localStorage.setItem(ISSUED_TEMPLATE_SNAPSHOTS_KEY, JSON.stringify(snapshots));
    localStorage.setItem(ISSUED_CERTIFICATES_KEY, JSON.stringify(compacted));
  } catch (error) {
    // Drop only orphaned immutable snapshots and retry. Issued certificates are
    // never removed by this recovery path.
    try {
      const referenced = new Set(compacted.map((record) => record?.templateSnapshotId).filter(Boolean));
      const cleanedSnapshots = {};
      Object.entries(snapshots).forEach(([id, snapshot]) => {
        if (referenced.has(id)) cleanedSnapshots[id] = snapshot;
      });
      localStorage.setItem(ISSUED_TEMPLATE_SNAPSHOTS_KEY, JSON.stringify(cleanedSnapshots));
      localStorage.setItem(ISSUED_CERTIFICATES_KEY, JSON.stringify(compacted));
    } catch {
      const quotaError = new Error(
        "Unable to save the certificate batch because this browser's storage is full. Download/export your existing certificates and clear CertiChain site storage, then issue the batch again."
      );
      quotaError.cause = error;
      throw quotaError;
    }
  }

  window.dispatchEvent(new CustomEvent("certichain:issued-certificates-updated"));
  return loadIssuedCertificates();
}

export function upsertIssuedCertificates(records) {
  const existing = loadIssuedCertificates();
  const map = new Map(existing.map((item) => [item.id, item]));
  for (const record of Array.isArray(records) ? records : []) {
    if (record?.id) map.set(record.id, record);
  }
  return saveIssuedCertificates([...map.values()]);
}

export function updateIssuedCertificate(id, patch) {
  const existing = loadIssuedCertificates();
  const next = existing.map((item) => (item.id === id ? { ...item, ...patch } : item));
  saveIssuedCertificates(next);
  return next.find((item) => item.id === id) || null;
}

export function appendCertificateHistory(id, action, details = {}) {
  const record = findIssuedCertificate(id);
  if (!record) return null;
  const history = Array.isArray(record.history) ? record.history : [];
  const updated = updateIssuedCertificate(id, {
    history: [...history, { action, at: new Date().toISOString(), ...details }],
  });
  return updated;
}

export function findIssuedCertificate(id) {
  const target = String(id || "").toLowerCase();
  return loadIssuedCertificates().find((item) => String(item.id || "").toLowerCase() === target) || null;
}
