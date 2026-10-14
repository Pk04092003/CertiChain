# CertiChain V94 – Final verification/UI correction

## Fixes in this build
- Fixed the `/certificates/:id` admin page crash caused by a missing `FileText` icon import.
- Public QR verification uses the deployed verification record and shows a clear status seal: VERIFIED, REVOKED, or DISQUALIFIED.
- Public certificate IDs are normalized consistently and stored with both `id` and `certificateId` fields.
- Public verification records remain durable through MongoDB on Render when `MONGODB_URI` is configured.
- Existing/legacy certificates can be synchronized from the Issued Certificates registry or Certificate Details.
- New certificate publication retries once to handle transient Render cold starts.
- Every rendered certificate prints a consistent, aligned `Certificate ID: <id>` footer.
- Templates can reference `{{certificate_id}}`, `{{certificateId}}`, or `{{id}}`; these system values are injected automatically during rendering.
- Blockchain revocation is represented publicly as REVOKED rather than DISQUALIFIED.
- Email workflow remains PDF-only, Admin-only account model, and public Viewer verification without login.
