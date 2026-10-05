import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { Resend } from 'resend';

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

function readEmailConfig() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM || '').trim();
  return { configured: Boolean(apiKey && from), apiKey, from };
}

let cachedResend = null;
let cachedResendKey = '';
function getResendClient() {
  const config = readEmailConfig();
  if (!config.configured) return null;
  if (!cachedResend || cachedResendKey !== config.apiKey) {
    cachedResend = new Resend(config.apiKey);
    cachedResendKey = config.apiKey;
  }
  return cachedResend;
}

function emailNotConfiguredMessage() {
  return 'Email delivery is not configured. Add RESEND_API_KEY and RESEND_FROM to the backend environment.';
}

function normalizeError(error, fallback = 'Email delivery failed.') {
  const source = error?.error || error;
  return {
    message: String(source?.message || error?.message || fallback),
    code: source?.name || error?.code || null,
    statusCode: Number.isFinite(Number(source?.statusCode)) ? Number(source.statusCode) : (Number.isFinite(Number(error?.statusCode)) ? Number(error.statusCode) : null),
    name: source?.name || null,
  };
}

function isRetryableEmailError(error) {
  const status = Number(error?.statusCode || error?.error?.statusCode || 0);
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500 || ['ETIMEDOUT','ECONNRESET','ECONNREFUSED','EAI_AGAIN','ENETUNREACH','EPIPE'].includes(String(error?.code || '').toUpperCase());
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendResendWithRetry(client, payload, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await client.emails.send(payload);
      if (result?.error) {
        const normalized = normalizeError(result.error);
        const err = new Error(normalized.message);
        Object.assign(err, normalized);
        throw err;
      }
      return result?.data || result;
    } catch (error) {
      lastError = error;
      if (!isRetryableEmailError(error) || attempt >= maxAttempts) throw error;
      await sleep(600 * attempt);
    }
  }
  throw lastError;
}

function buildResendAttachments(message = {}) {
  const primary = message?.contentBase64 ? [{
    filename: String(message.filename || 'certificate.png'),
    content: String(message.contentBase64),
  }] : [];
  const extras = Array.isArray(message?.attachments) ? message.attachments.filter((item) => item?.contentBase64).map((item) => ({
    filename: String(item.filename || 'attachment'),
    content: String(item.contentBase64),
    contentType: item.contentType ? String(item.contentType) : undefined,
  })) : [];
  return [...primary, ...extras];
}

function buildResendPayload(message = {}, from) {
  const to = String(message?.to || '').trim();
  const subject = String(message?.subject || 'Certificate issued').trim();
  const html = String(message?.html || '');
  if (!to || !html || !message?.contentBase64) {
    throw new Error('Recipient, email HTML and certificate attachment are required.');
  }
  const attachments = buildResendAttachments(message);
  return { from, to, subject, html, attachments };
}

app.get('/api/email/status', (_, res) => {
  const config = readEmailConfig();
  res.json({
    configured: config.configured,
    provider: 'Resend',
    from: config.from || null,
    message: config.configured
      ? 'Resend is configured and ready for certificate email delivery.'
      : emailNotConfiguredMessage(),
  });
});

app.post('/api/email/test', async (req, res) => {
  try {
    const to = String(req.body?.to || '').trim();
    if (!to) return res.status(400).json({ error: 'A test recipient email address is required.' });
    const config = readEmailConfig();
    if (!config.configured) return res.status(503).json({ code: 'EMAIL_NOT_CONFIGURED', error: emailNotConfiguredMessage() });
    const client = getResendClient();
    const data = await sendResendWithRetry(client, {
      from: config.from,
      to,
      subject: 'CertiChain email delivery test',
      html: '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a"><h2>CertiChain email test successful</h2><p>This message confirms that the CertiChain backend can send email through Resend.</p></div>',
    });
    return res.json({ sent: true, messageId: data?.id || null });
  } catch (error) {
    console.error('Resend test failed:', error);
    return res.status(500).json({ error: normalizeError(error).message });
  }
});

app.post('/api/email/send', async (req, res) => {
  try {
    const { to, subject, html } = req.body || {};
    if (!to || !subject || !html) return res.status(400).json({ error: 'to, subject and html are required' });
    const config = readEmailConfig();
    if (!config.configured) return res.status(503).json({ code: 'EMAIL_NOT_CONFIGURED', error: emailNotConfiguredMessage() });
    const data = await sendResendWithRetry(getResendClient(), { from: config.from, to, subject, html });
    return res.json({ sent: true, messageId: data?.id || null });
  } catch (error) {
    console.error('Email send failed:', error);
    return res.status(500).json({ error: normalizeError(error).message });
  }
});

app.post('/api/email/certificates/bulk', async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (!messages.length) return res.status(400).json({ error: 'messages must contain at least one certificate email.' });
    const config = readEmailConfig();
    if (!config.configured) return res.status(503).json({ code: 'EMAIL_NOT_CONFIGURED', error: emailNotConfiguredMessage() });

    const client = getResendClient();
    // Dispatch every eligible recipient immediately in parallel. Retries occur only for transient provider/network failures.
    const outcomes = await Promise.allSettled(messages.map((message) => sendResendWithRetry(client, buildResendPayload(message, config.from))));
    const results = outcomes.map((outcome, index) => {
      const message = messages[index] || {};
      const certificateId = String(message?.certificateId || filenameFallback(message?.filename) || `certificate-${index + 1}`);
      if (outcome.status === 'fulfilled') return { certificateId, to: String(message?.to || ''), sent: true, messageId: outcome.value?.id || null };
      const details = normalizeError(outcome.reason);
      return { certificateId, to: String(message?.to || ''), sent: false, error: details.message, errorCode: details.code, responseCode: details.statusCode };
    });
    const sentCount = results.filter((item) => item.sent).length;
    const failedCount = results.length - sentCount;
    return res.json({ sent: failedCount === 0, total: results.length, sentCount, failedCount, results });
  } catch (error) {
    console.error('Bulk certificate email failed:', error);
    return res.status(500).json({ error: normalizeError(error, 'Bulk certificate email failed.').message });
  }
});

function filenameFallback(filename) {
  const value = String(filename || '').trim();
  return value.replace(/\.png$/i, '') || null;
}

app.post('/api/email/certificate', async (req, res) => {
  try {
    const config = readEmailConfig();
    if (!config.configured) return res.status(503).json({ code: 'EMAIL_NOT_CONFIGURED', error: emailNotConfiguredMessage() });
    const client = getResendClient();
    const payload = buildResendPayload(req.body || {}, config.from);
    const data = await sendResendWithRetry(client, payload);
    return res.json({ sent: true, messageId: data?.id || null });
  } catch (error) {
    console.error(`Certificate email failed for ${req.body?.to || 'unknown recipient'}:`, error);
    return res.status(500).json({ error: normalizeError(error, 'Certificate email failed.').message });
  }
});

app.listen(port, '0.0.0.0', async () => {
  const config = readEmailConfig();
  console.log(`CertiChain backend running on http://0.0.0.0:${port}`);
  console.log(loadedEnvFile ? `Environment loaded from: ${loadedEnvFile}` : 'No backend .env file was loaded.');
  if (!config.configured) {
    console.log('Resend not configured yet. Add RESEND_API_KEY and RESEND_FROM in the environment.');
    return;
  }
  console.log(`Resend configured. Sender: ${config.from}`);
});
