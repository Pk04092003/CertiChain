# V100 — QR Scanner and Build Syntax Fix

- Fixed the stray `}` syntax error in `src/pages/Verification.jsx` that caused the Vercel build to fail.
- Added a **Scan QR with camera** option to the public `/verify` portal.
- Uses browser `BarcodeDetector` and camera access when supported; scanned HTTPS verification URLs open directly, while plain certificate IDs route to `/verify/:certificateId`.
- Requires HTTPS and camera permission. Browsers without native QR detection are given instructions to use the phone camera or Google Lens.
