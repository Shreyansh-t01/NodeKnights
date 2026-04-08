# Database And Storage Guide

Note as of April 8, 2026:

- Firestore is now configured independently of Firebase Storage
- Firebase Storage is no longer required by the backend runtime
- raw/extracted artifact storage is controlled by `ARTIFACT_STORAGE_MODE`
- artifact storage can be `disabled` or `local`

This guide explains every place this backend stores data, what kind of data goes there, and where that data is used.

It also explains the current runtime state and what is still needed to move fully out of fallback mode.

## 1. Current status in this workspace

Checked on April 7, 2026.

Current state:

- Firebase now expects inline env credentials instead of a service-account JSON path.
- Firebase is still not enabled because `FIREBASE_STORAGE_BUCKET` and/or the inline Firebase credential env vars are empty.
- Pinecone is not enabled because `PINECONE_API_KEY` and `PINECONE_INDEX_HOST` are empty.
- Because of that, this backend is still storing data in local fallback files for contract artifacts, contract records, and vectors.

Important consequence:

- Firestore is not active yet.
- Firebase Storage is not active yet.
- Pinecone is not active yet.
- Local fallback storage is active.

## 2. Where the rulebook is stored

The rulebook is stored as a local JSON file here:

- `backend/data/rulebook.json`

How the path is configured:

- `RULEBOOK_PATH` in `backend/.env`
- parsed in `backend/config/env.js`
- loaded in `backend/services/insight.service.js`

The rulebook is not stored in Firestore, Firebase Storage, or Pinecone.

It is read directly from disk at service startup with:

```js
const rulebook = JSON.parse(fs.readFileSync(env.rulebookPath, 'utf-8'));
```

What it is used for:

- clause-specific recommendations
- fallback legal reasoning
- semantic answer guidance
- clause insight templates
- contract overview templates

## 3. High-level storage map

This project does not use one single database.

It uses different stores for different kinds of data:

1. Firebase Storage
   Used for raw files and extracted text artifacts.
2. Firestore
   Used for structured contract, clause, and risk records.
3. Pinecone
   Used for semantic vector storage and vector search.
4. Local filesystem fallback
   Used when Firebase Storage is unavailable.
5. Local JSON fallback
   Used when Firestore or Pinecone are unavailable.
6. Local rulebook JSON
   Used for rule-driven reasoning and fallback insight generation.

## 4. What each store contains

### A. Firebase Storage

Code path:

- `backend/config/firebase.js`
- `backend/services/storage.service.js`

Stores:

- raw uploaded contract files
- extracted text files

Storage paths:

- `contracts/raw/{contractId}/{fileName}`
- `contracts/derived/{contractId}/extracted.txt`

Used by:

- `uploadRawDocument()`
- `uploadExtractedText()`

Called from:

- `backend/services/contract.service.js`

Read usage:

- These artifact references are saved inside the contract record under `artifacts`.
- The backend does not currently implement a separate download/read service for these files.

### B. Firestore

Code path:

- `backend/config/firebase.js`
- `backend/services/contract.repository.js`

Stores:

- contract records
- clause records
- risk records

Collection layout:

```text
contracts/{contractId}
contracts/{contractId}/clauses/{clauseId}
contracts/{contractId}/risks/{riskId}
```

Used by:

- `saveContractBundleFirebase()`
- `listContractsFirebase()`
- `getContractByIdFirebase()`

Called from:

- `backend/services/contract.service.js`
- `backend/services/search.service.js` indirectly through contract detail lookup

What it stores:

- contract metadata
- artifact references
- text preview
- processing pipeline state
- structured clauses
- structured risks

### C. Pinecone

Code path:

- `backend/services/vector.service.js`

Stores:

- clause embeddings
- clause metadata used for semantic search

Namespace:

- `PINECONE_NAMESPACE`
- currently defaults to `contracts`

Used by:

- `upsertClauseVectors()`
- `querySimilarClauses()`

Called from:

- `backend/services/contract.service.js` during contract ingestion
- `backend/services/contract.service.js` during clause insight generation
- `backend/services/search.service.js` during semantic search

What is stored per vector:

- `id`
- `values`
- `metadata.contractId`
- `metadata.contractTitle`
- `metadata.clauseId`
- `metadata.clauseType`
- `metadata.riskLabel`
- `metadata.clauseText`
- `metadata.position`

### D. Local filesystem fallback

Code path:

- `backend/services/storage.service.js`

Stores:

- raw uploaded files
- extracted text files

Actual local paths:

- `backend/tmp/raw/{contractId}/{fileName}`
- `backend/tmp/derived/{contractId}/extracted.txt`

Used when:

- Firebase Storage is disabled
- or Firebase Storage upload fails

### E. Local JSON fallback for structured contract data

Code path:

- `backend/services/contract.repository.js`
- `backend/utils/jsonStore.js`

Stores:

- full contract bundle in one JSON file

Actual local path:

- `backend/tmp/local-store/contracts.json`

Used when:

- Firestore is disabled
- or Firestore write/read fails

What is stored:

- full `contract`
- full `clauses`
- full `risks`

### F. Local JSON fallback for vectors

Code path:

- `backend/services/vector.service.js`
- `backend/utils/jsonStore.js`

Actual local path:

- `backend/tmp/local-store/vectors.json`

Used when:

- Pinecone is disabled
- or Pinecone request fails

Stores:

- vector values
- vector metadata

It is later read back for local semantic search.

### G. Local rulebook JSON

Code path:

- `backend/services/insight.service.js`

Actual local path:

- `backend/data/rulebook.json`

Used when:

- building fallback clause insights
- building fallback contract overviews
- building fallback semantic search answers
- supplementing AI-generated answers with grounded defaults

## 5. End-to-end data flow during contract upload

Main endpoint:

- `POST /api/contracts/upload`

Related route/controller:

- `backend/routes/contract.routes.js`
- `backend/controllers/contract.controller.js`

Flow:

1. `multer.memoryStorage()` keeps the uploaded file in memory.
2. `ingestManualContract()` creates a new `contractId`.
3. `uploadRawDocument()` stores the original file.
   - Firebase Storage if enabled
   - otherwise local `tmp/raw`
4. `extractTextFromDocument()` extracts text from PDF, image, or plain text input.
5. `uploadExtractedText()` stores the extracted text.
   - Firebase Storage if enabled
   - otherwise local `tmp/derived`
6. `analyzeContractText()` generates clause/entity analysis.
   - Python ML service if available
   - otherwise local heuristic fallback
7. `buildContractMetadata()`, `buildClauseRecords()`, and `buildRiskRecords()` build structured objects.
8. `createVectorRecords()` creates embedding records.
9. `upsertClauseVectors()` stores vectors.
   - Pinecone if enabled
   - otherwise local `vectors.json`
10. `saveContractBundle()` stores structured contract data.
   - Firestore if enabled
   - otherwise local `contracts.json`
11. `generateContractOverview()` creates user-facing insights.
   - Gemini if enabled
   - otherwise rulebook/template fallback

## 6. Read/query flows

### A. List contracts

Endpoint:

- `GET /api/contracts`

Reads from:

- Firestore if enabled
- otherwise `backend/tmp/local-store/contracts.json`

Code:

- `listContracts()`
- `listContractsFirebase()`
- `listContractsLocal()`

### B. Get one contract

Endpoint:

- `GET /api/contracts/:contractId`

Reads from:

- Firestore if enabled
- otherwise `backend/tmp/local-store/contracts.json`

Code:

- `getContractById()`
- `getContractByIdFirebase()`
- `getContractByIdLocal()`

### C. Clause insight generation

Endpoints:

- `GET /api/contracts/:contractId/insights`
- `POST /api/contracts/:contractId/insights`

Reads from:

- contract store: Firestore or local `contracts.json`
- vector store: Pinecone or local `vectors.json`
- rulebook: `backend/data/rulebook.json`

Code path:

- `buildContractInsights()`
- `getContractById()`
- `embedText()`
- `querySimilarClauses()`
- `generateClauseInsight()`

### D. Semantic search

Endpoint:

- `POST /api/search/semantic`

Reads from:

- vector store: Pinecone or local `vectors.json`
- optional contract store: Firestore or local `contracts.json`
- rulebook: `backend/data/rulebook.json`

Code path:

- `runSemanticSearch()`
- `embedText()`
- `querySimilarClauses()`
- `buildSemanticAnswer()`

## 7. Where generated insights are stored

This is an important distinction:

- contract records are stored
- vectors are stored
- raw and extracted artifacts are stored
- generated overview/insight text is mostly returned in API responses and not persisted as its own database record

In practice:

- the `pipeline` and `artifacts` metadata are persisted
- the real-time reasoning result returned by `generateContractOverview()` or `generateClauseInsight()` is not saved as a separate collection/document in the current code

## 8. What is not in a database

These parts are file/env based, not database-backed:

- rulebook: `backend/data/rulebook.json`
- Firebase credentials: `backend/.env`
- Google connector secrets and refresh token: `backend/.env`
- Pinecone credentials: `backend/.env`
- Gemini credentials/config: `backend/.env`

## 9. Current fallback files already being used

This workspace already contains fallback data under:

- `backend/tmp/raw/`
- `backend/tmp/derived/`
- `backend/tmp/local-store/contracts.json`
- `backend/tmp/local-store/vectors.json`

That is the live evidence that the backend has been storing processed data locally instead of Firebase/Pinecone.

## 10. What you need to leave fallback mode

### Firebase

Firebase will only turn on when both of these are true:

1. credentials are available
2. `FIREBASE_STORAGE_BUCKET` is set

What is still missing:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`

Once that bucket is set and the backend is restarted:

- raw files should go to Firebase Storage
- extracted text should go to Firebase Storage
- contract metadata should go to Firestore

### Pinecone

Pinecone will turn on only when both are set:

- `PINECONE_API_KEY`
- `PINECONE_INDEX_HOST`

Once those are present:

- clause vectors will go to Pinecone instead of `backend/tmp/local-store/vectors.json`

## 11. Minimal target architecture if everything is enabled

If you finish the missing config, the intended architecture becomes:

- Firebase Storage
  stores raw files and extracted text
- Firestore
  stores contracts, clauses, and risks
- Pinecone
  stores clause vectors for semantic search
- Local rulebook JSON
  remains on disk for fallback/domain guidance
- Local `tmp/`
  becomes mostly fallback/debug storage instead of the primary data layer

## 12. Quick summary

- Rulebook is stored in `backend/data/rulebook.json`.
- Raw files and extracted text belong in Firebase Storage.
- Structured contract data belongs in Firestore.
- Semantic vectors belong in Pinecone.
- Right now the app is still using local fallback stores because Firebase Storage bucket config and Pinecone config are missing.
