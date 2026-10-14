# CertiChain V95 deployment

## Roles
- Admin: one authenticated administrator account.
- Viewer: no account. Public verification uses certificate ID or QR/Google Lens.

## Vercel
Root Directory: `.`
Framework: Vite
Build Command: `npm run build`
Output Directory: `dist`

Environment:
- `VITE_API_URL=https://certichain-1-xc8l.onrender.com`
- `VITE_PUBLIC_APP_URL=https://certichain-livid.vercel.app`

## Render
Root Directory: `backend`
Build Command: `npm install`
Start Command: `npm start`

Required environment variables:

### Gmail
`GMAIL_CLIENT_ID`
`GMAIL_CLIENT_SECRET`
`GMAIL_REDIRECT_URI=https://certichain-1-xc8l.onrender.com/api/email/google/callback`
`GMAIL_REFRESH_TOKEN`
`GMAIL_SENDER_EMAIL`
`GMAIL_FROM_NAME=CertiChain`
`FRONTEND_URL=https://certichain-livid.vercel.app`

### Admin authentication
`ADMIN_EMAIL`
`ADMIN_PASSWORD`
`ADMIN_NAME=CertiChain Admin`
`ADMIN_JWT_SECRET`

### MongoDB public metadata
`MONGODB_URI`
`CERTICHAIN_MONGODB_DB=certichain`
`CERTICHAIN_PUBLIC_COLLECTION=public_certificates`

### Automatic IPFS + blockchain
`PINATA_JWT`
`PINATA_NETWORK=public`
`IPFS_GATEWAY_URL=https://ipfs.io/ipfs`
`BLOCKCHAIN_RPC_URL`
`BLOCKCHAIN_CONTRACT_ADDRESS`
`BLOCKCHAIN_PRIVATE_KEY`
`BLOCKCHAIN_NETWORK=Ethereum Sepolia`

`BLOCKCHAIN_PRIVATE_KEY` must belong to a wallet that is authorized in the deployed `CertificateRegistry` contract. Never commit this key or place it in Vercel/frontend code.

## New issuance flow
1. Admin issues the certificate.
2. CertiChain renders the exact A4 PDF.
3. The PDF is uploaded to IPFS.
4. The returned IPFS CID is registered in the `CertificateRegistry` contract on Sepolia.
5. The public verification metadata is synchronized when MongoDB is available.
6. The Gmail API sends the same PDF as the only email attachment.
7. A success popup confirms the certificate was mailed.

## Public verification
QR codes point to the Vercel `/verify/<certificateId>` URL.
The public endpoint `/api/public/verify/:certificateId` reads the blockchain server-side and uses MongoDB only for optional metadata/disqualification information. MongoDB/TLS problems are not shown as raw errors to viewers.

Public states:
- VERIFIED: on-chain certificate exists and is not revoked.
- REVOKED: on-chain certificate is revoked.
- DISQUALIFIED: administrator has disqualified the certificate.
- UNREGISTERED: metadata exists but the certificate has not been registered on-chain.

## Existing/old certificates
Old certificates are never emailed automatically and are not automatically sent to blockchain. The admin can select old certificates and email them manually from Issued Certificates. Only the PDF is attached.
For an older certificate that needs blockchain/public verification, open Certificate Details and use `Automatic IPFS + blockchain` or the manual recovery actions.
