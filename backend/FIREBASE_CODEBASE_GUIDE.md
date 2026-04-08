# Firebase Codebase Guide

Note as of April 8, 2026:

- the backend runtime now uses Firestore only
- Firebase Storage is no longer part of the active runtime path
- raw/extracted file artifacts are controlled separately by `ARTIFACT_STORAGE_MODE`
- artifact storage can be `disabled` or `local`

This file explains how Firebase is used in this backend, how Firestore and Firebase Storage are wired up, and what is currently happening in this workspace.

## 1. What Firebase is doing in this project

This backend uses the Firebase Admin SDK on the server side only.

- Firestore is used for structured contract data.
- Firebase Storage is used for file artifacts.
- The code falls back to local filesystem and local JSON storage if Firebase is not configured or if a Firebase call fails.

Important detail:

- There is no browser/client Firebase SDK setup in this backend.
- The server uses `firebase-admin`, which means it authenticates with inline service-account-style credentials from env vars.
- Admin SDK access is privileged server access, so it is not relying on end-user Firebase auth for these writes.

Main Firebase files:

- `backend/config/firebase.js`
- `backend/config/env.js`
- `backend/services/storage.service.js`
- `backend/services/contract.repository.js`
- `backend/controllers/health.controller.js`

## 2. Startup and initialization flow

Server startup begins in `backend/server.js`.

1. `dotenv` loads environment variables.
2. `backend/config/env.js` parses env values and builds feature flags.
3. `backend/config/firebase.js` tries to resolve Firebase credentials and initialize the Admin SDK.
4. The rest of the app imports the exported `firestore`, `storage`, and `firebaseStatus`.

Firebase initialization happens in `backend/config/firebase.js`:

- It imports:
  - `initializeApp`, `cert`, `getApps` from `firebase-admin/app`
  - `getFirestore` from `firebase-admin/firestore`
  - `getStorage` from `firebase-admin/storage`
- It resolves credentials only from inline env vars:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
- If credentials exist and the Firebase feature flag is enabled, it runs:
  - `initializeApp({ credential, projectId, storageBucket })`
  - `getFirestore(firebaseApp)`
  - `getStorage(firebaseApp)`

Exports from `backend/config/firebase.js`:

- `firebaseApp`
- `firestore`
- `storage`
- `firebaseStatus`

`firebaseStatus` is the app's public status object:

- `enabled`
- `mode`
- `message`

The health endpoint returns this object, so you can inspect Firebase state without digging through logs.

## 3. Environment variables used for Firebase

Firebase-related env parsing lives in `backend/config/env.js`.

Recognized variables:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`

How they are handled:

- `FIREBASE_PRIVATE_KEY` converts escaped newlines with `.replace(/\\n/g, '\n')`
- `featureFlags.firebase` becomes `true` only when:
  - `FIREBASE_STORAGE_BUCKET` is present
  - `FIREBASE_PROJECT_ID` is present
  - `FIREBASE_CLIENT_EMAIL` is present
  - `FIREBASE_PRIVATE_KEY` is present

That means this codebase treats Firebase as fully enabled only when both Storage bucket config and credentials exist.

## 4. Current local status in this workspace

Inspected on April 7, 2026.

Current safe observations from the workspace:

- Firebase is currently not enabled.
- The app reports fallback mode.
- `FIREBASE_STORAGE_BUCKET` is currently not set in the active env.
- Firebase now expects inline env credentials instead of a service-account JSON file path.

Why Firebase is currently falling back:

1. One or more inline Firebase credential env vars are still empty.
2. The storage bucket is not configured, so the Firebase feature flag is also off.

## 5. Firestore setup in this codebase

Firestore is created in `backend/config/firebase.js` with:

```js
firestore = getFirestore(firebaseApp);
```

The Firestore access layer is `backend/services/contract.repository.js`.

### What gets stored in Firestore

The repository stores contract analysis data in this structure:

```text
contracts/{contractId}
contracts/{contractId}/clauses/{clauseId}
contracts/{contractId}/risks/{riskId}
```

### Root contract document

The root document comes from `buildContractRecord()` in `backend/services/contract.helpers.js`.

It includes fields like:

- `id`
- `title`
- `source`
- `status`
- `metadata`
- `textPreview`
- `textLength`
- `artifacts`
- `pipeline`
- `createdAt`
- `updatedAt`

The `artifacts` object contains references to where the raw file and extracted text were stored.

### Clauses subcollection

Each clause document includes fields like:

- `id`
- `contractId`
- `position`
- `clauseText`
- `clauseType`
- `clauseLabel`
- `riskLabel`
- `riskScore`
- `extractedValues`
- `tags`
- `createdAt`

### Risks subcollection

Risk documents are generated only for medium/high risk clauses and include:

- `id`
- `contractId`
- `clauseId`
- `clauseType`
- `severity`
- `score`
- `title`
- `summary`
- `createdAt`

### How writes happen

`saveContractBundleFirebase()` performs a Firestore batch write:

1. Creates or overwrites `contracts/{contractId}`
2. Writes all clause docs under `clauses`
3. Writes all risk docs under `risks`
4. Commits the batch

So one contract ingestion becomes one grouped Firestore write transaction via batch commit.

### How reads happen

`listContractsFirebase()`:

- reads all documents from `contracts`
- maps `document.data()`
- sorts them in Node.js by `createdAt`

`getContractByIdFirebase(contractId)`:

1. reads `contracts/{contractId}`
2. reads `clauses` and `risks` subcollections in parallel
3. sorts clauses by `position`
4. sorts risks by descending `score`

### Firestore fallback

If Firebase is disabled or a Firestore call throws:

- writes fall back to `backend/tmp/local-store/contracts.json`
- reads also fall back to that JSON store

That fallback logic lives in the same repository file.

## 6. Firebase Storage setup in this codebase

Storage is created in `backend/config/firebase.js` with:

```js
storage = getStorage(firebaseApp);
```

The Firebase Storage access layer is `backend/services/storage.service.js`.

### Bucket selection

Uploads use:

```js
const bucket = env.firebaseStorageBucket
  ? storage.bucket(env.firebaseStorageBucket)
  : storage.bucket();
```

So the preferred setup is to provide `FIREBASE_STORAGE_BUCKET`.

### What gets stored in Firebase Storage

Two artifact types are stored:

1. Raw uploaded document
2. Extracted text file

### Raw document path

Raw uploads are stored at:

```text
contracts/raw/{contractId}/{sanitizedOriginalFileName}
```

The filename is sanitized by replacing non-word characters with `-`.

Metadata attached to the upload:

- `contractId`
- `source`
- `assetType: raw-document`

The returned artifact object looks like:

```js
{
  mode: 'firebase',
  path: 'contracts/raw/...',
  uri: 'gs://bucket-name/contracts/raw/...',
  bucket: 'bucket-name'
}
```

### Extracted text path

Extracted OCR/parsed text is stored at:

```text
contracts/derived/{contractId}/extracted.txt
```

Metadata attached to the upload:

- `contractId`
- `source`
- `assetType: extracted-text`

### Upload behavior

Uploads use `fileRef.save(payload, { resumable: false, contentType, metadata })`.

Important consequences:

- Uploads are simple direct saves, not resumable uploads.
- Custom metadata is nested under `metadata.metadata`.
- The app stores both binary buffers and plain text through the same helper.

### Storage fallback

If Firebase Storage is disabled or an upload throws:

- raw files fall back to `backend/tmp/raw/{contractId}/{fileName}`
- extracted text falls back to `backend/tmp/derived/{contractId}/extracted.txt`

The local directory creation is handled by `backend/utils/jsonStore.js`.

## 7. End-to-end request flow

The main upload endpoint is:

```text
POST /api/contracts/upload
```

Defined in `backend/routes/contract.routes.js`.

### Upload middleware

`backend/middlewares/upload.js` uses `multer.memoryStorage()`.

That means:

- uploaded files are kept in memory as `req.file.buffer`
- the backend does not first save the upload to disk before Firebase Storage upload
- allowed file types are pdf, txt, png, jpg, jpeg, webp

### Full ingestion flow

The main orchestration lives in `backend/services/contract.service.js`.

Flow:

1. Generate `contractId`
2. Upload the raw file through `uploadRawDocument()`
3. Extract text from the uploaded file
4. Upload the extracted text through `uploadExtractedText()`
5. Run contract analysis
6. Build contract metadata
7. Build clause records
8. Build risk records
9. Build the main contract record
10. Save the structured bundle through `saveContractBundle()`
11. Return the contract, clauses, risks, insights, and diagnostics

Firebase fits into this flow in two places:

- Firebase Storage stores the raw and derived file artifacts
- Firestore stores the structured contract bundle

## 8. Drive and Gmail imports also use Firebase

The connector controllers do not write to Firebase directly.

Instead:

- `backend/services/drive.service.js`
- `backend/services/gmail.service.js`

both eventually call:

```js
ingestManualContract(file, options)
```

That means Google Drive imports and Gmail attachment imports automatically reuse the same Firebase Storage and Firestore pipeline as manual uploads.

## 9. Health check for Firebase

The health endpoint is:

```text
GET /api/health
```

Implemented in `backend/controllers/health.controller.js`.

It returns:

```json
{
  "services": {
    "firebase": {
      "enabled": false,
      "mode": "fallback",
      "message": "..."
    }
  }
}
```

Use this endpoint after config changes to confirm whether the backend is using Firebase or local fallback.

## 10. How to enable Firebase in this repo

To make Firebase fully active in this project, fix the local configuration in this order:

1. Fill:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
2. Set `FIREBASE_STORAGE_BUCKET`.
3. Restart the backend.
4. Check `GET /api/health`.

Expected success result:

- `services.firebase.enabled` should be `true`
- `services.firebase.mode` should be `firebase`
- `services.firebase.message` should say Firebase Storage and Firestore are configured

## 11. Practical example of the current fix you likely need

Right now the strongest local fix looks like this:

- set `FIREBASE_PROJECT_ID`
- set `FIREBASE_CLIENT_EMAIL`
- set `FIREBASE_PRIVATE_KEY`
- set `FIREBASE_STORAGE_BUCKET`

Without the bucket, the Firebase feature flag stays off.

Without the inline env credentials, initialization falls back.

All four need to be right for this codebase to use Firebase end to end.

## 12. Important design notes and gotchas

- Firestore and Firebase Storage are enabled together through one feature flag.
- Firestore writes are simple and clean; there are no advanced queries or indexes in the current repository layer.
- Listing contracts currently fetches the whole `contracts` collection and sorts in memory.
- The storage layer stores artifacts first, then the repository stores structured metadata that references those artifacts.
- Because this is Admin SDK code, Firebase security rules are not the main control plane for these server writes.
- The backend currently has an empty `backend/.gitignore`, so be careful not to commit env files with live secrets accidentally.

## 13. Short summary

In this project:

- Firebase Storage holds uploaded contract files and extracted text artifacts.
- Firestore holds the analyzed contract record plus `clauses` and `risks` subcollections.
- The code is already wired correctly for both services.
- The app is currently using fallback storage locally because the inline Firebase env credentials and storage bucket are not fully set.
