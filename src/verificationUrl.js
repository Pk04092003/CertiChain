import { authHeaders } from "./authStore";

const trimSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

export function getPublicAppUrl() {
  const configured = trimSlash(import.meta.env.VITE_PUBLIC_APP_URL);
  if (configured) return configured;
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "http://localhost:5173";
}

export function getVerificationUrl(certificateId) {
  return `${getPublicAppUrl()}/verify/${encodeURIComponent(String(certificateId || "").trim().toUpperCase())}`;
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
  return trimSlash(import.meta.env.VITE_API_URL || "https://certichain-1-xc8l.onrender.com");
}

function buildPublicPayload(record) {
  const sourceData = record?.data && typeof record.data === "object" ? record.data : {};
  const publicFields = Object.fromEntries(
    Object.entries(sourceData)
      .filter(([key]) => !/^email$/i.test(String(key)))
      .map(([key, value]) => [String(key), value == null ? "" : String(value)])
  );

  return {
    id: String(record.id),
    name: String(record?.data?.name || record?.data?.student_name || record?.data?.recipient_name || "Participant"),
    email: String(record?.email || record?.data?.email || ""),
    course: String(record?.data?.course || record?.templateName || "Certificate"),
    templateName: String(record?.templateName || "Certificate"),
    issuedAt: record.issuedAt || null,
    status: record.blockchainRevoked || record.status === "Revoked" ? "Revoked" : (record.status || "Issued"),
    verificationStatus: record.blockchainRevoked || record.status === "Revoked" ? "Revoked" : (record.status === "Disqualified" ? "Disqualified" : "Verified"),
    blockchainRevoked: Boolean(record.blockchainRevoked),
    blockchainRevokedAt: record.blockchainRevokedAt || null,
    revocationReason: record.revocationReason || null,
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
    publicFields,
  };
}

async function apiJson(pathname, options = {}) {
  const response = await fetch(`${apiBaseUrl()}${pathname}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || `CertiChain backend returned HTTP ${response.status}.`);
    error.status = response.status;
    error.code = data?.errorCode || data?.code || null;
    throw error;
  }
  return data;
}

export async function publishCertificateForPublicVerification(record) {
  if (!record?.id) return { ok: false, skipped: true };
  try {
    const data = await apiJson("/api/public/certificates", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
      body: JSON.stringify(buildPublicPayload(record)),
    });
    return { ok: true, ...data };
  } catch (error) {
    return { ok: false, error: error?.message || "Public verification sync failed.", status: error?.status || null };
  }
}

export async function getPublicCertificate(certificateId) {
  const id = String(certificateId || "").trim().toUpperCase();
  if (!id) return { ok: false, error: "Certificate ID is required." };
  try {
    const data = await apiJson(`/api/public/certificates/${encodeURIComponent(id)}`, { headers: { Accept: "application/json" } });
    return { ok: true, certificate: data?.certificate || null };
  } catch (error) {
    return { ok: false, error: error?.message || "Public verification service unavailable.", status: error?.status || null };
  }
}

export async function verifyCertificatePublicly(certificateId) {
  const id = String(certificateId || "").trim().toUpperCase();
  if (!id) return { ok: false, state: "NOT_FOUND", error: "Certificate ID is required." };
  try {
    const data = await apiJson(`/api/public/verify/${encodeURIComponent(id)}`, { headers: { Accept: "application/json" } });
    return { ok: true, ...data };
  } catch (error) {
    return { ok: false, state: error?.status === 404 ? "NOT_FOUND" : "UNAVAILABLE", error: error?.message || "Certificate verification is temporarily unavailable.", status: error?.status || null, code: error?.code || null };
  }
}

export async function automateNewCertificate({ record, pdfBase64 }) {
  if (!record?.id) return { ok: false, error: "Certificate ID is required." };
  if (!pdfBase64) return { ok: false, error: "PDF certificate data is required." };
  try {
    const data = await apiJson("/api/certificates/automate", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
      body: JSON.stringify({
        certificateId: record.id,
        pdfBase64,
        name: record?.data?.name || record?.data?.student_name || record?.data?.recipient_name || "Participant",
        course: record?.data?.course || record?.templateName || "Certificate",
        templateName: record?.templateName || "Certificate",
        issuedAt: record?.issuedAt || null,
        createdByName: record?.createdByName || "CertiChain Admin",
        createdBy: record?.createdBy || "",
        certificateHash: record?.documentHash || null,
      }),
    });
    return { ok: true, ...data };
  } catch (error) {
    return { ok: false, error: error?.message || "Automatic IPFS and blockchain registration failed.", status: error?.status || null, code: error?.code || null };
  }
}

export async function updatePublicCertificateStatus(record) {
  if (!record?.id) return { ok: false, skipped: true };
  const id = String(record.id).trim().toUpperCase();
  const payload = buildPublicPayload(record);
  try {
    const data = await apiJson(`/api/public/certificates/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
      body: JSON.stringify(payload),
    });
    return { ok: true, ...data };
  } catch (error) {
    if (error?.status === 404) return publishCertificateForPublicVerification(record);
    return { ok: false, error: error?.message || "Public verification sync failed.", status: error?.status || null };
  }
}
