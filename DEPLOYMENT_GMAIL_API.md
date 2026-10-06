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

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`

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
