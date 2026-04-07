# Deployment Guide

## Vercel (Recommended)

The project is configured for a single Vercel deployment via `vercel.json` at the root.

### What gets deployed
| Path | What | How |
|------|------|-----|
| `/*` | React frontend | `@vercel/static-build` (CRA build) |
| `/api/*` | FastAPI backend | `@vercel/python` serverless |

### Steps
1. Install the Vercel CLI: `npm i -g vercel`
2. From the project root: `vercel`
3. On first run, link to your Vercel project.
4. Set environment variables in the Vercel dashboard (see `.env.template`).
5. For production: `vercel --prod`

### Environment Variables (set in Vercel dashboard)
```
SECRET_KEY=...
ANTHROPIC_API_KEY=...
ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app
```

---

## Docker (Self-hosted)

Builds both frontend and backend as separate containers.

```bash
# From project root
./docker-build.sh

# Or directly
docker compose up --build
```

Frontend → http://localhost:3000
Backend  → http://localhost:8000/docs

---

## Manual (Local dev)

```bash
./setup.sh   # one-time: installs all deps
./host.sh    # start frontend + backend
```

---

## Backend — Standalone Deploy (Railway / Render / Fly.io)

If you want to deploy the backend separately:

1. Point your deployment service at `./backend`
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Set env vars from `.env.template`
5. Update `REACT_APP_API_URL` in the frontend to point to your backend URL.
