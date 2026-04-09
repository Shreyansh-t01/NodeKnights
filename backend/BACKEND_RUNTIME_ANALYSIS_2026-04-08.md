# Backend Runtime Analysis

Checked on April 8, 2026 against the code and the current on-disk `backend/.env`.

## Executive summary

The backend is **working in local fallback mode**, not in full cloud-integrated mode.

What is working right now:

- Express backend code loads cleanly
- all backend JavaScript files pass syntax check
- contract ingestion works in fallback mode
- text extraction works for plain text files
- heuristic contract analysis works when the Python ML service is unavailable
- contract persistence works in local JSON fallback
- vector indexing works in local JSON fallback
- semantic search works in local fallback mode
- rulebook/template reasoning works
- artifact storage being disabled does **not** break the pipeline

What is not working right now from the current `backend/.env` on disk:

- Firestore is not configured
- Pinecone is not configured
- Gemini is not configured
- Google Drive/Gmail connectors are not configured
- Python ML service is not reachable at `http://127.0.0.1:8001`

## Current config state from `backend/.env`

Observed on disk during this check:

- `FIREBASE_PROJECT_ID` is empty
- `FIREBASE_CLIENT_EMAIL` is empty
- `FIREBASE_PRIVATE_KEY` is empty
- `ARTIFACT_STORAGE_MODE=disabled`
- `PINECONE_API_KEY` is empty
- `PINECONE_INDEX_HOST` is empty
- `GEMINI_API_KEY` is empty
- Google connector env vars are empty

Important note:

- this analysis reflects the **saved file on disk**, not unsaved editor state

## Checks performed

### 1. Backend syntax pass

I ran a syntax check across all backend `.js` files outside `node_modules`.

Result:

```text
ALL_JS_SYNTAX_OK (33 files)
```

Status:

- Working

### 2. Health snapshot via backend health controller

I invoked the backend health controller directly using the current env on disk.

Observed result:

```json
{
  "success": true,
  "service": "legal-intelligence-backend",
  "environment": "development",
  "services": {
    "firestore": {
      "enabled": false,
      "mode": "disabled",
      "message": "Firestore credentials are not configured. Local contract storage will be used."
    },
    "artifactStorage": {
      "enabled": false,
      "mode": "disabled"
    },
    "mlService": {
      "enabled": true,
      "required": false,
      "reachable": false,
      "target": "http://127.0.0.1:8001/analyze",
      "mode": "python-ml-service-optional"
    },
    "pinecone": {
      "enabled": false,
      "mode": "local-vector-fallback"
    },
    "googleConnectors": {
      "enabled": false,
      "mode": "disabled"
    },
    "reasoning": {
      "enabled": false,
      "provider": "template",
      "configuredProvider": "gemini",
      "model": null,
      "mode": "template-fallback"
    }
  }
}
```

Status:

- Health reporting works
- Firestore disabled by current env
- artifact storage intentionally disabled
- ML service unreachable but optional
- Pinecone disabled by current env
- Google connectors disabled by current env
- Gemini disabled by current env

### 3. Isolated end-to-end ingestion smoke test

I ran a complete ingestion + retrieval test in an isolated temp directory:

- temp storage overridden to `backend/tmp/health-check`
- sample input was a plain text contract
- this avoided polluting normal app data

Observed result:

```json
{
  "contractId": "contract_9d03c134-7aef-482e-a298-915e2d01e781",
  "persistence": {
    "mode": "local-json",
    "location": "D:\\PROJECTS\\SOLUTIONHACKATHON\\backend\\tmp\\health-check\\local-store\\contracts.json"
  },
  "vectorIndex": {
    "mode": "local-vector-store",
    "count": 4,
    "location": "D:\\PROJECTS\\SOLUTIONHACKATHON\\backend\\tmp\\health-check\\local-store\\vectors.json"
  },
  "extractionMethod": "plain-text",
  "analysisSource": "node-heuristic-fallback",
  "clauses": 4,
  "risks": 2,
  "listedContracts": 1,
  "fetchedClauses": 4,
  "searchMatches": 3
}
```

Status:

- Working in fallback mode

What this proves:

- upload processing path works
- document extraction works for text
- Python ML fallback works
- disabled artifact storage does not break ingestion
- local contract persistence works
- local vector indexing works
- local semantic search works

### 4. Optional artifact storage behavior check

I directly tested raw/extracted artifact handling with `ARTIFACT_STORAGE_MODE=disabled`.

Observed result:

```json
{
  "raw": {
    "mode": "disabled",
    "assetType": "raw-document",
    "reason": "Artifact storage is disabled.",
    "path": null,
    "uri": null
  },
  "text": {
    "mode": "disabled",
    "assetType": "extracted-text",
    "reason": "Artifact storage is disabled.",
    "path": null,
    "uri": null
  }
}
```

Status:

- Working as intended

This confirms:

- raw document storage is optional
- extracted text artifact storage is optional
- disabling artifact storage does not crash the backend

## Working / not working matrix

### Working now

- route/controller/module loading
- health controller response generation
- plain text extraction
- heuristic ML fallback
- rulebook/template insight generation
- local JSON contract storage fallback
- local JSON vector storage fallback
- local semantic search fallback
- optional artifact disabling

### Not working now

- Firestore with the current saved `.env`
- Pinecone with the current saved `.env`
- Gemini with the current saved `.env`
- Google Drive import with the current saved `.env`
- Gmail import with the current saved `.env`
- Python ML service at `http://127.0.0.1:8001`

### Intentionally disabled now

- artifact/raw document storage

## Important code-level observations

### Firestore

The runtime now enables Firestore independently from Firebase Storage.

Current behavior:

- if Firebase credentials are present, Firestore can be used
- if they are absent, the backend falls back to local JSON

Current status from saved `.env`:

- disabled

### Artifact storage

The runtime no longer requires Firebase Storage.

Current behavior:

- `ARTIFACT_STORAGE_MODE=disabled` returns disabled artifact references
- `ARTIFACT_STORAGE_MODE=local` would store files under `backend/tmp/...`

Current status:

- disabled by config

### Pinecone

Current behavior:

- if Pinecone env is missing, vectors go to local `vectors.json`

Current status:

- disabled by config

### Gemini reasoning

Current behavior:

- if Gemini env is missing, rulebook/template fallback is used

Current status:

- disabled by config

### Python ML service

Current behavior:

- backend tries `http://127.0.0.1:8001/analyze`
- if unavailable and optional, it falls back to local heuristics

Current status:

- unreachable
- fallback working

## Known limitations in this check

- I did not perform a full browser/API black-box test against a long-running server process because background process spawning is restricted in this sandbox.
- I verified the same health payload by invoking the controller directly.
- Firestore, Pinecone, Gemini, and Google connectors were assessed against the saved env on disk as of April 8, 2026.

## Overall verdict

If your goal is:

- "Can the backend run and process contracts right now?"

Then the answer is:

- **Yes**, in local fallback mode.

If your goal is:

- "Are all cloud integrations currently active from the saved env file?"

Then the answer is:

- **No**.

The backend is healthy enough for local processing, fallback search, and fallback insights, but the current saved `.env` on disk does not enable Firestore, Pinecone, Gemini, Google connectors, or the Python ML service.

## Recommended next steps

1. Save the correct Firestore env values into `backend/.env` if you want database persistence in Firestore.
2. Save the correct Pinecone env values if you want semantic vectors stored remotely.
3. Save the Gemini API key if you want external reasoning instead of template fallback.
4. Start the Python ML service if you want model-backed extraction/analysis instead of local heuristics.
5. Fill Google OAuth env vars only if Drive/Gmail imports are required.
