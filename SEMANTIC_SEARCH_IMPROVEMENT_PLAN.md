# Semantic Search Improvement Plan

Date: 2026-04-10
Related analysis: `PROBLEM_STATEMENT_FIT_ANALYSIS.md`

## Purpose

This file explains how to fix the semantic-search-related weaknesses identified in `PROBLEM_STATEMENT_FIT_ANALYSIS.md`, one by one, in a practical implementation order.

Goal:

- make semantic search more relevant
- make retrieved results more useful to legal reviewers
- improve precedent retrieval quality
- make the answer layer grounded in better evidence
- prepare the search stack for larger document collections

## Current Search Weaknesses

These are the main semantic search weaknesses in the current app:

1. embeddings are deterministic hash vectors, not real semantic embeddings
2. search indexes shortened clause summaries instead of full clause text
3. precedent retrieval is often too narrow because search is scoped to one contract
4. retrieval has weak filtering because clause metadata is too thin
5. ranking logic is basic and does not rerank candidates deeply
6. answer generation is based on limited retrieved evidence
7. UI does not help the user control search scope or understand result quality
8. there is no formal relevance evaluation set, so search quality cannot be improved systematically
9. current fallback/local-store design is not ideal for large-scale search

## Target State

Your semantic search should eventually work like this:

1. ingest full documents
2. split them into strong clause/chunk units
3. store both full clause text and compact summaries
4. generate real semantic embeddings for the full clause/chunk text
5. retrieve across the whole corpus by default
6. filter by metadata like contract type, source, governing law, sport domain, date range, and risk
7. rerank top candidates using hybrid scoring
8. answer the user using multiple grounded matches and visible evidence
9. let the reviewer open the original document directly from each match
10. measure search quality with a fixed test set and improve from data

## Implementation Order

Do the steps in this order.

If you skip the order and jump straight to “better UI” or “better prompting,” the search will still feel weak because the retrieval base will remain weak.

---

## Step 1: Stop Losing Clause Meaning

### Problem

Right now the search layer mostly works on shortened clause text. That means retrieval is happening on compressed summaries, not the real clause language.

This is the single biggest reason search can feel shallow or irrelevant.

### What To Change

Store both:

- full clause text
- short clause summary

Use full clause text for embedding and retrieval.
Use short clause summary only for compact display.

### Files To Change

- `ML-model-main/ml-service/app/predictor.py`
- `ML-model-main/ml-service/app/utils.py`
- `backend/services/mlAnalysis.service.js`
- `backend/services/contract.helpers.js`
- `backend/services/contract.service.js`

### Exact Changes

#### In Python ML output

Change the clause payload from only:

```json
{
  "clause_text": "Payment of Rs. 50,000",
  "clause_type": "payment",
  "risk_label": "low"
}
```

to something like:

```json
{
  "clause_text_full": "The Sponsor shall pay Rs. 50,000 within 15 days of receipt of invoice...",
  "clause_text_summary": "Payment of Rs. 50,000",
  "clause_type": "payment",
  "risk_label": "low"
}
```

#### In Node fallback analysis

Do the same in `backend/services/mlAnalysis.service.js`.

Return both:

- `clauseTextFull`
- `clauseTextSummary`

#### In internal clause records

Update `buildClauseRecords(...)` in `backend/services/contract.helpers.js` so every clause record stores:

- `clauseTextFull`
- `clauseTextSummary`
- `clauseText`

Recommendation:

- keep `clauseText` temporarily for backward compatibility
- point it to `clauseTextSummary`
- use `clauseTextFull` for all future embedding/search logic

### Done Means Done

- every stored clause has both full and summary text
- search index is no longer built from only compressed clause summaries

---

## Step 2: Replace Hash Embeddings With Real Semantic Embeddings

### Problem

Current embeddings come from `backend/utils/hashEmbedding.js`, which is only a deterministic approximation. It is useful for demos, but it will not give high-quality legal semantic retrieval.

### What To Change

Replace the default embedding path with a real embedding provider.

Keep the hash embedding only as a development fallback.

### Files To Change

- `backend/services/embedding.service.js`
- `backend/utils/hashEmbedding.js`
- `backend/config/env.js`
- optionally create `backend/services/embeddingProvider.service.js`

### Exact Changes

#### Add provider switching

In `backend/config/env.js`, add fields like:

- `EMBEDDING_PROVIDER`
- `EMBEDDING_API_KEY`
- `EMBEDDING_MODEL`

#### Update `embedText(...)`

Current:

- always returns hash embedding

Target:

- if provider credentials exist, call a real embedding API
- otherwise fall back to hash embedding for local development

#### Keep the return shape stable

Still return:

```json
{
  "provider": "real-embedding-provider",
  "values": [...]
}
```

### Important Rule

Do not mix old hash vectors and new real vectors in the same index namespace.

When you switch providers:

- create a fresh namespace
- reindex all clauses

### Done Means Done

- search uses real embeddings in live mode
- fallback still works locally
- existing indexed clauses are re-embedded into a clean namespace

---

## Step 3: Change Indexing Granularity

### Problem

Even with good embeddings, retrieval will still be weak if each indexed unit is too short, too compressed, or badly split.

### What To Change

Index richer search units:

1. full clause records
2. long clauses split into semantic chunks
3. optional heading-aware sections

### Files To Change

- `ML-model-main/ml-service/app/utils.py`
- `backend/services/contract.service.js`
- `backend/services/vector.service.js`

### Exact Changes

#### Improve clause splitting

In `split_into_clauses(...)`, preserve stronger boundaries:

- numbered sections
- headings
- long paragraphs
- subclauses

#### For long clauses

If a clause is too long:

- split it into 2-4 chunks
- keep a shared `clauseId`
- assign a `chunkId`

#### Store search-unit metadata

For each vector record store:

- `contractId`
- `contractTitle`
- `clauseId`
- `chunkId`
- `clauseType`
- `riskLabel`
- `clauseTextFull`
- `clauseTextSummary`
- `position`
- `sectionHeading`

### Why This Helps

The search engine can then retrieve:

- precise narrow chunks for focused questions
- richer context for answer generation

### Done Means Done

- long clauses do not collapse into one weak vector
- retrieved results contain enough surrounding text to be useful

---

## Step 4: Add Corpus-Level Precedent Search

### Problem

Current semantic search often scopes retrieval to one contract. That is useful for local review, but weak for precedent search across a legal corpus.

### What To Change

Support two explicit search modes:

1. `contract` mode: search inside selected contract only
2. `corpus` mode: search across all indexed contracts

### Files To Change

- `backend/services/search.service.js`
- `backend/services/vector.service.js`
- `backend/controllers/search.controller.js`
- `frontend/src/components/SearchWorkbench.jsx`
- `frontend/src/pages/SearchPage.jsx`
- `frontend/src/App.jsx`

### Exact Changes

#### API payload

Expand the search request from:

```json
{
  "query": "...",
  "contractId": "...",
  "topK": 5
}
```

to:

```json
{
  "query": "...",
  "scope": "contract",
  "contractId": "...",
  "topK": 10,
  "filters": {}
}
```

#### Search service logic

In `runSemanticSearch(...)`:

- if `scope === 'contract'`, pass `contractId`
- if `scope === 'corpus'`, do not restrict by `contractId`

### Frontend

Add a search scope toggle:

- This Contract
- All Contracts

### Done Means Done

- user can intentionally run precedent search across the whole corpus
- semantic search is no longer trapped inside one document when broader precedent is needed

---

## Step 5: Add Better Metadata For Search Filters

### Problem

Search cannot become truly useful until it can filter results intelligently.

Right now metadata is too thin.

### What To Change

Expand contract and clause metadata.

### Files To Change

- `backend/services/contract.helpers.js`
- `backend/services/contract.service.js`
- `backend/services/vector.service.js`
- `frontend/src/components/SearchWorkbench.jsx`

### Add Metadata Fields

At minimum:

- `contractType`
- `source`
- `createdAt`
- `governingLaw`
- `effectiveDate`
- `counterparty`
- `riskLabel`
- `clauseType`

If you want sports-specific relevance later, also add:

- `sportType`
- `league`
- `team`
- `playerOrSponsor`
- `agreementFamily`

### Search Filters To Support

- clause type
- risk level
- source
- contract type
- date range
- governing law

### Backend Change

Update `queryPinecone(...)` to accept filter objects beyond only `contractId`.

### Done Means Done

- user can search “termination clauses in sponsor agreements”
- user can search “high-risk arbitration language across all contracts”

---

## Step 6: Add Hybrid Retrieval And Reranking

### Problem

Vector similarity alone is not enough. Legal search works better when semantic retrieval is combined with lexical overlap and metadata-aware reranking.

### What To Change

Use a two-stage ranking pipeline.

### Files To Change

- `backend/services/vector.service.js`
- optionally add `backend/services/rerank.service.js`

### Target Retrieval Flow

1. fetch a broad candidate set, for example top 30 by vector similarity
2. rerank them in application logic using:
   - semantic score
   - keyword overlap
   - clause-type alignment
   - metadata match
   - exact phrase boosts
3. return top 5-10 after reranking

### Suggested Score Formula

Example:

```text
finalScore =
  semanticScore * 0.50
  + lexicalScore * 0.20
  + phraseBoost * 0.10
  + clauseTypeBoost * 0.10
  + metadataBoost * 0.10
```

### Better Query Understanding

From the user query, detect:

- target clause type
- risk intent
- party/contract type hints

For example:

`show risky termination language in sponsorship deals`

should produce search hints like:

- `clauseType = termination`
- `riskBias = high`
- `contractTypeHint = sponsorship`

### Done Means Done

- search ranking improves even when the query wording is messy
- top results better match the legal intent of the question

---

## Step 7: Improve The Answer Layer

### Problem

Even good retrieval can feel weak if the answer only uses a top match and gives generic guidance.

### What To Change

Make the answer layer use multiple matches and expose evidence.

### Files To Change

- `backend/services/insight.service.js`
- `backend/services/search.service.js`
- `frontend/src/components/SearchWorkbench.jsx`

### Exact Changes

#### In `buildSemanticAnswer(...)`

Use:

- top 3-5 matches
- full clause text excerpts
- explicit contract titles
- explicit risk labels

Return richer result data like:

```json
{
  "answer": "...",
  "recommendations": ["..."],
  "supportingMatches": [...],
  "evidence": [
    {
      "contractTitle": "...",
      "clauseType": "...",
      "excerpt": "...",
      "score": 0.89,
      "whyMatched": ["termination language", "notice wording"]
    }
  ]
}
```

#### In frontend

Display:

- contract title
- clause type
- score
- excerpt
- open document link

### Done Means Done

- users can see why a result is relevant
- answer quality is grounded in visible evidence, not vague explanation

---

## Step 8: Make Search UI Useful For Reviewers

### Problem

Search UX is still too simple for real legal review.

### What To Change

Upgrade the workbench into a reviewer tool.

### Files To Change

- `frontend/src/components/SearchWorkbench.jsx`
- `frontend/src/pages/SearchPage.jsx`
- `frontend/src/App.jsx`

### Add These Controls

1. search scope toggle
2. filter chips or dropdowns
3. sort mode:
   - most relevant
   - highest risk
   - newest
4. open original document action
5. compare selected clauses action
6. evidence snippets with highlighted matched terms

### Add These Result Fields

- contract title
- clause type
- clause summary
- clause excerpt
- risk label
- score
- position
- source document button

### Done Means Done

- a reviewer can understand and act on results without leaving the page confused

---

## Step 9: Build A Search Evaluation Set

### Problem

Without a test set, you cannot know whether search actually improved.

### What To Change

Create a manual relevance dataset.

### New Files To Add

- `backend/data/search_eval_queries.json`
- `backend/scripts/evaluate-search.js`

### Dataset Format

Example:

```json
[
  {
    "query": "termination without notice",
    "expectedClauseTypes": ["termination"],
    "expectedContracts": ["Strategic Vendor Agreement"],
    "minRelevantInTop5": 3
  }
]
```

### Measure

Track:

- Precision@5
- Recall@10
- Mean reciprocal rank
- result diversity across documents

### Process

Every time you change:

- clause splitting
- embeddings
- reranking
- filters

run the evaluation script before merging.

### Done Means Done

- search quality is measured, not guessed

---

## Step 10: Reindex Existing Data Safely

### Problem

After changing clause schema or embeddings, the old vectors become stale.

### What To Change

Add a reindex script.

### New File To Add

- `backend/scripts/reindex-contracts.js`

### What The Script Should Do

1. read all stored contracts
2. rebuild clause search units
3. regenerate embeddings
4. upsert into a fresh vector namespace
5. log counts and failures

### Important Rule

Do not rely on old vectors after:

- changing embedding provider
- changing chunking logic
- changing indexed text source

### Done Means Done

- the live search index matches the current retrieval design

---

## Step 11: Prepare For Scale

### Problem

Search quality also breaks at scale if the storage and retrieval path is not built for larger corpora.

### What To Change

Move toward production search architecture.

### Priority Changes

1. make Pinecone the main live vector path
2. keep local vectors only for development
3. add pagination for contract listing
4. add background jobs for ingestion and indexing
5. separate document metadata search from vector retrieval

### Recommended Architecture Direction

- metadata/filter search in structured store
- semantic retrieval in vector store
- answer assembly in backend service layer

### Done Means Done

- search still performs well when the corpus grows

---

## Step 12: Add Clause Comparison On Top Of Search

### Problem

Users do not only want “similar clauses.” They want to compare them.

### What To Change

Add a compare workflow on top of retrieved results.

### New Capability

From search results, let the user select:

- current clause
- precedent clause

Then show:

- side-by-side text
- difference highlights
- risk difference
- recommended rewrite

### Files To Change

- `frontend/src/components/SearchWorkbench.jsx`
- new compare component, for example `frontend/src/components/ClauseComparePanel.jsx`
- `backend/services/insight.service.js`

### Done Means Done

- precedent search leads directly into legal comparison, not just list viewing

---

## Practical Execution Sequence

If you want the shortest path to a much better semantic search, do this exact sequence:

### Phase A: Highest impact

1. store `clauseTextFull` and `clauseTextSummary`
2. embed `clauseTextFull`
3. switch to a real embedding provider
4. reindex everything

### Phase B: Make retrieval actually useful

5. add search scope toggle: contract vs corpus
6. add metadata filters
7. add hybrid reranking
8. use top 3-5 matches in answer generation

### Phase C: Make it usable for reviewers

9. improve Search UI with filters, score, excerpts, and document links
10. add clause compare workflow

### Phase D: Make it reliable

11. add evaluation dataset and script
12. add reindex script
13. add background indexing for scale

## Recommended Schema Changes

## Clause Record

Change toward this internal shape:

```json
{
  "id": "clause_x",
  "contractId": "contract_x",
  "position": 4,
  "sectionHeading": "Termination",
  "clauseTextFull": "Either party may terminate this Agreement immediately upon...",
  "clauseTextSummary": "Termination without prior notice may occur on breach",
  "clauseType": "termination",
  "riskLabel": "high",
  "riskScore": 90,
  "tags": ["termination", "high"],
  "createdAt": "..."
}
```

## Vector Metadata

Change toward this vector metadata shape:

```json
{
  "contractId": "contract_x",
  "contractTitle": "Strategic Vendor Agreement",
  "contractType": "Sponsorship Agreement",
  "clauseId": "clause_x",
  "chunkId": "chunk_1",
  "clauseType": "termination",
  "riskLabel": "high",
  "sectionHeading": "Termination",
  "clauseTextSummary": "Termination without prior notice may occur on breach",
  "clauseTextFull": "Either party may terminate this Agreement immediately upon...",
  "governingLaw": "India",
  "source": "google-drive",
  "createdAt": "..."
}
```

## Search API Shape To Aim For

Suggested request:

```json
{
  "query": "show risky termination clauses in sponsor agreements",
  "scope": "corpus",
  "topK": 10,
  "filters": {
    "clauseTypes": ["termination"],
    "riskLabels": ["high", "medium"],
    "contractTypes": ["Sponsorship Agreement"]
  }
}
```

Suggested response:

```json
{
  "query": "...",
  "scope": "corpus",
  "matches": [
    {
      "id": "clause_x",
      "score": 0.91,
      "metadata": {
        "contractTitle": "Sponsor Deal 2026",
        "clauseType": "termination",
        "riskLabel": "high",
        "clauseTextSummary": "...",
        "clauseTextFull": "...",
        "position": 8
      }
    }
  ],
  "reasoning": {
    "answer": "...",
    "recommendations": ["..."],
    "supportingMatches": [...],
    "evidence": [...]
  }
}
```

## What To Implement First In Your Current Codebase

If I were changing this repo myself, I would start here:

1. `ML-model-main/ml-service/app/predictor.py`
   - return full and summary clause text
2. `backend/services/mlAnalysis.service.js`
   - normalize full and summary clause text from Python or fallback
3. `backend/services/contract.helpers.js`
   - store both fields in clause records
4. `backend/services/contract.service.js`
   - build vectors from full clause text
5. `backend/services/embedding.service.js`
   - add real embedding provider support
6. `backend/services/vector.service.js`
   - add filter support and reranking
7. `backend/services/search.service.js`
   - support `scope` and `filters`
8. `backend/services/insight.service.js`
   - answer from multiple grounded matches
9. `frontend/src/components/SearchWorkbench.jsx`
   - add filters, scores, excerpts, and document links

## Final Advice

If you want semantic search to feel genuinely relevant and useful, do not treat it as a prompt problem.

Your improvement stack should be:

1. better indexed text
2. better embeddings
3. better metadata
4. better retrieval and reranking
5. better answer grounding
6. better UI
7. better evaluation

That order matters.

If you fix only the last two, the search will still look smart sometimes but behave unreliably.
