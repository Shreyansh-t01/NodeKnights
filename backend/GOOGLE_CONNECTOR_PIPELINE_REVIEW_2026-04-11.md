# Google Connector Pipeline Review

This file explains the current Gmail and Google Drive ingestion flow in this repo, what data enters the system, what the backend does with that data, what is missing right now, and how to make the pipeline automatic.

This review is based on the current code in:

- `backend/routes/connector.routes.js`
- `backend/controllers/connector.controller.js`
- `backend/controllers/googleOAuth.controller.js`
- `backend/services/googleAuth.service.js`
- `backend/services/googleTokenStore.service.js`
- `backend/services/drive.service.js`
- `backend/services/gmail.service.js`
- `backend/services/contract.service.js`
- `backend/services/documentExtraction.service.js`
- `backend/services/mlAnalysis.service.js`
- `backend/services/insight.service.js`
- `backend/services/contract.repository.js`

## 1. Current live status

When checked locally on April 11, 2026:

- Google connectors are configured and connected.
- The refresh token is being loaded from `backend/tmp/local-store/google-oauth.json`.
- The backend health endpoint reports Drive/Gmail connectors, Firestore, Supabase, Pinecone, Gemini, and the Python ML service as available.

That means your connector setup is ready enough for manual imports right now.

## 2. Current flow from Google OAuth to final insights

### A. Google OAuth setup flow

1. `GET /api/connectors/google/auth-url`
2. `googleOAuth.controller.js -> getGoogleAuthUrl()`
3. `googleAuth.service.js -> createGoogleAuthUrl()`
4. Google returns an auth URL with Drive and Gmail readonly scopes.
5. After consent, Google redirects to `GET /api/connectors/google/callback`
6. `handleGoogleCallback()` calls `exchangeGoogleAuthCode(code)`
7. Tokens are saved by `googleTokenStore.service.js -> saveGoogleTokens()`
8. The stored token file is `backend/tmp/local-store/google-oauth.json`

After this, `getOAuthClient()` can build an authenticated OAuth client for both Drive and Gmail imports.

### B. Google Drive import flow

Manual route:

- `POST /api/connectors/drive/import`

Code path:

1. `connector.routes.js`
2. `connector.controller.js -> importFromDrive()`
3. `drive.service.js -> importDriveFiles({ fileId, folderId, limit })`

Drive import behavior:

- If `fileId` is provided, one file is downloaded.
- If `folderId` is provided, the backend lists files in that folder.
- If neither is provided, it uses the first configured folder from `GOOGLE_DRIVE_FOLDER_IDS`.

Supported Drive types right now:

- PDF
- plain text
- PNG, JPEG, JPG, WEBP
- Google Docs documents

What happens for each file:

1. `downloadDriveFile(fileId)` fetches file metadata.
2. If the file is a Google Doc, it is exported as PDF.
3. A file-like object is built in memory:
   - `buffer`
   - `originalname`
   - `mimetype`
   - `externalId`
   - `sourceUrl`
4. That object is passed into `ingestManualContract(file, { source: 'google-drive', externalId })`

Important detail:

- The Drive service does fetch `externalId` and `sourceUrl`.
- The current ingestion pipeline does not persist that source identity in the final contract record.

### C. Gmail attachment import flow

Manual route:

- `POST /api/connectors/gmail/import`

Code path:

1. `connector.routes.js`
2. `connector.controller.js -> importFromGmail()`
3. `gmail.service.js -> importGmailAttachments({ query, maxResults })`

Gmail import behavior:

1. Gmail API lists messages using the provided query.
2. For each message, Gmail fetches the full message payload.
3. `collectAttachmentParts()` recursively finds supported attachments.
4. For each attachment, `downloadAttachment()` fetches the raw bytes.
5. A file-like object is built in memory:
   - `buffer`
   - `originalname`
   - `mimetype`
   - `externalId = messageId`
6. That object is passed into `ingestManualContract(file, { source: 'gmail-attachment', externalId: message.id })`

Supported Gmail attachment types right now:

- PDF
- plain text
- PNG, JPEG, JPG, WEBP

Important detail:

- Gmail attachment metadata such as sender, subject, received date, and attachment ID are not persisted into the contract record.
- If one email has multiple attachments, the current code uses the same `messageId` as `externalId` for all of them.

### D. Shared ingestion pipeline used by manual upload, Drive import, and Gmail import

Both Drive and Gmail reuse the exact same pipeline:

`ingestManualContract(file, options)`

That flow is:

1. Generate a new `contractId`
2. Store the raw file with `uploadRawDocument()`
3. Extract text with `extractTextFromDocument()`
4. Store extracted text with `uploadExtractedText()`
5. Analyze contract text with `analyzeContractText()`
6. Build contract metadata
7. Build clause records
8. Build risk records
9. Create clause embeddings
10. Upsert clause vectors into Pinecone
11. Save contract, clauses, and risks to Firestore
12. Build clause insights for high-risk clauses
13. Build the contract overview insight
14. Return the final payload

## 3. What data comes in and what the backend does with it

### A. From Drive

Data retrieved from Google:

- file ID
- file name
- MIME type
- web view link
- file bytes or exported PDF bytes

What the backend does with it:

- downloads the file into memory
- converts Google Docs into PDF
- sends the file buffer into the contract ingestion pipeline

What is currently lost:

- original Drive file ID after ingestion
- source URL after ingestion
- modified time
- revision information
- folder identity

### B. From Gmail

Data retrieved from Google:

- message ID
- attachment filename
- attachment MIME type
- attachment bytes

What the backend does with it:

- downloads the attachment into memory
- sends the file buffer into the contract ingestion pipeline

What is currently lost:

- Gmail attachment ID
- sender
- subject
- received time
- thread ID
- label state

### C. During document extraction

The file buffer is parsed by `documentExtraction.service.js`.

Behavior:

- PDF -> `pdf-parse`
- image -> `tesseract.js`
- anything else -> UTF-8 text conversion

Output:

- normalized extracted text
- extraction method
- optional page/confidence metadata

### D. During ML analysis

The extracted text is sent to `mlAnalysis.service.js`.

Behavior:

- first tries the Python ML service at `http://127.0.0.1:8001/analyze`
- if that fails, falls back to Node heuristics unless `REQUIRE_PYTHON_ML_SERVICE=true`

Output:

- entities
- clauses
- clause type labels
- clause risk labels
- summary

### E. During storage and indexing

The backend then:

- stores the raw document in Supabase or local storage
- stores extracted text in Supabase or local storage
- stores the structured contract record in Firestore or local JSON
- stores clause vectors in Pinecone or local vector JSON

### F. During insight generation

The backend then:

- selects up to 5 high-risk clauses
- retrieves precedent matches and rulebook matches
- generates clause insights
- generates the contract overview

Important detail:

- the ingestion flow does generate insights immediately
- but the repository save step only persists `contract`, `clauses`, and `risks`
- the generated `insights` object is returned in the API response, not stored as part of the saved contract bundle
- later, `GET /api/contracts/:contractId/insights` regenerates insights from stored contract data

## 4. What is working right now

The current pipeline is already good enough for manual imports:

- OAuth connection is working
- Drive file download is working
- Gmail attachment download is working
- extracted documents are analyzed through the same ingestion pipeline as manual uploads
- vectors are indexed
- risks are created
- high-risk clause insights are generated

So the basic connector pipeline is alive.

## 5. What you need to fix right now

These are the most important pipeline issues in priority order.

### 1. Persist source identity and source metadata

This is the biggest gap.

Right now Drive and Gmail fetch source identifiers, but `ingestManualContract()` throws that context away. That means:

- you cannot reliably know which contract came from which Drive file
- you cannot know which Gmail message created which contract
- you cannot build dedupe logic
- you cannot build continuous sync safely

What to add to the stored contract record:

- `sourceType`
- `sourceExternalId`
- `sourceUrl`
- `sourceFolderId`
- `messageId`
- `attachmentId`
- `subject`
- `from`
- `receivedAt`
- `modifiedTime`
- `revisionId` if available

Best place:

- extend `buildContractRecord()` and `buildContractMetadata()`
- pass connector metadata through `ingestManualContract(file, options)`

### 2. Add idempotency and duplicate prevention

Right now every import creates a brand new `contractId`.

So if you run the same Drive folder import twice, or the same Gmail query twice, the same file can be ingested again and again.

You need a stable source key.

Recommended source keys:

- Drive: `drive:{fileId}:{modifiedTime or revisionId}`
- Gmail: `gmail:{messageId}:{attachmentId}`

Before ingesting, check whether that source key already exists in Firestore.

### 3. Store sync checkpoints

Continuous sync is not possible without remembering where the last sync stopped.

Right now there is no saved checkpoint for:

- last processed Drive page token
- last processed Drive modified time
- last processed Gmail history ID
- last processed Gmail internal date

Add a new collection or JSON store such as:

- `connector_sync_state`

Suggested records:

- one document for Drive
- one document for Gmail

Each should store:

- connector name
- status
- last successful sync time
- last cursor or token
- last error
- counts for imported, skipped, failed

### 4. Move import work out of request-response routes

Right now `POST /api/connectors/drive/import` and `POST /api/connectors/gmail/import` do the whole job inline:

- download
- extract
- OCR
- ML analysis
- vector indexing
- Firestore save
- insight generation

That is okay for manual testing, but not for continuous automation.

You should move this into:

- a background worker
- or a scheduled job runner
- or a queue-based sync processor

Then the API route should enqueue a sync job instead of doing all work directly.

### 5. Persist or emit high-risk review results

Right now insights are generated, but they are not stored as first-class records.

For automation, you probably want at least one of these:

- save the generated insights under the contract
- save alert records for high-risk clauses
- send a notification when a new contract enters `review-required`

Without that, the contract is analyzed, but nothing actively surfaces the result unless the UI later asks for it.

### 6. Clean up `googleAuth.service.js`

This file has debugging leftovers and dead code:

- unused `createUrl`
- nested `createOAuth2Client`
- `console.log()` calls that print OAuth internals and token values
- references to `GOOGLE_CALLBACK_URL` even though the real env key in the app is `GOOGLE_REDIRECT_URI`

This does not block imports today, but it is confusing and unsafe.

### 7. Improve Gmail attachment identity

Right now every attachment from the same email inherits the same `externalId = messageId`.

That is not enough for dedupe if one email has:

- two PDFs
- a revised attachment with the same name
- multiple contract files

You should store:

- `messageId`
- `attachmentId`
- `filename`
- `threadId`

### 8. Consider practical format gaps

The current connectors only support:

- PDF
- text
- common images
- Google Docs export to PDF on the Drive side

If your contracts arrive as:

- DOCX
- scanned DOCX converted in email
- Google Sheets
- Word attachments from Gmail

then those are not fully handled by the current connector pipeline.

If DOCX matters for your users, add DOCX extraction soon.

### 9. Be aware of the current insight cap

Automatic clause insights currently run only for:

- high-risk clauses
- first 5 only

If a contract has 8 or 10 high-risk clauses, the extra ones will not get automatic insight cards in the ingestion response.

## 6. The easiest way to make Drive and Gmail ingestion automatic

The cleanest version is:

1. keep the current ingestion pipeline
2. add connector checkpoints and source identity
3. add a scheduler or worker
4. let the worker call the same ingestion path for only new items

That way you do not need to rewrite the core analysis code.

### Recommended automation design

#### Step 1. Create a sync state store

Add a place to store sync state, for example:

- Firestore collection: `connector_sync_state`

Example documents:

- `drive-default`
- `gmail-default`

Each document should contain:

- `connector`
- `enabled`
- `lastRunAt`
- `lastSuccessAt`
- `lastCursor`
- `lastError`
- `importedCount`
- `skippedCount`
- `failedCount`

#### Step 2. Add a source registry

Add a place to store processed source items, for example:

- Firestore collection: `source_ingestion_index`

Each record should contain:

- `sourceKey`
- `sourceType`
- `externalId`
- `attachmentId`
- `contractId`
- `status`
- `processedAt`

This prevents duplicate imports.

#### Step 3. Build background sync jobs

Create two jobs:

- `syncDriveContracts()`
- `syncGmailContracts()`

These jobs should:

1. load the sync checkpoint
2. fetch only new or changed source items
3. build a stable `sourceKey`
4. skip already processed items
5. ingest new files
6. save success or failure
7. update the checkpoint only after successful completion

#### Step 4. Use polling first

The easiest reliable first version is polling every few minutes.

Examples:

- every 5 minutes for Gmail
- every 10 minutes for Drive

This can run using:

- a Node cron scheduler
- a separate worker process
- a cloud scheduler hitting a protected sync endpoint

#### Step 5. Upgrade to event-driven later

After polling works, you can make it more real-time.

For Gmail:

- use `watch` with Google Pub/Sub
- then call `history.list` to fetch only changes after the saved `historyId`

For Drive:

- use `changes.getStartPageToken()`
- store the page token
- call `changes.list()` to fetch only new or changed files

This is better than re-scanning folders and re-running Gmail queries forever.

## 7. What the automatic pipeline should look like

### A. Automatic Drive sync

Desired flow:

1. scheduler triggers Drive sync
2. load saved Drive checkpoint
3. ask Drive for changed files since last checkpoint
4. filter to supported file types
5. build `sourceKey`
6. skip if already processed
7. download file
8. call ingestion pipeline
9. if high-risk clauses exist, save alert or notification
10. update Drive checkpoint

### B. Automatic Gmail sync

Desired flow:

1. scheduler triggers Gmail sync
2. load saved Gmail checkpoint
3. fetch new messages or changes since last checkpoint
4. collect supported attachments
5. build `sourceKey` using message plus attachment identity
6. skip if already processed
7. download attachment
8. call ingestion pipeline
9. if high-risk clauses exist, save alert or notification
10. update Gmail checkpoint

## 8. Minimal implementation plan

If you want the fastest path to a working automatic system, do it in this order:

1. Persist source metadata inside saved contract records.
2. Add a `source_ingestion_index` to prevent duplicate imports.
3. Add a `connector_sync_state` store.
4. Create a worker script that polls Drive and Gmail on an interval.
5. Reuse `ingestManualContract()` for the actual processing.
6. Store or emit high-risk alerts after ingestion.
7. Only after that, add Drive/Gmail change-based APIs for more efficient syncing.

## 9. Bottom line

Your current system is already capable of:

- pulling files from Drive
- pulling attachments from Gmail
- extracting text
- running ML analysis
- generating risks
- generating high-risk clause insights

What it is missing is not the analysis pipeline.

What it is missing is the automation layer:

- persistent source identity
- dedupe
- sync checkpoints
- background jobs
- stored alerts or stored insights

Once those are added, Gmail and Drive can become continuous ingestion sources instead of manual import buttons.
