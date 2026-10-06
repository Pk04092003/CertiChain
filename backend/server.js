import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { google } from 'googleapis';
import crypto from 'node:crypto';

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
  const clientId = String(process.env.GMAIL_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GMAIL_CLIENT_SECRET || '').trim();
  const redirectUri = String(process.env.GMAIL_REDIRECT_URI || '').trim();
  const refreshToken = String(process.env.GMAIL_REFRESH_TOKEN || '').trim();
  const senderEmail = String(process.env.GMAIL_SENDER_EMAIL || '').trim();
  const fromName = String(process.env.GMAIL_FROM_NAME || 'CertiChain').trim();
  return { configured: Boolean(clientId && clientSecret && redirectUri), connected: Boolean(clientId && clientSecret && redirectUri && refreshToken),
    clientId, clientSecret, redirectUri, refreshToken, senderEmail, fromName };
}

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const OAUTH_STATE_COOKIE = 'certichain_gmail_oauth_state';
const OAUTH_STATE_MAX_AGE = 10 * 60;

function stateCookieSecret() {
  const config = readEmailConfig();
  // Reuse the OAuth client secret as the state-signing secret so no extra
  // credential is required. The secret never leaves the backend.
  return config.clientSecret || 'certichain-oauth-state-secret';
}

function signOAuthState(state) {
  return crypto.createHmac('sha256', stateCookieSecret()).update(state).digest('hex');
}

function setOAuthStateCookie(res, state) {
  const signed = `${state}.${signOAuthState(state)}`;
  const secure = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  const flags = [
    `${OAUTH_STATE_COOKIE}=${encodeURIComponent(signed)}`,
    'Path=/api/email/google',
    `Max-Age=${OAUTH_STATE_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ];
  res.setHeader('Set-Cookie', flags.join('; '));
}

function clearOAuthStateCookie(res) {
  const secure = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  const flags = [
    `${OAUTH_STATE_COOKIE}=`,
    'Path=/api/email/google',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ];
  res.setHeader('Set-Cookie', flags.join('; '));
}

function readCookie(req, name) {
  const header = String(req.headers?.cookie || '');
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return '';
}

function verifyOAuthState(req, state) {
  const cookieValue = readCookie(req, OAUTH_STATE_COOKIE);
  const [cookieState, signature] = cookieValue.split('.');
  if (!cookieState || !signature || cookieState !== state) return false;
  const expected = signOAuthState(cookieState);
  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expected, 'hex');
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
  const state = crypto.randomBytes(32).toString('hex');
  setOAuthStateCookie(res, state);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: [GMAIL_SCOPE],
    state,
  });
}

function normalizeGmailError(error, fallback = 'Gmail email delivery failed.') {
  const data = error?.response?.data;
  const message = data?.error?.message || data?.error_description || data?.message || error?.message || fallback;
  const statusCode = Number(error?.response?.status || error?.code || 0);
  return { message: String(message), code: data?.error?.status || data?.error || error?.code || null, statusCode: Number.isFinite(statusCode) ? statusCode : null };
}

function isRetryableGmailError(error) {
  const status = Number(error?.response?.status || error?.code || 0);
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504 ||
    ['ETIMEDOUT','ECONNRESET','ECONNREFUSED','EAI_AGAIN','ENETUNREACH','EPIPE'].includes(String(error?.code || '').toUpperCase());
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
  const accessToken = String(accessTokenResult?.token || accessTokenResult || '').trim();
  if (!accessToken) throw new Error('Google did not return an access token from the stored refresh token.');
  const info = await auth.getTokenInfo(accessToken);
  const scopes = Array.isArray(info?.scopes) ? info.scopes : [];
  return {
    scopes,
    hasGmailSendScope: scopes.includes(GMAIL_SCOPE),
    email: String(info?.email || '').trim() || null,
    expiryDate: info?.expiry_date || null,
  };
}

function sanitizeHeader(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function encodeMimeHeader(value) {
  const clean = sanitizeHeader(value);
  return /^[\x00-\x7F]*$/.test(clean) ? clean : `=?UTF-8?B?${Buffer.from(clean,'utf8').toString('base64')}?=`;
}

function wrapBase64(value) {
  return String(value || '').match(/.{1,76}/g)?.join('\r\n') || '';
}

function buildGmailRawMessage(message, senderEmail, fromName='CertiChain') {
  const to = sanitizeHeader(message?.to);
  const subject = encodeMimeHeader(message?.subject || 'Certificate issued');
  const html = String(message?.html || '');
  if (!to || !html) throw new Error('Recipient and email HTML are required.');
  const boundary = `----=_CertiChain_${crypto.randomBytes(12).toString('hex')}`;
  const lines = [
    `From: ${encodeMimeHeader(fromName)} <${sanitizeHeader(senderEmail)}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '', `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64', '',
    wrapBase64(Buffer.from(html,'utf8').toString('base64'))
  ];
  const addAttachment = (a={}) => {
    const content = String(a.contentBase64 || '').replace(/\s/g,'');
    if (!content) return;
    const filename = sanitizeHeader(a.filename || 'attachment');
    const type = sanitizeHeader(a.contentType || 'application/octet-stream');
    lines.push('', `--${boundary}`, `Content-Type: ${type}; name="${filename}"`,
      'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${filename}"`, '', wrapBase64(content));
  };
  if (message?.contentBase64) addAttachment({filename:message.filename||'certificate.png', contentType:message.contentType||'image/png', contentBase64:message.contentBase64});
  for (const a of Array.isArray(message?.attachments)?message.attachments:[]) addAttachment(a);
  lines.push('', `--${boundary}--`, '');
  return Buffer.from(lines.join('\r\n'),'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
}


function normalizeCertificateEmailMessage(message = {}) {
  const next = { ...message };
  const attachments = [];

  const topLevelContentType = String(next.contentType || "").toLowerCase().trim();
  const topLevelContent = String(next.contentBase64 || "").replace(/\s/g, "");
  if (topLevelContent && topLevelContentType === "application/pdf") {
    attachments.push({
      filename: String(next.filename || "certificate.pdf").toLowerCase().endsWith(".pdf")
        ? String(next.filename || "certificate.pdf")
        : "certificate.pdf",
      contentType: "application/pdf",
      contentBase64: topLevelContent,
    });
  }

  for (const item of Array.isArray(next.attachments) ? next.attachments : []) {
    const type = String(item?.contentType || "").toLowerCase().trim();
    const content = String(item?.contentBase64 || "").replace(/\s/g, "");
    if (type === "application/pdf" && content) {
      attachments.push({
        filename: String(item?.filename || "certificate.pdf").toLowerCase().endsWith(".pdf")
          ? String(item?.filename || "certificate.pdf")
          : "certificate.pdf",
        contentType: "application/pdf",
        contentBase64: content,
      });
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const item of attachments) {
    const key = `${item.filename}:${item.contentBase64.slice(0, 48)}:${item.contentBase64.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  delete next.contentBase64;
  delete next.contentType;
  delete next.filename;
  next.attachments = deduped;

  if (!next.attachments.length) {
    const error = new Error("A PDF certificate attachment is required.");
    error.code = "PDF_ATTACHMENT_REQUIRED";
    error.statusCode = 400;
    throw error;
  }

  return next;
}

async function sendGmailMessage(message, maxAttempts=3) {
  const config = readEmailConfig();
  if (!config.connected) { const e = new Error('Gmail is not connected. Configure Google OAuth, authorize the sender account, and add GMAIL_REFRESH_TOKEN to Render.'); e.code='GMAIL_NOT_CONNECTED'; e.statusCode=503; throw e; }
  const auth = gmailClientFromConfig();
  if (!auth) { const e = new Error('Gmail is not connected.'); e.statusCode = 503; throw e; }
  const sender = config.senderEmail;
  if (!sender) { const e = new Error('Set GMAIL_SENDER_EMAIL in Render to the Gmail account that granted gmail.send access.'); e.statusCode=500; throw e; }
  const authInfo = await gmailAuthorizationInfo();
  if (!authInfo?.hasGmailSendScope) { const e = new Error(`Stored Gmail authorization does not include ${GMAIL_SCOPE}. Reconnect Gmail and grant Send email permission, then replace GMAIL_REFRESH_TOKEN in Render.`); e.code='GMAIL_SCOPE_MISSING'; e.statusCode=403; throw e; }
  const gmail = google.gmail({ version:'v1', auth });
  const raw = buildGmailRawMessage(message, sender, config.fromName);
  let lastError;
  for (let attempt=1; attempt<=maxAttempts; attempt++) {
    try {
      const response = await gmail.users.messages.send({ userId:'me', requestBody:{ raw }});
      return response.data;
    } catch (e) {
      lastError=e;
      if (!isRetryableGmailError(e) || attempt>=maxAttempts) throw e;
      await sleep(600*attempt);
    }
  }
  throw lastError;
}

function filenameFallback(filename) {
  const value = String(filename || '').trim();
  return value.replace(/\.png$/i,'') || null;
}

app.get('/api/email/status', async (_, res) => {
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
    configured: config.configured, connected, provider:'Gmail API',
    from: config.senderEmail || null,
    authUrl: !connected ? '/api/email/google/auth' : null,
    message: !config.configured
      ? 'Gmail API is not configured. Add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REDIRECT_URI to Render.'
      : !config.refreshToken
        ? 'Gmail authorization is required. Click Connect Gmail and authorize the sender account, then add the returned refresh token to Render.'
        : error ? `Gmail authorization failed: ${error}` : 'Gmail API is connected and ready for certificate email delivery.'
  });
});

app.get('/api/email/google/auth', (_, res) => {
  const url = createGoogleAuthUrl(res);
  if (!url) return res.status(503).send('<h2>Gmail OAuth is not configured</h2><p>Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REDIRECT_URI on the backend.</p>');
  res.redirect(url);
});

app.get('/api/email/google/callback', async (req,res) => {
  const state = String(req.query?.state || '');
  const code = String(req.query?.code || '');
  const oauthError = String(req.query?.error || '');
  if (oauthError) return res.status(400).send(`<h2>Google authorization failed</h2><p>${sanitizeHeader(oauthError)}</p>`);
  if (!state || !verifyOAuthState(req, state)) return res.status(400).send('<h2>Invalid or expired OAuth state</h2><p>Please start the Gmail connection again from CertiChain. Do not reuse an old Google callback URL.</p>');
  clearOAuthStateCookie(res);
  if (!code) return res.status(400).send('<h2>No authorization code</h2>');
  try {
    const client = oauthClient();
    const {tokens} = await client.getToken(code);
    const refreshToken = String(tokens?.refresh_token || '').trim();
    if (!refreshToken) return res.status(400).send('<h2>No refresh token returned</h2><p>Google did not return a refresh token. Start the connection again with offline access and consent.</p>');
    client.setCredentials(tokens);
    const accessToken = String(tokens?.access_token || '').trim();
    const tokenInfo = accessToken ? await client.getTokenInfo(accessToken) : null;
    const grantedScopes = Array.isArray(tokenInfo?.scopes) ? tokenInfo.scopes : String(tokens?.scope || '').split(/\s+/).filter(Boolean);
    if (!grantedScopes.includes(GMAIL_SCOPE)) {
      return res.status(403).send(`<h2>Gmail authorization is missing the Send scope</h2><p>This OAuth grant did not include <code>${GMAIL_SCOPE}</code>.</p><p>In Google Cloud, add the Gmail Send scope to your app's Data Access, then start a fresh connection and click Allow.</p>`);
    }
    const sender = String(process.env.GMAIL_SENDER_EMAIL || tokenInfo?.email || '').trim();
    const tokenForCopy = refreshToken.replace(/[<>&]/g,'');
    const frontend = String(process.env.FRONTEND_URL || '').trim().replace(/\/$/,'');
    return res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>CertiChain Gmail Connected</title><style>
body{font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:40px;color:#0f172a}.card{max-width:820px;margin:auto;background:#fff;border-radius:18px;padding:32px;box-shadow:0 10px 30px rgba(15,23,42,.08)}textarea{width:100%;min-height:150px;box-sizing:border-box;padding:14px;border:1px solid #cbd5e1;border-radius:12px;font-family:monospace}.ok{color:#047857}.warn{background:#fffbeb;border:1px solid #fde68a;padding:14px;border-radius:12px}</style></head>
<body><div class="card"><h1 class="ok">✓ Gmail authorization successful</h1><p>Authorized sender: <strong>${sanitizeHeader(sender)}</strong></p>
<div class="warn"><strong>Final step:</strong> Copy the refresh token below into Render as <code>GMAIL_REFRESH_TOKEN</code>. Never commit it to GitHub.</div>
<p><textarea readonly>${tokenForCopy}</textarea></p><p>Then redeploy the Render backend. After that CertiChain will send directly from the authorized Gmail account.</p>
${frontend?`<p><a href="${frontend}/settings">Return to CertiChain Settings</a></p>`:''}</div></body></html>`);
  } catch(e) {
    console.error('Gmail OAuth callback failed:',e);
    return res.status(500).send(`<h2>Gmail authorization failed</h2><p>${sanitizeHeader(normalizeGmailError(e).message)}</p>`);
  }
});

app.post('/api/email/test', async (req,res) => {
  try {
    const to=String(req.body?.to||'').trim();
    if(!to) return res.status(400).json({error:'A test recipient email address is required.'});
    const data=await sendGmailMessage({to,subject:'CertiChain email delivery test',html:'<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a"><h2>CertiChain Gmail API test successful</h2><p>This confirms that the CertiChain backend can send email through the authorized Gmail account.</p></div>'});
    return res.json({sent:true,messageId:data?.id||null,threadId:data?.threadId||null});
  } catch(e) {
    console.error('Gmail test failed:',e);
    const d=normalizeGmailError(e); const status=d.statusCode>=400&&d.statusCode<600?d.statusCode:500;
    return res.status(status).json({error:d.message,errorCode:d.code,responseCode:d.statusCode});
  }
});

app.post('/api/email/send', async (req,res) => {
  try {
    const {to,subject,html}=req.body||{};
    if(!to||!subject||!html) return res.status(400).json({error:'to, subject and html are required'});
    const data=await sendGmailMessage({to,subject,html});
    return res.json({sent:true,messageId:data?.id||null,threadId:data?.threadId||null});
  } catch(e) {
    console.error('Gmail email send failed:',e);
    const d=normalizeGmailError(e); const status=d.statusCode>=400&&d.statusCode<600?d.statusCode:500;
    return res.status(status).json({error:d.message,errorCode:d.code,responseCode:d.statusCode});
  }
});

app.post('/api/email/certificates/bulk', async (req,res) => {
  try {
    const messages=Array.isArray(req.body?.messages)?req.body.messages:[];
    if(!messages.length) return res.status(400).json({error:'messages must contain at least one certificate email.'});
    const outcomes=await Promise.allSettled(messages.map(message=>sendGmailMessage(normalizeCertificateEmailMessage(message))));
    const results=outcomes.map((outcome,index)=>{
      const message=messages[index]||{};
      const certificateId=String(message?.certificateId||filenameFallback(message?.filename)||`certificate-${index+1}`);
      if(outcome.status==='fulfilled') return {certificateId,to:String(message?.to||''),sent:true,messageId:outcome.value?.id||null,threadId:outcome.value?.threadId||null};
      const d=normalizeGmailError(outcome.reason);
      return {certificateId,to:String(message?.to||''),sent:false,error:d.message,errorCode:d.code,responseCode:d.statusCode};
    });
    const sentCount=results.filter(x=>x.sent).length;
    return res.json({sent:sentCount===results.length,total:results.length,sentCount,failedCount:results.length-sentCount,results});
  } catch(e) {
    console.error('Bulk certificate Gmail delivery failed:',e);
    const d=normalizeGmailError(e,'Bulk certificate email failed.'); const status=d.statusCode>=400&&d.statusCode<600?d.statusCode:500;
    return res.status(status).json({error:d.message});
  }
});

app.post('/api/email/certificate', async (req,res) => {
  try {
    const data=await sendGmailMessage(normalizeCertificateEmailMessage(req.body||{}));
    return res.json({sent:true,messageId:data?.id||null,threadId:data?.threadId||null});
  } catch(e) {
    console.error(`Gmail certificate email failed for ${req.body?.to||'unknown recipient'}:`,e);
    const d=normalizeGmailError(e,'Certificate email failed.'); const status=d.statusCode>=400&&d.statusCode<600?d.statusCode:500;
    return res.status(status).json({error:d.message,errorCode:d.code,responseCode:d.statusCode});
  }
});

app.listen(port, '0.0.0.0', async () => {
  const config = readEmailConfig();
  console.log(`CertiChain backend running on http://0.0.0.0:${port}`);
  console.log(loadedEnvFile ? `Environment loaded from: ${loadedEnvFile}` : 'No backend .env file was loaded.');
  console.log(config.configured ? 'Gmail OAuth configuration present.' : 'Gmail OAuth not configured yet.');
  if (config.connected) {
    try {
      const info = await gmailAuthorizationInfo();
      if (info?.hasGmailSendScope) console.log(`Gmail API connected. Sender: ${config.senderEmail || info.email || 'configured sender'}`);
      else console.error('Gmail refresh token is missing the gmail.send scope.');
    } catch (error) {
      console.error(`Gmail refresh token is not usable: ${normalizeGmailError(error).message}`);
    }
  }
});
