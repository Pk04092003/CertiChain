# CertiChain V95 – Integrity, Lifecycle & Dynamic QR Enhancements

Implemented without changing the deployed CertificateRegistry contract.

## 1. Certificate data tamper/integrity detection
- Public certificate records receive an original SHA-256 integrity fingerprint.
- Public verification recomputes the fingerprint from the published certificate identity/details and issuer-defined public variables.
- Verification displays MATCH / MISMATCH status and the original/current fingerprints.
- The integrity scope is explicitly the public certificate record, not the PDF document.

## 2. Certificate lifecycle timeline
- Public verification now displays the available certificate history chronologically.
- Events can include creation, public synchronization, IPFS/blockchain registration, email delivery, revocation and disqualification.
- Transaction hash, block number and IPFS CID are shown when recorded with an event.

## 3. Dynamic QR verification
- The existing QR continues to encode the permanent CertiChain verification URL rather than static certificate details.
- Scanning the same printed QR always reads the current verification state from CertiChain/blockchain.
- A later revoke/disqualify operation therefore appears automatically when the QR is scanned again.

## 4. Public verification details
- No certificate PDF/document preview is shown.
- Public verification displays certificate details, issuer details, blockchain details, all issuer-defined public variables (excluding email), integrity status, and lifecycle history.
- Participant email remains private.

## Deployment note
The backend syntax check passes with Node's `--check`. A full frontend production build could not be completed in the packaging environment because dependency installation timed out; run `npm install` and `npm run build` locally/CI before deployment.
