# CertiChain V92 workflow

## Roles
### Admin
There is only one authenticated role: **Admin**. The Admin signs in and manages the complete institution portal: templates, certificate issuance, Gmail, settings, registry, audit logs, and analytics.

### Viewer
**Viewer is public access, not an account.** A viewer never registers, logs in, or receives a username/password.

## New certificate email flow
1. Admin selects a saved A4 template.
2. Admin enters the participant email for a single certificate, or uploads a CSV containing `email` for bulk issuance.
3. CertiChain issues and stores the immutable certificate.
4. CertiChain automatically converts the rendered certificate to PDF and sends that PDF to the participant by Gmail API.
5. **Only the PDF is attached to the email. No PNG is attached.**

## Old certificate email flow
1. Admin opens **Issued Certificates**.
2. Admin selects one or more previously issued certificates.
3. Admin clicks **Email selected**.
4. Admin reviews the message and sends the selected certificate PDFs.
5. **Previously issued certificates are never emailed automatically.**

## Viewer verification flow
1. Viewer scans the QR code on the certificate with a phone camera or Google Lens, or opens the public verification page and enters the certificate ID.
2. The QR code contains the deployed CertiChain HTTPS verification URL.
3. CertiChain opens `/verify/<certificateId>`.
4. The verification page is read-only and requires no account.
5. The page reports whether the certificate record is valid or disqualified.

## Production QR requirement
The deployed Vercel site should be used as the public verification origin. `VITE_PUBLIC_APP_URL` can be set explicitly to the Vercel HTTPS URL; otherwise the browser origin is used. Do not issue production certificates whose QR code points to localhost.
