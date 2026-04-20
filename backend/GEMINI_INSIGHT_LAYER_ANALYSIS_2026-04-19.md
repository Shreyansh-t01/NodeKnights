# Gemini Insight Layer Analysis

Date: 2026-04-19

## Short Answer

For one fresh contract, Gemini is used in two different ways:

1. to generate insight text
2. to generate embeddings used for retrieval and vector indexing

The main insight path is not a single Gemini call. It is a small pipeline.

## Where Gemini Is Used

### 1. Text-generation layer

These are the main Gemini response entry points:

- `backend/services/insight.service.js:574` `generateContractOverview()`
- `backend/services/insight.service.js:614` `generateBatchClauseInsights()`
- `backend/services/insight.service.js:666` `generateClauseInsight()`
- `backend/services/insight.service.js:718` `buildSemanticAnswer()`

All of them go through:

- `backend/services/genAi.service.js:435` `generateStructuredObject()`
- `backend/services/genAi.service.js:251` `runGeminiRequest()`

That ultimately sends `generateContent` requests to Gemini.

### 2. Embedding layer

Gemini is also used here:

- `backend/services/embedding.service.js:309` `embedText()`
- `backend/services/embedding.service.js:352` `embedTexts()`

These embeddings are used:

- to build clause review context during insights
- to index contract clauses into Pinecone
- to support semantic search and retrieval

So even when Gemini is not writing text, it is still being used in the insight pipeline.

## Exact Contract Insight Flow

### A. During contract upload

Upload path:

- `backend/services/contract.service.js:258` `ingestManualContract()`

Inside that upload flow:

1. ML analysis runs first, not Gemini.
2. High-risk clause insight candidates are selected in `buildAutomaticClauseInsights()` at `backend/services/contract.service.js:110`.
3. For each high-risk clause, `buildClauseReviewContext()` at `backend/services/contract.service.js:81` does:
   - 1 Gemini query embedding
   - 3 Pinecone lookups:
     - precedents
     - comparable contracts
     - knowledge/rules
4. After contexts are built, `generateBatchClauseInsights()` makes 1 Gemini text-generation call for all high-risk clauses together.
5. `generateContractOverview()` makes 1 more Gemini text-generation call.
6. After that, `createVectorRecords()` at `backend/services/contract.service.js:35` calls `embedTexts()` to embed all saved clauses for indexing.

### B. When the frontend opens `/insights`

Frontend behavior:

- upload uses `api.uploadContract()` at `frontend/src/lib/api.js:110`
- then navigates to `/insights` at `frontend/src/App.jsx:956`
- then immediately calls `api.getContractInsights()` in `hydrateInsights()` at `frontend/src/App.jsx:693`

Backend route:

- `backend/routes/contract.routes.js:18`
- `backend/controllers/contract.controller.js:42`
- `backend/services/contract.service.js:470` `buildContractInsightsInternal()`

Important detail:

- if a reusable cached overview already exists, the backend returns it immediately at `backend/services/contract.service.js:474-479` behavior
- so this second frontend fetch is usually an extra backend roundtrip, but not an extra Gemini call

## How Many Gemini Requests One Contract Causes

Define:

- `H` = number of high-risk clauses, capped at 5
- `C` = total clause count in the contract
- `B` = embedding batch size, currently `20`

Current caps:

- high-risk clauses analyzed automatically: max `5`
- overview prompt includes only first `4` clause insights

### Fresh upload, cold cache

Direct insight-generation Gemini usage:

- `H` query-embedding requests
- `1` batch clause-insight text request, if `H > 0`
- `1` contract overview text request

So the direct Gemini insight count is:

- if `H = 0`: `1`
- if `H > 0`: `H + 2`

Additional Gemini usage in the same upload request:

- clause vector indexing: about `ceil(C / 20)` embedding requests

So total Gemini API calls during one fresh upload are roughly:

- if `H = 0`: `1 + ceil(C / 20)`
- if `H > 0`: `H + 2 + ceil(C / 20)`

### Example

If one contract has:

- `3` high-risk clauses
- `12` total clauses

Then a cold upload typically causes:

- `3` Gemini query embeddings for insight retrieval
- `1` Gemini batch clause-insight request
- `1` Gemini contract overview request
- `1` Gemini batch embedding request for clause indexing

Total: `6` Gemini API calls

Plus:

- `9` Pinecone retrieval queries
- `1` Pinecone upsert

## Why The Count Can Become Higher Than Expected

The Gemini text wrapper has fallback behavior:

- model candidates are built in `backend/services/genAi.service.js:37`
- actual configured response model list in `.env` is:
  - `gemini-2.5-flash`
  - `gemini-2.0-flash`
  - `gemini-2.0-flash-lite`

For one logical text-generation request, the backend may try:

- schema mode
- then plain-JSON fallback mode
- then move to the next model

Because of that, one logical overview or clause-insight call can expand into multiple HTTP calls if Gemini errors or returns invalid JSON.

Current `.env` helps a bit:

- `GENAI_MAX_RETRIES=0`

That means there are no same-model retries.

But model fallback still exists, so one logical text request can still fan out across multiple models.

## Current Caching And Deduping

There are several good protections already:

- exact Gemini response cache in `backend/services/genAi.service.js`
- in-flight dedupe in `pendingStructuredRequests`
- in-memory clause insight cache in `backend/services/insight.service.js`
- persisted contract-level cached insights in `contract.cachedInsights`
- in-flight dedupe for overview/clause insight requests in `pendingContractInsightRequests`

So repeated opens of the same contract usually should not re-hit Gemini if the cached insight is reusable.

## Main Problems In The Current Design

### 1. Query embeddings are not batched

`buildClauseReviewContext()` embeds each high-risk clause one by one.

That means up to 5 separate Gemini embedding calls just to build insight context.

This is the biggest avoidable Gemini request multiplier in the current insight path.

### 2. Upload and insight generation are tightly coupled

`ingestManualContract()` does all of this in one request:

- save contract
- generate clause insights
- generate overview
- build clause vectors

That makes uploads slower and makes Gemini/Pinecone problems feel like upload problems.

### 3. Frontend does one extra insights fetch after upload

After upload, the frontend already has `response.data.insights`, but it still navigates and re-fetches `/contracts/:id/insights`.

Usually this does not hit Gemini again because of cache, but it is still a duplicate backend request.

### 4. Overview generation is a separate Gemini call

Even after batch clause insights are ready, the system still makes another Gemini request for the overview headline/summary/next steps.

That is clean architecturally, but it adds one more generation call per contract.

### 5. Response fallback models are always present

Even if you clear `GEMINI_MODEL_CANDIDATES` in `.env`, the code still adds default fallback models in `genAi.service.js`.

So the backend is designed to try multiple Gemini models unless the code is changed.

## Best Ways To Reduce Gemini Usage

## Priority 1

Batch the high-risk clause query embeddings.

Instead of calling `embedText()` once per clause in `buildClauseReviewContext()`, build all missing high-risk clause query vectors with one `embedTexts()` call and pass those vectors into the review-context builder.

This changes:

- from up to `H` Gemini embedding calls
- to about `ceil(H / 20)` calls

With the current cap of 5 clauses, that usually means:

- from up to `5` calls
- down to `1`

## Priority 2

Stop re-fetching insights immediately after upload if upload already returned fresh insights.

The frontend can reuse the upload response first and only refresh later on manual reload, contract change, or explicit retry.

This reduces duplicate backend traffic and makes the UX feel faster.

## Priority 3

Move insight generation and vector indexing off the upload critical path.

Recommended pattern:

- save contract immediately
- return success immediately
- mark insights as `pending`
- generate Gemini insights in a background job
- update the contract card when ready

This is the cleanest fix for reliability.

## Priority 4

Consider making the contract overview deterministic or derived from clause insights.

If the overview can be built from:

- risk counts
- top risks
- already-generated clause insights

then you can remove one Gemini text-generation call per contract.

## Priority 5

Add real Gemini telemetry.

Right now the request count has to be inferred from code.

Add per-request logging around:

- `generateStructuredObject()`
- `postEmbeddingRequest()`

with:

- contractId
- clauseId
- label
- model
- mode
- cache hit or miss
- duration

That will let you measure the real call count instead of estimating it.

## Bottom Line

For one fresh contract, the direct Gemini insight path is usually:

- `H` query embeddings
- `1` batch clause insight generation
- `1` overview generation

And the same upload also adds:

- `ceil(C / 20)` Gemini embedding calls for clause indexing

So the biggest improvement is simple:

1. batch clause query embeddings
2. stop the immediate post-upload refetch
3. move insight generation and vector indexing to background jobs

Those three changes will cut request volume, reduce latency, and make the upload flow much more stable.
