# V101 — Bulk ZIP Certificate Verification

Added a bulk verification panel to the public verification portal. Upload a ZIP containing either:

- Certificate PDFs named with the exact certificate ID (for example `CERT-2026-000001.pdf`), or
- A `manifest.csv` file with a `certificateId` column (accepted header variants include `certificate_id`, `certificateid`, and `id`).

The portal checks each ID using the existing `/api/public/verify/:certificateId` service, shows the result table, and exports a CSV report. ZIP limit: 50 MB; up to 200 IDs; requests are processed in batches of five. This checks the certificate registry/status, not the PDF's visual content or file integrity.

## Test

```powershell
npm install
npm run build
```

Upload the updated project to the existing `master` branch to trigger deployment.
