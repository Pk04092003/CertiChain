import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the backend .env explicitly so it works whether the server is started
// directly from backend/ or through the root npm workspace.
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
app.use(cors());
app.use(express.json({ limit: "100mb" }));

const port = Number(process.env.PORT || 5000);
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

function publicCertificatePayload(body = {}) {
  const id = String(body.id || "").trim();
  if (!id) return null;
  return {
    id,
    name: String(body.name || "Participant").trim(),
    course: String(body.course || body.templateName || "Certificate").trim(),
    templateName: String(body.templateName || "Certificate").trim(),
    issuedAt: body.issuedAt || null,
    status: String(body.status || "Issued"),
    createdByName: String(body.createdByName || "Authorized Institution"),
    createdBy: String(body.createdBy || ""),
    blockchainStatus: String(body.blockchainStatus || "Not registered"),
    transactionHash: body.transactionHash || null,
    blockNumber: body.blockNumber || null,
    ipfsCid: body.ipfsCid || null,
    blockchainNetwork: String(body.blockchainNetwork || "Ethereum Sepolia"),
    disqualificationReason: body.disqualificationReason || null,
    disqualifiedBy: body.disqualifiedBy || null,
    disqualifiedAt: body.disqualifiedAt || null,
    certificateHash: body.certificateHash || null,
    updatedAt: new Date().toISOString(),
  };
}

function readSmtpConfig() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const user = String(process.env.SMTP_USER || "").trim();
  // Google displays App Passwords with spaces; remove them before SMTP auth.
  const pass = String(process.env.SMTP_PASS || "").replace(/\s+/g, "");
  const portNumber = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || portNumber === 465;
  const from = String(process.env.SMTP_FROM || user).trim();

  return {
    configured: Boolean(host && user && pass),
    host,
    port: Number.isFinite(portNumber) ? portNumber : 587,
    secure,
    user,
    pass,
    from,
  };
}

let cachedTransporter = null;
let cachedTransporterSignature = "";

function createTransporter() {
  const config = readSmtpConfig();
  if (!config.configured) return null;

  const signature = JSON.stringify({
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    pass: config.pass,
  });

  if (cachedTransporter && cachedTransporterSignature === signature) {
    return cachedTransporter;
  }

  cachedTransporter?.close?.();
  const maxConnections = Math.max(1, Math.min(Number(process.env.SMTP_MAX_CONNECTIONS || 5), 20));
  cachedTransporter = nodemailer.createTransport({
    pool: true,
    maxConnections,
    maxMessages: 100,
    maxRequeues: 3,
    host: config.host,
    port: config.port,
    secure: config.secure,
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
  cachedTransporterSignature = signature;
  return cachedTransporter;
}

function errorDetails(error) {
  return {
    message: String(error?.message || "Email send failed."),
    code: error?.code || null,
    responseCode: Number.isFinite(Number(error?.responseCode)) ? Number(error.responseCode) : null,
    response: error?.response || null,
  };
}

function isRetryableSmtpError(error) {
  const code = String(error?.code || "").toUpperCase();
  const responseCode = Number(error?.responseCode || 0);
  return [421, 450, 451, 454].includes(responseCode) || [
    "ETIMEDOUT",
    "ECONNECTION",
    "ESOCKET",
    "EAI_AGAIN",
    "ECONNRESET",
    "ENETUNREACH",
    "EPIPE",
  ].includes(code);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendMailWithRetry(transporter, message, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await transporter.sendMail(message);
    } catch (error) {
      lastError = error;
      if (!isRetryableSmtpError(error) || attempt >= maxAttempts) throw error;
      // Only failed/transient messages are retried. Initial delivery is dispatched immediately.
      await sleep(800 * attempt);
    }
  }
  throw lastError;
}

function missingConfigMessage() {
  return "Email is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM to backend/.env, then restart the backend.";
}

app.get("/health", (_, res) => res.json({ ok: true, service: "certichain-backend" }));

app.get("/api/email/status", (_, res) => {
  const config = readSmtpConfig();
  res.json({
    configured: config.configured,
    host: config.host || null,
    port: config.port,
    secure: config.secure,
    maxConnections: Math.max(1, Math.min(Number(process.env.SMTP_MAX_CONNECTIONS || 5), 20)),
    user: config.user ? config.user.replace(/(^.).*(@.*$)/, "$1••••$2") : null,
    from: config.from || null,
    message: config.configured
      ? "SMTP is configured and ready for certificate email delivery."
      : missingConfigMessage(),
  });
});

app.get("/api/public/certificates/:id", (req, res) => {
  const target = decodeURIComponent(String(req.params.id || "")).toLowerCase();
  const key = Object.keys(publicCertificates).find((entry) => entry.toLowerCase() === target);
  if (!key) return res.status(404).json({ error: "Certificate not found." });
  return res.json({ certificate: publicCertificates[key] });
});

app.post("/api/public/certificates", async (req, res) => {
  try {
    const payload = publicCertificatePayload(req.body || {});
    if (!payload) return res.status(400).json({ error: "Certificate id is required." });
    const existing = publicCertificates[payload.id];
    // Public registry is append-only for certificate creation. Issued fields may
    // only move forward for lifecycle metadata such as disqualification or chain sync.
    if (existing) {
      publicCertificates[payload.id] = {
        ...existing,
        ...payload,
        id: existing.id,
        name: existing.name,
        course: existing.course,
        templateName: existing.templateName,
        issuedAt: existing.issuedAt || payload.issuedAt,
        createdBy: existing.createdBy || payload.createdBy,
        createdByName: existing.createdByName || payload.createdByName,
      };
    } else {
      publicCertificates[payload.id] = payload;
    }
    await savePublicCertificates();
    return res.json({ ok: true, certificate: publicCertificates[payload.id] });
  } catch (error) {
    console.error("Public certificate sync failed:", error);
    return res.status(500).json({ error: error?.message || "Public certificate sync failed." });
  }
});

app.post("/api/email/test", async (req, res) => {
  try {
    const to = String(req.body?.to || "").trim();
    if (!to) return res.status(400).json({ error: "A test recipient email address is required." });

    const transporter = createTransporter();
    if (!transporter) {
      return res.status(503).json({ code: "SMTP_NOT_CONFIGURED", error: missingConfigMessage() });
    }

    await transporter.verify();
    const config = readSmtpConfig();
    const info = await transporter.sendMail({
      from: config.from,
      to,
      subject: "CertiChain email delivery test",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>CertiChain email test successful</h2>
          <p>This message confirms that the CertiChain backend can send email through the configured SMTP server.</p>
        </div>
      `,
    });

    res.json({ sent: true, messageId: info.messageId });
  } catch (error) {
    console.error("SMTP test failed:", error);
    res.status(500).json({ error: error?.message || "SMTP test failed." });
  }
});

app.post("/api/email/send", async (req, res) => {
  try {
    const { to, subject, html } = req.body || {};
    if (!to || !subject || !html) {
      return res.status(400).json({ error: "to, subject and html are required" });
    }

    const transporter = createTransporter();
    if (!transporter) {
      return res.status(503).json({ code: "SMTP_NOT_CONFIGURED", error: missingConfigMessage() });
    }

    const config = readSmtpConfig();
    const info = await transporter.sendMail({
      from: config.from,
      to,
      subject,
      html,
    });

    res.json({ sent: true, messageId: info.messageId });
  } catch (error) {
    console.error("Email send failed:", error);
    res.status(500).json({ error: error?.message || "Email send failed." });
  }
});

app.post("/api/email/certificates/bulk", async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (!messages.length) {
      return res.status(400).json({ error: "messages must contain at least one certificate email." });
    }

    const transporter = createTransporter();
    if (!transporter) {
      return res.status(503).json({ code: "SMTP_NOT_CONFIGURED", error: missingConfigMessage() });
    }

    await transporter.verify();
    const config = readSmtpConfig();

    // Start every SMTP send without an application-level per-recipient delay.
    // Promise.allSettled keeps individual recipient results even when one fails.
    const outcomes = await Promise.allSettled(messages.map((message) => {
      const to = String(message?.to || "").trim();
      const subject = String(message?.subject || "Certificate issued").trim();
      const html = String(message?.html || "");
      const filename = String(message?.filename || "certificate.png");
      const contentType = String(message?.contentType || "image/png");
      const contentBase64 = String(message?.contentBase64 || "");
      const extraAttachments = Array.isArray(message?.attachments) ? message.attachments : [];

      if (!to || !html || !contentBase64) {
        return Promise.reject(new Error("Recipient, email HTML and certificate attachment are required."));
      }

      const attachments = [{
        filename,
        content: Buffer.from(contentBase64, "base64"),
        contentType,
      }, ...extraAttachments.filter((item) => item?.contentBase64).map((item) => ({
        filename: String(item.filename || "attachment"),
        content: Buffer.from(String(item.contentBase64), "base64"),
        contentType: String(item.contentType || "application/octet-stream"),
      }))];

      return sendMailWithRetry(transporter, {
        from: config.from,
        to,
        subject,
        html,
        attachments,
      });
    }));

    const results = outcomes.map((outcome, index) => {
      const message = messages[index] || {};
      const certificateId = String(message?.certificateId || filenameFallback(message?.filename) || `certificate-${index + 1}`);
      if (outcome.status === "fulfilled") {
        return { certificateId, to: String(message?.to || ""), sent: true, messageId: outcome.value?.messageId || null };
      }
      const details = errorDetails(outcome.reason);
      return { certificateId, to: String(message?.to || ""), sent: false, error: details.message, errorCode: details.code, responseCode: details.responseCode, response: details.response };
    });

    const sent = results.filter((item) => item.sent).length;
    const failed = results.length - sent;
    res.json({ sent: failed === 0, total: results.length, sentCount: sent, failedCount: failed, results });
  } catch (error) {
    console.error("Bulk certificate email failed:", error);
    res.status(500).json({ error: error?.message || "Bulk certificate email failed." });
  }
});

function filenameFallback(filename) {
  const value = String(filename || "").trim();
  return value.replace(/\.png$/i, "") || null;
}

app.post("/api/email/certificate", async (req, res) => {
  try {
    const {
      to,
      subject,
      html,
      filename = "certificate.png",
      contentType = "image/png",
      contentBase64,
      attachments: extraAttachments = [],
    } = req.body || {};

    if (!to || !subject || !html || !contentBase64) {
      return res.status(400).json({
        error: "to, subject, html and contentBase64 are required",
      });
    }

    const transporter = createTransporter();
    if (!transporter) {
      return res.status(503).json({
        code: "SMTP_NOT_CONFIGURED",
        error: missingConfigMessage(),
      });
    }

    const config = readSmtpConfig();
    const info = await sendMailWithRetry(transporter, {
      from: config.from,
      to,
      subject,
      html,
      attachments: [{
        filename,
        content: Buffer.from(contentBase64, "base64"),
        contentType,
      }, ...extraAttachments.filter((item) => item?.contentBase64).map((item) => ({
        filename: String(item.filename || "attachment"),
        content: Buffer.from(String(item.contentBase64), "base64"),
        contentType: String(item.contentType || "application/octet-stream"),
      }))],
    });

    res.json({ sent: true, messageId: info.messageId });
  } catch (error) {
    console.error(`Certificate email failed for ${req.body?.to || "unknown recipient"}:`, error);
    res.status(500).json({ error: error?.message || "Certificate email failed." });
  }
});

app.listen(port, async () => {
  const config = readSmtpConfig();
  console.log(`CertiChain backend running on http://localhost:${port}`);
  console.log(loadedEnvFile ? `Environment loaded from: ${loadedEnvFile}` : "No backend .env file was loaded.");

  if (!config.configured) {
    console.log("SMTP not configured yet. Check that backend/.env exists and contains SMTP_HOST, SMTP_USER and SMTP_PASS.");
    return;
  }

  console.log(`SMTP settings loaded: ${config.host}:${config.port} | user=${config.user} | password=${config.pass ? "loaded" : "missing"}`);
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log("SMTP connection verified successfully. Certificate emails are ready.");
  } catch (error) {
    console.error("SMTP connection verification failed:", error?.message || error);
    console.log("The SMTP variables are present, but Gmail rejected the connection. Check the App Password, 2-Step Verification and SMTP settings.");
  }
});
