# V96 Publisher Identity on Public Verification

## What changed
- Public verification now displays **Published by (institution)** using the publisher name recorded with the certificate.
- It also displays the recorded publisher account and the **Blockchain issuing wallet** returned by the CertificateRegistry smart contract.
- The blockchain wallet is shown separately from the institution name because the on-chain transaction signer can be an automated issuer wallet.

## Files changed
- `backend/server.js`: includes `createdByName` and `createdBy` in the public verification response.
- `src/pages/Verification.jsx`: displays institution publisher and on-chain issuer identity in certificate details.

## Important
Older certificates may show `Authorized Institution`, `Not recorded`, or `Not available on-chain` if their publisher details were not saved at issuance time. The blockchain issuing wallet is the actual address recorded by the smart contract; the displayed institution name is metadata supplied by the issuing application.
