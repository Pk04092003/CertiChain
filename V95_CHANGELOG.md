# CertiChain V95 changelog

- Added secure server-side admin login with short-lived HMAC bearer sessions.
- Added automatic PDF -> IPFS -> blockchain issuance workflow for new certificates.
- Added serialized blockchain writes to prevent wallet nonce collisions during bulk issuance.
- Added Pinata/custom IPFS support on the backend; certificate PDF is stored as the IPFS object.
- Added blockchain-backed public verification endpoint that survives MongoDB metadata failures.
- Added clear VERIFIED / REVOKED / DISQUALIFIED / UNREGISTERED public status seals.
- Added IPFS certificate PDF link on public verification when an IPFS CID exists.
- New certificate emails are sent only after automatic IPFS + blockchain processing succeeds.
- Added success popups after automatic certificate email delivery.
- Old certificates remain manual-email only.
- Old email flow sends PDF only.
- Added Render/Vercel deployment settings for the new root structure.
- Certificate ID footer remains aligned at the bottom center of every rendered A4 certificate.
