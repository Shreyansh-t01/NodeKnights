# Precedent Review And Rulebook Ingestion Plan

Date: 2026-04-10

## Goal

This file explains how to implement:

1. side-by-side precedent review
2. ingestion of playbooks, rulebooks, and sports-organization-related rules

It is written against the current codebase, so the suggestions point to the actual files and extension points you already have.

## Executive Summary

To implement side-by-side precedent review properly, you need to add:

- a clause comparison workflow in the backend
- a compare panel in the frontend
- richer search result payloads
- direct links from semantic search results into comparison

To ingest playbooks, rulebooks, and sports rules properly, you need to add:

- a separate knowledge ingestion pipeline
- structured storage for policy/rule documents
- a vector index for rule passages
- a way to join rule knowledge with contract search and insight generation

Best implementation direction:

- keep contracts and rulebooks as separate corpora
- retrieve both during review
- show current clause, precedent clause, and rule benchmark together

## Current Starting Point In This Repo

The current app already gives you these building blocks:

- contract ingestion: `backend/services/contract.service.js`
- semantic search: `backend/services/search.service.js`
- vector retrieval: `backend/services/vector.service.js`
- reasoning layer: `backend/services/insight.service.js`
- existing static rulebook: `backend/data/rulebook.json`
- frontend search workspace: `frontend/src/components/SearchWorkbench.jsx`
- frontend insights workspace: `frontend/src/components/ContractInsightsPanel.jsx`

So you are not starting from zero. You already have:

- clause records
- precedent-like retrieval
- rulebook-based recommendations

What is missing is the review experience and the ingestion pipeline for external rules/playbooks.

---

## Part 1: Side-By-Side Precedent Review

## What The Feature Should Do

When a reviewer selects a clause from a contract, the system should show:

### Left side

- current clause text
- clause type
- risk label
- contract title

### Right side

- best precedent clause
- precedent contract title
- precedent clause type
- precedent risk label

### Bottom or side panel

- highlighted differences
- benchmark explanation
- recommended rewrite
- related rulebook/playbook guidance
- button to open the original source document

## Recommended User Flow

1. user opens a contract
2. user selects a clause
3. backend fetches top precedent matches
4. user clicks one match
5. compare page opens
6. app shows current clause vs precedent clause side by side
7. app also shows rule/playbook benchmark
8. user can open original documents if needed

## Changes Needed For Side-By-Side Review

## A. Backend Changes

### 1. Add a compare service

Create a new backend service, for example:

- `backend/services/precedent.service.js`

This service should:

- fetch the current contract
- fetch the target clause
- retrieve precedent matches across corpus
- return selected precedent clause
- optionally fetch rulebook/playbook guidance
- build a comparison payload

### Suggested functions

- `getClausePrecedents({ contractId, clauseId, topK, filters })`
- `compareClauseWithPrecedent({ contractId, clauseId, precedentClauseId })`
- `buildClauseComparison({ currentClause, precedentClause, ruleMatches })`

### 2. Add new routes

Add a new route file:

- `backend/routes/precedent.routes.js`

Suggested endpoints:

- `GET /api/precedents/:contractId/:clauseId`
- `POST /api/precedents/compare`

Suggested request for compare:

```json
{
  "contractId": "contract_x",
  "clauseId": "clause_a",
  "precedentClauseId": "clause_b"
}
```

### 3. Add a controller

Create:

- `backend/controllers/precedent.controller.js`

Suggested handlers:

- `listPrecedents`
- `comparePrecedent`

### 4. Extend the repository layer if needed

Right now `backend/services/contract.repository.js` supports:

- save contract bundle
- list contracts
- get contract by id

For comparison workflows, you may want repository helpers like:

- `getClauseById(contractId, clauseId)`
- `getContractsByIds(contractIds)`
- later: `getKnowledgeDocumentById(id)`

### 5. Improve vector metadata

Your vector metadata should already include:

- `contractId`
- `contractTitle`
- `clauseId`
- `clauseType`
- `riskLabel`
- `clauseTextFull`

To make side-by-side review better, add:

- `source`
- `position`
- `contractType`
- `sectionHeading`
- `documentId` or original contract id if you split chunks later

### 6. Add comparison reasoning

Extend `backend/services/insight.service.js` with something like:

- `generateClauseComparisonInsight(currentClause, precedentClause, ruleMatches)`

This should return:

- `whyCurrentIsRisky`
- `whyPrecedentIsStronger`
- `materialDifferences`
- `recommendedRewrite`

## B. Frontend Changes

### 1. Add a new route

Add a new app route like:

- `/precedents`
- or `/compare`

Update:

- `frontend/src/App.jsx`
- `frontend/src/components/AppNav.jsx`

### 2. Add a new page

Create:

- `frontend/src/pages/PrecedentReviewPage.jsx`

This page should:

- let the user choose a contract/clause
- show precedent matches
- open side-by-side review

### 3. Add new components

Recommended new components:

- `frontend/src/components/ClauseComparePanel.jsx`
- `frontend/src/components/PrecedentMatchList.jsx`
- `frontend/src/components/RuleBenchmarkPanel.jsx`

### 4. Extend Search UI

Current search results in `frontend/src/components/SearchWorkbench.jsx` are still lightweight.

Add:

- `Compare` button per supporting match
- `Open Document` button
- score display
- clause excerpt

### 5. Add compare state in App

In `frontend/src/App.jsx`, add state such as:

- `selectedClauseId`
- `selectedPrecedentClauseId`
- `precedentReview`
- `precedentPending`

### 6. Extend API helpers

In `frontend/src/lib/api.js`, add:

- `getClausePrecedents(contractId, clauseId, params)`
- `comparePrecedent(payload)`

## C. Comparison Rendering

### 1. Show full text, not only summary

Display:

- `clauseTextFull`

Keep summary only as label text if needed.

### 2. Show differences

Use a diff library for text comparison.

Recommended choices:

- `diff`
- `diff-match-patch`

What to show:

- additions
- removals
- missing notice language
- missing cure period
- missing caps / carve-outs / definitions

### 3. Show rule benchmark under the diff

Comparison should not only say “different.”

It should also say:

- what the playbook expects
- which side is closer to best practice

## Suggested Compare Response Shape

```json
{
  "currentClause": {
    "contractId": "contract_a",
    "contractTitle": "Sponsorship Agreement 2026",
    "clauseId": "clause_1",
    "clauseType": "termination",
    "riskLabel": "high",
    "clauseTextFull": "..."
  },
  "precedentClause": {
    "contractId": "contract_b",
    "contractTitle": "Broadcast Partner Agreement 2025",
    "clauseId": "clause_9",
    "clauseType": "termination",
    "riskLabel": "low",
    "clauseTextFull": "..."
  },
  "ruleMatches": [
    {
      "sourceType": "playbook",
      "title": "Termination Playbook",
      "benchmark": "Balanced agreements usually include notice windows and cure periods."
    }
  ],
  "comparison": {
    "whyCurrentIsRisky": "...",
    "whyPrecedentIsStronger": "...",
    "materialDifferences": ["...", "..."],
    "recommendedRewrite": "..."
  }
}
```

## Fastest MVP Path For Side-By-Side Review

If you want the quickest version first:

1. add precedent endpoints
2. show current clause and top match side by side
3. display full text
4. show static rulebook benchmark
5. add `Compare` button in search results

That gives you a real usable feature fast.

## Stronger Version After MVP

After the MVP:

1. let user choose among top 5 precedents
2. add diff highlighting
3. add benchmark scoring
4. add draft rewrite suggestions
5. add open-original-document links on both sides

---

## Part 2: Ingesting Playbooks, Rulebooks, And Sports Rules

## What These Knowledge Sources Are

You should treat these as a separate knowledge corpus from contracts.

Examples:

- legal playbooks
- internal redline policies
- league regulations
- federation rules
- salary cap rules
- transfer rules
- player contract standards
- sponsorship compliance rules
- broadcaster rights restrictions
- image rights guidance

## Do Not Mix Them Blindly With Contracts

Important recommendation:

- keep contracts in one corpus
- keep playbooks/rules in another corpus

Then retrieve both during search and review.

Why:

- contracts are precedents
- rules/playbooks are normative guidance

They serve different purposes and should be labeled differently.

## Ways To Ingest These Knowledge Sources

## Way 1: Static Curated JSON In Repo

This is the fastest MVP.

### How

Extend the current rulebook idea beyond `backend/data/rulebook.json`.

Add files like:

- `backend/data/playbooks/termination-playbook.json`
- `backend/data/sports-rules/league-rules.json`
- `backend/data/sports-rules/sponsorship-policy.json`

### Best for

- demos
- fixed rules
- fast implementation

### Limitation

- updates require code or repo changes

## Way 2: Admin Upload Pipeline

This is the best next step.

### How

Create a new knowledge upload route:

- `POST /api/knowledge/upload`

Accepted input formats:

- JSON
- CSV
- TXT
- Markdown
- PDF

Use the same storage/extraction pipeline pattern as contract ingestion, but save the output into a knowledge repository instead of contract repository.

### Best for

- internal playbooks
- uploaded policies
- legal ops handbooks

## Way 3: Google Drive Folder Ingestion

This is ideal if sports organizations already keep rulebooks in Drive.

### How

Reuse your existing connector approach:

- `backend/services/drive.service.js`

But create a separate flow:

- `importKnowledgeFromDrive(...)`

Use one or more dedicated Drive folders for:

- playbooks
- league rules
- compliance guidance

### Best for

- fragmented source systems
- real operations setup

## Way 4: Scheduled External Sync

This is the scalable production path.

### How

Add scheduled ingestion from:

- league websites
- federation PDFs
- official internal repositories
- enterprise document systems

### Best for

- continuously changing rules
- compliance-heavy environments

### Limitation

- more engineering complexity

## Recommended Ingestion Order

Do this in order:

1. static curated JSON
2. admin upload
3. Drive ingestion
4. scheduled sync

That sequence gives you value quickly without overengineering.

---

## Recommended Knowledge Data Model

Create a separate knowledge record shape like:

```json
{
  "id": "knowledge_123",
  "sourceType": "playbook",
  "title": "League Sponsorship Playbook",
  "organization": "Premier League",
  "sport": "football",
  "jurisdiction": "UK",
  "documentType": "playbook",
  "effectiveFrom": "2026-01-01",
  "effectiveTo": null,
  "version": "2026.1",
  "status": "active",
  "topics": ["sponsorship", "branding", "termination"],
  "artifacts": {
    "rawDocument": {},
    "extractedText": {}
  },
  "createdAt": "...",
  "updatedAt": "..."
}
```

And knowledge chunks like:

```json
{
  "id": "knowledge_chunk_1",
  "knowledgeId": "knowledge_123",
  "sectionTitle": "Termination And Exit",
  "textFull": "...",
  "textSummary": "...",
  "tags": ["termination", "notice", "cure period"],
  "createdAt": "..."
}
```

## Metadata You Should Capture

At minimum:

- `sourceType`: playbook, rulebook, regulation, policy
- `organization`
- `sport`
- `league`
- `documentType`
- `jurisdiction`
- `effective dates`
- `version`
- `topics`

This metadata becomes critical for filtering and grounded review.

---

## Backend Changes Needed For Knowledge Ingestion

## A. New Repository Layer

Create:

- `backend/services/knowledge.repository.js`

This should mirror the contract repository pattern, but for knowledge documents.

Suggested functions:

- `saveKnowledgeBundle(...)`
- `listKnowledgeDocuments(...)`
- `getKnowledgeDocumentById(...)`
- `searchKnowledgeMetadata(...)`

## B. New Service Layer

Create:

- `backend/services/knowledge.service.js`

Suggested functions:

- `ingestKnowledgeDocument(file, options)`
- `buildKnowledgeChunks(text, metadata)`
- `indexKnowledgeChunks(chunks)`
- `findRelevantKnowledge({ query, clauseType, sport, league })`

## C. New Routes And Controller

Create:

- `backend/routes/knowledge.routes.js`
- `backend/controllers/knowledge.controller.js`

Suggested endpoints:

- `POST /api/knowledge/upload`
- `GET /api/knowledge`
- `GET /api/knowledge/:knowledgeId`
- `POST /api/knowledge/search`

## D. Storage Layer Reuse

You can reuse the same artifact-storage pattern already used in:

- `backend/services/storage.service.js`

Extend it for knowledge document paths like:

- `knowledge/raw/<knowledgeId>/<file>`
- `knowledge/derived/<knowledgeId>/extracted.txt`

## E. Vector Index Strategy

Index knowledge chunks separately from contract clauses.

Recommended namespace strategy:

- `contracts`
- `knowledge-playbooks`
- `knowledge-rules`

Do not throw everything into one undifferentiated namespace.

---

## How Knowledge Should Be Used In Review

When a reviewer opens side-by-side comparison:

1. retrieve precedent clauses from contract corpus
2. retrieve benchmark guidance from knowledge corpus
3. combine both into the reasoning layer

That means the final review experience becomes:

- current clause
- precedent clause
- policy/rule benchmark
- recommended revision

This is much stronger than precedent search alone.

## Example Review Stack

### Current clause

“The team may terminate the sponsorship immediately without notice.”

### Precedent clause

“Either party may terminate upon material breach after 30 days written notice and opportunity to cure.”

### Playbook guidance

“Termination clauses in sponsor agreements must include notice, cure period, and post-termination branding obligations.”

### Generated review output

“Current clause is riskier because it lacks notice and cure mechanics and does not define post-termination sponsor asset handling.”

---

## Sports-Specific Rule Ingestion

If you want true sports-organization fit, add domain-specific categories.

## Suggested taxonomy

- player contracts
- sponsorship agreements
- broadcast rights
- merchandising
- image rights
- morality clauses
- transfer/release rules
- salary cap/commercial cap
- licensing rights
- stadium/event agreements

## Suggested metadata fields

- `sport`
- `league`
- `competition`
- `organizationType`
- `agreementFamily`
- `team`
- `athleteRole`
- `sponsorCategory`

These metadata fields should exist in both:

- contracts
- knowledge documents

That allows aligned retrieval such as:

- compare only against football sponsorship precedents
- retrieve only rules from the relevant league

---

## Frontend Changes Needed For Knowledge Workflows

## A. Add a knowledge workspace

Recommended new route:

- `/knowledge`

Page:

- `frontend/src/pages/KnowledgePage.jsx`

Use it for:

- uploading playbooks
- listing ingested rulebooks
- searching knowledge sources

## B. Add benchmark panels to review UI

Create:

- `frontend/src/components/RuleBenchmarkPanel.jsx`

Show:

- rule title
- section title
- benchmark text
- why it applies

## C. Add knowledge search into precedent review page

The compare page should show:

- precedent matches
- benchmark rules
- optional toggle between “precedent” and “policy guidance”

---

## Suggested Phased Implementation

## Phase 1: Precedent review MVP

1. new precedent compare route
2. new compare page
3. show current clause vs top precedent
4. display rulebook benchmark from existing `rulebook.json`

## Phase 2: Rulebook ingestion MVP

1. add knowledge upload route
2. add knowledge repository
3. ingest PDFs/TXT/JSON as knowledge documents
4. chunk and index knowledge passages

## Phase 3: Strong legal review workflow

1. attach benchmark rules to clause comparison
2. allow filtering by contract type / sport / league
3. show diff highlighting
4. add rewrite assistance

## Phase 4: Sports-domain specialization

1. add sports metadata fields
2. add sports-specific playbooks and league rules
3. build sport-aware filters and prompts

---

## Exact File List I Would Add

### Backend

- `backend/routes/precedent.routes.js`
- `backend/controllers/precedent.controller.js`
- `backend/services/precedent.service.js`
- `backend/routes/knowledge.routes.js`
- `backend/controllers/knowledge.controller.js`
- `backend/services/knowledge.service.js`
- `backend/services/knowledge.repository.js`

### Frontend

- `frontend/src/pages/PrecedentReviewPage.jsx`
- `frontend/src/pages/KnowledgePage.jsx`
- `frontend/src/components/ClauseComparePanel.jsx`
- `frontend/src/components/PrecedentMatchList.jsx`
- `frontend/src/components/RuleBenchmarkPanel.jsx`

## Existing Files I Would Extend

### Backend

- `backend/server.js`
- `backend/services/insight.service.js`
- `backend/services/search.service.js`
- `backend/services/vector.service.js`
- `backend/services/contract.repository.js`
- `backend/config/env.js`
- `backend/services/storage.service.js`

### Frontend

- `frontend/src/App.jsx`
- `frontend/src/lib/api.js`
- `frontend/src/components/AppNav.jsx`
- `frontend/src/components/SearchWorkbench.jsx`
- `frontend/src/components/ContractInsightsPanel.jsx`

---

## Best Practical Recommendation

If you want the smartest path with minimum chaos, do this:

1. build side-by-side precedent review first
2. reuse existing `rulebook.json` as the first benchmark source
3. then create a separate knowledge ingestion pipeline
4. then add sports-specific metadata and rule corpora

That sequence gives you:

- a visible product improvement immediately
- a real legal-review workflow
- a scalable path for sports-domain intelligence later

## Final Conclusion

To implement side-by-side precedent review, you need:

- new comparison endpoints
- a new compare page
- richer search result payloads
- diff and benchmark rendering

To ingest playbooks/rulebooks/sports rules, you should:

- create a separate knowledge ingestion pipeline
- store rule documents separately from contracts
- chunk and index rule passages
- use them together with precedent retrieval during review

If you want the strongest version of this product, the eventual review stack should always combine:

1. current clause
2. precedent clause
3. playbook/rule benchmark
4. recommended rewrite
