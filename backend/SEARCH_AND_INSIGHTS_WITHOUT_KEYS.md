# Search and AI Insights Without API Keys

This file explains how search and "AI insights" are working **right now**, even though no Gemini API key or external GenAI provider is connected yet.

## Short answer

Right now, the system is working in a **local fallback mode**:

- semantic search is running with a **local vector fallback**
- embeddings are generated with a **deterministic hash function**, not an external embedding API
- insight text is generated from a **rulebook + templates**, not from Gemini
- if Pinecone is not configured, vectors are stored in a local JSON file
- if external GenAI is not configured, the backend returns structured reasoning built from rules and retrieved clauses

So the system is already usable without keys, but the "reasoning layer" is currently **template-driven**, not LLM-generated.

## Files involved

### Search

- [backend/services/embedding.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/embedding.service.js)
- [backend/utils/hashEmbedding.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/utils/hashEmbedding.js)
- [backend/services/vector.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/vector.service.js)
- [backend/services/search.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/search.service.js)

### Insight generation

- [backend/services/insight.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/insight.service.js)
- [backend/data/rulebook.json](/d:/PROJECTS/SOLUTIONHACKATHON/backend/data/rulebook.json)

### System status

- [backend/controllers/health.controller.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/controllers/health.controller.js)
- [backend/config/env.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/config/env.js)
- [backend/.env.example](/d:/PROJECTS/SOLUTIONHACKATHON/backend/.env.example)

## 1. Why the backend still works without Gemini

In the health controller, the reasoning mode is reported like this:

- if an external AI provider is configured, it uses that provider
- otherwise it reports `provider: "template"`

That logic comes from:

- [backend/controllers/health.controller.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/controllers/health.controller.js)

and the flag is driven by:

- `GENAI_BASE_URL`
- `GENAI_API_KEY`
- `GENAI_MODEL`

Because those values are empty right now, the backend treats the reasoning layer as:

```text
template
```

That means there is **no Gemini call happening right now**.

## 2. How search works right now

### Current search flow

When the user asks a semantic search question:

1. Node receives the query
2. Node creates an embedding for the query
3. Node searches stored clause vectors
4. Node ranks the best matching clauses
5. Node builds an explanation from the top matches and the rulebook

This is implemented in:

- [backend/services/search.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/search.service.js)

The function `runSemanticSearch()` does:

1. validate the query
2. call `embedText(query)`
3. call `querySimilarClauses(...)`
4. call `buildSemanticAnswer(...)`

## 3. How embeddings are being generated without an embedding API

Right now, embeddings are not coming from Gemini, OpenAI, or any hosted embedding model.

Instead, the backend uses a local deterministic embedding generator.

This is implemented in:

- [backend/services/embedding.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/embedding.service.js)
- [backend/utils/hashEmbedding.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/utils/hashEmbedding.js)

### What it does

The function `embedText(text)` returns:

```js
{
  provider: 'deterministic-hash',
  values: createDeterministicEmbedding(text, env.embeddingDimension)
}
```

The actual vector is created by:

- splitting the text into tokens
- hashing each token with SHA-256
- projecting the token hashes into a fixed-size numeric vector
- normalizing the final vector

### Important meaning

This is **not a true LLM embedding model**.

It is a development-friendly fallback so the search pipeline can still function before real embedding infrastructure is connected.

So right now:

- search works
- vector storage works
- similarity ranking works

But the semantic quality is still lower than a real embedding model.

## 4. Where vectors are stored without Pinecone

If Pinecone keys are not configured, the backend does not stop.

Instead, it switches to a local vector store.

This behavior is implemented in:

- [backend/services/vector.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/vector.service.js)

### Current behavior

If `featureFlags.pinecone` is false:

- vectors are saved locally
- vector search runs locally

The local vector file is:

- [backend/tmp/local-store/vectors.json](/d:/PROJECTS/SOLUTIONHACKATHON/backend/tmp/local-store/vectors.json)

Each stored vector includes:

- clause id
- vector values
- metadata such as contract id, clause type, risk label, and clause text

## 5. How local search ranking works

When Pinecone is not available, `queryLocalVectors(...)` is used.

The local score is not based on one thing only. It combines:

1. **cosine similarity** between query vector and clause vector
2. **lexical overlap** between query words and clause text
3. **clause type boost** if the query mentions a clause type like `termination` or `payment`

The current score is effectively:

```text
0.55 * cosine similarity
+ 0.35 * lexical overlap
+ clause type boost
```

This is why the search still gives useful results even without Pinecone or an external embedding API.

## 6. How "AI insights" are being generated right now

This part is very important:

The current insight output is **not generated by Gemini**.

Instead, it is generated by:

- matching clause types
- reading predefined legal guidance from the rulebook
- combining that guidance with retrieved matches
- filling response templates

This logic is implemented in:

- [backend/services/insight.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/insight.service.js)
- [backend/data/rulebook.json](/d:/PROJECTS/SOLUTIONHACKATHON/backend/data/rulebook.json)

## 7. What the rulebook is doing

The rulebook is a local JSON file with entries like:

- `payment`
- `termination`
- `penalty`
- `confidentiality`
- `dispute_resolution`
- `governing_law`

Each rulebook entry contains:

- `primaryConcern`
- `benchmark`
- `recommendedAction`

Example meaning:

- why this clause type is risky
- what good benchmark language usually looks like
- what the reviewer should change

So the insight layer is currently acting like a **structured legal playbook engine**, not a free-form generative AI model.

## 8. How contract insights are built right now

For contract-level insights, the backend uses:

- `generateContractOverview(contractBundle)`

That function produces:

- a headline
- a summary
- top risk items
- next-step recommendations
- clause insights for medium/high-risk clauses

These outputs come from:

- contract risk counts
- clause risk labels
- template sentences
- rulebook recommendations

So when you see overview text in the dashboard, it is currently **programmatically assembled**, not generated by Gemini.

## 9. How clause-level insight is built right now

For a clause, the backend uses:

- `generateClauseInsight(clause, precedentMatches)`

That function creates:

- `whyItIsRisky`
- `comparison`
- `recommendedChange`

### Where each part comes from

`whyItIsRisky`
- comes from `rule.primaryConcern`

`comparison`
- comes from retrieved matches plus `rule.benchmark`

`recommendedChange`
- comes from `rule.recommendedAction`

So this is a **retrieval + rules + template composition** system.

## 10. How search answers are built right now

For semantic search answers, the backend uses:

- `buildSemanticAnswer({ query, matches, contract })`

That function does not call any external model.

Instead it:

1. takes the best retrieved clause match
2. reads its clause type
3. fetches the matching rulebook entry
4. constructs a final response string
5. returns recommendations and supporting matches

So the returned answer is **generated by backend code**, not by Gemini.

## 11. What happens if the Python ML model is also unavailable

This question is slightly separate, but useful for understanding the current stack.

If the Python ML service is down, Node still keeps working because:

- [backend/services/mlAnalysis.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/mlAnalysis.service.js)

first tries the Python service, and if it fails, it falls back to local heuristics.

That fallback creates:

- entities
- clause types
- risk labels

using regex and rule-based logic in Node.

So your current development stack has multiple layers of fallback:

1. Python ML if available
2. heuristic Node clause analysis if Python is unavailable
3. Pinecone if configured
4. local vector JSON if Pinecone is unavailable
5. external GenAI if configured later
6. rulebook/template reasoning if no external GenAI is configured

## 12. What is "AI" right now and what is not

### Currently AI-like

- your trained Python legal model, if it is running
- vector-style retrieval behavior
- clause matching and risk-based guidance

### Currently not real generative AI

- the final explanation text
- the legal recommendations
- the summary wording

Those outputs are still:

- rule-driven
- template-driven
- retrieval-assisted

not LLM-generated.

## 13. Practical summary of current no-key behavior

Right now the system behaves like this:

```text
Contract text
-> clause analysis
-> deterministic local embeddings
-> local vector matching
-> rulebook lookup
-> template-based legal insight response
```

So even without Gemini keys, the platform already demonstrates:

- end-to-end ingestion
- searchable clause intelligence
- precedent-style matching
- explainable legal guidance

But the final insight wording is still coming from **backend logic and your local rulebook**, not from an external generative AI model.

## 14. What will change later when Gemini is connected

Once you connect a real GenAI provider, the architecture can evolve like this:

### Current

- deterministic hash embeddings
- local/Pinecone retrieval
- rulebook-driven answer templates

### Later

- real embedding model
- real semantic retrieval
- GenAI-generated explanation and rewrite suggestions
- better contextual comparison across clauses and precedents

At that point, the retrieval layer will supply focused context, and Gemini can generate:

- richer explanations
- better redrafting suggestions
- more natural reasoning
- more nuanced clause comparisons

## Final one-line explanation

Right now, search and AI insights work without keys because the backend is using **local deterministic embeddings + local vector search + rulebook-based template reasoning**, not Gemini.
