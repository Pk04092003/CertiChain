# CertiChain V95 UI – IPFS Certificate Viewer Fix

## Fix
The public verification page no longer embeds the Pinata/IPFS gateway URL directly in the browser iframe. Some gateways (including `ipfs.io`) can refuse embedded connections because of gateway/security headers.

A public backend endpoint now proxies the stored certificate PDF:
`GET /api/public/certificates/:certificateId/document`

The verification page uses this endpoint for the PDF viewer and the **Open Verified Certificate** button.

## Preserved
- Ethereum Sepolia blockchain configuration
- CertificateRegistry contract
- Pinata upload flow
- Gmail delivery
- MongoDB public verification
- Verified / Revoked / Disqualified status logic
- Verification seals

## Deployment
Redeploy both the backend and frontend after uploading this version. No new environment variables are required.
