# Pinecone Codebase Guide

This guide explains exactly how Pinecone is used in this backend, what it stores, how queries work, and how to create an index that matches this code.

## 1. What Pinecone is doing in this project

Pinecone is used only as a vector database.

It does not store:

- raw uploaded files
- extracted text files
- full contract records
- the rulebook

It does store:

- clause embedding vectors
- clause metadata used during semantic retrieval

So in this project:

- Firebase Storage is for file artifacts
- Firestore is for structured contract data
- Pinecone is for semantic vector search

## 2. Current runtime status

Right now in this workspace Pinecone is not enabled, because these env vars are empty:

- `PINECONE_API_KEY`
- `PINECONE_INDEX_HOST`

That means the code is currently using the local fallback vector store:

- `backend/tmp/local-store/vectors.json`

The health endpoint reports Pinecone state in:

- `GET /api/health`

and shows:

- `services.pinecone.enabled`
- `services.pinecone.mode`

## 3. Pinecone-related files in your code

Main files:

- `backend/services/vector.service.js`
- `backend/services/embedding.service.js`
- `backend/utils/hashEmbedding.js`
- `backend/utils/vectorMath.js`
- `backend/services/contract.service.js`
- `backend/services/search.service.js`
- `backend/config/env.js`
- `backend/controllers/health.controller.js`

## 4. When Pinecone is used

Pinecone is controlled by this feature flag in `backend/config/env.js`:

```js
pinecone: Boolean(env.pineconeApiKey && env.pineconeIndexHost)
```

So Pinecone turns on only when both are set:

- `PINECONE_API_KEY`
- `PINECONE_INDEX_HOST`

If either is missing:

- vector upserts go to local JSON
- vector queries use local JSON search

## 5. What vectors your code creates

Vector creation starts in `backend/services/contract.service.js`.

During contract ingestion:

1. clauses are built
2. `createVectorRecords(contract, clauses)` runs
3. each clause is embedded with `embedText(clause.clauseText)`
4. the resulting records are sent to `upsertClauseVectors()`

The vector record shape is:

```js
{
  id: clause.id,
  values: embedding.values,
  metadata: {
    contractId: contract.id,
    contractTitle: contract.title,
    clauseId: clause.id,
    clauseType: clause.clauseType,
    riskLabel: clause.riskLabel,
    clauseText: clause.clauseText,
    position: clause.position,
  },
}
```

So Pinecone stores:

- vector id = clause id
- vector values = embedding array
- metadata = clause and contract lookup fields

## 6. How embeddings are generated

This project does not call OpenAI, Gemini embeddings, or Pinecone integrated embedding.

Instead, `backend/services/embedding.service.js` uses:

```js
createDeterministicEmbedding(text, env.embeddingDimension)
```

That function lives in `backend/utils/hashEmbedding.js`.

Important facts:

- embeddings are deterministic hash-based vectors
- default dimension is `128`
- vectors are normalized before returning
- the same text always produces the same vector

This means Pinecone is only storing vectors created by your code.

Very important concept:

- Pinecone is not improving or generating embeddings
- Pinecone is only indexing and retrieving the vectors you send it

So search quality depends heavily on your embedding function.

## 7. What Pinecone stores per item

Each upserted Pinecone item contains:

- `id`
- `values`
- `metadata.contractId`
- `metadata.contractTitle`
- `metadata.clauseId`
- `metadata.clauseType`
- `metadata.riskLabel`
- `metadata.clauseText`
- `metadata.position`

That metadata is important because:

- contract-specific search uses `contractId` filter
- UI/explanations use `clauseType`, `riskLabel`, and `clauseText`

## 8. Namespace usage

Your code sends every request with:

- `namespace: env.pineconeNamespace`

Default:

- `PINECONE_NAMESPACE=contracts`

This means:

- you do not need one Pinecone index per contract
- you do not need one namespace per contract
- the current code uses one shared namespace and filters by `contractId` when needed

## 9. Exact Pinecone API calls used by your code

This backend does not use the official Pinecone SDK.

It calls Pinecone over raw HTTP with `fetch()`.

### Upsert

`backend/services/vector.service.js` sends:

```text
POST {PINECONE_INDEX_HOST}/vectors/upsert
```

Headers:

- `Content-Type: application/json`
- `Api-Key: <PINECONE_API_KEY>`

Body:

```json
{
  "namespace": "contracts",
  "vectors": [
    {
      "id": "clause_...",
      "values": [ ... ],
      "metadata": {
        "contractId": "contract_...",
        "contractTitle": "...",
        "clauseId": "clause_...",
        "clauseType": "payment",
        "riskLabel": "low",
        "clauseText": "...",
        "position": 1
      }
    }
  ]
}
```

### Query

`backend/services/vector.service.js` sends:

```text
POST {PINECONE_INDEX_HOST}/query
```

Headers:

- `Content-Type: application/json`
- `Api-Key: <PINECONE_API_KEY>`

Body shape:

```json
{
  "namespace": "contracts",
  "vector": [ ... ],
  "topK": 5,
  "includeMetadata": true
}
```

If `contractId` is provided, it adds:

```json
{
  "filter": {
    "contractId": {
      "$eq": "contract_..."
    }
  }
}
```

## 10. How queries are used in your app

### A. During contract ingestion

After analysis:

- each clause gets embedded
- vectors are upserted to Pinecone

Code path:

- `ingestManualContract()`
- `createVectorRecords()`
- `upsertClauseVectors()`

### B. Clause insight lookup

When you ask for contract insights for a clause:

- the app embeds the selected clause text
- queries similar vectors
- builds reasoning from the matches

Code path:

- `buildContractInsights()`
- `embedText()`
- `querySimilarClauses()`
- `generateClauseInsight()`

Important nuance:

- `buildContractInsights()` passes the same `contractId` into the vector query
- so this specific insight flow searches within the same contract only
- it is not doing global cross-contract precedent search in that path

### C. Semantic search endpoint

Endpoint:

- `POST /api/search/semantic`

Code path:

- `runSemanticSearch()`
- `embedText(query)`
- `querySimilarClauses()`
- `buildSemanticAnswer()`

If `contractId` is omitted:

- search runs across the full Pinecone namespace

If `contractId` is supplied:

- search is filtered to one contract

## 11. Local fallback behavior

If Pinecone is unavailable, `backend/services/vector.service.js` falls back to:

- `backend/tmp/local-store/vectors.json`

Upserts:

- append/replace vector records in local JSON

Queries:

- load vectors from JSON
- optionally filter by `contractId`
- score results using:
  - cosine similarity
  - lexical overlap
  - clause type boost

This creates a very important difference:

- local fallback search is hybrid-ish
- Pinecone search in your current code is pure vector search

So results may differ between local fallback and Pinecone mode.

## 12. Best Pinecone index settings for this code

To match this code well, create:

- a dense index
- dimension `128`
- metric `cosine`

Why:

- your vectors are dense numeric arrays
- `EMBEDDING_DIMENSION` defaults to `128`
- local fallback uses cosine similarity
- your hash embeddings are normalized, so cosine is the clearest match

Important rule:

- the Pinecone index dimension must exactly match `EMBEDDING_DIMENSION`

If you change `EMBEDDING_DIMENSION` later:

- old vectors will no longer match the index dimension
- you will need a new index or a full re-ingest

## 13. How to create an index that works with this backend

Use one index for the whole app.

Recommended setup:

1. Create a new Pinecone dense index.
2. Set dimension to `128`.
3. Set metric to `cosine`.
4. Choose any region close to your backend deployment.
5. Wait until the index is ready.
6. Copy the index host value.

Then put these in `backend/.env`:

```env
PINECONE_API_KEY=your_api_key
PINECONE_INDEX_HOST=your_index_host
PINECONE_NAMESPACE=contracts
EMBEDDING_DIMENSION=128
```

Very important:

- `PINECONE_INDEX_HOST` should be the actual index host
- do not put the Pinecone console URL there
- do not put just the index name there

Your code expects a host because it directly calls:

- `/vectors/upsert`
- `/query`

If the host does not point at the real index endpoint, requests will fail.

## 14. What “works perfectly with our code” means here

For perfect compatibility with your current code, the safest choices are:

- one shared index
- namespace `contracts`
- dimension `128`
- metric `cosine`
- dense vectors
- metadata filtering enabled by normal Pinecone query behavior

You do not need:

- multiple indexes
- multiple namespaces per contract
- integrated embedding
- sparse vectors

## 15. Verification checklist after setup

After filling the env values:

1. Restart the backend.
2. Open `GET /api/health`.
3. Confirm:
   - `services.pinecone.enabled` is `true`
   - `services.pinecone.mode` is `pinecone`
4. Upload a contract through `/api/contracts/upload`.
5. Check the response pipeline/diagnostics.

Expected sign:

- vector indexing detail should say it indexed clause vectors via `pinecone`

Then test:

- `POST /api/search/semantic`

If Pinecone is working, vector retrieval should come from Pinecone instead of local JSON.

## 16. Important gotchas in your current code

### A. Pinecone does not generate embeddings for you

The actual semantic quality comes from:

- `backend/utils/hashEmbedding.js`

So if retrieval quality feels weak, Pinecone may be working correctly and the limitation may be the embedding strategy.

### B. Local fallback and Pinecone mode do not rank exactly the same way

Local fallback adds:

- lexical overlap scoring
- clause-type boost

Pinecone mode currently does not add those reranking signals after the query.

So even with the same underlying data, top matches can differ.

### C. Clause text may be shorter than the original clause

In the heuristic analysis path, some clause text is summarized before being embedded.

That means Pinecone may store:

- compact clause labels

instead of:

- the full original paragraph text

### D. Mixed-store mode is possible

Pinecone can be enabled while Firestore/Firebase are still disabled.

In that case:

- vectors go to Pinecone
- structured contracts still go to local JSON fallback

That is allowed by your code.

### E. Vector upsert happens before structured persistence

The ingestion flow upserts vectors before `saveContractBundle()`.

So in edge cases, vectors may exist in Pinecone even if structured contract persistence later falls back or fails.

## 17. Simple setup recommendation for your project

If you want the least confusing working setup, do this:

1. Keep `EMBEDDING_DIMENSION=128`
2. Create one dense Pinecone index with metric `cosine`
3. Put the real index host into `PINECONE_INDEX_HOST`
4. Set `PINECONE_API_KEY`
5. Leave `PINECONE_NAMESPACE=contracts`
6. Restart backend
7. Verify with `/api/health`
8. Upload one fresh contract to populate Pinecone

## 18. Short summary

- Pinecone in your app stores clause vectors, not documents.
- One vector is stored per clause.
- Vector values come from your local deterministic hash embedding code.
- The correct Pinecone index settings for this code are dense + 128 dimension + cosine metric.
- You only need one index and one namespace.
- The most important env value is the real Pinecone index host, not the index name.
