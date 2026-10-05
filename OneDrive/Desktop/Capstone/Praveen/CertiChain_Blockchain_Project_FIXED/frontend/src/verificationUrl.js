const trimSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

export function getPublicAppUrl() {
  const configured = trimSlash(import.meta.env.VITE_PUBLIC_APP_URL);
  if (configured) return configured;
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "http://localhost:5173";
}

export function getVerificationUrl(certificateId) {
  return `${getPublicAppUrl()}/verify/${encodeURIComponent(String(certificateId || ""))}`;
}

export function isLocalVerificationUrl(url = getPublicAppUrl()) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host) || host.endsWith(".local");
  } catch {
    return true;
  }
}

export function apiBaseUrl() {
  return trimSlash(import.meta.env.VITE_API_URL || "http://localhost:5000");
}

export async function publishCertificateForPublicVerification(record) {
  if (!record?.id) return { ok: false, skipped: true };
  const payload = {
    id: String(record.id),
    name: String(record?.data?.name || record?.data?.student_name || record?.data?.recipient_name || "Participant"),
    email: String(record?.email || record?.data?.email || ""),
    course: String(record?.data?.course || record?.templateName || "Certificate"),
    templateName: String(record?.templateName || "Certificate"),
    issuedAt: record.issuedAt || null,
    status: record.status || "Issued",
    createdByName: record.createdByName || "Authorized Institution",
    createdBy: record.createdBy || "",
    blockchainStatus: record.blockchainStatus || "Not registered",
    transactionHash: record.transactionHash || null,
    blockNumber: record.blockNumber || null,
    ipfsCid: record.ipfsCid || null,
    blockchainNetwork: record.blockchainNetwork || "Ethereum Sepolia",
    disqualificationReason: record.disqualificationReason || null,
    disqualifiedBy: record.disqualifiedBy || null,
    disqualifiedAt: record.disqualifiedAt || null,
    certificateHash: record.documentHash || null,
  };
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 6000);
    const response = await fetch(`${apiBaseUrl()}/api/public/certificates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    window.clearTimeout(timer);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "Unable to publish certificate for public verification.");
    return { ok: true, ...data };
  } catch (error) {
    return { ok: false, error: error?.name === "AbortError" ? "Public verification server timed out." : (error?.message || "Public verification sync failed.") };
  }
}

export async function updatePublicCertificateStatus(record) {
  return publishCertificateForPublicVerification(record);
}
