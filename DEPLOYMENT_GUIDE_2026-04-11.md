# Deployment Guide

This file explains how to deploy this project step by step, where to change API endpoints, and what must be updated for Google OAuth and Drive webhooks.

It is written for the current codebase as of April 11, 2026.

## 1. Understand the deployment shape first

This project has 3 runtime pieces:

1. `backend/`
   - Node.js API server
   - handles uploads, connectors, storage, Firestore, Pinecone, Gemini, document APIs

2. `frontend/`
   - React + Vite app
   - talks to the backend using `/api/...`

3. Python ML service
   - `ML-model-main/ml-service`
   - backend sends extracted text to it at `ML_SERVICE_URL`

So in production, your real system looks like this:

`Browser -> Frontend -> Backend API -> ML service / Firestore / Supabase / Pinecone / Gemini / Google APIs`

## 2. Decide your deployment style

You have 2 clean options.

### Option A. Same domain, reverse proxy

Example:

- frontend: `https://app.example.com`
- backend API exposed at: `https://app.example.com/api`

In this setup:

- frontend can keep `VITE_API_BASE_URL=/api`
- backend can keep `API_PREFIX=/api`
- your web server or platform routes `/api/*` to the backend

This is the easiest setup for the frontend.

### Option B. Separate frontend and backend domains

Example:

- frontend: `https://app.example.com`
- backend: `https://api.example.com`

In this setup:

- frontend must use `VITE_API_BASE_URL=https://api.example.com/api`
- backend `CORS_ORIGIN` must allow the frontend domain

This is also valid, but requires one extra frontend env variable.

## 3. Where API endpoints come from in this repo

The frontend API base is defined in:

- [frontend/src/lib/api.js](/d:/PROJECTS/SOLUTIONHACKATHON/frontend/src/lib/api.js:1)

Current behavior:

```js
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
```

Meaning:

- if `VITE_API_BASE_URL` is set, frontend uses that
- otherwise frontend uses `/api`

Important:

- `frontend/vite.config.js` proxy is only for local development
- it does not apply in production

That local dev proxy is here:

- [frontend/vite.config.js](/d:/PROJECTS/SOLUTIONHACKATHON/frontend/vite.config.js:1)

## 4. What you should deploy first

Deploy in this order:

1. backend
2. Python ML service
3. frontend
4. reconnect Google OAuth on the deployed backend
5. enable Drive watch

This order avoids frontend failures caused by missing backend URLs.

## 5. Backend deployment steps

### Step 1. Create a production backend env

Start from:

- [backend/.env.example](/d:/PROJECTS/SOLUTIONHACKATHON/backend/.env.example:1)

Create a real production `backend/.env` on the server.

At minimum review and set these:

```env
NODE_ENV=production
PORT=3000
API_PREFIX=/api
CORS_ORIGIN=https://app.example.com
APP_BASE_URL=https://app.example.com
ML_SERVICE_URL=http://127.0.0.1:8001
REQUIRE_PYTHON_ML_SERVICE=false
STRICT_REMOTE_SERVICES=true
```

Then set your real service credentials:

- Firebase
- Supabase
- Pinecone
- Gemini
- Google OAuth

### Step 2. Set Google production URLs

These are the most important Google-related production values:

```env
GOOGLE_REDIRECT_URI=https://api.example.com/api/connectors/google/callback
GOOGLE_DRIVE_FOLDER_IDS=your_drive_folder_id
GOOGLE_DRIVE_WATCH_ENABLED=true
GOOGLE_DRIVE_WEBHOOK_URL=https://api.example.com/api/connectors/drive/notifications
GOOGLE_DRIVE_WATCH_CHANNEL_TOKEN=put-a-long-random-secret-here
GMAIL_POLL_ENABLED=true
GMAIL_POLL_INTERVAL_MS=300000
NOTIFICATION_EMAIL_ENABLED=true
NOTIFICATION_EMAIL_RECIPIENTS=team@example.com
```

If you use same-domain routing, these can also be:

```env
GOOGLE_REDIRECT_URI=https://app.example.com/api/connectors/google/callback
GOOGLE_DRIVE_WEBHOOK_URL=https://app.example.com/api/connectors/drive/notifications
```

Notes:

- if `APP_BASE_URL` is not set, the backend now falls back to the first hosted URL in `CORS_ORIGIN`
- if `GOOGLE_DRIVE_WEBHOOK_URL` is not set, the backend now derives it from `GOOGLE_REDIRECT_URI`
- Gmail notification emails need the Google connection to include `https://www.googleapis.com/auth/gmail.send`

### Step 3. Install backend dependencies

From `backend/`:

```bash
npm install
```

### Step 4. Start backend

From `backend/`:

```bash
npm start
```

Current backend start script is:

- [backend/package.json](/d:/PROJECTS/SOLUTIONHACKATHON/backend/package.json:6)

Production recommendation:

- run it under a process manager or hosting platform that keeps it alive
- the Drive watch renewal logic depends on the backend staying up

### Step 5. Expose backend publicly over HTTPS

This is required for:

- Google OAuth callback
- Drive webhook notifications

The Drive webhook URL must be:

- public
- HTTPS
- valid SSL certificate

Localhost is not enough for production webhooks.

## 6. Python ML service deployment steps

The backend sends contract text to:

- `ML_SERVICE_URL`

If you keep Python on the same server, you can use:

```env
ML_SERVICE_URL=http://127.0.0.1:8001
```

To start the current local-style service:

```bash
cd d:\PROJECTS\SOLUTIONHACKATHON
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir .\ML-model-main\ml-service --port 8001 --reload
```

For production, use the same app but run it as a real long-running service.

If Python is deployed separately:

```env
ML_SERVICE_URL=https://ml.example.com
```

Then make sure the backend can reach it.

## 7. Frontend deployment steps

### Step 1. Decide the frontend API base

#### If backend is behind the same domain under `/api`

You do not need to change frontend API paths.

Use:

```env
VITE_API_BASE_URL=/api
```

or leave it unset.

#### If backend is on a different domain

Set:

```env
VITE_API_BASE_URL=https://api.example.com/api
```

This is the main place where API endpoint base changes for the frontend.

### Step 2. Build frontend

From `frontend/`:

```bash
npm install
npm run build
```

Current frontend build script is:

- [frontend/package.json](/d:/PROJECTS/SOLUTIONHACKATHON/frontend/package.json:6)

### Step 3. Deploy frontend static output

Deploy:

- `frontend/dist/`

This is the built React app.

## 8. What exactly you need to change for API endpoints

This is the most important section if you are confused about URLs.

### A. Frontend API endpoint base

Change:

- `VITE_API_BASE_URL`

Used in:

- [frontend/src/lib/api.js](/d:/PROJECTS/SOLUTIONHACKATHON/frontend/src/lib/api.js:1)

Examples:

- same domain:
  - `VITE_API_BASE_URL=/api`
- separate backend domain:
  - `VITE_API_BASE_URL=https://api.example.com/api`

### B. Backend CORS

Change:

- `CORS_ORIGIN`

Examples:

- if frontend is `https://app.example.com`
  - `CORS_ORIGIN=https://app.example.com`

### C. Google OAuth callback URL

Change:

- `GOOGLE_REDIRECT_URI`

This must match the backend public callback URL exactly.

Examples:

- `https://api.example.com/api/connectors/google/callback`
- `https://app.example.com/api/connectors/google/callback`

### D. Drive webhook URL

Change:

- `GOOGLE_DRIVE_WEBHOOK_URL`

Examples:

- `https://api.example.com/api/connectors/drive/notifications`
- `https://app.example.com/api/connectors/drive/notifications`

### E. Google Cloud Console OAuth settings

You must also update Google Cloud Console so the deployed redirect URI is allowed.

Add the same exact URL you put into:

- `GOOGLE_REDIRECT_URI`

## 9. Recommended production URL setups

### Setup 1. Same-domain reverse proxy

Use this when possible.

Frontend:

- `https://app.example.com`

Backend:

- hidden behind reverse proxy
- exposed to browser as `https://app.example.com/api`

Frontend env:

```env
VITE_API_BASE_URL=/api
```

Backend env:

```env
CORS_ORIGIN=https://app.example.com
GOOGLE_REDIRECT_URI=https://app.example.com/api/connectors/google/callback
GOOGLE_DRIVE_WEBHOOK_URL=https://app.example.com/api/connectors/drive/notifications
```

### Setup 2. Separate app and api domains

Frontend:

- `https://app.example.com`

Backend:

- `https://api.example.com`

Frontend env:

```env
VITE_API_BASE_URL=https://api.example.com/api
```

Backend env:

```env
CORS_ORIGIN=https://app.example.com
GOOGLE_REDIRECT_URI=https://api.example.com/api/connectors/google/callback
GOOGLE_DRIVE_WEBHOOK_URL=https://api.example.com/api/connectors/drive/notifications
```

## 10. After backend deployment, reconnect Google OAuth

Do this after the backend is live.

### Step 1. Open auth URL

Call:

- `GET /api/connectors/google/auth-url`

### Step 2. Complete consent

Google redirects to:

- `/api/connectors/google/callback`

### Step 3. Verify connection

Call:

- `GET /api/connectors/google/status`

Expected:

- configured = true
- connected = true

## 11. After Google is connected, enable Drive watch

### Step 1. Check current watch status

Call:

- `GET /api/connectors/drive/watch`

### Step 2. Start watch manually once

Call:

- `POST /api/connectors/drive/watch/start`

### Step 3. Verify status again

Call:

- `GET /api/connectors/drive/watch`

### Step 4. Test a real file upload

Upload a supported file into the monitored Drive folder.

Then check:

- `GET /api/contracts`

If the webhook and Drive sync are working, a new contract should appear automatically after ingestion.

## 12. Frontend automatic refresh after deployment

The frontend now polls live backend data automatically.

That logic is in:

- [frontend/src/App.jsx](/d:/PROJECTS/SOLUTIONHACKATHON/frontend/src/App.jsx:20)

Current behavior:

- health and contracts refresh every 15 seconds
- the insights page refreshes while open

So after deployment, if Drive ingest creates a contract in the backend, the frontend should show it without manual page reload.

## 13. Minimum production checklist

Before calling the deployment complete, verify all of these:

### Backend

- backend starts successfully
- `/api/health` responds
- backend has public HTTPS
- `CORS_ORIGIN` matches frontend
- `GOOGLE_REDIRECT_URI` matches deployed callback
- `GOOGLE_DRIVE_WEBHOOK_URL` matches deployed notifications route

### Python ML

- Python service is running
- backend can reach `ML_SERVICE_URL`

### Frontend

- frontend loads in browser
- API calls hit the correct backend
- no CORS errors in browser console

### Google

- Google status route says connected
- Drive watch route says active after start
- Gmail polling route reports enabled if you want automatic email ingestion
- a newly analyzed remote document creates an in-app notification
- email notifications are delivered or clearly report a missing `gmail.send` scope
- file upload in watched folder leads to new contract ingestion

## 14. Most common mistakes to avoid

### Mistake 1. Forgetting that Vite proxy is only local

`frontend/vite.config.js` helps only during local dev.

It does not solve production routing.

### Mistake 2. Using localhost in production Google URLs

These will not work for real deployment:

- `http://localhost:3000/api/connectors/google/callback`
- `http://localhost:3000/api/connectors/drive/notifications`

Use public HTTPS URLs instead.

### Mistake 3. Deploying frontend before backend URLs are decided

If `VITE_API_BASE_URL` is wrong at build time, frontend API calls point to the wrong place.

### Mistake 4. Forgetting CORS

If frontend and backend are on different domains, set:

- `CORS_ORIGIN=https://your-frontend-domain`

### Mistake 5. Forgetting Google Cloud Console redirect update

Even if `.env` is correct, Google OAuth fails if the redirect URI is not added in Google Cloud Console.

## 15. Suggested first deployment path

If you want the least painful path:

1. deploy backend first on `https://api.yourdomain.com`
2. deploy Python ML where backend can reach it
3. set backend env vars
4. update Google Cloud Console redirect URI
5. reconnect Google OAuth
6. test `GET /api/health`
7. test `GET /api/connectors/google/status`
8. test `POST /api/connectors/drive/watch/start`
9. deploy frontend
10. set `VITE_API_BASE_URL=https://api.yourdomain.com/api`
11. test file upload into watched Drive folder
12. confirm new contracts appear automatically

## 16. Final short answer

If you ask “where do I change the API endpoints?”, the answer is:

- frontend base URL: `VITE_API_BASE_URL`
- backend browser access prefix: `API_PREFIX`
- backend CORS: `CORS_ORIGIN`
- Google callback URL: `GOOGLE_REDIRECT_URI`
- Drive webhook URL: `GOOGLE_DRIVE_WEBHOOK_URL`

Those are the main deployment URL knobs for this codebase.
