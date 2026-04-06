# GenAI Layer Complete Flow

This file explains the complete current "GenAI layer" flow in this project: where data enters, which files touch it, which functions transform it, where it gets stored, and how search and insight responses are produced.

Update:

- if `GENAI_PROVIDER=gemini` and a valid Gemini API key is configured, `backend/services/insight.service.js` now sends contract overview, clause insight, and semantic-answer generation through Gemini
- if Gemini is not configured or the provider call fails, the backend falls back to the existing rulebook and template layer

## 1. What this project is actually doing today

The current backend can now use Gemini as the live external insight layer when configured.

What it does use today is:

1. Document parsing and OCR in Node.js
2. A Python ML microservice for contract analysis, with a Node fallback
3. Deterministic local embeddings for vector search
4. Pinecone or local JSON vector storage
5. Gemini-driven insight generation for overviews, clause guidance, and semantic answers when configured
6. Rulebook-driven template reasoning as the fallback path

So the current "GenAI layer" is really a mixed intelligence layer made of:

- ML classification and extraction
- vector retrieval
- template-based legal reasoning

Important truth:

- `backend/config/env.js` resolves Gemini-ready env values
- `backend/services/genAi.service.js` calls Gemini `generateContent`
- `backend/services/insight.service.js` uses Gemini for generated insight text when enabled
- the old rulebook path is still kept as a safe fallback

That means:

- the Python service remains the main model-backed contract analysis path
- insight text can now come from Gemini when configured
- embeddings are generated locally by hashing tokens, not by a hosted embedding model

## 2. Main directories involved

### Node backend

- `backend/server.js`
- `backend/routes/`
- `backend/controllers/`
- `backend/services/`
- `backend/utils/`
- `backend/config/`
- `backend/data/rulebook.json`

### Python ML service

- `ML-model-main/ml-service/app/main.py`
- `ML-model-main/ml-service/app/schemas.py`
- `ML-model-main/ml-service/app/predictor.py`
- `ML-model-main/ml-service/app/utils.py`
- `ML-model-main/ml-service/app/config.py`

### Local fallback storage directories created at runtime

By default these resolve under `backend/tmp/` because `TEMP_STORAGE_DIR` falls back to `path.resolve(projectRoot, 'tmp')`.

- `backend/tmp/raw/`
- `backend/tmp/derived/`
- `backend/tmp/local-store/contracts.json`
- `backend/tmp/local-store/vectors.json`

## 3. Entry points into the GenAI layer

There are 5 practical entry points.

### A. Manual upload

Route:

- `POST /api/contracts/upload`

Code path:

- `backend/server.js`
- `backend/routes/contract.routes.js`
- `backend/middlewares/upload.js`
- `backend/controllers/contract.controller.js -> uploadContract(...)`
- `backend/services/contract.service.js -> ingestManualContract(...)`

### B. Google Drive import

Route:

- `POST /api/connectors/drive/import`

Code path:

- `backend/routes/connector.routes.js`
- `backend/controllers/connector.controller.js -> importFromDrive(...)`
- `backend/services/drive.service.js -> importDriveFiles(...)`
- `backend/services/contract.service.js -> ingestManualContract(...)`

### C. Gmail attachment import

Route:

- `POST /api/connectors/gmail/import`

Code path:

- `backend/routes/connector.routes.js`
- `backend/controllers/connector.controller.js -> importFromGmail(...)`
- `backend/services/gmail.service.js -> importGmailAttachments(...)`
- `backend/services/contract.service.js -> ingestManualContract(...)`

### D. Contract insights

Routes:

- `GET /api/contracts/:contractId/insights`
- `POST /api/contracts/:contractId/insights`

Code path:

- `backend/controllers/contract.controller.js -> getInsights(...)`
- `backend/services/contract.service.js -> buildContractInsights(...)`
- `backend/services/insight.service.js`

### E. Semantic search

Route:

- `POST /api/search/semantic`

Code path:

- `backend/controllers/search.controller.js -> semanticSearch(...)`
- `backend/services/search.service.js -> runSemanticSearch(...)`
- `backend/services/embedding.service.js`
- `backend/services/vector.service.js`
- `backend/services/insight.service.js`

## 4. End-to-end flow for contract ingestion

This is the most important pipeline in the repo.

### Step 1. Express receives the request

File:

- `backend/server.js`

What happens:

- loads env with `dotenv`
- creates Express app
- mounts contract, connector, search, and health routes

Relevant route mount:

- `app.use(\`${env.apiPrefix}/contracts\`, contractRoutes);`
- default `API_PREFIX` is `/api`

### Step 2. Route selects upload handler

File:

- `backend/routes/contract.routes.js`

What happens:

- `router.post('/upload', upload.single('file'), uploadContract);`

This means the uploaded form-data field must be named `file`.

### Step 3. Multer loads the file into memory

File:

- `backend/middlewares/upload.js`

Functionality:

- uses `multer.memoryStorage()`
- allows these MIME types:
  - `application/pdf`
  - `text/plain`
  - `image/png`
  - `image/jpeg`
  - `image/jpg`
  - `image/webp`
- file size limit is `env.maxUploadSizeMb * 1024 * 1024`

Important data shape here:

- `req.file.buffer` contains the raw uploaded bytes
- `req.file.originalname` contains the original file name
- `req.file.mimetype` contains the detected MIME type

### Step 4. Controller passes file to service layer

File:

- `backend/controllers/contract.controller.js`

Function:

- `uploadContract(req, res)`

What it does:

- calls `ingestManualContract(req.file, { source: 'manual-upload' })`
- returns JSON response with the full processed payload

### Step 5. Core orchestration starts in `ingestManualContract(...)`

File:

- `backend/services/contract.service.js`

Function:

- `async function ingestManualContract(file, options = {})`

This is the main orchestration function for the whole intelligence pipeline.

It does these actions in order:

1. validate input file
2. generate `contractId`
3. store raw document
4. extract readable text
5. store extracted text
6. run analysis
7. build metadata
8. build normalized clause records
9. build risk records
10. build pipeline diagnostics
11. create embeddings for clauses
12. upsert vectors
13. persist structured contract bundle
14. generate contract overview insight
15. return final response

## 5. Raw document storage path

Files:

- `backend/services/contract.service.js`
- `backend/services/storage.service.js`
- `backend/config/firebase.js`
- `backend/config/env.js`
- `backend/utils/jsonStore.js`

### Called function chain

- `ingestManualContract(...)`
- `uploadRawDocument({ contractId, file, source })`
- either `uploadToFirebase(...)`
- or `saveLocally(...)`

### File responsibilities

#### `backend/services/storage.service.js`

Key functions:

- `sanitizeFileName(fileName)`
- `saveLocally(targetPath, content, encoding)`
- `uploadToFirebase(filePath, payload, contentType, metadata)`
- `uploadRawDocument({ contractId, file, source })`
- `uploadExtractedText({ contractId, text, source })`

### Firebase path if enabled

Raw file path:

- `contracts/raw/<contractId>/<safeName>`

Metadata sent along:

- `contractId`
- `source`
- `assetType: 'raw-document'`

### Local fallback path if Firebase is unavailable

Local file path:

- `backend/tmp/raw/<contractId>/<safeName>`

How local directory is created:

- `saveLocally(...)`
- `ensureDirectory(...)` from `backend/utils/jsonStore.js`
- `fs.mkdir(path.dirname(filePath), { recursive: true })`

## 6. Text extraction path

Files:

- `backend/services/contract.service.js`
- `backend/services/documentExtraction.service.js`

### Called function chain

- `ingestManualContract(...)`
- `extractTextFromDocument(file)`

### Main extraction dispatcher

File:

- `backend/services/documentExtraction.service.js`

Function:

- `extractTextFromDocument(file)`

Routing logic:

- if MIME type is `application/pdf` -> `extractFromPdf(file.buffer)`
- if MIME type starts with `image/` -> `extractFromImage(file.buffer)`
- otherwise -> decode as UTF-8 plain text

### PDF extraction

Functions:

- `extractFromPdf(buffer)`
- `normalizeText(text)`

Library used:

- `pdf-parse`

Behavior:

- supports two export shapes from `pdf-parse`
- first tries legacy function style
- then tries `PDFParse` class style
- normalizes the resulting text

Output example:

```json
{
  "text": "...normalized text...",
  "method": "pdf-parse-v1",
  "pages": 12
}
```

### Image extraction

Functions:

- `extractFromImage(buffer)`

Library used:

- `tesseract.js`

Output example:

```json
{
  "text": "...ocr text...",
  "method": "tesseract-ocr",
  "confidence": 86.3
}
```

### Plain text extraction

If the file is not PDF or image, Node does:

```js
file.buffer.toString('utf-8')
```

Output example:

```json
{
  "text": "...plain text...",
  "method": "plain-text"
}
```

### Validation after extraction

Still in `extractTextFromDocument(file)`:

- if text is missing or shorter than 20 characters, an `AppError(422)` is thrown

## 7. Extracted text storage path

Files:

- `backend/services/contract.service.js`
- `backend/services/storage.service.js`

### Called function chain

- `ingestManualContract(...)`
- `uploadExtractedText({ contractId, text, source })`

### Firebase path

- `contracts/derived/<contractId>/extracted.txt`

### Local fallback path

- `backend/tmp/derived/<contractId>/extracted.txt`

## 8. Contract analysis path

This is the part most people would think of as the AI or ML layer.

Files:

- `backend/services/contract.service.js`
- `backend/services/mlAnalysis.service.js`
- `backend/config/env.js`
- `backend/package.json`
- `ML-model-main/ml-service/app/main.py`
- `ML-model-main/ml-service/app/schemas.py`
- `ML-model-main/ml-service/app/predictor.py`
- `ML-model-main/ml-service/app/utils.py`
- `ML-model-main/ml-service/app/config.py`

### Called function chain from Node

- `ingestManualContract(...)`
- `analyzeContractText(extracted.text)`
- tries `analyzeWithMlService(text)`
- if that fails and fallback is allowed -> `analyzeLocally(text)`

## 9. Python ML service path

### Node side caller

File:

- `backend/services/mlAnalysis.service.js`

Function:

- `analyzeWithMlService(text)`

What it sends:

```json
{
  "text": "<extracted contract text>"
}
```

Destination:

- `POST ${env.mlServiceUrl}/analyze`
- default `ML_SERVICE_URL` is `http://127.0.0.1:8001`
- so the default target is `http://127.0.0.1:8001/analyze`

Default backend helper script:

- `backend/package.json -> npm run dev:ml`
- command: `python -m uvicorn app.main:app --app-dir ..\\ML-model-main\\ml-service --reload --port 8001`

### Python API entry

File:

- `ML-model-main/ml-service/app/main.py`

Functions:

- `root()`
- `analyze(request: AnalyzeRequest)`

What happens:

- FastAPI receives the request
- request body is validated by `AnalyzeRequest`
- `analyze_text(request.text)` is called

### Python request and response schema

File:

- `ML-model-main/ml-service/app/schemas.py`

Important classes:

- `AnalyzeRequest`
- `ClauseResult`
- `AnalyzeResponse`

### Python model and config bootstrap

File:

- `ML-model-main/ml-service/app/config.py`

Defines model locations:

- `NER_MODEL_PATH`
- `CLAUSE_MODEL_PATH`
- `RISK_MODEL_PATH`

Resolved paths:

- `models/ner`
- `models/clause_classifier/clause_model.pkl`
- `models/risk_detector/risk_model.pkl`

### Core Python analysis logic

File:

- `ML-model-main/ml-service/app/predictor.py`

Main functions:

- `predict_entities(text)`
- `predict_clause_type(clause_text)`
- `predict_risk(clause_text)`
- `analyze_text(text)`

#### Python startup behavior

At import time, the service tries to load:

1. spaCy NER model from `NER_MODEL_PATH`
2. fallback spaCy model `en_core_web_sm` if custom NER is unavailable
3. clause classifier from `CLAUSE_MODEL_PATH`
4. risk model from `RISK_MODEL_PATH`

If the clause or risk models are missing:

- clause typing falls back to keyword heuristics
- risk prediction falls back to keyword heuristics

#### `predict_entities(text)`

Behavior:

- runs spaCy NER
- keeps only:
  - `ORG`
  - `PARTY`
  - `LOCATION`
- also augments entities using regex helpers for:
  - money
  - dates
  - durations
  - percentages

Regex helpers come from:

- `ML-model-main/ml-service/app/utils.py`

#### `analyze_text(text)`

This is the real Python analysis pipeline:

1. `predict_entities(text)`
2. `split_into_clauses(text)`
3. for each clause:
   - `predict_clause_type(clause)`
   - `predict_risk(clause)`
   - `make_short_clause_text(clause_type, clause)`
4. keep only important clauses or high-risk clauses
5. return a JSON payload

Returned payload shape:

```json
{
  "entities": [
    { "text": "ABC Pvt Ltd", "label": "ORG", "start": 10, "end": 21 }
  ],
  "clauses": [
    {
      "clause_text": "Payment of Rs. 50,000",
      "clause_type": "payment",
      "risk_label": "low"
    }
  ],
  "summary": "Text analysis complete"
}
```

### Python helper logic that shapes the ML output

File:

- `ML-model-main/ml-service/app/utils.py`

Important functions:

- `normalize_text(text)`
- `is_heading_line(line)`
- `split_numbered_sections(text)`
- `split_long_chunk(chunk, max_sentences=2)`
- `split_into_clauses(text)`
- `extract_money(text)`
- `extract_dates(text)`
- `extract_duration(text)`
- `extract_percentages(text)`
- `clean_clause_text(text)`
- `make_short_clause_text(clause_type, raw_text)`

This file matters a lot because it decides:

- how raw contract text is chunked into clauses
- how regex-based values are extracted
- how long clauses are compressed into short clause summaries

Important architectural detail:

- the vector layer later embeds `clause_text`
- but Python returns a shortened clause summary, not the full raw clause text
- so vector storage is based on normalized summary text, not the entire clause paragraph

## 10. Node fallback analysis path

If the Python service is unavailable, Node uses heuristic analysis.

File:

- `backend/services/mlAnalysis.service.js`

Key functions:

- `collectMatches(regex, text, label)`
- `extractParties(text)`
- `splitIntoClauses(text)`
- `predictClauseType(clauseText)`
- `predictRisk(clauseText, clauseType)`
- `makeShortClauseText(clauseType, clauseText)`
- `analyzeLocally(text)`
- `analyzeWithMlService(text)`
- `analyzeContractText(text)`

### Fallback decision logic

Function:

- `analyzeContractText(text)`

Behavior:

1. try Python service
2. if it works -> return `source: 'python-ml-service'`
3. if it fails and `REQUIRE_PYTHON_ML_SERVICE=true` -> throw `503`
4. otherwise -> return local fallback analysis with `source: 'node-heuristic-fallback'`

### What local fallback returns

The fallback returns:

- `entities`
- `clauses`
- `summary`
- `source`

Important difference from Python path:

- Node fallback uses regex plus keyword heuristics only
- no real external model is involved

## 11. Metadata normalization path

Once analysis comes back, Node converts it into the app's internal contract records.

Files:

- `backend/services/contract.service.js`
- `backend/services/contract.helpers.js`

### Functions in `backend/services/contract.helpers.js`

- `formatClauseType(value)`
- `extractFileTitle(originalName)`
- `uniqueEntityTexts(entities, labels)`
- `riskWeight(riskLabel)`
- `inferContractType(clauses)`
- `summarizeRiskCounts(clauses)`
- `buildContractMetadata(...)`
- `buildClauseRecords(...)`
- `buildRiskRecords(...)`
- `buildContractRecord(...)`

### `buildContractMetadata(...)`

Consumes:

- extracted `analysis.entities`
- extracted `analysis.clauses`
- raw text length
- file metadata

Produces:

- title
- contractType
- parties
- dates
- durations
- monetaryValues
- percentages
- locations
- clauseTypes
- riskCounts
- textLength
- summary

### `buildClauseRecords(...)`

Transforms analyzed clauses into internal records with:

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

### `buildRiskRecords(...)`

Creates risk rows only for:

- `medium`
- `high`

Each risk record includes:

- `id`
- `contractId`
- `clauseId`
- `clauseType`
- `severity`
- `score`
- `title`
- `summary`

## 12. Embedding generation path

This is the vectorization path used for search.

Files:

- `backend/services/contract.service.js`
- `backend/services/embedding.service.js`
- `backend/utils/hashEmbedding.js`
- `backend/config/env.js`

### Called function chain

- `ingestManualContract(...)`
- `createVectorRecords(contract, clauses)`
- for each clause -> `embedText(clause.clauseText)`
- `createDeterministicEmbedding(text, env.embeddingDimension)`

### `backend/services/embedding.service.js`

Function:

- `embedText(text)`

Returned shape:

```json
{
  "provider": "deterministic-hash",
  "values": [0.01, -0.03, "..."]
}
```

### `backend/utils/hashEmbedding.js`

Function:

- `createDeterministicEmbedding(text, dimension = 128)`

What it does:

1. lowercases and trims text
2. splits text into tokens
3. hashes each token with SHA-256
4. projects hash bytes into a fixed numeric vector
5. sums contributions across tokens
6. normalizes the vector magnitude
7. rounds values to 6 decimal places

Important truth:

- this is not a real transformer embedding model
- it is a deterministic local approximation so vector infrastructure can work without external API keys

## 13. Vector record creation path

File:

- `backend/services/contract.service.js`

Function:

- `createVectorRecords(contract, clauses)`

For each clause it creates:

```json
{
  "id": "<clause.id>",
  "values": ["...embedding vector..."],
  "metadata": {
    "contractId": "<contract.id>",
    "contractTitle": "<contract.title>",
    "clauseId": "<clause.id>",
    "clauseType": "<clause.clauseType>",
    "riskLabel": "<clause.riskLabel>",
    "clauseText": "<clause.clauseText>",
    "position": 1
  }
}
```

Important detail:

- vectors are created from `clause.clauseText`
- and `clause.clauseText` is already the shortened clause summary produced by Python or Node heuristics

## 14. Vector storage path

Files:

- `backend/services/vector.service.js`
- `backend/utils/jsonStore.js`
- `backend/utils/vectorMath.js`
- `backend/config/env.js`

### Main functions

- `upsertClauseVectors(records)`
- `upsertPineconeVectors(records)`
- `upsertLocalVectors(records)`
- `querySimilarClauses({ vector, topK, contractId, queryText })`
- `queryPinecone(vector, topK, contractId)`
- `queryLocalVectors(vector, topK, contractId, queryText)`
- `tokenize(text)`
- `lexicalOverlapScore(queryText, clauseText)`
- `clauseTypeBoost(queryText, clauseType)`

### Pinecone path

If these are set:

- `PINECONE_API_KEY`
- `PINECONE_INDEX_HOST`

then `featureFlags.pinecone` becomes true and Node tries Pinecone first.

Upsert endpoint:

- `POST https://<pinecone-host>/vectors/upsert`

Query endpoint:

- `POST https://<pinecone-host>/query`

Namespace:

- `env.pineconeNamespace`
- default is `contracts`

### Local fallback path

If Pinecone is unavailable or errors, vectors are stored in:

- `backend/tmp/local-store/vectors.json`

This file is managed through:

- `readJsonFile(...)`
- `writeJsonFile(...)`

### Local query ranking logic

When local vector search is used, score is:

```text
cosineSimilarity(vector, item.values) * 0.55
+ lexicalOverlapScore(queryText, item.metadata.clauseText) * 0.35
+ clauseTypeBoost(queryText, item.metadata.clauseType)
```

That means local search does not rely only on vectors. It also uses:

- token overlap
- a clause-type keyword boost

## 15. Structured contract persistence path

Files:

- `backend/services/contract.service.js`
- `backend/services/contract.repository.js`
- `backend/config/firebase.js`
- `backend/utils/jsonStore.js`

### Called function chain

- `ingestManualContract(...)`
- `saveContractBundle({ contract, clauses, risks })`

### Firebase path

If Firebase is enabled:

- contract saved to Firestore document `contracts/<contractId>`
- clauses saved under `contracts/<contractId>/clauses/<clauseId>`
- risks saved under `contracts/<contractId>/risks/<riskId>`

### Local fallback path

If Firebase is unavailable:

- full bundle is appended to `backend/tmp/local-store/contracts.json`

Bundle structure:

```json
{
  "contract": { "...": "..." },
  "clauses": [{ "...": "..." }],
  "risks": [{ "...": "..." }]
}
```

## 16. Contract overview insight generation path

This is where the user-facing insight text is generated after ingestion.

Files:

- `backend/services/contract.service.js`
- `backend/services/insight.service.js`
- `backend/data/rulebook.json`

### Called function chain

- `ingestManualContract(...)`
- `generateContractOverview({ contract, clauses, risks })`

### `backend/services/insight.service.js`

Functions:

- `getRulebookEntry(clauseType = 'other')`
- `generateClauseInsight(clause, precedentMatches = [])`
- `generateContractOverview(contractBundle)`
- `buildSemanticAnswer({ query, matches, contract })`

### Rulebook loading

At module load time:

- `rulebook = JSON.parse(fs.readFileSync(env.rulebookPath, 'utf-8'))`

So this service reads:

- `backend/data/rulebook.json`

unless `RULEBOOK_PATH` points somewhere else.

### `generateContractOverview(contractBundle)`

Inputs:

- contract metadata
- clauses
- risks

Outputs:

- `headline`
- `summary`
- `topRiskItems`
- `nextSteps`
- `clauseInsights`

Important detail:

- if Gemini is configured, the overview text is generated through `backend/services/genAi.service.js`
- if Gemini is unavailable, Node falls back to the local template path

### `generateClauseInsight(clause, precedentMatches)`

Inputs:

- current clause
- similar clause matches from vector search
- matching rulebook entry for the clause type

Outputs:

- `clauseId`
- `clauseType`
- `riskLabel`
- `whyItIsRisky`
- `comparison`
- `recommendedChange`

The language is generated like this:

- primary path: Gemini uses the clause plus precedent context to generate grounded text
- fallback path: Node combines rulebook content, match count, top match score, and top match risk label

## 17. On-demand contract insight path

When the frontend asks for insights later, it does not rerun the whole ingestion pipeline.

Files:

- `backend/controllers/contract.controller.js`
- `backend/services/contract.service.js`
- `backend/services/contract.repository.js`
- `backend/services/embedding.service.js`
- `backend/services/vector.service.js`
- `backend/services/insight.service.js`

### Function chain

- `getInsights(req, res)`
- `buildContractInsights(contractId, clauseId)`
- `getContractById(contractId)`

Then it branches:

### Branch A. No `clauseId`

If no specific clause is requested:

- `generateContractOverview(contractBundle)` is returned directly

### Branch B. `clauseId` is provided

If a clause is requested:

1. find the clause in the stored bundle
2. embed `clause.clauseText`
3. call `querySimilarClauses(...)`
4. call `generateClauseInsight(clause, matches)`

Important detail:

- in this code path, `querySimilarClauses(...)` is called with the same `contractId`
- so precedent matching here is restricted to that contract unless this logic is changed

## 18. Semantic search path

This is the other major GenAI-like user path.

Files:

- `backend/controllers/search.controller.js`
- `backend/services/search.service.js`
- `backend/services/embedding.service.js`
- `backend/services/vector.service.js`
- `backend/services/contract.service.js`
- `backend/services/insight.service.js`

### Full function chain

- `POST /api/search/semantic`
- `semanticSearch(req, res)`
- `runSemanticSearch({ query, contractId, topK = 5 })`
- `embedText(query)`
- `querySimilarClauses({ vector, topK, contractId, queryText: query })`
- optional `getContractDetails(contractId)`
- `buildSemanticAnswer({ query, matches, contract })`

### What `runSemanticSearch(...)` returns

```json
{
  "query": "payment clause with penalty",
  "matches": [
    {
      "id": "clause_123",
      "score": 0.88,
      "metadata": {
        "contractId": "contract_123",
        "clauseType": "payment",
        "riskLabel": "medium",
        "clauseText": "Payment obligation tied to Rs. 50,000"
      }
    }
  ],
  "reasoning": {
    "answer": "...",
    "supportingMatches": [],
    "recommendations": []
  }
}
```

### How the final search answer text is generated

Function:

- `buildSemanticAnswer({ query, matches, contract })`

Logic:

1. if no matches -> return a fallback answer with canned recommendations
2. else take `matches[0]` as primary match
3. if Gemini is enabled, send the query plus retrieved match context to Gemini for grounded answer generation
4. otherwise load the rulebook entry for the primary clause type
5. build answer text from Gemini or the local fallback
6. return the real retrieved supporting matches plus practical recommendations

Important truth:

- semantic search answers can now be generated by Gemini when configured
- if Gemini is unavailable, they are assembled from retrieved metadata plus rulebook text

## 19. Data flow summary by file and function

This is the shortest full map.

### Entry and routing

- `backend/server.js`
  - mounts API routes
- `backend/routes/contract.routes.js`
  - routes upload and insight requests
- `backend/routes/connector.routes.js`
  - routes Google import requests
- `backend/routes/search.routes.js`
  - routes semantic search

### Controllers

- `backend/controllers/contract.controller.js`
  - `uploadContract`
  - `listContracts`
  - `getContract`
  - `getInsights`
- `backend/controllers/connector.controller.js`
  - `importFromDrive`
  - `importFromGmail`
- `backend/controllers/search.controller.js`
  - `semanticSearch`
- `backend/controllers/health.controller.js`
  - exposes current service modes and feature flags

### Core orchestration

- `backend/services/contract.service.js`
  - `ingestManualContract`
  - `createVectorRecords`
  - `buildContractInsights`
  - central coordinator for the full pipeline

### Connector auth

- `backend/services/googleAuth.service.js`
  - builds the Google OAuth client used by Drive and Gmail imports

### Storage and extraction

- `backend/services/storage.service.js`
  - stores raw files and extracted text
- `backend/services/documentExtraction.service.js`
  - extracts readable text from PDF, image, or plain text

### Analysis

- `backend/services/mlAnalysis.service.js`
  - calls Python ML service or Node fallback
- `ML-model-main/ml-service/app/main.py`
  - FastAPI entry
- `ML-model-main/ml-service/app/predictor.py`
  - actual Python analysis logic
- `ML-model-main/ml-service/app/utils.py`
  - clause splitting, regex extraction, clause summarization
- `ML-model-main/ml-service/app/config.py`
  - model file paths
- `ML-model-main/ml-service/app/schemas.py`
  - request and response validation

### Record building and persistence

- `backend/services/contract.helpers.js`
  - normalizes metadata, clauses, and risks
- `backend/services/contract.repository.js`
  - stores and retrieves contract bundles

### Embeddings and vector search

- `backend/services/embedding.service.js`
  - wraps embedding generation
- `backend/utils/hashEmbedding.js`
  - deterministic vector creation
- `backend/services/vector.service.js`
  - upsert and query vectors
- `backend/utils/vectorMath.js`
  - cosine similarity

### Reasoning layer

- `backend/services/insight.service.js`
  - generates overview, clause insight, and semantic answer text
- `backend/data/rulebook.json`
  - legal reasoning content used by templates

## 20. Connector-specific entry paths

The intelligence pipeline is reused for imports too.

### Google Drive

File:

- `backend/services/drive.service.js`
- `backend/services/googleAuth.service.js`

Main functions:

- `getDriveClient()`
- `listFilesInFolder(folderId, limit)`
- `downloadDriveFile(fileId)`
- `importDriveFiles({ fileId, folderId, limit })`

Data flow:

1. Drive API lists or downloads files
2. downloaded bytes are converted into a file-like object
3. that object is passed into `ingestManualContract(...)`

### Gmail

File:

- `backend/services/gmail.service.js`
- `backend/services/googleAuth.service.js`

Main functions:

- `getGmailClient()`
- `collectAttachmentParts(part, attachments)`
- `decodeBase64Url(value)`
- `downloadAttachment(gmail, messageId, attachment)`
- `importGmailAttachments({ query, maxResults })`

Data flow:

1. Gmail API lists messages
2. attachment metadata is extracted recursively
3. attachment bytes are downloaded
4. bytes are converted into a file-like object
5. that object is passed into `ingestManualContract(...)`

So Drive and Gmail do not have a separate AI pipeline. They reuse the exact same one.

## 21. Runtime switches that change the GenAI path

File:

- `backend/config/env.js`

### Variables that matter today

- `ML_SERVICE_URL`
  - where Node sends extracted text for Python analysis
- `REQUIRE_PYTHON_ML_SERVICE`
  - if true, Node will not fall back to local heuristics
- `TEMP_STORAGE_DIR`
  - where local raw files, text, contracts, and vectors are stored
- `EMBEDDING_DIMENSION`
  - size of the deterministic vector
- `RULEBOOK_PATH`
  - file used by the insight template layer
- `PINECONE_API_KEY`
  - enables Pinecone vector storage and query
- `PINECONE_INDEX_HOST`
  - Pinecone host
- `PINECONE_NAMESPACE`
  - Pinecone namespace

### Variables used for Gemini generation

- `GENAI_PROVIDER`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_BASE_URL`
- `GENAI_BASE_URL`
- `GENAI_API_KEY`
- `GENAI_MODEL`
- `GENAI_TIMEOUT_MS`
- `GENAI_TEMPERATURE`
- `GENAI_MAX_OUTPUT_TOKENS`
- `GENAI_THINKING_BUDGET`

Current usage reality:

- `backend/config/env.js` resolves Gemini-ready values
- `featureFlags.externalGenAi` decides whether external insight generation is active
- `backend/services/genAi.service.js` sends structured `generateContent` requests
- `backend/services/insight.service.js` uses Gemini for overview, clause insight, and semantic-answer text
- if the call fails, the backend falls back to the template path

## 22. What is generating the final text at each stage

This is the direct answer to which function and file are generating output.

### A. Contract analysis output

Generated by:

- primary path: `ML-model-main/ml-service/app/predictor.py -> analyze_text(text)`
- fallback path: `backend/services/mlAnalysis.service.js -> analyzeLocally(text)`

This stage generates:

- entities
- clause types
- risk labels
- clause summaries

### B. Embeddings

Generated by:

- `backend/services/embedding.service.js -> embedText(text)`
- `backend/utils/hashEmbedding.js -> createDeterministicEmbedding(text, dimension)`

This stage generates:

- numeric vectors for clauses and queries

### C. Contract overview insight text

Generated by:

- `backend/services/insight.service.js -> generateContractOverview(contractBundle)`

This stage generates:

- headline
- summary
- next steps
- clause insight list

### D. Clause-level insight text

Generated by:

- `backend/services/insight.service.js -> generateClauseInsight(clause, precedentMatches)`

This stage generates:

- why it is risky
- comparison text
- recommended change

### E. Semantic search answer text

Generated by:

- `backend/services/insight.service.js -> buildSemanticAnswer({ query, matches, contract })`

This stage generates:

- answer sentence
- supporting match list
- recommendations

### F. Rule content used in generated text

Read from:

- `backend/data/rulebook.json`

Loaded by:

- `backend/services/insight.service.js -> getRulebookEntry(...)`

## 23. One-line end-to-end chains

Manual upload path:

`server.js -> contract.routes.js -> upload.js -> contract.controller.js/uploadContract -> contract.service.js/ingestManualContract -> storage.service.js/uploadRawDocument -> documentExtraction.service.js/extractTextFromDocument -> storage.service.js/uploadExtractedText -> mlAnalysis.service.js/analyzeContractText -> Python main.py/analyze -> predictor.py/analyze_text OR Node analyzeLocally -> contract.helpers.js/build* -> embedding.service.js/embedText -> hashEmbedding.js/createDeterministicEmbedding -> vector.service.js/upsertClauseVectors -> contract.repository.js/saveContractBundle -> insight.service.js/generateContractOverview`

Semantic search path:

`server.js -> search.routes.js -> search.controller.js/semanticSearch -> search.service.js/runSemanticSearch -> embedding.service.js/embedText -> vector.service.js/querySimilarClauses -> insight.service.js/buildSemanticAnswer`

Clause insight path:

`contract.controller.js/getInsights -> contract.service.js/buildContractInsights -> contract.repository.js/getContractById -> embedding.service.js/embedText -> vector.service.js/querySimilarClauses -> insight.service.js/generateClauseInsight`

## 24. Final architectural conclusion

If you describe the current GenAI layer honestly, it is:

- an ingestion and analysis pipeline in Node
- a Python contract-analysis microservice for model-backed extraction and classification
- deterministic vector creation for retrieval
- Pinecone or local vector indexing
- Gemini-based insight generation when configured
- template and rulebook-based reasoning in Node as the fallback path

It is not yet:

- a real external embedding API integration
- a Gemini-based embedding pipeline

So the current intelligence stack is best described as:

- ML-assisted contract analysis
- retrieval-assisted matching
- Gemini-generated legal insights with template fallback
