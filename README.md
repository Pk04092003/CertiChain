# CertiChain V85

This version uses the repository root as the Vite frontend for Vercel. The backend remains in `backend/` for Render.

## Vercel
- Root Directory: `.`
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`
- Disable/clear Production Overrides that replace these values.

## Render
Set the service Root Directory to `backend/`, Build Command to `npm install`, and Start Command to `npm start`.

Never commit `.env` files containing secrets.


## Production deployment
The frontend uses `https://certichain-1-xc8l.onrender.com` as its safe fallback API URL. For your Vercel Production deployment, keep `VITE_API_URL=https://certichain-1-xc8l.onrender.com` so the browser calls the current Render backend.


## Gmail API email delivery

CertiChain sends certificates directly from the authorized Gmail account using the Gmail API and Google OAuth 2.0, so a custom email domain is not required. Google's server-side OAuth flow uses offline access to obtain a refresh token that the backend can use when the issuer is not actively signed in. The `https://www.googleapis.com/auth/gmail.send` scope is the narrow Gmail scope used by this project for sending mail on the user's behalf.

### Google Cloud setup

1. Create/select a Google Cloud project and enable **Gmail API**.
2. Configure **Google Auth Platform / OAuth consent screen**. For a personal Gmail account used for testing, choose External and add `praveen.kumaran0409@gmail.com` as a test user when Google presents that option.
3. Create an OAuth 2.0 Client ID with application type **Web application**.
4. Add this authorized redirect URI:
   `https://YOUR-RENDER-SERVICE.onrender.com/api/email/google/callback`
5. Put `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REDIRECT_URI` into Render.
6. Deploy the backend.
7. Open:
   `https://YOUR-RENDER-SERVICE.onrender.com/api/email/google/auth`
8. Sign in as `praveen.kumaran0409@gmail.com` and grant the Gmail send permission.
9. Copy the refresh token shown by the callback page into Render as `GMAIL_REFRESH_TOKEN`, and redeploy.
10. Keep `GMAIL_SENDER_EMAIL=praveen.kumaran0409@gmail.com`.

Google documents that offline access returns a refresh token that should be stored securely on the server, and the client can refresh access tokens automatically when needed.

The backend creates a MIME message and sends the PNG/PDF certificate attachments using Gmail's `users.messages.send`.

### Render environment variables

```env
PORT=10000
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REDIRECT_URI=https://YOUR-RENDER-SERVICE.onrender.com/api/email/google/callback
GMAIL_REFRESH_TOKEN=...
GMAIL_SENDER_EMAIL=praveen.kumaran0409@gmail.com
GMAIL_FROM_NAME=CertiChain
FRONTEND_URL=https://certichain-livid.vercel.app
MONGODB_URI=...
```

Never commit the Gmail client secret or refresh token to GitHub.


### Gmail OAuth scope
The Gmail integration intentionally uses only `https://www.googleapis.com/auth/gmail.send`.

## V91 Email workflow

- New single certificates require the participant email before issuance and are automatically emailed immediately after the immutable certificate is saved.
- New bulk certificates require the CSV `email` column and are automatically emailed immediately after issuance.
- Existing/old certificates are never emailed automatically as a side effect of issuing new certificates.
- To email an old certificate, open **Issued Certificates**, select one or more records, click **Email selected**, review the email template, and click **Send selected certificates**.
- Failed automatic deliveries remain in the immutable registry with their delivery status and can be selected later for retry.
