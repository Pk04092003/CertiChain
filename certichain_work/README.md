# CertiChain V95 — Admin + Public Viewer

CertiChain is a certificate issuance and verification portal with one authenticated **Admin** role and a public **Viewer** flow that requires no account.

## Workflow

### Admin
1. Sign in using the administrator credentials configured on Render.
2. Create/save an A4 certificate template.
3. Issue a single certificate or upload a bulk CSV.
4. A newly issued certificate is rendered to PDF.
5. The PDF is uploaded automatically to IPFS.
6. The IPFS CID is registered automatically in `CertificateRegistry` on Ethereum Sepolia.
7. Public verification metadata is synchronized.
8. The same PDF is emailed through Gmail API.
9. A confirmation popup appears after the email is sent successfully.

### Existing/old certificates
Existing certificates are **not** emailed automatically. To email an old certificate:
- Open **Issued Certificates**.
- Select the certificates.
- Choose **Email selected**.
- Review and send them manually.

Only the PDF certificate is attached to certificate emails.

### Viewer
The Viewer does not create an account or sign in. The Viewer can:
- enter a certificate ID at `/verify`;
- scan the QR code with a phone camera or Google Lens;
- see a clear status seal: **VERIFIED**, **REVOKED**, **DISQUALIFIED**, or **UNREGISTERED**;
- open the certificate PDF from IPFS when a public CID is available.

## Certificate ID
Every rendered certificate contains a centered, aligned **Certificate ID** footer. The template preview also injects `{{certificate_id}}`, `{{certificateId}}` and `{{id}}` so the ID can be used in editable text elements.

## Deployment

### Vercel frontend
- Repository root: `.`
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- `VITE_API_URL=https://certichain-1-xc8l.onrender.com`
- `VITE_PUBLIC_APP_URL=https://certichain-livid.vercel.app`

### Render backend
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`

Required Render environment variables:

```text
PORT=10000

# Gmail API
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=https://certichain-1-xc8l.onrender.com/api/email/google/callback
GMAIL_REFRESH_TOKEN=
GMAIL_SENDER_EMAIL=
GMAIL_FROM_NAME=CertiChain
FRONTEND_URL=https://certichain-livid.vercel.app

# Admin authentication
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_NAME=CertiChain Admin
ADMIN_JWT_SECRET=

# MongoDB public metadata
MONGODB_URI=
CERTICHAIN_MONGODB_DB=certichain
CERTICHAIN_PUBLIC_COLLECTION=public_certificates

# Automatic IPFS
PINATA_JWT=
PINATA_NETWORK=public
IPFS_GATEWAY_URL=https://ipfs.io/ipfs

# Automatic blockchain
BLOCKCHAIN_RPC_URL=
BLOCKCHAIN_CONTRACT_ADDRESS=
BLOCKCHAIN_PRIVATE_KEY=
BLOCKCHAIN_NETWORK=Ethereum Sepolia
```

`BLOCKCHAIN_PRIVATE_KEY` must belong to a wallet authorized by the deployed `CertificateRegistry` contract and funded with Sepolia ETH for gas. Never put the private key, Gmail refresh token, MongoDB password, or API tokens in GitHub/Vercel frontend code.

See `DEPLOYMENT_AUTOMATION.md` for the complete deployment checklist.
