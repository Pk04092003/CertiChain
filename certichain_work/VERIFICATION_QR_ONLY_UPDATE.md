# QR Verification Page Update

- Removed the certificate PDF/document preview from the public verification page.
- Removed the overlaid VERIFIED/DISQUALIFIED/REVOKED certificate seals.
- QR-code verification now opens a clean status result: VERIFIED, REVOKED, DISQUALIFIED, or NOT VERIFIED.
- The page displays the complete set of public certificate details available from the backend, including certificate ID, recipient name, course/certificate, template, issue date, issuer, blockchain network/status, transaction hash, block number, certificate hash, and IPFS CID.
- Disqualification/revocation reasons are shown when available.
- Participant email remains hidden from public verification for privacy.
- No blockchain, IPFS, Gmail, MongoDB, or contract configuration was changed.
