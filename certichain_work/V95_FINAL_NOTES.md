# CertiChain V95 Final Notes

## Final workflow
- Admin is the only authenticated role.
- Viewer has no account and verifies by certificate ID or QR code.
- New certificates: issue -> render PDF -> upload PDF to IPFS -> register on Sepolia -> publish public verification -> email PDF via Gmail -> show success popup.
- Existing certificates are not auto-emailed and are not auto-registered on the blockchain. Admin can manually select old certificates for PDF email and can use recovery/sync actions where needed.
- Public verification shows VERIFIED, REVOKED, DISQUALIFIED, or UNREGISTERED. Raw backend/database errors are hidden from the public verifier.
- Certificate ID is always available through the `{{certificate_id}}`, `{{certificateId}}`, and `{{id}}` variables and the preview/export fallback footer.

## Deployment
- Render root directory: `backend`
- Render build command: `npm install`
- Render start command: `npm start`
- Vercel root directory: repository root (`.`)
- Vercel build command: `npm run build`
- Vercel output: `dist`

## Security
Keep Gmail OAuth credentials, refresh token, MongoDB URI/password, Pinata JWT, blockchain private key, admin password, and admin JWT secret in Render/Vercel environment variables as appropriate. Never commit them to GitHub.
