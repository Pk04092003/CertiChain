# CertiChain V93 workflow – durable public verification

## Roles
- **Admin**: the only account. Creates templates, issues certificates, emails certificates, manages the registry and can disqualify/synchronize records.
- **Viewer**: no account and no login. Verifies a certificate by scanning its QR code with a phone camera/Google Lens or by entering the Certificate ID at `/verify`.

## Certificate email workflow
- New single certificates: the participant email is entered before issue. The certificate is saved, synchronized to public verification, and then the PDF certificate is automatically emailed.
- New bulk certificates: the CSV must contain an `email` column. Each certificate is created, synchronized to public verification, and its own PDF is automatically emailed.
- Only the **PDF** certificate is attached to certificate emails.
- Existing/old certificates are **not** emailed automatically.
- Admin can open an old certificate and use **Sync public verification** when it predates the public verification database, then use the existing selected-certificate email workflow when a mail needs to be sent.

## Public verification
- New certificates are published to a durable MongoDB Atlas collection.
- Public verification reads only the backend registry, so a viewer's phone does not depend on the admin browser's localStorage.
- The public API does not return the participant email address.
- Disqualification/status changes are synchronized to the public record.
- QR codes use the deployed HTTPS Vercel origin, so Google Lens/phone-camera scanning can open the verification page from anywhere with internet access.

## Existing certificates
Certificates created before V93 may not yet exist in the public MongoDB collection. Open the certificate in **Issued Certificates → Certificate details** and click **Sync public verification** once. The same QR code will then resolve on the public site.
