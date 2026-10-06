import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { google } from "googleapis";
import crypto from "node:crypto";
import { MongoClient } from "mongodb";
import { ethers } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
  path.join(__dirname, ".env"),
  path.join(process.cwd(), ".env"),
  path.join(__dirname, "..", ".env"),
];
let loadedEnvFile = null;
for (const envPath of [...new Set(envCandidates)]) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    loadedEnvFile = envPath;
    break;
  }
}

const app = express();
app.set("trust proxy", 1);
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Accept", "Authorization"],
}));
app.use(express.json({ limit: "100mb" }));

const port = Number(process.env.PORT || 5000);

// ---------------------------------------------------------------------------
// Admin authentication
// Only the administrator has an account. Public certificate verification does
// not require authentication. Admin-only operations use a short-lived HMAC
// bearer token issued after checking Render environment credentials.
// ---------------------------------------------------------------------------
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "");
const ADMIN_NAME = String(process.env.ADMIN_NAME || "CertiChain Admin").trim() || "CertiChain Admin";
const ADMIN_JWT_SECRET = String(process.env.ADMIN_JWT_SECRET || "").trim();
const ADMIN_TOKEN_TTL_SECONDS = 12 * 60 * 60;

function tokenSecret() {
  return ADMIN_JWT_SECRET || (process.env.RENDER === "true" ? "" : "local-dev-secret-change-me");
}

function createAdminToken(user) {
  const secret = tokenSecret();
  if (!secret) throw new Error("ADMIN_JWT_SECRET is not configured.");
  const payload = {
    sub: String(user.email).toLowerCase(),
    name: String(user.name || ADMIN_NAME),
    role: "Admin",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ADMIN_TOKEN_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyAdminToken(token) {
  const secret = tokenSecret();
  if (!secret) return null;
  const [encoded, signature] = String(token || "").split(".");
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload?.role !== "Admin") return null;
    if (Number(payload?.exp || 0) <= Math.floor(Date.now() / 1000)) return null;
    if (!payload?.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

function bearerToken(req) {
  const value = String(req.headers?.authorization || "");
  return /^Bearer\s+/i.test(value) ? value.replace(/^Bearer\s+/i, "").trim() : "";
}

function requireAdmin(req, res, next) {
  const payload = verifyAdminToken(bearerToken(req));
  if (!payload) {
    return res.status(401).json({ error: "Admin authorization required. Please sign in again.", errorCode: "ADMIN_UNAUTHORIZED" });
  }
  req.admin = payload;
  return next();
}

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const usingEnvCredentials = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD && ADMIN_JWT_SECRET);
  const localFallback = process.env.RENDER !== "true" && !ADMIN_EMAIL && !ADMIN_PASSWORD;
  const valid = usingEnvCredentials
    ? email === ADMIN_EMAIL && password === ADMIN_PASSWORD
    : localFallback
      ? email === "admin@certichain.local" && password === "admin123"
      : false;

  if (!valid) {
    const code = usingEnvCredentials ? "INVALID_CREDENTIALS" : "ADMIN_AUTH_NOT_CONFIGURED";
    const message = usingEnvCredentials
      ? "Invalid admin email or password."
      : "Administrator authentication is not configured on the backend. Add ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_JWT_SECRET to Render.";
    return res.status(usingEnvCredentials ? 401 : 503).json({ error: message, errorCode: code });
  }

  const user = {
    id: "USR-ADMIN",
    name: usingEnvCredentials ? ADMIN_NAME : "CertiChain Admin",
    email: usingEnvCredentials ? ADMIN_EMAIL : "admin@certichain.local",
    role: "Admin",
  };
  try {
    const token = createAdminToken(user);
    return res.json({ ok: true, token, expiresIn: ADMIN_TOKEN_TTL_SECONDS, user });
  } catch (error) {
    return res.status(503).json({ error: error?.message || "Administrator authentication is unavailable." });
  }
});

app.get("/api/auth/me", requireAdmin, (req, res) => {
  res.json({
    ok: true,
    user: {
      id: "USR-ADMIN",
      name: String(req.admin?.name || ADMIN_NAME),
      email: String(req.admin?.sub || ADMIN_EMAIL),
      role: "Admin",
    },
  });
});

// ---------------------------------------------------------------------------
// Durable public verification metadata (MongoDB in production)
// ---------------------------------------------------------------------------
const mongoUri = String(process.env.MONGODB_URI || "").trim();
const mongoDbName = String(process.env.CERTICHAIN_MONGODB_DB || "certichain").trim();
const mongoCollectionName = String(process.env.CERTICHAIN_PUBLIC_COLLECTION || "public_certificates").trim();
let mongoClient = null;
let publicCollectionPromise = null;

async function getPublicCollection() {
  if (!mongoUri) return null;
  if (!publicCollectionPromise) {
    publicCollectionPromise = (async () => {
      mongoClient = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 8000 });
      await mongoClient.connect();
      const collection = mongoClient.db(mongoDbName).collection(mongoCollectionName);
      await collection.createIndex({ id: 1 }, { unique: true });
      console.log(`Public verification MongoDB connected: ${mongoDbName}.${mongoCollectionName}`);
      return collection;
    })().catch((error) => {
      publicCollectionPromise = null;
      try { mongoClient?.close(); } catch {}
      mongoClient = null;
      throw error;
    });
  }
  return publicCollectionPromise;
}

const publicCertificatesDir = path.join(__dirname, "data");
const publicCertificatesFile = path.join(publicCertificatesDir, "public-certificates.json");
let publicCertificates = {};
try {
  fs.mkdirSync(publicCertificatesDir, { recursive: true });
  const raw = fs.readFileSync(publicCertificatesFile, "utf8");
  const parsed = JSON.parse(raw || "{}");
  publicCertificates = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
} catch {
  publicCertificates = {};
}
let publicWriteQueue = Promise.resolve();
function savePublicCertificates() {
  publicWriteQueue = publicWriteQueue.then(async () => {
    await fs.promises.mkdir(publicCertificatesDir, { recursive: true });
    await fs.promises.writeFile(publicCertificatesFile, JSON.stringify(publicCertificates, null, 2), "utf8");
  }).catch((error) => console.error("Public certificate store write failed:", error?.message || error));
  return publicWriteQueue;
}

function normalizeId(value) {
  return String(value || "").trim().toUpperCase();
}

function stablePublicIntegrityInput(body = {}) {
  const publicFields = body.publicFields && typeof body.publicFields === "object" && !Array.isArray(body.publicFields)
    ? Object.fromEntries(Object.entries(body.publicFields).filter(([key]) => !/^email$/i.test(String(key))).sort(([a], [b]) => String(a).localeCompare(String(b))))
    : {};
  return JSON.stringify({
    id: normalizeId(body.id || body.certificateId),
    name: String(body.name || "Participant").trim(),
    course: String(body.course || body.templateName || "Certificate").trim(),
    templateName: String(body.templateName || "Certificate").trim(),
    issuedAt: body.issuedAt || null,
    createdByName: String(body.createdByName || "Authorized Institution"),
    createdBy: String(body.createdBy || ""),
    publicFields,
    certificateHash: body.certificateHash || null,
  });
}

function calculateIntegrityHash(body = {}) {
  return crypto.createHash("sha256").update(stablePublicIntegrityInput(body)).digest("hex");
}

function publicCertificatePayload(body = {}) {
  const id = normalizeId(body.id || body.certificateId);
  if (!id) return null;
  const isRevoked = Boolean(body.blockchainRevoked) || String(body.status || "").trim() === "Revoked";
  const isDisqualified = String(body.status || "").trim() === "Disqualified";
  return {
    id,
    certificateId: id,
    name: String(body.name || "Participant").trim(),
    course: String(body.course || body.templateName || "Certificate").trim(),
    templateName: String(body.templateName || "Certificate").trim(),
    issuedAt: body.issuedAt || null,
    status: isRevoked ? "Revoked" : (isDisqualified ? "Disqualified" : "Issued"),
    verificationStatus: isRevoked ? "Revoked" : (isDisqualified ? "Disqualified" : "Verified"),
    blockchainRevoked: isRevoked,
    blockchainRevokedAt: body.blockchainRevokedAt || null,
    revocationReason: body.revocationReason || null,
    createdByName: String(body.createdByName || "Authorized Institution"),
    createdBy: String(body.createdBy || ""),
    blockchainStatus: String(body.blockchainStatus || "Not registered"),
    transactionHash: body.transactionHash || null,
    blockNumber: body.blockNumber || null,
    ipfsCid: body.ipfsCid || null,
    blockchainNetwork: String(body.blockchainNetwork || process.env.BLOCKCHAIN_NETWORK || "Ethereum Sepolia"),
    disqualificationReason: body.disqualificationReason || null,
    disqualifiedBy: body.disqualifiedBy || null,
    disqualifiedAt: body.disqualifiedAt || null,
    certificateHash: body.certificateHash || null,
    integrityHash: body.integrityHash || calculateIntegrityHash(body),
    history: Array.isArray(body.history) ? body.history : [],
    publicFields: body.publicFields && typeof body.publicFields === "object" && !Array.isArray(body.publicFields)
      ? Object.fromEntries(Object.entries(body.publicFields).filter(([key]) => !/^email$/i.test(String(key))))
      : {},
    updatedAt: new Date().toISOString(),
  };
}

function publicCertificateForResponse(record) {
  if (!record) return null;
  const { _id, email, ...safe } = record;
  return {
    ...safe,
    documentUrl: safe.ipfsCid ? ipfsDocumentUrl(safe.ipfsCid) : null,
  };
}

async function upsertPublicCertificate(payload) {
  const collection = await getPublicCollection();
  if (collection) {
    const now = new Date().toISOString();
    const document = { ...payload, updatedAt: now };
    await collection.updateOne({ id: payload.id }, { $set: document }, { upsert: true });
    return document;
  }

  if (process.env.RENDER === "true") {
    const error = new Error("Public verification storage is not configured. Add MONGODB_URI to the Render service.");
    error.statusCode = 503;
    error.code = "PUBLIC_STORAGE_NOT_CONFIGURED";
    throw error;
  }

  publicCertificates[payload.id] = payload;
  await savePublicCertificates();
  return payload;
}

async function findPublicCertificate(id) {
  const target = normalizeId(id);
  if (!target) return null;
  const collection = await getPublicCollection();
  if (collection) return collection.findOne({ id: target }, { projection: { _id: 0 } });

  if (process.env.RENDER === "true") {
    const error = new Error("Public verification storage is not configured. Add MONGODB_URI to the Render service.");
    error.statusCode = 503;
    error.code = "PUBLIC_STORAGE_NOT_CONFIGURED";
    throw error;
  }

  return publicCertificates[target] || null;
}

async function findPublicCertificateSafe(id) {
  try {
    const record = await findPublicCertificate(id);
    return { record, error: null };
  } catch (error) {
    console.error("Public metadata lookup failed:", error?.message || error);
    return { record: null, error };
  }
}

async function patchPublicCertificate(id, patch = {}) {
  const target = normalizeId(id);
  if (!target) return null;
  const existing = await findPublicCertificate(target);
  if (!existing) return null;
  const next = publicCertificatePayload({ ...existing, ...patch, id: target });
  return upsertPublicCertificate(next);
}

// ---------------------------------------------------------------------------
// Blockchain automation
// ---------------------------------------------------------------------------
const BLOCKCHAIN_ABI = [
  "function issueCertificate(bytes32 certificateId, string ipfsCid) external",
  "function revokeCertificate(bytes32 certificateId) external",
  "function verifyCertificate(bytes32 certificateId) external view returns (bool exists,bool revoked,address issuer,string ipfsCid,uint256 issuedAt)",
  "function authorizedIssuers(address) external view returns (bool)",
];

function blockchainConfig() {
  const rpcUrl = String(process.env.BLOCKCHAIN_RPC_URL || process.env.SEPOLIA_RPC_URL || "").trim();
  const contractAddress = String(process.env.BLOCKCHAIN_CONTRACT_ADDRESS || "").trim();
  const privateKey = String(process.env.BLOCKCHAIN_PRIVATE_KEY || "").trim();
  const network = String(process.env.BLOCKCHAIN_NETWORK || "Ethereum Sepolia").trim();
  return {
    rpcUrl,
    contractAddress,
    privateKey,
    network,
    readConfigured: Boolean(rpcUrl && contractAddress),
    writeConfigured: Boolean(rpcUrl && contractAddress && privateKey),
  };
}

function certificateBytes32(id) {
  return ethers.keccak256(ethers.toUtf8Bytes(normalizeId(id)));
}

function blockchainProvider() {
  const config = blockchainConfig();
  if (!config.rpcUrl) return null;
  return new ethers.JsonRpcProvider(config.rpcUrl);
}

async function readBlockchainCertificate(id) {
  const config = blockchainConfig();
  if (!config.readConfigured) return { configured: false, exists: false };
  const provider = blockchainProvider();
  const contract = new ethers.Contract(config.contractAddress, BLOCKCHAIN_ABI, provider);
  const result = await contract.verifyCertificate(certificateBytes32(id));
  return {
    configured: true,
    exists: Boolean(result[0]),
    revoked: Boolean(result[1]),
    issuer: String(result[2] || ""),
    ipfsCid: String(result[3] || "").trim() || null,
    issuedAt: Number(result[4] || 0) || null,
    network: config.network,
    contractAddress: config.contractAddress,
  };
}

let blockchainWriteQueue = Promise.resolve();
function queueBlockchainWrite(task) {
  const run = blockchainWriteQueue.then(task, task);
  blockchainWriteQueue = run.catch(() => undefined);
  return run;
}

function readableBlockchainError(error) {
  const code = String(error?.code || "");
  if (code === "CALL_EXCEPTION" || code === "ACTION_REJECTED") return String(error?.shortMessage || error?.reason || error?.message || "Blockchain transaction failed.");
  if (/insufficient funds/i.test(String(error?.message || ""))) return "The automated issuer wallet does not have enough Sepolia ETH for transaction fees.";
  if (/not authorized issuer|Not authorized issuer/i.test(String(error?.message || ""))) return "The automated issuer wallet is not authorized by the CertificateRegistry contract.";
  if (/Certificate exists/i.test(String(error?.message || ""))) return "Certificate is already registered on-chain.";
  return String(error?.shortMessage || error?.message || "Blockchain operation failed.");
}

async function issueCertificateOnChain({ certificateId, ipfsCid }) {
  const config = blockchainConfig();
  if (!config.writeConfigured) {
    const error = new Error("Automatic blockchain registration is not configured. Add BLOCKCHAIN_RPC_URL, BLOCKCHAIN_CONTRACT_ADDRESS and BLOCKCHAIN_PRIVATE_KEY to Render.");
    error.statusCode = 503;
    error.code = "BLOCKCHAIN_NOT_CONFIGURED";
    throw error;
  }
  if (!ipfsCid) {
    const error = new Error("An IPFS CID is required before blockchain registration.");
    error.statusCode = 400;
    error.code = "IPFS_CID_REQUIRED";
    throw error;
  }

  return queueBlockchainWrite(async () => {
    const provider = blockchainProvider();
    const wallet = new ethers.Wallet(config.privateKey, provider);
    const contract = new ethers.Contract(config.contractAddress, BLOCKCHAIN_ABI, wallet);
    const authorized = await contract.authorizedIssuers(wallet.address);
    if (!authorized) {
      const error = new Error(`Automated issuer wallet ${wallet.address} is not authorized by the CertificateRegistry contract.`);
      error.statusCode = 403;
      error.code = "BLOCKCHAIN_ISSUER_UNAUTHORIZED";
      throw error;
    }

    const existing = await readBlockchainCertificate(certificateId);
    if (existing.exists) {
      return {
        exists: true,
        transactionHash: null,
        blockNumber: null,
        wallet: wallet.address,
        ipfsCid: existing.ipfsCid || ipfsCid,
        issuedAt: existing.issuedAt,
        revoked: existing.revoked,
        network: existing.network,
        contractAddress: existing.contractAddress,
        alreadyRegistered: true,
      };
    }

    try {
      const tx = await contract.issueCertificate(certificateBytes32(certificateId), ipfsCid);
      const receipt = await tx.wait();
      return {
        exists: true,
        transactionHash: receipt?.hash || tx.hash,
        blockNumber: Number(receipt?.blockNumber || 0) || null,
        wallet: wallet.address,
        ipfsCid,
        issuedAt: Math.floor(Date.now() / 1000),
        revoked: false,
        network: config.network,
        contractAddress: config.contractAddress,
        alreadyRegistered: false,
      };
    } catch (error) {
      // Another request may have won a race before this transaction was mined.
      const after = await readBlockchainCertificate(certificateId).catch(() => null);
      if (after?.exists) {
        return {
          exists: true,
          transactionHash: null,
          blockNumber: null,
          wallet: wallet.address,
          ipfsCid: after.ipfsCid || ipfsCid,
          issuedAt: after.issuedAt,
          revoked: after.revoked,
          network: after.network,
          contractAddress: after.contractAddress,
          alreadyRegistered: true,
        };
      }
      const wrapped = new Error(readableBlockchainError(error));
      wrapped.statusCode = Number(error?.statusCode || 502);
      wrapped.code = error?.code || "BLOCKCHAIN_ISSUE_FAILED";
      throw wrapped;
    }
  });
}

async function blockchainStatus() {
  const config = blockchainConfig();
  if (!config.readConfigured) {
    return { configured: false, writeConfigured: false, network: config.network, contractAddress: config.contractAddress || null, authorized: false };
  }
  const provider = blockchainProvider();
  const chainId = Number((await provider.getNetwork()).chainId);
  let authorized = false;
  let walletAddress = null;
  if (config.privateKey) {
    try {
      const wallet = new ethers.Wallet(config.privateKey, provider);
      walletAddress = wallet.address;
      const contract = new ethers.Contract(config.contractAddress, BLOCKCHAIN_ABI, provider);
      authorized = Boolean(await contract.authorizedIssuers(wallet.address));
    } catch (error) {
      return { configured: true, writeConfigured: true, network: config.network, contractAddress: config.contractAddress, chainId, authorized: false, walletAddress, error: readableBlockchainError(error) };
    }
  }
  return { configured: true, writeConfigured: config.writeConfigured, network: config.network, contractAddress: config.contractAddress, chainId, authorized, walletAddress };
}

// ---------------------------------------------------------------------------
// IPFS (Pinata preferred; custom gateway fallback supported)
// ---------------------------------------------------------------------------
const DEFAULT_IPFS_UPLOAD_URL = "https://uploads.pinata.cloud/v3/files";
function ipfsConfig() {
  return {
    pinataJwt: String(process.env.PINATA_JWT || "").trim(),
    network: String(process.env.PINATA_NETWORK || "public").trim() || "public",
    uploadEndpoint: String(process.env.IPFS_UPLOAD_ENDPOINT || "").trim(),
    uploadToken: String(process.env.IPFS_UPLOAD_TOKEN || "").trim(),
    gateway: String(process.env.IPFS_GATEWAY_URL || "https://ipfs.io/ipfs").trim().replace(/\/+$/, ""),
  };
}

function ipfsDocumentUrl(cid) {
  const value = String(cid || "").trim();
  if (!value) return null;
  const config = ipfsConfig();
  if (/^https?:\/\//i.test(value)) return value;
  return `${config.gateway}/${encodeURIComponent(value)}`;
}

function cleanBase64(value) {
  return String(value || "").replace(/^data:[^,]+,/i, "").replace(/\s/g, "");
}

async function uploadPdfToIpfs({ certificateId, pdfBase64 }) {
  const config = ipfsConfig();
  const body = cleanBase64(pdfBase64);
  if (!body) {
    const error = new Error("PDF data is required for IPFS upload.");
    error.statusCode = 400;
    error.code = "PDF_REQUIRED";
    throw error;
  }

  const bytes = Buffer.from(body, "base64");
  if (!bytes.length) {
    const error = new Error("The supplied PDF data is empty or invalid.");
    error.statusCode = 400;
    error.code = "PDF_INVALID";
    throw error;
  }

  let endpoint = "";
  let headers = {};
  let requestBody;
  if (config.pinataJwt) {
    endpoint = DEFAULT_IPFS_UPLOAD_URL;
    const form = new FormData();
    form.append("network", config.network);
    form.append("file", new Blob([bytes], { type: "application/pdf" }), `${normalizeId(certificateId)}.pdf`);
    requestBody = form;
    headers = { Authorization: `Bearer ${config.pinataJwt}` };
  } else if (config.uploadEndpoint) {
    endpoint = config.uploadEndpoint;
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "application/pdf" }), `${normalizeId(certificateId)}.pdf`);
    form.append("certificateId", normalizeId(certificateId));
    requestBody = form;
    if (config.uploadToken) headers.Authorization = `Bearer ${config.uploadToken}`;
  } else {
    const error = new Error("Automatic IPFS upload is not configured. Add PINATA_JWT to Render (recommended) or configure IPFS_UPLOAD_ENDPOINT.");
    error.statusCode = 503;
    error.code = "IPFS_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch(endpoint, { method: "POST", headers, body: requestBody });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(String(data?.error || data?.message || `IPFS upload failed (HTTP ${response.status}).`));
    error.statusCode = response.status;
    error.code = "IPFS_UPLOAD_FAILED";
    throw error;
  }
  const cid = String(data?.data?.cid || data?.cid || data?.IpfsHash || data?.ipfsCid || "").trim();
  if (!cid) {
    const error = new Error("The IPFS upload service did not return a CID.");
    error.statusCode = 502;
    error.code = "IPFS_CID_MISSING";
    throw error;
  }
  return { cid, url: ipfsDocumentUrl(cid), provider: config.pinataJwt ? "Pinata" : "Custom" };
}

app.get("/api/blockchain/status", async (_, res) => {
  try {
    const chain = await blockchainStatus();
    const ipfs = ipfsConfig();
    return res.json({
      ok: true,
      blockchain: chain,
      ipfs: { configured: Boolean(ipfs.pinataJwt || ipfs.uploadEndpoint), provider: ipfs.pinataJwt ? "Pinata" : (ipfs.uploadEndpoint ? "Custom" : null), gateway: ipfs.gateway },
    });
  } catch (error) {
    return res.status(503).json({ ok: false, error: "Automatic blockchain status is temporarily unavailable." });
  }
});

async function automateCertificate({ certificateId, pdfBase64, metadata = {} }) {
  const id = normalizeId(certificateId);
  if (!id) {
    const error = new Error("Certificate ID is required.");
    error.statusCode = 400;
    throw error;
  }

  const chainBefore = await readBlockchainCertificate(id).catch((error) => ({ configured: false, exists: false, error }));
  if (chainBefore?.exists && chainBefore.ipfsCid) {
    const merged = publicCertificatePayload({
      ...metadata,
      id,
      ipfsCid: chainBefore.ipfsCid,
      blockchainStatus: "Registered",
      transactionHash: metadata.transactionHash || null,
      blockNumber: metadata.blockNumber || null,
      blockchainNetwork: chainBefore.network,
    });
    let publicVerification = { ok: false, error: null };
    try {
      const saved = await upsertPublicCertificate(merged);
      publicVerification = { ok: true, certificate: publicCertificateForResponse(saved) };
    } catch (error) {
      publicVerification = { ok: false, error: error?.message || "Public metadata could not be stored." };
    }
    return {
      ok: true,
      alreadyRegistered: true,
      ipfs: { cid: chainBefore.ipfsCid, url: ipfsDocumentUrl(chainBefore.ipfsCid) },
      blockchain: chainBefore,
      publicVerification,
    };
  }

  const ipfs = await uploadPdfToIpfs({ certificateId: id, pdfBase64 });
  const chain = await issueCertificateOnChain({ certificateId: id, ipfsCid: ipfs.cid });

  const payload = publicCertificatePayload({
    ...metadata,
    id,
    ipfsCid: chain.ipfsCid || ipfs.cid,
    blockchainStatus: "Registered",
    transactionHash: chain.transactionHash || metadata.transactionHash || null,
    blockNumber: chain.blockNumber || metadata.blockNumber || null,
    blockchainNetwork: chain.network,
  });

  let publicVerification = { ok: false, error: null };
  try {
    const saved = await upsertPublicCertificate(payload);
    publicVerification = { ok: true, certificate: publicCertificateForResponse(saved) };
  } catch (error) {
    console.error("Public verification metadata store failed after chain registration:", error?.message || error);
    publicVerification = { ok: false, error: error?.message || "Public metadata could not be stored." };
  }

  return { ok: true, alreadyRegistered: false, ipfs, blockchain: chain, publicVerification };
}

app.post("/api/certificates/automate", requireAdmin, async (req, res) => {
  try {
    const certificateId = normalizeId(req.body?.certificateId);
    const pdfBase64 = cleanBase64(req.body?.pdfBase64);
    const metadata = {
      id: certificateId,
      name: String(req.body?.name || "Participant").trim(),
      course: String(req.body?.course || "Certificate").trim(),
      templateName: String(req.body?.templateName || "Certificate").trim(),
      issuedAt: req.body?.issuedAt || null,
      createdByName: String(req.admin?.name || req.body?.createdByName || "CertiChain Admin"),
      createdBy: String(req.admin?.sub || req.body?.createdBy || ""),
      certificateHash: req.body?.certificateHash || null,
      publicFields: req.body?.publicFields && typeof req.body.publicFields === "object" && !Array.isArray(req.body.publicFields) ? req.body.publicFields : {},
      history: Array.isArray(req.body?.history) ? req.body.history : [],
      status: "Issued",
    };
    if (!certificateId) return res.status(400).json({ error: "Certificate ID is required." });
    if (!pdfBase64) return res.status(400).json({ error: "PDF certificate data is required." });

    const result = await automateCertificate({ certificateId, pdfBase64, metadata });
    return res.json(result);
  } catch (error) {
    console.error("Automatic certificate workflow failed:", error);
    const status = Number(error?.statusCode || 500);
    return res.status(status >= 400 && status < 600 ? status : 500).json({ error: error?.message || "Automatic certificate workflow failed.", errorCode: error?.code || null });
  }
});

// ---------------------------------------------------------------------------
// Public verification API — blockchain-backed and resilient to Mongo errors
// ---------------------------------------------------------------------------
app.get("/api/public/health", async (_, res) => {
  const mongo = { configured: Boolean(mongoUri), available: false };
  if (mongo.configured) {
    try { mongo.available = Boolean(await getPublicCollection()); } catch {}
  }
  const chain = blockchainConfig();
  return res.json({
    ok: true,
    persistent: mongo.available,
    storage: mongo.available ? "mongodb" : "blockchain-primary",
    blockchainConfigured: chain.readConfigured,
    database: mongo.available ? mongoDbName : null,
    collection: mongo.available ? mongoCollectionName : null,
  });
});

app.post("/api/public/certificates", requireAdmin, async (req, res) => {
  try {
    const payload = publicCertificatePayload(req.body || {});
    if (!payload) return res.status(400).json({ error: "Certificate id is required." });
    const saved = await upsertPublicCertificate(payload);
    return res.status(201).json({ ok: true, certificate: publicCertificateForResponse(saved) });
  } catch (error) {
    console.error("Public certificate publish failed:", error);
    const status = Number(error?.statusCode || 500);
    return res.status(status >= 400 && status < 600 ? status : 500).json({ error: error?.message || "Unable to publish certificate for public verification.", errorCode: error?.code || null });
  }
});


// Public PDF proxy for certificate documents.
// Browsers can refuse to embed third-party IPFS gateways because of their
// framing/security headers. Serving the PDF through our own API keeps the
// public verification viewer same-origin while the source remains IPFS.
app.get("/api/public/certificates/:certificateId/document", async (req, res) => {
  try {
    const id = normalizeId(req.params.certificateId);
    if (!id) return res.status(400).json({ error: "Certificate ID is required." });

    const metadataResult = await findPublicCertificateSafe(id);
    let record = metadataResult.record;

    // Fall back to the on-chain CID if MongoDB metadata is unavailable.
    let cid = record?.ipfsCid || null;
    if (!cid) {
      try {
        const chain = await readBlockchainCertificate(id);
        if (chain?.exists) cid = chain.ipfsCid || null;
      } catch (error) {
        console.error(`Certificate document blockchain lookup failed for ${id}:`, error?.message || error);
      }
    }

    if (!cid) {
      return res.status(metadataResult.error ? 503 : 404).json({
        error: metadataResult.error
          ? "Certificate document is temporarily unavailable."
          : "Certificate document was not found."
      });
    }

    // Only resolve IPFS CIDs/URLs already stored by CertiChain. Do not accept
    // an arbitrary URL from the public request to avoid creating an open proxy.
    const sourceUrl = ipfsDocumentUrl(cid);
    if (!sourceUrl) return res.status(404).json({ error: "Certificate document URL is unavailable." });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let response;
    try {
      response = await fetch(sourceUrl, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { Accept: "application/pdf,*/*;q=0.8" },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return res.status(502).json({ error: `IPFS gateway returned HTTP ${response.status}.` });
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) return res.status(502).json({ error: "The IPFS gateway returned an empty document." });

    // Certificates generated by CertiChain are PDFs. Keep a reasonable
    // response-size guard for the public endpoint.
    if (bytes.length > 25 * 1024 * 1024) {
      return res.status(502).json({ error: "Certificate document is too large to display." });
    }

    res.status(200);
    res.setHeader("Content-Type", contentType.includes("pdf") ? "application/pdf" : "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${id}.pdf"`);
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.end(bytes);
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "The IPFS gateway took too long to respond."
      : (error?.message || "Unable to load certificate document.");
    console.error("Public certificate document proxy failed:", message);
    return res.status(502).json({ error: "Certificate document is temporarily unavailable." });
  }
});

app.get("/api/public/certificates/:certificateId", async (req, res) => {
  const result = await findPublicCertificateSafe(req.params.certificateId);
  if (!result.record) return res.status(result.error ? 503 : 404).json({ error: result.error ? "Public verification service is temporarily unavailable." : "Public verification record not found." });
  return res.json({ ok: true, certificate: publicCertificateForResponse(result.record) });
});

app.get("/api/public/verify/:certificateId", async (req, res) => {
  const id = normalizeId(req.params.certificateId);
  if (!id) return res.status(400).json({ error: "Certificate ID is required." });

  const metadataResult = await findPublicCertificateSafe(id);
  let chain = null;
  let chainError = null;
  try {
    chain = await readBlockchainCertificate(id);
  } catch (error) {
    chainError = error;
    console.error(`Blockchain verification read failed for ${id}:`, error?.message || error);
  }

  const metadata = metadataResult.record;
  if (!metadata && (!chain || !chain.exists)) {
    if (chainError || metadataResult.error) {
      return res.status(503).json({ error: "Certificate verification is temporarily unavailable. Please try again in a moment.", errorCode: "VERIFICATION_TEMPORARILY_UNAVAILABLE" });
    }
    return res.status(404).json({ error: "No CertiChain verification record was found for this certificate ID.", errorCode: "CERTIFICATE_NOT_FOUND" });
  }

  const disqualified = String(metadata?.status || metadata?.verificationStatus || "").toLowerCase() === "disqualified";
  const revoked = Boolean(chain?.revoked) || Boolean(metadata?.blockchainRevoked) || String(metadata?.status || "").toLowerCase() === "revoked";
  const state = disqualified ? "DISQUALIFIED" : revoked ? "REVOKED" : chain?.exists ? "VERIFIED" : "UNREGISTERED";
  const ipfsCid = chain?.ipfsCid || metadata?.ipfsCid || null;
  const certificate = {
    id,
    certificateId: id,
    name: String(metadata?.name || "Certificate holder"),
    course: String(metadata?.course || metadata?.templateName || "Issued certificate"),
    templateName: String(metadata?.templateName || "Certificate"),
    issuedAt: metadata?.issuedAt || (chain?.issuedAt ? new Date(chain.issuedAt * 1000).toISOString() : null),
    status: state === "REVOKED" ? "Revoked" : state === "DISQUALIFIED" ? "Disqualified" : state === "VERIFIED" ? "Issued" : "Unregistered",
    verificationStatus: state === "VERIFIED" ? "Verified" : state === "REVOKED" ? "Revoked" : state === "DISQUALIFIED" ? "Disqualified" : "Unregistered",
    blockchainStatus: chain?.exists ? (chain.revoked ? "Revoked" : "Registered") : String(metadata?.blockchainStatus || "Not registered"),
    blockchainRevoked: Boolean(chain?.revoked || metadata?.blockchainRevoked),
    blockchainRevokedAt: metadata?.blockchainRevokedAt || null,
    transactionHash: metadata?.transactionHash || null,
    blockNumber: metadata?.blockNumber || null,
    blockchainNetwork: chain?.network || metadata?.blockchainNetwork || blockchainConfig().network,
    blockchainIssuer: chain?.issuer || null,
    contractAddress: chain?.contractAddress || blockchainConfig().contractAddress || null,
    ipfsCid,
    documentUrl: ipfsCid ? ipfsDocumentUrl(ipfsCid) : null,
    disqualificationReason: metadata?.disqualificationReason || null,
    disqualifiedBy: metadata?.disqualifiedBy || null,
    disqualifiedAt: metadata?.disqualifiedAt || null,
    certificateHash: metadata?.certificateHash || null,
    integrityHash: metadata?.integrityHash || null,
    publicFields: metadata?.publicFields && typeof metadata.publicFields === "object" ? metadata.publicFields : {},
    history: Array.isArray(metadata?.history) ? metadata.history : [],
    issuerAddress: chain?.issuer || metadata?.createdBy || null,
    contractAddress: chain?.contractAddress || blockchainConfig().contractAddress || null,
  };

  const integrityExpected = metadata?.integrityHash || null;
  const integrityActual = metadata ? calculateIntegrityHash({
    id,
    name: metadata.name,
    course: metadata.course,
    templateName: metadata.templateName,
    issuedAt: metadata.issuedAt,
    createdByName: metadata.createdByName,
    createdBy: metadata.createdBy,
    publicFields: metadata.publicFields,
    certificateHash: metadata.certificateHash,
  }) : null;
  const integrityMatched = Boolean(integrityExpected && integrityActual && integrityExpected === integrityActual);

  return res.json({
    ok: true,
    state,
    certificate,
    integrity: {
      available: Boolean(integrityExpected),
      matched: integrityMatched,
      originalHash: integrityExpected,
      currentHash: integrityActual,
      algorithm: "SHA-256",
      scope: "Public certificate record fields (not the PDF document)",
    },
    blockchain: chain ? {
      configured: Boolean(chain.configured),
      exists: Boolean(chain.exists),
      revoked: Boolean(chain.revoked),
      issuer: chain.issuer || null,
      ipfsCid: chain.ipfsCid || null,
      issuedAt: chain.issuedAt || null,
      network: chain.network || blockchainConfig().network,
      contractAddress: chain.contractAddress || null,
    } : { configured: blockchainConfig().readConfigured, exists: false, error: "Blockchain verification is temporarily unavailable." },
    metadataAvailable: Boolean(metadata),
    metadataStorageError: metadataResult.error ? "Public metadata is temporarily unavailable; blockchain verification is still used when possible." : null,
  });
});

app.patch("/api/public/certificates/:certificateId", requireAdmin, async (req, res) => {
  try {
    const allowed = {
      status: req.body?.status,
      blockchainStatus: req.body?.blockchainStatus,
      transactionHash: req.body?.transactionHash,
      blockNumber: req.body?.blockNumber,
      ipfsCid: req.body?.ipfsCid,
      blockchainNetwork: req.body?.blockchainNetwork,
      disqualificationReason: req.body?.disqualificationReason,
      disqualifiedBy: req.body?.disqualifiedBy,
      disqualifiedAt: req.body?.disqualifiedAt,
      blockchainRevoked: req.body?.blockchainRevoked,
      blockchainRevokedAt: req.body?.blockchainRevokedAt,
      revocationReason: req.body?.revocationReason,
      certificateHash: req.body?.certificateHash,
      history: req.body?.history,
      createdByName: req.body?.createdByName,
      createdBy: req.body?.createdBy,
      name: req.body?.name,
      course: req.body?.course,
      templateName: req.body?.templateName,
      issuedAt: req.body?.issuedAt,
    };
    const cleanPatch = Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined));
    const saved = await patchPublicCertificate(req.params.certificateId, cleanPatch);
    if (!saved) return res.status(404).json({ error: "Public verification record not found." });
    return res.json({ ok: true, certificate: publicCertificateForResponse(saved) });
  } catch (error) {
    console.error("Public certificate update failed:", error);
    const status = Number(error?.statusCode || 500);
    return res.status(status >= 400 && status < 600 ? status : 500).json({ error: error?.message || "Unable to update public verification record.", errorCode: error?.code || null });
  }
});

// ---------------------------------------------------------------------------
// Gmail API
// ---------------------------------------------------------------------------
function readEmailConfig() {
  const clientId = String(process.env.GMAIL_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.GMAIL_CLIENT_SECRET || "").trim();
  const redirectUri = String(process.env.GMAIL_REDIRECT_URI || "").trim();
  const refreshToken = String(process.env.GMAIL_REFRESH_TOKEN || "").trim();
  const senderEmail = String(process.env.GMAIL_SENDER_EMAIL || "").trim();
  const fromName = String(process.env.GMAIL_FROM_NAME || "CertiChain").trim();
  return {
    configured: Boolean(clientId && clientSecret && redirectUri),
    connected: Boolean(clientId && clientSecret && redirectUri && refreshToken),
    clientId, clientSecret, redirectUri, refreshToken, senderEmail, fromName,
  };
}

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const OAUTH_STATE_COOKIE = "certichain_gmail_oauth_state";
const OAUTH_STATE_MAX_AGE = 10 * 60;

function stateCookieSecret() {
  const config = readEmailConfig();
  return config.clientSecret || "certichain-oauth-state-secret";
}
function signOAuthState(state) { return crypto.createHmac("sha256", stateCookieSecret()).update(state).digest("hex"); }
function setOAuthStateCookie(res, state) {
  const secure = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
  const flags = [`${OAUTH_STATE_COOKIE}=${encodeURIComponent(`${state}.${signOAuthState(state)}`)}`, "Path=/api/email/google", `Max-Age=${OAUTH_STATE_MAX_AGE}`, "HttpOnly", "SameSite=Lax", ...(secure ? ["Secure"] : [])];
  res.setHeader("Set-Cookie", flags.join("; "));
}
function clearOAuthStateCookie(res) {
  const secure = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
  const flags = [`${OAUTH_STATE_COOKIE}=`, "Path=/api/email/google", "Max-Age=0", "HttpOnly", "SameSite=Lax", ...(secure ? ["Secure"] : [])];
  res.setHeader("Set-Cookie", flags.join("; "));
}
function readCookie(req, name) {
  const header = String(req.headers?.cookie || "");
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return "";
}
function verifyOAuthState(req, state) {
  const cookieValue = readCookie(req, OAUTH_STATE_COOKIE);
  const [cookieState, signature] = cookieValue.split(".");
  if (!cookieState || !signature || cookieState !== state) return false;
  const expected = signOAuthState(cookieState);
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function oauthClient() {
  const config = readEmailConfig();
  if (!config.configured) return null;
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}
function createGoogleAuthUrl(res) {
  const client = oauthClient();
  if (!client) return null;
  const state = crypto.randomBytes(32).toString("hex");
  setOAuthStateCookie(res, state);
  return client.generateAuthUrl({ access_type: "offline", prompt: "consent", include_granted_scopes: true, scope: [GMAIL_SCOPE], state });
}
function normalizeGmailError(error, fallback = "Gmail email delivery failed.") {
  const data = error?.response?.data;
  const message = data?.error?.message || data?.error_description || data?.message || error?.message || fallback;
  const statusCode = Number(error?.response?.status || error?.code || error?.statusCode || 0);
  return { message: String(message), code: data?.error?.status || data?.error || error?.code || null, statusCode: Number.isFinite(statusCode) ? statusCode : null };
}
function isRetryableGmailError(error) {
  const status = Number(error?.response?.status || error?.code || 0);
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504 || ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "ENETUNREACH", "EPIPE"].includes(String(error?.code || "").toUpperCase());
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function gmailClientFromConfig() {
  const config = readEmailConfig();
  if (!config.connected) return null;
  const client = oauthClient();
  client.setCredentials({ refresh_token: config.refreshToken });
  return client;
}
async function gmailAuthorizationInfo() {
  const auth = gmailClientFromConfig();
  if (!auth) return null;
  const accessTokenResult = await auth.getAccessToken();
  const accessToken = String(accessTokenResult?.token || accessTokenResult || "").trim();
  if (!accessToken) throw new Error("Google did not return an access token from the stored refresh token.");
  const info = await auth.getTokenInfo(accessToken);
  const scopes = Array.isArray(info?.scopes) ? info.scopes : [];
  return { scopes, hasGmailSendScope: scopes.includes(GMAIL_SCOPE), email: String(info?.email || "").trim() || null, expiryDate: info?.expiry_date || null };
}
function sanitizeHeader(value) { return String(value ?? "").replace(/[\r\n]+/g, " ").trim(); }
function encodeMimeHeader(value) {
  const clean = sanitizeHeader(value);
  return /^[\x00-\x7F]*$/.test(clean) ? clean : `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}
function wrapBase64(value) { return String(value || "").match(/.{1,76}/g)?.join("\r\n") || ""; }
function buildGmailRawMessage(message, senderEmail, fromName = "CertiChain") {
  const to = sanitizeHeader(message?.to);
  const subject = encodeMimeHeader(message?.subject || "Certificate issued");
  const html = String(message?.html || "");
  if (!to || !html) throw new Error("Recipient and email HTML are required.");
  const boundary = `----=_CertiChain_${crypto.randomBytes(12).toString("hex")}`;
  const lines = [`From: ${encodeMimeHeader(fromName)} <${sanitizeHeader(senderEmail)}>`, `To: ${to}`, `Subject: ${subject}`, "MIME-Version: 1.0", `Content-Type: multipart/mixed; boundary="${boundary}"`, "", `--${boundary}`, "Content-Type: text/html; charset=\"UTF-8\"", "Content-Transfer-Encoding: base64", "", wrapBase64(Buffer.from(html, "utf8").toString("base64"))];
  const addAttachment = (a = {}) => {
    const content = String(a.contentBase64 || "").replace(/\s/g, "");
    if (!content) return;
    const filename = sanitizeHeader(a.filename || "attachment");
    const type = sanitizeHeader(a.contentType || "application/octet-stream");
    lines.push("", `--${boundary}`, `Content-Type: ${type}; name="${filename}"`, "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename="${filename}"`, "", wrapBase64(content));
  };
  for (const a of Array.isArray(message?.attachments) ? message.attachments : []) addAttachment(a);
  lines.push("", `--${boundary}--`, "");
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function normalizeCertificateEmailMessage(message = {}) {
  const next = { ...message };
  const attachments = [];
  const addPdf = (filename, contentBase64, contentType = "application/pdf") => {
    const type = String(contentType || "").toLowerCase().trim();
    const content = String(contentBase64 || "").replace(/\s/g, "");
    if (type !== "application/pdf" || !content) return;
    attachments.push({ filename: String(filename || "certificate.pdf").toLowerCase().endsWith(".pdf") ? String(filename || "certificate.pdf") : "certificate.pdf", contentType: "application/pdf", contentBase64: content });
  };
  addPdf(next.filename, next.contentBase64, next.contentType);
  for (const item of Array.isArray(next.attachments) ? next.attachments : []) addPdf(item?.filename, item?.contentBase64, item?.contentType);
  delete next.contentBase64;
  delete next.contentType;
  delete next.filename;
  next.attachments = attachments;
  if (!attachments.length) {
    const error = new Error("A PDF certificate attachment is required.");
    error.code = "PDF_ATTACHMENT_REQUIRED";
    error.statusCode = 400;
    throw error;
  }
  return next;
}
async function sendGmailMessage(message, maxAttempts = 3) {
  const config = readEmailConfig();
  if (!config.connected) { const e = new Error("Gmail is not connected. Configure Google OAuth, authorize the sender account, and add GMAIL_REFRESH_TOKEN to Render."); e.code = "GMAIL_NOT_CONNECTED"; e.statusCode = 503; throw e; }
  const auth = gmailClientFromConfig();
  if (!auth) { const e = new Error("Gmail is not connected."); e.statusCode = 503; throw e; }
  const sender = config.senderEmail;
  if (!sender) { const e = new Error("Set GMAIL_SENDER_EMAIL in Render to the Gmail account that granted gmail.send access."); e.statusCode = 500; throw e; }
  const authInfo = await gmailAuthorizationInfo();
  if (!authInfo?.hasGmailSendScope) { const e = new Error(`Stored Gmail authorization does not include ${GMAIL_SCOPE}. Reconnect Gmail and grant Send email permission, then replace GMAIL_REFRESH_TOKEN in Render.`); e.code = "GMAIL_SCOPE_MISSING"; e.statusCode = 403; throw e; }
  const gmail = google.gmail({ version: "v1", auth });
  const raw = buildGmailRawMessage(message, sender, config.fromName);
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
      return response.data;
    } catch (e) {
      lastError = e;
      if (!isRetryableGmailError(e) || attempt >= maxAttempts) throw e;
      await sleep(600 * attempt);
    }
  }
  throw lastError;
}

app.get("/api/email/status", async (_, res) => {
  const config = readEmailConfig();
  let connected = false, error = null, scopeGranted = false;
  if (config.connected) {
    try {
      const info = await gmailAuthorizationInfo();
      scopeGranted = Boolean(info?.hasGmailSendScope);
      connected = scopeGranted;
      if (!scopeGranted) error = `Stored Gmail authorization is missing the Gmail send scope (${GMAIL_SCOPE}).`;
    } catch (e) {
      error = normalizeGmailError(e).message;
    }
  }
  res.json({
    configured: config.configured,
    connected,
    provider: "Gmail API",
    from: config.senderEmail || null,
    authUrl: !connected ? "/api/email/google/auth" : null,
    message: !config.configured
      ? "Gmail API is not configured. Add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REDIRECT_URI to Render."
      : !config.refreshToken
        ? "Gmail authorization is required. Click Connect Gmail and authorize the sender account, then add GMAIL_REFRESH_TOKEN to Render."
        : error ? `Gmail authorization failed: ${error}` : "Gmail API is connected and ready for certificate email delivery.",
  });
});

app.get("/api/email/google/auth", (_, res) => {
  const url = createGoogleAuthUrl(res);
  if (!url) return res.status(503).send("<h2>Gmail OAuth is not configured</h2><p>Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REDIRECT_URI on the backend.</p>");
  return res.redirect(url);
});

app.get("/api/email/google/callback", async (req, res) => {
  const state = String(req.query?.state || "");
  const code = String(req.query?.code || "");
  const oauthError = String(req.query?.error || "");
  if (oauthError) return res.status(400).send(`<h2>Google authorization failed</h2><p>${sanitizeHeader(oauthError)}</p>`);
  if (!state || !verifyOAuthState(req, state)) return res.status(400).send("<h2>Invalid or expired OAuth state</h2><p>Please start the Gmail connection again from CertiChain. Do not reuse an old Google callback URL.</p>");
  clearOAuthStateCookie(res);
  if (!code) return res.status(400).send("<h2>No authorization code</h2>");
  try {
    const client = oauthClient();
    const { tokens } = await client.getToken(code);
    const refreshToken = String(tokens?.refresh_token || "").trim();
    if (!refreshToken) return res.status(400).send("<h2>No refresh token returned</h2><p>Google did not return a refresh token. Start the connection again with offline access and consent.</p>");
    client.setCredentials(tokens);
    const accessToken = String(tokens?.access_token || "").trim();
    const tokenInfo = accessToken ? await client.getTokenInfo(accessToken) : null;
    const grantedScopes = Array.isArray(tokenInfo?.scopes) ? tokenInfo.scopes : String(tokens?.scope || "").split(/\s+/).filter(Boolean);
    if (!grantedScopes.includes(GMAIL_SCOPE)) return res.status(403).send(`<h2>Gmail authorization is missing the Send scope</h2><p>Reconnect and grant <code>${GMAIL_SCOPE}</code>.</p>`);
    const sender = String(process.env.GMAIL_SENDER_EMAIL || tokenInfo?.email || "").trim();
    const tokenForCopy = refreshToken.replace(/[<>&]/g, "");
    const frontend = String(process.env.FRONTEND_URL || "").trim().replace(/\/$/, "");
    return res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><title>CertiChain Gmail Connected</title><style>body{font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:40px;color:#0f172a}.card{max-width:820px;margin:auto;background:#fff;border-radius:18px;padding:32px;box-shadow:0 10px 30px rgba(15,23,42,.08)}textarea{width:100%;min-height:150px;box-sizing:border-box;padding:14px;border:1px solid #cbd5e1;border-radius:12px;font-family:monospace}.ok{color:#047857}.warn{background:#fffbeb;border:1px solid #fde68a;padding:14px;border-radius:12px}</style></head><body><div class="card"><h1 class="ok">✓ Gmail authorization successful</h1><p>Authorized sender: <strong>${sanitizeHeader(sender)}</strong></p><div class="warn"><strong>Final step:</strong> Copy the refresh token below into Render as <code>GMAIL_REFRESH_TOKEN</code>. Never commit it to GitHub.</div><p><textarea readonly>${tokenForCopy}</textarea></p><p>Then redeploy the Render backend.</p>${frontend ? `<p><a href="${frontend}/settings">Return to CertiChain Settings</a></p>` : ""}</div></body></html>`);
  } catch (e) {
    console.error("Gmail OAuth callback failed:", e);
    return res.status(500).send(`<h2>Gmail authorization failed</h2><p>${sanitizeHeader(normalizeGmailError(e).message)}</p>`);
  }
});

app.post("/api/email/test", requireAdmin, async (req, res) => {
  try {
    const to = String(req.body?.to || "").trim();
    if (!to) return res.status(400).json({ error: "A test recipient email address is required." });
    const data = await sendGmailMessage({ to, subject: "CertiChain email delivery test", html: "<div style=\"font-family:Arial,sans-serif;line-height:1.6;color:#0f172a\"><h2>CertiChain Gmail API test successful</h2><p>This confirms that CertiChain can send email through Gmail API.</p></div>" });
    return res.json({ sent: true, messageId: data?.id || null, threadId: data?.threadId || null });
  } catch (e) {
    const d = normalizeGmailError(e); const status = d.statusCode >= 400 && d.statusCode < 600 ? d.statusCode : 500;
    return res.status(status).json({ error: d.message, errorCode: d.code, responseCode: d.statusCode });
  }
});

app.post("/api/email/send", requireAdmin, async (req, res) => {
  try {
    const { to, subject, html } = req.body || {};
    if (!to || !subject || !html) return res.status(400).json({ error: "to, subject and html are required" });
    const data = await sendGmailMessage({ to, subject, html });
    return res.json({ sent: true, messageId: data?.id || null, threadId: data?.threadId || null });
  } catch (e) {
    const d = normalizeGmailError(e); const status = d.statusCode >= 400 && d.statusCode < 600 ? d.statusCode : 500;
    return res.status(status).json({ error: d.message, errorCode: d.code, responseCode: d.statusCode });
  }
});

app.post("/api/email/certificates/bulk", requireAdmin, async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (!messages.length) return res.status(400).json({ error: "messages must contain at least one certificate email." });
    const outcomes = await Promise.allSettled(messages.map((message) => sendGmailMessage(normalizeCertificateEmailMessage(message))));
    const results = outcomes.map((outcome, index) => {
      const message = messages[index] || {};
      const certificateId = normalizeId(message?.certificateId) || `CERTIFICATE-${index + 1}`;
      if (outcome.status === "fulfilled") return { certificateId, to: String(message?.to || ""), sent: true, messageId: outcome.value?.id || null, threadId: outcome.value?.threadId || null };
      const d = normalizeGmailError(outcome.reason);
      return { certificateId, to: String(message?.to || ""), sent: false, error: d.message, errorCode: d.code, responseCode: d.statusCode };
    });
    const sentCount = results.filter((x) => x.sent).length;
    return res.json({ sent: sentCount === results.length, total: results.length, sentCount, failedCount: results.length - sentCount, results });
  } catch (e) {
    const d = normalizeGmailError(e, "Bulk certificate email failed."); const status = d.statusCode >= 400 && d.statusCode < 600 ? d.statusCode : 500;
    return res.status(status).json({ error: d.message });
  }
});

app.post("/api/email/certificate", requireAdmin, async (req, res) => {
  try {
    const data = await sendGmailMessage(normalizeCertificateEmailMessage(req.body || {}));
    return res.json({ sent: true, messageId: data?.id || null, threadId: data?.threadId || null });
  } catch (e) {
    const d = normalizeGmailError(e, "Certificate email failed."); const status = d.statusCode >= 400 && d.statusCode < 600 ? d.statusCode : 500;
    return res.status(status).json({ error: d.message, errorCode: d.code, responseCode: d.statusCode });
  }
});

app.listen(port, "0.0.0.0", async () => {
  const emailConfig = readEmailConfig();
  console.log(`CertiChain backend running on http://0.0.0.0:${port}`);
  console.log(loadedEnvFile ? `Environment loaded from: ${loadedEnvFile}` : "No backend .env file was loaded.");
  console.log(emailConfig.configured ? "Gmail OAuth configuration present." : "Gmail OAuth not configured yet.");
  const chain = blockchainConfig();
  console.log(chain.readConfigured ? `Blockchain verification configured: ${chain.network} ${chain.contractAddress}` : "Blockchain verification not configured yet.");
  const ipfs = ipfsConfig();
  console.log(ipfs.pinataJwt || ipfs.uploadEndpoint ? `IPFS upload configured: ${ipfs.pinataJwt ? "Pinata" : "Custom"}` : "IPFS upload not configured yet.");
  if (emailConfig.connected) {
    try {
      const info = await gmailAuthorizationInfo();
      if (info?.hasGmailSendScope) console.log(`Gmail API connected. Sender: ${emailConfig.senderEmail || info.email || "configured sender"}`);
      else console.error("Gmail refresh token is missing the gmail.send scope.");
    } catch (error) {
      console.error(`Gmail refresh token is not usable: ${normalizeGmailError(error).message}`);
    }
  }
});
