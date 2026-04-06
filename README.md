# Legal Intelligence System

This repo now contains:

- `backend/` - a standard Node.js orchestration layer with routes, controllers, services, config, and shared middleware.
- `frontend/` - a separate Vite + React dashboard for contract intake, workflow visibility, risk review, and semantic search.
- `ML-model-main/ml-service/` - your existing Python ML service for contract analysis.

## High-level flow

1. Contracts enter from manual uploads, Google Drive, or Gmail attachments.
2. Raw files are stored in Firebase Storage, with a local fallback for development.
3. OCR and parsing convert PDFs or images into clean text.
4. The Python ML service extracts entities, clauses, clause classes, and risk levels.
5. Structured outputs are saved in Firestore, with a local JSON fallback for development.
6. Clause embeddings are stored in Pinecone, with a local vector fallback for development.
7. Semantic search and rulebook context generate focused insights for the React dashboard.

## Backend setup

1. Install dependencies inside `backend/`.
2. Fill `backend/.env.example` values in a local `.env`.
3. Start the Python ML service from `ML-model-main/ml-service`.
4. Start the Node backend.

Suggested commands:

```powershell
cd backend
npm install
npm run start
```

For the ML service:

```powershell
cd ML-model-main\ml-service
python -m uvicorn app.main:app --reload --port 8001
```

## Frontend setup

1. Install dependencies inside `frontend/`.
2. Fill `frontend/.env.example` values in a local `.env`.
3. Start the Vite dev server.

Suggested commands:

```powershell
cd frontend
npm install
npm run dev
```

## Key API routes

- `GET /api/health`
- `POST /api/contracts/upload`
- `GET /api/contracts`
- `GET /api/contracts/:contractId`
- `POST /api/contracts/:contractId/insights`
- `POST /api/connectors/drive/import`
- `POST /api/connectors/gmail/import`
- `POST /api/search/semantic`

## Notes

- Firebase, Pinecone, Gmail, and Drive are optional at boot time; the backend falls back to local storage so you can develop the flow before adding secrets.
- The frontend ships with mock data and automatically swaps to live API responses when the backend is running.
- The workflow diagram used by the frontend lives at `frontend/public/legal-intelligence-workflow.svg`.
