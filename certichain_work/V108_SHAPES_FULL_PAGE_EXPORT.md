# V108 — Custom Shapes and Full-Page Certificate Export

## Changes
- Added editor controls for stars, circles, squares, and rectangles alongside the existing single-line tool.
- Shapes are editable elements with position, resize/rotate controls, and fill colour supported by the existing selection/property panel.
- Added star rendering to both the template editor and the issued-certificate preview so it appears in generated certificates.
- Updated certificate PNG capture to remove the on-screen preview scale and capture the full intrinsic certificate sheet dimensions. This is intended to prevent the certificate artwork from appearing reduced in one corner of the exported PDF/PNG.

## Validation
- ZIP integrity checked after packaging.
- Production build not verified: dependency installation timed out in this environment. Run `npm install` and `npm run build` locally before deploying.
