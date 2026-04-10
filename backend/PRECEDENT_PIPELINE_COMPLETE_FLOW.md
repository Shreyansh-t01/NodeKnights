# Precedent Pipeline Complete Flow

Date: 2026-04-10

This file explains the complete precedent pipeline in this backend:

1. how precedent data enters the system
2. how rulebook / policy data enters the system
3. where both are stored
4. how a contract clause retrieves them later
5. how Gemini uses that context
6. what the final insight response contains

This is written against the current codebase, not as generic architecture.

---

## 1. Purpose Of The Pipeline

The precedent pipeline exists so that when a risky contract clause is reviewed, the system can combine three kinds of context:

1. the current clause from the uploaded contract
2. similar approved precedent clauses
3. relevant rules / policies / playbook guidance

That combined context is then sent to Gemini to produce grounded, actionable clause insight.

So the final review stack is:

- current clause
- best precedent clause
- additional precedent matches
- rule / policy benchmark matches
- Gemini-generated recommendation

---

## 2. Main Data Sources

The system uses three separate corpora.

### A. Live contract corpus

This is the contract currently being reviewed.

Stored in:

- Firestore collection: `contracts`
- Pinecone namespace: `contracts`

### B. Precedent corpus

This is your bank of approved historical clauses.

Stored in:

- Firestore collection: `precedents`
- Pinecone namespace: `precedents`

### C. Knowledge corpus

This is your benchmark guidance such as playbooks, policies, and rulebooks.

Stored in:

- Firestore collection: `knowledge_documents`
- Pinecone namespace: `knowledge`

These corpora are intentionally separate.

- contracts = what is under review
- precedents = comparison language
- knowledge = normative benchmark guidance

---

## 3. Entry Points Into The System

The backend exposes these routes from [server.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/server.js).

### Precedent routes

Defined in [precedent.routes.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/routes/precedent.routes.js):

- `POST /api/precedents/upload`
- `POST /api/precedents/entries`
- `GET /api/precedents`
- `GET /api/precedents/review/:contractId/:clauseId`
- `GET /api/precedents/:precedentId`

### Knowledge routes

Defined in [knowledge.routes.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/routes/knowledge.routes.js):

- `POST /api/knowledge/upload`
- `POST /api/knowledge/entries`
- `POST /api/knowledge/search`
- `GET /api/knowledge`
- `GET /api/knowledge/:knowledgeId`

### Contract insight routes

Defined in [contract.routes.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/routes/contract.routes.js):

- `GET /api/contracts/:contractId/insights`
- `POST /api/contracts/:contractId/insights`

This contract insight route is where precedent retrieval is actually used in review.

---

## 4. Config That Controls The Pipeline

Config is resolved in [env.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/config/env.js).

Important values:

- `PRECEDENT_COLLECTION`
- `KNOWLEDGE_COLLECTION`
- `PINECONE_CONTRACT_NAMESPACE`
- `PINECONE_PRECEDENT_NAMESPACE`
- `PINECONE_KNOWLEDGE_NAMESPACE`
- `STRICT_REMOTE_SERVICES`
- `GENAI_PROVIDER`
- `GEMINI_API_KEY`

Current intended defaults:

- Firestore collection `precedents`
- Firestore collection `knowledge_documents`
- Pinecone namespace `contracts`
- Pinecone namespace `precedents`
- Pinecone namespace `knowledge`

If `STRICT_REMOTE_SERVICES=true`, the backend should fail instead of silently relying on local fallback when remote services are required.

---

## 5. Precedent Ingestion Flow

Precedent ingestion is handled in [precedent.controller.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/controllers/precedent.controller.js) and [precedent.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/precedent.service.js).

There are two ingestion paths.

### Path A. Manual precedent entry

Route:

- `POST /api/precedents/entries`

Controller:

- `createPrecedentEntry`

Service function:

- `createPrecedentFromEntries(payload)`

### Exact flow

1. client sends JSON containing:
   - precedent title
   - metadata
   - one or more clauses
2. `createPrecedentFromEntries()` validates the payload
3. `buildManualClauseRecords()` normalizes each clause into a standard internal record
4. `buildPrecedentRecord()` creates the top-level precedent document
5. `buildVectorRecords()` creates Pinecone-ready vectors for each clause
6. `savePrecedentBundle()` writes:
   - top-level precedent document into Firestore
   - clause docs into `precedents/{precedentId}/clauses`
7. `upsertClauseVectors()` writes clause vectors into Pinecone namespace `precedents`
8. response returns:
   - precedent record
   - clause records
   - persistence diagnostics

### What gets stored per precedent clause

Each clause record includes:

- `id`
- `precedentId`
- `position`
- `clauseText`
- `clauseTextSummary`
- `clauseTextFull`
- `clauseType`
- `clauseLabel`
- `riskLabel`
- `riskScore`
- `sectionHeading`
- `contractType`
- `jurisdiction`
- `tags`

### What gets indexed in Pinecone

Each precedent vector includes metadata like:

- `corpusType: precedent_clause`
- `precedentId`
- `precedentTitle`
- `clauseId`
- `clauseType`
- `riskLabel`
- `clauseTextSummary`
- `clauseTextFull`
- `position`
- `sectionHeading`
- `contractType`
- `jurisdiction`
- `sourceType`
- `tags`

That metadata is what later makes retrieval explainable.

---

## 6. Precedent Document Upload Flow

Route:

- `POST /api/precedents/upload`

Controller:

- `uploadPrecedent`

Service function:

- `ingestPrecedentDocument(file, options)`

### Exact flow

1. user uploads PDF / text / image file
2. `extractTextFromDocument()` extracts plain text
3. `analyzeContractText()` splits the text into clauses and assigns:
   - clause type
   - risk label
4. `buildAnalyzedClauseRecords()` converts the analyzed clauses into precedent clause records
5. `buildPrecedentRecord()` creates the top-level precedent document
6. `savePrecedentBundle()` writes the precedent and clauses into Firestore
7. `buildVectorRecords()` creates vector payloads
8. `upsertClauseVectors()` writes them to Pinecone namespace `precedents`
9. response returns:
   - precedent document
   - clause list
   - extraction / analysis / persistence diagnostics

So even uploaded precedent files become clause-level searchable precedent records.

---

## 7. Knowledge / Rulebook Ingestion Flow

Knowledge ingestion is handled in [knowledge.controller.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/controllers/knowledge.controller.js) and [knowledge.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/knowledge.service.js).

Again there are two ingestion paths.

### Path A. Manual rule / policy entry

Route:

- `POST /api/knowledge/entries`

Controller:

- `createKnowledgeEntry`

Service function:

- `createKnowledgeFromEntries(payload)`

### Exact flow

1. client sends JSON containing:
   - document title
   - metadata
   - one or more rules
2. `buildManualChunkRecords()` converts each rule into a normalized chunk
3. `buildKnowledgeRecord()` creates the top-level knowledge document
4. `buildVectorRecords()` creates Pinecone-ready vectors
5. `saveKnowledgeBundle()` writes:
   - top-level knowledge document into Firestore
   - chunk docs into `knowledge_documents/{knowledgeId}/chunks`
6. `upsertClauseVectors()` writes chunk vectors into Pinecone namespace `knowledge`
7. response returns:
   - knowledge document
   - chunks
   - persistence diagnostics

### Path B. Rulebook / policy file upload

Route:

- `POST /api/knowledge/upload`

Controller:

- `uploadKnowledge`

Service function:

- `ingestKnowledgeDocument(file, options)`

### Exact flow

1. user uploads a PDF / TXT / image
2. `extractTextFromDocument()` extracts text
3. `buildTextChunkRecords()` splits the text into chunk records
4. `buildKnowledgeRecord()` creates the top-level knowledge document
5. `saveKnowledgeBundle()` writes the document and chunks into Firestore
6. `buildVectorRecords()` creates chunk vectors
7. `upsertClauseVectors()` indexes them into Pinecone namespace `knowledge`
8. response returns:
   - knowledge document
   - chunks
   - extraction and persistence diagnostics

### What each knowledge chunk stores

Knowledge chunks can include:

- `id`
- `knowledgeId`
- `position`
- `sectionTitle`
- `primaryClauseType`
- `clauseTypes`
- `primaryConcern`
- `benchmark`
- `recommendedAction`
- `textSummary`
- `textFull`
- `sourceType`
- `documentType`
- `organization`
- `jurisdiction`
- `league`
- `sport`
- `version`
- `status`
- `tags`

This is what later lets the system say not only "this looks risky" but also "this is the benchmark you should compare against."

---

## 8. Contract Ingestion Flow

Contract ingestion is handled in [contract.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/contract.service.js).

Main function:

- `ingestManualContract(file, options)`

### Exact flow

1. user uploads a contract through `POST /api/contracts/upload`
2. raw file is optionally stored through artifact storage
3. `extractTextFromDocument()` extracts text
4. `analyzeContractText()` creates:
   - clauses
   - entities
   - risk labels
5. `buildClauseRecords()` converts clauses into internal clause docs
6. `buildRiskRecords()` creates risk docs
7. `buildContractRecord()` creates the top-level contract doc
8. `saveContractBundle()` writes contract, clauses, and risks into Firestore
9. `createVectorRecords()` creates vectors for contract clauses
10. `upsertClauseVectors()` indexes them into Pinecone namespace `contracts`

Then the new precedent-aware path starts:

11. `buildAutomaticClauseInsights()` selects up to 5 high-risk clauses
12. for each such clause, `buildClauseReviewContext()` retrieves:
    - precedent matches
    - knowledge matches
13. `generateClauseInsight()` produces grounded clause insight
14. `generateContractOverview()` builds the top-level overview response

So precedent retrieval already participates during contract upload if high-risk clauses exist.

---

## 9. Retrieval Flow During Contract Insight Review

This is the most important runtime path.

Route:

- `GET /api/contracts/:contractId/insights`

Controller:

- `getInsights`

Service function:

- `buildContractInsights(contractId, clauseId)`

There are two branches.

### Branch A. No specific clause requested

If `clauseId` is not provided:

1. backend loads contract bundle from Firestore
2. `buildAutomaticClauseInsights()` picks up to 5 high-risk clauses
3. for each clause:
   - `buildClauseReviewContext()` runs
   - precedent matches are retrieved
   - rule matches are retrieved
   - Gemini insight is generated
4. `generateContractOverview()` returns:
   - headline
   - summary
   - next steps
   - clauseInsights array

### Branch B. One specific clause requested

If `clauseId` is provided:

1. backend loads the contract bundle
2. finds the clause inside that contract
3. `buildClauseReviewContext()` is called
4. `generateClauseInsight()` returns a single detailed clause insight object

This branch is useful when you want a focused clause-by-clause review.

---

## 10. How Precedent Retrieval Works

Precedent retrieval is implemented in:

- `findPrecedentMatchesForClause({ clause, topK })`

inside [precedent.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/precedent.service.js).

### Exact retrieval logic

1. take the current clause text:
   - prefer `clauseTextFull`
   - fallback to `clauseText`
2. generate embedding with `embedText()`
3. normalize the clause type
4. run primary retrieval in Pinecone namespace `precedents` with filter:
   - `clauseType = current clause type`
5. if not enough results are found, run fallback retrieval in the same namespace without that filter
6. merge the two result sets
7. normalize result objects into a clean shape for the rest of the pipeline

### Result shape

Each precedent match returned to the pipeline includes:

- `id`
- `score`
- `precedentId`
- `title`
- `clauseId`
- `clauseType`
- `riskLabel`
- `clauseTextSummary`
- `clauseTextFull`
- `sectionHeading`
- `contractType`
- `jurisdiction`
- `sourceType`

The best match becomes:

- `precedentClause`

The full ranked list becomes:

- `precedentMatches`

---

## 11. How Rule / Policy Retrieval Works

Rule retrieval is implemented in:

- `findRelevantKnowledge({ clause, topK })`

inside [knowledge.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/knowledge.service.js).

### Exact retrieval logic

1. take the current clause text
2. prepend clause type text to the query
3. generate embedding with `embedText()`
4. run targeted retrieval in Pinecone namespace `knowledge` using:
   - `primaryClauseType = current clause type`
5. if not enough results are found, run fallback retrieval without that filter
6. merge the matches
7. normalize the matches

### Result shape

Each knowledge match includes:

- `id`
- `score`
- `knowledgeId`
- `title`
- `chunkId`
- `sectionTitle`
- `sourceType`
- `documentType`
- `primaryClauseType`
- `clauseTypes`
- `primaryConcern`
- `benchmark`
- `recommendedAction`
- `textSummary`
- `textFull`
- `organization`
- `jurisdiction`
- `league`
- `sport`
- `version`
- `status`

The knowledge list becomes:

- `ruleMatches`

### Fallback behavior

If no remote knowledge match exists, [insight.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/insight.service.js) creates a fallback rule match from `backend/data/rulebook.json`.

So rule context never has to be empty.

---

## 12. How The Vector Layer Works

The shared vector functions live in [vector.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/vector.service.js).

Two core functions:

- `upsertClauseVectors(records, options)`
- `querySimilarClauses({ vector, topK, namespace, filters, queryText, excludeIds })`

### Why this matters

The same vector layer is used for:

- contract clause indexing
- precedent clause indexing
- knowledge chunk indexing
- precedent retrieval
- knowledge retrieval

### Retrieval scoring

Local fallback scoring combines:

- cosine similarity
- lexical overlap
- clause-type boost

Pinecone retrieval uses:

- namespace separation
- metadata filters
- vector similarity

The important architectural change is that retrieval is no longer one undifferentiated vector pool. It is split by namespace:

- `contracts`
- `precedents`
- `knowledge`

That keeps precedent retrieval grounded in precedent data and rule retrieval grounded in policy data.

---

## 13. How Review Context Is Built

The review context is constructed in:

- `buildClauseReviewContext(contract, clause)`

inside [contract.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/contract.service.js).

### Exact output

For one clause, it builds:

```json
{
  "currentClause": {},
  "precedentMatches": [],
  "precedentClause": {},
  "ruleMatches": []
}
```

### Meaning of each part

- `currentClause` = the clause from the live contract
- `precedentMatches` = top retrieved precedent clauses
- `precedentClause` = the first / best precedent match
- `ruleMatches` = retrieved benchmark rules or fallback rulebook match

This object is the bridge between retrieval and Gemini reasoning.

---

## 14. How Gemini Uses The Retrieved Data

Gemini reasoning is handled in [insight.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/insight.service.js).

Main functions:

- `generateClauseInsight(clause, reviewContext)`
- `generateContractOverview(contractBundle)`

### Clause prompt construction

`buildClauseInsightPrompt(clause, reviewContext)` serializes this context into the Gemini prompt:

- current clause
- precedent matches
- rule matches

The prompt explicitly tells Gemini:

- use only provided context
- do not invent facts
- explain comparison against precedent and benchmark guidance

### Contract overview prompt construction

`buildContractOverviewPrompt(contractBundle, fallback)` sends:

- contract metadata
- top risks
- clause insight targets
- current clause
- best precedent clause
- rule matches

This lets Gemini generate not only line-item advice but also a contract-level summary.

### Gemini output fields

For clause insight:

- `whyItIsRisky`
- `comparison`
- `recommendedChange`

For contract overview:

- `headline`
- `summary`
- `nextSteps`
- per-clause insight text

### Fallback behavior

If Gemini is unavailable:

- template clause insight is generated
- template overview is generated
- local rulebook fallback still works

So the pipeline still returns a usable result even without Gemini.

---

## 15. Final Clause Insight Shape

The final clause insight object returned by `generateClauseInsight()` contains both retrieval context and explanation text.

It includes:

- `clauseId`
- `clauseType`
- `riskLabel`
- `currentClause`
- `precedentClause`
- `precedentMatches`
- `ruleMatches`
- `whyItIsRisky`
- `comparison`
- `recommendedChange`

This is what powers the side-by-side UI.

So the final response is not just "AI text."
It is:

1. retrieved structured data
2. best precedent comparison
3. best benchmark guidance
4. Gemini explanation layered on top

---

## 16. Dedicated Precedent Review Route

There is also a direct precedent review route:

- `GET /api/precedents/review/:contractId/:clauseId`

This path uses:

- `getClausePrecedents(contractId, clauseId, topK)`

inside [precedent.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/precedent.service.js).

### What it does

1. loads the contract from Firestore
2. finds the selected clause
3. runs precedent retrieval only
4. returns:
   - current clause
   - precedent matches
   - top-level clause identifiers

This route is useful when you want precedent comparison without running the full insight-generation stack.

---

## 17. Firestore Storage Layout

### Precedents

```text
precedents/{precedentId}
precedents/{precedentId}/clauses/{clauseId}
```

### Knowledge

```text
knowledge_documents/{knowledgeId}
knowledge_documents/{knowledgeId}/chunks/{chunkId}
```

### Contracts

```text
contracts/{contractId}
contracts/{contractId}/clauses/{clauseId}
contracts/{contractId}/risks/{riskId}
```

This layout keeps the corpora independent but still easy to join in the review layer.

---

## 18. Pinecone Layout

### Namespaces

- `contracts`
- `precedents`
- `knowledge`

### Why separate namespaces matter

Without namespace separation, a risky contract clause could retrieve:

- another live contract clause when you wanted an approved precedent
- a rule chunk when you wanted a clause precedent

With separate namespaces:

- contract search stays in `contracts`
- precedent search stays in `precedents`
- rule search stays in `knowledge`

This is what makes the pipeline clean and reliable.

---

## 19. End-To-End Example

Imagine a current contract contains this clause:

> The company may terminate immediately without notice.

### Step 1. Contract analysis

The contract pipeline marks it as:

- `clauseType = termination`
- `riskLabel = high`

### Step 2. Precedent retrieval

The backend searches `precedents` and finds:

> Either party may terminate for material breach after 30 days written notice and an opportunity to cure.

### Step 3. Rule retrieval

The backend searches `knowledge` and finds:

> Balanced termination clauses should include notice, cure period, and post-termination obligations.

### Step 4. Gemini reasoning

Gemini receives:

- current clause
- precedent match
- benchmark rule

### Step 5. Final output

It returns something like:

- `whyItIsRisky`: no notice or cure period
- `comparison`: weaker than approved precedent and below policy benchmark
- `recommendedChange`: add written notice, cure window, and clear post-termination obligations

That final output is then shown in the Insights UI.

---

## 20. Summary

The precedent pipeline is a combined storage + retrieval + reasoning system.

### Ingestion

- precedents enter through `/api/precedents/upload` or `/api/precedents/entries`
- knowledge enters through `/api/knowledge/upload` or `/api/knowledge/entries`

### Storage

- Firestore stores structured documents and child records
- Pinecone stores searchable vectors

### Retrieval

- live clause -> precedent matches from `precedents`
- live clause -> benchmark matches from `knowledge`

### Reasoning

- `reviewContext` is built from current clause + retrieved precedent + retrieved rules
- Gemini produces grounded insight text
- fallback template logic keeps the pipeline usable even if Gemini or remote rule matches are missing

### Final result

The system can show:

1. current clause
2. best precedent clause
3. policy benchmark
4. actionable insight

That is the full current precedent pipeline in this codebase.
