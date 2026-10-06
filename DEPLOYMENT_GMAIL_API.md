# CertiChain — Gmail API Deployment (Render + Vercel)

This package uses Gmail API through Google OAuth 2.0. It does **not** use Resend.

## Project layout

- Frontend: Vite + React (repository root)
- Backend: Node.js + Express (`backend/`)
- Email provider: Gmail API (`googleapis`)
- Backend deployment: Render
- Frontend deployment: Vercel

## Render backend

Configure the Render web service with:

- Root Directory: `.`
- Build Command: `cd backend && npm install`
- Start Command: `cd backend && npm start`

Environment variables:

```text
PORT=10000
GMAIL_CLIENT_ID=<Google OAuth client ID>
GMAIL_CLIENT_SECRET=<Google OAuth client secret>
GMAIL_REDIRECT_URI=https://certichain-1-xc8l.onrender.com/api/email/google/callback
GMAIL_REFRESH_TOKEN=<Google OAuth refresh token>
GMAIL_SENDER_EMAIL=praveen.kumaran0409@gmail.com
GMAIL_FROM_NAME=CertiChain
MONGODB_URI=<MongoDB Atlas URI>
FRONTEND_URL=https://certichain-livid.vercel.app
```

Do **not** commit real secrets to GitHub.

## Verify the backend

After a successful Render deploy, these routes must exist:

```text
GET /api/email/status
GET /api/email/google/auth
GET /api/email/google/callback
POST /api/email/test
POST /api/email/certificate
POST /api/email/certificates/bulk
```

Open this in a browser to confirm the OAuth route exists:

```text
https://certichain-1-xc8l.onrender.com/api/email/google/auth
```

A `Cannot GET /api/email/google/auth` response means Render is still running an older backend commit.

## Vercel frontend

Set:

```text
VITE_API_URL=https://certichain-1-xc8l.onrender.com
VITE_PUBLIC_APP_URL=https://certichain-livid.vercel.app
```

Build command:

```text
npm run build
```

Output directory:

```text
dist
```

## GitHub safety

Before pushing, make sure these are absent from tracked files:

- `.env`
- OAuth client secrets
- Gmail refresh tokens
- MongoDB passwords / full connection strings with credentials
- Resend API keys
- blockchain private keys / RPC secrets


### OAuth state fix
This version uses a signed HttpOnly OAuth-state cookie instead of an in-memory state Map. This is important on Render because service restarts/redeploys can discard in-memory state. Start a fresh authorization at `/api/email/google/auth`; do not reuse an old callback URL.


## Important Gmail scope fix

CertiChain uses only `https://www.googleapis.com/auth/gmail.send`. The callback and connection-status checks no longer call the Gmail profile endpoint, because that endpoint requires broader Gmail permissions. The sender is taken from `GMAIL_SENDER_EMAIL`, and the backend validates that the stored OAuth token includes the Gmail Send scope. In Google Cloud Console, ensure the OAuth app's Data Access includes the Gmail Send scope. After a scope change, start a fresh connection from `/api/email/google/auth` and replace `GMAIL_REFRESH_TOKEN` in Render with the newly returned token.


### V92 application workflow
The Gmail API is used for certificate delivery. Certificate email messages contain a single PDF certificate attachment only.

The application has one authenticated role: Admin. Certificate viewers do not create accounts. They use the public verification route by certificate ID or QR code. The QR target is the deployed HTTPS verification URL, which can be opened by a phone camera or Google Lens.
## Durable public verification (V93)

Render must have these additional environment variables:

```text
MONGODB_URI=<your existing MongoDB Atlas connection string>
CERTICHAIN_MONGODB_DB=certichain
CERTICHAIN_PUBLIC_COLLECTION=public_certificates
```

Do not commit the real `MONGODB_URI` to GitHub. Keep it only in Render Environment Variables.

After deployment, verify the storage endpoint: `https://certichain-1-xc8l.onrender.com/api/public/health`. It should report `persistent: true` and `storage: "mongodb"`.

For an older certificate that was already issued before V93, open its Admin certificate details page and click **Sync public verification** once.

