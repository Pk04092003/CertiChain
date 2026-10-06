# CertiChain V94

## Account model
- Only the Admin has an account.
- Viewer has no account and no login.

## Public verification
- QR codes open `/verify/<certificateId>` on the deployed CertiChain HTTPS site.
- Viewer can also enter a Certificate ID at `/verify`.
- The portal shows a large VERIFIED, REVOKED, or DISQUALIFIED seal.
- Every issued certificate prints `Certificate ID: <id>` in a fixed, aligned footer.
- Template text can use the system variables `{{certificate_id}}`, `{{certificateId}}`, or `{{id}}`.
- Public verification records are persisted in MongoDB so Google Lens/phone scans work from any device.

## Legacy certificates
Open **Issued Certificates** as Admin. Certificates not yet marked `Published` are synchronized in the background. The **Sync verification** button can synchronize selected certificates, or all certificates when nothing is selected. **Certificate Details** also has a one-certificate sync action.

## Certificate status
- `Issued` => VERIFIED on the public portal.
- Blockchain revocation => REVOKED.
- Admin disqualification => DISQUALIFIED.

## Email
- Only the PDF certificate is attached.
- New certificates are emailed automatically after issuance.
- Old certificates are emailed only after the Admin selects them from the Issued Certificates page.
