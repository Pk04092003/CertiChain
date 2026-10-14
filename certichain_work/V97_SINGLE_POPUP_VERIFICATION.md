# V97 — Single-page verification popup

The public QR verification result now opens in a modal-style, scrollable popup. The same popup contains:
- Verification status (VERIFIED / REVOKED / DISQUALIFIED / NOT VERIFIED)
- Certificate ID, recipient, course/template, issued timestamp
- Institution/publisher name, publisher account, blockchain issuing wallet
- Certificate variables/public fields
- Integrity/hash comparison details when available
- Certificate lifecycle history and copy/verify-another actions

Mobile layout remains scrollable. The popup does not change the underlying verification rules or backend responses.
