# Lexora

Lexora is a legal intelligence system built to help teams review contracts faster, with stronger clarity around clauses, risk, precedent, and actionable insights. It brings documents from manual upload, Google Drive, and Gmail into one workflow so review happens in a single focused workspace instead of across scattered tools.

Lexora is especially useful for sports organizations, legal teams, and operations teams that need faster visibility into contract risk before approval.

## Problem We Solve

Contract review is often slowed down by:

- legal files spread across multiple platforms
- repetitive manual clause review
- weak visibility into risky language early in the workflow
- difficulty comparing contract language with precedent or policy context

Lexora solves this by combining intake, extraction, clause analysis, semantic search, and grounded insight generation in one platform.

## What Lexora Does

- Ingests contracts through manual upload, Google Drive, and Gmail attachments (currently automatic drive files retrieval only works for tester email id only as our system is not given to google app review yet)
- Extracts readable text from PDFs, images, and text documents
- Detects important clauses, assigns clause-level risk, and extracts useful metadata
- Organizes contract records into a searchable review workspace
- Generates grounded insights using precedent and rulebook context
- Enables semantic search across indexed clauses
- Supports document preview so reviewers can check the original file alongside analysis
- Provides voice-assisted search interaction in the frontend

## Google Technologies Used

Google technologies are a meaningful part of Lexora's architecture:

- **Google Drive API** for connected document ingestion from monitored folders
- **Gmail API** for importing contract attachments from email workflows
- **Google OAuth** for secure authorization of Drive and Gmail connectors
- **Firebase / Firestore** for structured cloud-backed application storage
- **Gemini** for insight generation and grounded legal reasoning when configured

These integrations help Lexora feel connected, practical, and ready for real document workflows instead of being limited to only manual uploads.

## System Design

```text
[Manual Upload]   [Google Drive]   [Gmail Attachments]
        \              |               /
         \             |              /
          +-------> [Backend API] <-------> [Frontend Workspace]
                        |
                        v
                  [Python ML Service]
                        |
                        v
        [Firestore] [File Storage] [Pinecone] [Gemini]
                        |
                        v
                [Search + Insights + Review]
```

- **Frontend:** React-based review workspace for upload, search, insights, and document review
- **Backend:** Node.js and Express orchestration layer for APIs, ingestion, connectors, and workflow control
- **ML Service:** Python FastAPI service for clause analysis, risk detection, and metadata extraction
- **Storage Layer:** Firestore for structured data and Supabase/file storage for document artifacts
- **Retrieval Layer:** Pinecone for semantic clause search
- **Google Layer:** Google Drive, Gmail, Google OAuth, Firebase, and Gemini power the connected workflow
- **User Experience:** all results come together in one legal intelligence workspace

## Workflow

```text
[Contract comes in]
        |
        v
[Stored by backend]
        |
        v
[Text extracted]
        |
        v
[ML analyzes clauses and risk]
        |
        v
[Contract data is structured]
        |
        v
[Clauses indexed for search]
        |
        v
[Insights and semantic search run]
        |
        v
[Results shown in Lexora workspace]
```

1. A contract enters Lexora through manual upload, Google Drive, or Gmail.
2. The backend receives the document and stores the file.
3. The system extracts readable text using parsing or OCR.
4. The ML service analyzes clauses, risk, and important metadata.
5. The backend creates structured contract records.
6. Clauses are indexed for semantic retrieval.
7. When the user opens search or insights, Lexora retrieves relevant legal context.
8. Gemini-powered reasoning helps generate grounded guidance.
9. The final results are shown inside the review workspace.

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, Vite, custom CSS |
| Backend | Node.js, Express, Multer, Helmet, CORS |
| ML Layer | FastAPI, spaCy, scikit-learn, joblib, pandas, NumPy |
| Extraction | `pdf-parse`, `tesseract.js` |
| Cloud / Storage | Firebase / Firestore, Supabase Storage |
| Retrieval | Pinecone |
| Google Stack | Google Drive API, Gmail API, Google OAuth, Gemini |

## Why Lexora Feels Strong

- It unifies intake from upload, Drive, and Gmail in one product flow
- It moves beyond plain document storage into clause-level understanding
- It combines structured ML analysis with retrieval-backed reasoning
- It keeps original files, extracted text, and search-ready clauses tied together
- It gives users both review visibility and actionable next steps

## Project Structure

```text
SOLUTIONHACKATHON/
|- frontend/                  # React application
|- backend/                   # Express API and orchestration layer
|- ML-model-main/
|  `- ml-service/             # FastAPI ML analysis service
`- README.md
```

## Quick Start

### Prerequisites

- Node.js `20+`
- npm
- Python `3.11`

### 1. Install dependencies

```powershell
npm install --prefix backend
npm install --prefix frontend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r .\ML-model-main\ml-service\requirements.txt
```

### 2. Configure environment files

```powershell
Copy-Item .\backend\.env.example .\backend\.env
Copy-Item .\frontend\.env.example .\frontend\.env
```

Use a simple local setup like this in `backend/.env`:

```env
NODE_ENV=development
PORT=3000
HOST=127.0.0.1
API_PREFIX=/api
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
ML_SERVICE_URL=http://127.0.0.1:8001
REQUIRE_PYTHON_ML_SERVICE=true
AUTH_USERNAME=demo
AUTH_PASSWORD=demo-password-123
```

In `frontend/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:3000/api
```

To enable the full connected experience, add the Google, Firebase, Gemini, Pinecone, and storage keys from `backend/.env.example`.

### 3. Run the services

Start the ML service:

```powershell
cd d:\PROJECTS\SOLUTIONHACKATHON
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir .\ML-model-main\ml-service --port 8001 --reload
```

Start the backend:

```powershell
cd d:\PROJECTS\SOLUTIONHACKATHON\backend
npm run dev
```

Start the frontend:

```powershell
cd d:\PROJECTS\SOLUTIONHACKATHON\frontend
npm run dev
```

### 4. Open the app

- Frontend: `http://localhost:5173`
- Backend health: `http://127.0.0.1:3000/healthz`
- ML service health: `http://127.0.0.1:8001/healthz`

## Main Product Flow

1. A contract is uploaded manually or automatically imported through Google Drive or Gmail.
2. The backend stores the file and extracts readable content.
3. The ML layer identifies clause types, risk labels, and important metadata.
4. The backend creates structured contract records and indexes clauses for retrieval.
5. The user explores contracts, previews documents, runs semantic search, and generates grounded insights.

## Future Scope

- Broader multi-document search
- Stronger precedent libraries
- Expanded rulebook coverage
- More automated reviewer workflows
- Richer analytics for legal and operations teams

## Summary

Lexora is a strong  legal intelligence platform that combines document intake, Google-powered integrations, clause analysis, semantic retrieval, and insight generation in one coherent system. It is designed to feel practical, modern, and useful from both a technical and product perspective.
