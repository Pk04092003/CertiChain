# CertiChain V85

This version uses the repository root as the Vite frontend for Vercel. The backend remains in `backend/` for Render.

## Vercel
- Root Directory: `.`
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`
- Disable/clear Production Overrides that replace these values.

## Render
Set the service Root Directory to `backend/`, Build Command to `npm install`, and Start Command to `npm start`.

Never commit `.env` files containing secrets.


## Production deployment
The frontend uses `https://certichain-xczm.onrender.com` as its safe fallback API URL. For your Vercel Production deployment, set `VITE_API_URL` to that Render URL and redeploy so the browser calls the Render backend instead of localhost.
