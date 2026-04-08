# Pinecone Index Spec

Use this file when creating the Pinecone index for this backend.

## Exact index settings

- Index type: `Dense`
- Dimension: `128`
- Metric: `cosine`
- Namespace used by the app: `contracts`
- One shared index is enough for the whole app

## Why these values must match

The backend creates embeddings with:

```js
createDeterministicEmbedding(text, env.embeddingDimension)
```

The current code reads:

- `EMBEDDING_DIMENSION` from env
- default value: `128`
- `PINECONE_NAMESPACE` from env
- default value: `contracts`

If your Pinecone index dimension does not exactly match `EMBEDDING_DIMENSION`, vector upserts and queries will fail.

## Env values that must be set

Put these in `backend/.env`:

```env
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_HOST=your_real_index_host
PINECONE_NAMESPACE=contracts
EMBEDDING_DIMENSION=128
```

Important:

- `PINECONE_INDEX_HOST` must be the real Pinecone index host
- do not use only the index name
- do not use the Pinecone console page URL
- the code accepts either `https://...` or the bare host value

## What gets stored in Pinecone

The app stores one vector per clause.

Vector ID:

- `clause_<uuid>`

Stored metadata:

- `contractId`
- `contractTitle`
- `clauseId`
- `clauseType`
- `riskLabel`
- `clauseText`
- `position`

The upserted record shape is:

```json
{
  "id": "clause_...",
  "values": [0.123, -0.456],
  "metadata": {
    "contractId": "contract_...",
    "contractTitle": "Agreement",
    "clauseId": "clause_...",
    "clauseType": "payment",
    "riskLabel": "medium",
    "clauseText": "Payment shall be made within 30 days.",
    "position": 1
  }
}
```

## How queries work

The backend calls Pinecone over HTTP, not the Pinecone SDK:

- `POST {PINECONE_INDEX_HOST}/vectors/upsert`
- `POST {PINECONE_INDEX_HOST}/query`

Query body includes:

- `namespace`
- `vector`
- `topK`
- `includeMetadata: true`

If a contract-specific search is needed, the app adds this filter:

```json
{
  "filter": {
    "contractId": {
      "$eq": "contract_..."
    }
  }
}
```

## Matching checklist

Make sure all of these match your Pinecone setup:

1. Dense index
2. Dimension `128`
3. Metric `cosine`
4. Namespace `contracts`
5. Real index host copied into `PINECONE_INDEX_HOST`
6. Fresh contract upload after setup so vectors are actually inserted

## Important behavior in this codebase

- Pinecone is only the vector store
- embeddings are generated locally by the backend
- this project does not use integrated Pinecone embeddings
- if Pinecone is not configured, the app falls back to `backend/tmp/local-store/vectors.json`
- Pinecone becomes active only when both `PINECONE_API_KEY` and `PINECONE_INDEX_HOST` are set

## Quick verification after setup

1. Restart the backend
2. Call `GET /api/health`
3. Confirm `services.pinecone.enabled` is `true`
4. Confirm `services.pinecone.mode` is `pinecone`
5. Upload one contract
6. Confirm the upload response says clause vectors were indexed via `pinecone`
