# CertiChain V76 — Complete Institutional Certificate Platform

This version builds on the V75 certificate workflow and adds a broader institutional management layer.

## Main workflow

### Single certificate
1. Select a saved A4 template.
2. Enter participant data.
3. Issue the certificate.
4. The immutable issued record is saved in Issued Certificates.
5. The separate Email Certificate page accepts the participant email.
6. The issuer can preview, customize the email subject/body, send PNG + PDF, download PNG/PDF, and open public verification.

### Bulk certificates
1. Select a saved template.
2. Upload CSV with an `email` column.
3. Validate required fields and duplicate candidates.
4. Preview using the exact selected template.
5. Click Issue bulk certificates.
6. Certificates are saved as immutable records.
7. The next page is Email Participants.
8. Send all, send selected, retry failed, preview individual certificates, and download PNG + PDF ZIP.

## Added features

- Issued Certificate registry search, filters, sorting, date range, selected ZIP, CSV export, PNG/PDF downloads and resend links.
- Real-time dashboard metrics and Recent Certificates.
- Analytics page with certificate/email metrics and course distribution.
- Audit Logs for issuance, email, template and administrative activity.
- Institution branding settings: institution, contact, authorized person, logo and signature.
- Configurable certificate numbering with prefix/year/serial length.
- Professional email subject/body templates with certificate variables.
- Local Institution Admin / Issuer / Viewer accounts and role-based portal access.
- My account profile and password update.
- Template import/export, PNG/PDF export, duplicate, versioning, archive/activate, default template and lock/unlock.
- Public certificate ID verification page and optional read-only blockchain verification through RPC + contract address.
- Certificate lifecycle metadata and blockchain/IPFS status fields.
- Optional IPFS upload endpoint from Certificate Details; the endpoint should return a CID.
- MetaMask CertificateRegistry registration/revocation when a deployed contract and IPFS CID are configured.
- Backup/restore of templates, certificates, settings and audit metadata. SMTP/private-key secrets are not included.
- Responsive issuer portal and public verification flow.

## Email configuration

Create `backend/.env` from `backend/.env.example` and configure Gmail SMTP with a Google App Password. Never commit `.env`.

Recommended settings:

```env
PORT=5000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-google-app-password
SMTP_FROM=your-email@gmail.com
SMTP_MAX_CONNECTIONS=5
```

Run the backend from the `backend` directory:

```powershell
npm install
npm run dev
```

Run the frontend from the `frontend` directory:

```powershell
npm install
npm run dev
```

## Demo accounts

- Institution Admin: `admin@certichain.local` / `admin123`
- Issuer: `issuer@certichain.local` / `issuer123`
- Viewer: `viewer@certichain.local` / `viewer123`

Change local account passwords from Settings before treating the portal as a real deployment.

## Blockchain / IPFS

The Solidity contract in `blockchain/contracts/CertificateRegistry.sol` supports authorized issuer registration, verification and revocation. The frontend now includes MetaMask integration for a deployed contract and supports read-only verification when a public Sepolia RPC URL and contract address are configured.

The optional IPFS upload button calls the configurable endpoint in Settings. The endpoint must accept `multipart/form-data` with a `file` field and return a JSON CID, for example `{ "cid": "bafy..." }`.

## Important

The frontend certificate registry is browser-local. It is suitable for a project/demo environment, but production institutional deployment should move certificates, users, audit logs and delivery state into a server/database with server-side authentication and authorization.


## Phone Camera / Google Lens QR verification

CertiChain QR codes now contain an absolute public verification URL such as `https://your-domain/verify/CERT-...`. Both Google Lens and standard phone camera apps can detect this URL and open the verification page.

For Vercel deployment, set `VITE_PUBLIC_APP_URL` in the frontend environment to the deployed HTTPS domain. Set `VITE_API_URL` to the public backend URL. The backend stores a non-sensitive public certificate registry so verification works from another phone/browser instead of relying on the issuing computer's localStorage.

For local same-Wi-Fi testing, use the computer's LAN IP for both values, for example `http://192.168.1.20:5173` and `http://192.168.1.20:5000`, and allow those ports through Windows Firewall. `localhost` QR codes are only useful on the same device.

The Vercel SPA rewrite is included in `frontend/vercel.json` so `/verify/<certificateId>` loads correctly on direct navigation.


### QR camera compatibility

The QR generator uses high error correction and a clean black-on-white code so standard Android/iPhone camera apps and Google Lens can detect it more reliably. The encoded value is the public verification URL, not just a certificate ID.
