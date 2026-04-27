# On-Demand Insight Generation Architecture

## Goal

This document describes the architecture you are thinking about:

- contracts are still uploaded, parsed, segmented into clauses, and risk-labeled during ingestion
- Gemini is **not** called during upload
- Gemini is called **only when the user clicks "Get Insights"**
- only **one Gemini call** is made for that contract insight generation request
- the Gemini result is stored and reused later for the same contract
- repeated opens of the same contract insight page should read from cache, not call Gemini again

This design is a strong way to reduce Gemini quota usage.

## Short Answer

Yes, this architecture can work well.

Yes, you should still keep the `/insights` page.

The important idea is:

- the insights page should show **two kinds of data**
- some data is available immediately without Gemini
- some data is generated only after the user requests AI insights

So the page does not have to be empty before Gemini runs.

## Core Principle

Split the insight system into two layers.

### Layer 1: Always available, no Gemini needed

This layer is created during upload.

It includes:

- extracted contract text
- clause segmentation
- clause type detection
- risk label detection: `high`, `medium`, `low`
- clause board and risk counts
- vector indexing for semantic search
- contract metadata

This means the contract can already support:

- clause review
- risk dashboard
- contract details page
- semantic search
- future precedent retrieval

without Gemini.

### Layer 2: On-demand generated insight

This layer is created only when the user clicks `Get Insights`.

It includes:

- overall contract headline
- contract summary for reviewer
- next steps
- generated explanation for high-risk clauses
- grounded comparison wording
- recommended redraft wording direction

This is the only part that needs Gemini.

## Why This Reduces Quota Problems

Right now, insight generation becomes expensive when it happens automatically during upload or refresh.

Your on-demand design reduces that cost because:

- many uploaded contracts may never need AI insight generation
- only contracts that users actually inspect will use Gemini
- one contract can use one Gemini call instead of many separate calls
- once stored, the same insight response can be reused many times

This is exactly the kind of architecture that protects quota.

## Recommended Product Flow

### Step 1. Upload Contract

During upload:

- store raw file
- extract text
- run ML analysis
- build clause list
- assign `high`, `medium`, `low` risk labels
- save contract bundle
- create clause vectors for semantic search

Do **not** call Gemini here.

### Step 2. Contracts Page

The Contracts page should already show:

- contract title
- parties
- dates
- risk counts
- clause review board
- high-risk clauses
- `Get Insights` button

This page is fully useful before Gemini.

### Step 3. User Clicks `Get Insights`

When the user clicks the button:

1. check whether cached insights already exist for that contract
2. if cached insights exist, return them immediately
3. if not, build the insight context
4. make one Gemini call
5. save the generated result
6. return the saved result to the UI

### Step 4. Open Insights Page

The `/insights` page should read the stored contract insight state.

That page should not assume Gemini has already run.

It should support multiple states cleanly.

## Required Insight Page States

The page should support these states:

### 1. `not_requested`

Meaning:

- contract was uploaded
- clauses and risks are ready
- AI insight generation has not been triggered yet

What to show:

- contract header
- risk summary
- list of high-risk clauses
- message like: `Insights have not been generated yet for this contract.`
- primary button: `Generate Insights`

This is the state that makes your architecture feel intentional.

### 2. `generating`

Meaning:

- user clicked `Get Insights`
- backend is building retrieval context and running Gemini

What to show:

- same contract header and clause list
- loading state
- message like: `Generating grounded insights for high-risk clauses...`

### 3. `ready`

Meaning:

- Gemini result already exists in storage

What to show:

- headline
- summary
- next steps
- generated clause insight cards
- precedent comparisons
- rulebook guidance

### 4. `failed`

Meaning:

- Gemini was requested
- retrieval worked
- Gemini failed or quota was exhausted

What to show:

- risk summary
- precedent matches
- rulebook matches
- message like: `AI wording is unavailable right now, but review context is still available.`

This is important because the page should still be useful even when Gemini fails.

## How The Insights Page Still Works Without Auto-Generation

The key is simple:

- the page is not only an "AI output page"
- it is a "review workspace"

That workspace can show a lot of useful information before Gemini.

### Before generation, show:

- contract title
- risk counts
- high-risk clause list
- clause text
- clause type
- risk label
- why each clause was flagged, if ML already exposes that
- a `Generate Insights` button

### After generation, add:

- Gemini-written overall summary
- Gemini-written `why it is risky`
- Gemini-written `comparison`
- Gemini-written `recommended change`

So the page remains functional both before and after AI generation.

## How Precedent Comparison Fits In

Precedent retrieval does **not** need Gemini.

That is the most important design point.

The system can retrieve precedent matches using:

- clause text
- clause type
- vector similarity
- Pinecone or local semantic retrieval fallback

This means the backend can find:

- best precedent clause
- additional precedent matches
- fallback comparable clauses from other contracts

before Gemini writes anything.

### Recommended flow

When `Get Insights` is clicked:

1. choose high-risk clauses
2. retrieve precedent matches for each clause
3. if no precedent exists, retrieve comparable clauses from other indexed contracts
4. store those matches in the insight bundle
5. pass them to Gemini for grounded writing

### Why this matters

Even if Gemini fails:

- the best precedent panel can still be shown
- the additional comparisons list can still be shown
- the page still teaches the user something useful

## How Rulebook Guidance Fits In

Rulebook retrieval also does **not** need Gemini.

The rulebook is already structured guidance.

For each high-risk clause, the backend can retrieve:

- benchmark text
- primary concern
- recommended action
- policy title or section title

That can be shown directly on the insights page.

### Best practice

Persist the rulebook matches together with the generated insight result.

That way:

- later page opens do not need to rebuild the same display data
- the user sees the exact benchmark context that Gemini used
- reports remain consistent across refreshes

## Best Architecture For Your Idea

The cleanest version of your idea is this:

### Ingestion pipeline

Do during upload:

- OCR and extraction
- clause segmentation
- risk labeling
- contract metadata save
- vector indexing for semantic search

Do not do during upload:

- Gemini overview generation
- Gemini clause insight generation

### On-demand insight pipeline

Do only when user requests insights:

- pick target clauses
- retrieve precedent matches
- retrieve rulebook matches
- assemble one large JSON context
- call Gemini once
- save whole insight bundle

## What Should Be Sent In The One Gemini Call

To keep it to one call, the prompt should contain:

- contract title
- short contract summary
- risk counts
- selected target clauses
- for each target clause:
  - clause id
  - clause type
  - risk label
  - current clause text
  - best precedent match
  - additional precedent matches
  - best rulebook match
  - additional rulebook matches

The model should return one JSON object like this:

```json
{
  "headline": "Immediate review is recommended before approval.",
  "summary": "Three high-risk clauses need legal review before signature.",
  "nextSteps": [
    "Review termination language against internal benchmark wording.",
    "Confirm payment and notice obligations.",
    "Redraft one-sided obligations before approval."
  ],
  "clauseInsights": [
    {
      "clauseId": "clause_1",
      "whyItIsRisky": "This clause allows unilateral action without a clear cure period.",
      "comparison": "The best precedent includes notice and cure protections that are missing here.",
      "recommendedChange": "Add notice, cure period, and balanced termination triggers."
    }
  ]
}
```

That is one Gemini call for the entire contract insight package.

## What Must Be Stored After Generation

Do not store only the final text.

Store the full insight bundle.

Recommended stored structure:

```json
{
  "status": "ready",
  "requestedAt": "timestamp",
  "generatedAt": "timestamp",
  "provider": "gemini",
  "promptVersion": "v1",
  "selectedClauseIds": ["clause_1", "clause_7"],
  "overview": {
    "headline": "...",
    "summary": "...",
    "nextSteps": ["...", "...", "..."]
  },
  "clauseInsights": {
    "clause_1": {
      "clauseId": "clause_1",
      "whyItIsRisky": "...",
      "comparison": "...",
      "recommendedChange": "...",
      "currentClause": {},
      "precedentClause": {},
      "precedentMatches": [],
      "ruleMatches": []
    }
  }
}
```

This is the answer to your concern about the insights page.

The page works because it reads one saved object that already includes:

- generated wording
- precedent context
- rulebook context

So later reloads do not need another Gemini call.

## How Medium And Low Risk Clauses Should Work

Your main design should focus only on `high` risk clauses for automatic AI generation.

That is the most quota-efficient design.

Recommended behavior:

- `high` risk clauses: included in automatic on-demand Gemini generation
- `medium` risk clauses: shown in clause board, but no automatic AI generation
- `low` risk clauses: shown in clause board only

Optional future extension:

- allow manual per-clause insight generation for one medium-risk clause if user clicks `Generate Insight For This Clause`

That keeps default cost low.

## What The UI Should Show On The Insights Page

A simple page structure can be:

### Section 1. Contract review summary

Always available:

- title
- status
- contract type
- risk counts

### Section 2. Insight status

Shows one of:

- `Not generated yet`
- `Generating now`
- `Generated`
- `Generation failed`

### Section 3. High-risk clauses

Always available:

- clause label
- clause type
- risk label
- clause text preview

### Section 4. Precedent and benchmark context

Available once retrieval context is built:

- best precedent
- additional precedents
- rulebook benchmark
- expected action

### Section 5. AI-generated explanation

Available only after Gemini succeeds:

- why risky
- comparison
- recommended change

This layout keeps the page useful at every stage.



## Recommended Backend State Machine

Each contract should have an insight state like:

```json
{
  "status": "not_requested | generating | ready | failed",
  "requestedAt": null,
  "generatedAt": null,
  "failedAt": null,
  "lastError": null
}
```

This makes the frontend easy to reason about.

## Recommended Request Flow

### First click

- user clicks `Get Insights`
- frontend calls `POST /contracts/:id/insights/generate`
- backend checks cache
- no cache found
- backend retrieves precedents and rulebook matches
- backend makes one Gemini call
- backend stores full insight bundle
- frontend displays result

### Second click later

- user clicks `Get Insights` again
- backend sees cached insight bundle
- backend returns cached result
- no Gemini call happens

This is exactly the rate-limit reduction you want.

## What Happens If Gemini Fails

Do not waste the page.

Instead:

- keep `status = failed`
- store `lastError`
- keep retrieval context if it was built
- show rulebook and precedent panels anyway
- show message: `AI wording is unavailable right now. Retrieved legal context is still available below.`

That gives value even without Gemini.

## Best Answer To Your Main Question

Your idea is good because it separates:

- contract intelligence extraction
- from expensive LLM explanation

That is the correct architecture if your main problem is Gemini quota.

The insights page can still work well if you design it as:

- a review workspace first
- an AI summary page second

The page should not depend entirely on Gemini to exist.

## Recommended Final Architecture

If you want the strongest quota-safe design, use this:

1. Upload contract
2. Extract clauses and risks
3. Save vectors for semantic search
4. Save contract with `insightStatus = not_requested`
5. Show risk board immediately
6. User clicks `Get Insights`
7. Retrieve precedent and rulebook context
8. Make one Gemini call for the whole contract insight bundle
9. Save generated result plus retrieval snapshots
10. Reuse that stored insight bundle for later page opens

## Final Recommendation

Yes, this is a very good architecture for reducing quota problems.

The most important implementation rule is:

- do not make the insights page depend on live Gemini generation

Instead:

- let the insights page show pre-AI contract review data
- then add generated explanations only after explicit user request

That gives you:

- lower quota usage
- predictable Gemini cost
- faster uploads
- a more reliable product
- cleaner fallback behavior

