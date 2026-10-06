# CertiChain V80 — Vercel + Render + Resend deployment-ready

This version keeps the CertiChain certificate/template/verification feature set and uses Resend for production email delivery.

## Vercel frontend

Recommended Vercel project configuration for this GitHub repository:

- Repository: `Pk04092003/CertiChain`
- Branch: `master`
- Root Directory: `./` (repository root)
- Framework Preset: `Other` or automatic detection
- Build Command: `npm run build`
- Output Directory: `frontend/dist`
- Install Command: `npm install`

The root `vercel.json` already defines the build/output/rewrite configuration. This avoids the previous `npm start`/`public` output-directory problem. SPA routes such as `/verify/CERT-...` are rewritten to the React `index.html`.

If you instead set Vercel Root Directory to `frontend`, use `Vite`, `npm run build`, output `dist`, and the `frontend/vercel.json` included in this project.

Vercel frontend environment variables:
- `VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com`
- `VITE_PUBLIC_APP_URL=https://YOUR-VERCEL-DOMAIN.vercel.app`

## Render backend

Create a Node Web Service from the same GitHub repository:

- Branch: `master`
- Root Directory: `OneDrive/Desktop/Capstone/Praveen/CertiChain_Blockchain_Project_FIXED/backend`
- Build Command: `npm install`
- Start Command: `npm start`

Render web services should listen on `0.0.0.0` and the `PORT` environment variable; the default Render port is 10000.

Backend environment variables on Render:
- `PORT=10000`
- `RESEND_API_KEY=re_...`
- `RESEND_FROM=CertiChain <your-verified-sender@yourdomain.com>`
- `MONGODB_URI=...`
- `FRONTEND_URL=https://YOUR-VERCEL-DOMAIN.vercel.app`

For initial testing, Resend documents `onboarding@resend.dev` as a testing sender. For production participants, verify your sending domain in Resend and use a sender address from that domain.

## Email delivery

Single certificate:
`Issue Certificate → issue → Email Certificate → enter email → Send certificate by email`

Bulk certificate:
`Issue Certificate → CSV → validate → Issue bulk certificates → Email Participants → Send All`

Each participant gets only the certificate from their own row. Initial delivery requests are dispatched in parallel. Only transient provider/network failures are retried.

## Local development

Frontend:
```powershell
cd frontend
npm install
npm run dev
```

Backend:
```powershell
cd backend
npm install
npm start
```

## Security

Never commit `.env` files, MongoDB passwords, Resend API keys, or private keys. Keep secrets in Render/Vercel environment settings.


## V80 email fix
The bulk Email Participants page now imports and uses the shared verification URL helper correctly. This fixes the runtime error that prevented certificate emails from being prepared/sent.


## Email prerequisite
Resend shared test sender `onboarding@resend.dev` is for testing and cannot deliver to arbitrary participant addresses. Verify a domain you own in Resend and set `RESEND_FROM` to an address on that verified domain before sending certificates to participants.


## Vercel SPA routing
For the Vercel project, set Root Directory to `OneDrive/Desktop/Capstone/Praveen/CertiChain_Blockchain_Project_FIXED` (the directory containing the workspace `package.json`). Use `npm run build` and `frontend/dist`. `cleanUrls` is disabled so React Router routes such as `/email-participants` and `/verify/<certificateId>` are rewritten to `index.html`.


## Vercel frontend deployment (V82)

Recommended Vercel Root Directory: `OneDrive/Desktop/Capstone/Praveen/CertiChain_Blockchain_Project_FIXED/frontend`
Framework: Vite
Build Command: `npm run build`
Output Directory: `dist`
Install Command: `npm install`

Do not set `npm start` as the Output Directory. `npm start` is only for the Render backend.

If Vercel previously showed a very fast `Build Completed in /vercel/output` without `npm install` and `vite build`, remove the old Production Override values or set them to the values above, then redeploy the latest `master` commit.
