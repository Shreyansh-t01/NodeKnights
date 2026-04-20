# Pinecone Integrated Embedding Setup

Date: 2026-04-19

## What changed in the backend

The backend is now ready to use Pinecone integrated text indexing/search instead of Gemini-generated embeddings when:

- `EMBEDDING_PROVIDER=pinecone`
- `PINECONE_INDEX_HOST` points to a Pinecone index with integrated embedding enabled

The backend now expects Pinecone to:

- convert source text into vectors during upsert
- convert query text into vectors during search

If the remote Pinecone index is not ready yet, the backend falls back to the local deterministic vector store because `STRICT_REMOTE_SERVICES=false`.

## Required Pinecone index configuration

Create a new dense index with integrated embedding.

Important settings:

- vector type: `dense`
- metric: `cosine`
- integrated embedding: `enabled`
- field map: map `text` to `chunk_text`

Example shape:

```json
{
  "name": "your-integrated-index",
  "cloud": "aws",
  "region": "us-east-1",
  "embed": {
    "model": "multilingual-e5-large",
    "metric": "cosine",
    "field_map": {
      "text": "chunk_text"
    },
    "write_parameters": {
      "input_type": "passage"
    },
    "read_parameters": {
      "input_type": "query"
    }
  }
}
```

Any supported Pinecone hosted dense embedding model is fine. The backend does not hardcode the model name into requests, but `chunk_text` must match exactly.

## Metadata/filter fields to keep available

The backend filters and deletes by metadata, so if you use an explicit Pinecone schema, mark these fields as filterable:

- `corpusType`
- `contractId`
- `clauseId`
- `clauseType`
- `primaryClauseType`
- `riskLabel`
- `healthCheckId`

Helpful optional filterable fields:

- `precedentId`
- `knowledgeId`
- `sourceType`
- `status`

## Namespaces used by this backend

Keep these namespaces available in the same index:

- `contracts`
- `precedents`
- `knowledge`

The backend already writes to:

- `PINECONE_CONTRACT_NAMESPACE`
- `PINECONE_PRECEDENT_NAMESPACE`
- `PINECONE_KNOWLEDGE_NAMESPACE`

## Env values you need in the backend

These are the backend values expected now:

```env
EMBEDDING_PROVIDER=pinecone
PINECONE_INDEX_HOST=your_new_integrated_index_host
PINECONE_API_VERSION=2026-04
PINECONE_TEXT_FIELD=chunk_text
PINECONE_TEXT_UPSERT_BATCH_SIZE=96
PINECONE_CONTRACT_NAMESPACE=contracts
PINECONE_PRECEDENT_NAMESPACE=precedents
PINECONE_KNOWLEDGE_NAMESPACE=knowledge
PINECONE_INTEGRATED_MODEL=multilingual-e5-large
```

`PINECONE_INTEGRATED_MODEL` is optional in runtime logic. It is only used for metadata/reporting.

## Important operational note

If you keep using the old vector-only Pinecone index host, the new text upsert/search endpoints will fail and the backend will fall back locally.

So to make remote Pinecone fully active, you must:

1. create an integrated-embedding index
2. copy that new host into `PINECONE_INDEX_HOST`
3. restart the backend
4. reindex contracts / precedents / knowledge into the new index

## Bottom line

The backend code is ready.

The one infrastructure requirement is that your Pinecone host must now be an integrated dense index whose embedding field map uses:

- `text -> chunk_text`
