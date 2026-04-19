# ML Model Layer Analysis

Date: 2026-04-19

Scope reviewed:
- `ML-model-main/ml-service/app/predictor.py`
- `ML-model-main/ml-service/app/utils.py`
- `ML-model-main/ml-service/app/main.py`
- `ML-model-main/ml-service/app/config.py`
- `ML-model-main/ml-service/app/schemas.py`
- `ML-model-main/ml-service/data/*`
- `ML-model-main/ml-service/models/*`
- `ML-model-main/ml-service/scripts/*`

This document does not change the model code. It is an engineering review of how the current ML layer works, why it will struggle in real-world contracts, and what is needed to make it production-capable.

## Executive Summary

The current ML layer is best described as a lightweight rules-plus-classical-ML prototype, not a real-world contract intelligence system yet.

What it currently is:
- Clause splitting is regex-based.
- Clause type and risk are mostly heuristic-driven, with fallback TF-IDF + logistic regression models.
- Entity extraction is a very small custom spaCy NER plus regex extraction.
- The output is filtered to only a subset of clause types or high-risk clauses.

What this means in practice:
- It can work on short, clean, synthetic-style English contract snippets.
- It will struggle on long agreements, OCR noise, legal drafting variation, nested numbering, multi-issue clauses, and domain drift.
- It does not yet have the data volume, label coverage, evaluation discipline, or training pipeline needed for dependable real-world deployment.

My bottom line:
- This is a good hackathon baseline.
- It is not yet a production-grade legal ML stack.
- To make it real-world capable, you need much better data, separate modeling tasks, stronger models, real evaluation, and a reproducible training pipeline.

## What The Current System Actually Does

### Runtime architecture

The service in `app/main.py` exposes:
- `GET /`
- `POST /analyze`

The analysis path in `app/predictor.py` does this:
1. Load spaCy NER or fall back to `en_core_web_sm`, or finally blank English.
2. Load clause classifier and risk classifier from Joblib if present.
3. Extract entities using spaCy plus regex helpers.
4. Split the document into clauses using regex and paragraph heuristics.
5. Predict clause type.
6. Predict risk.
7. Create short summaries for clauses.
8. Return only:
   - clause types in `IMPORTANT_TYPES`
   - or clauses marked `high` risk

### Current model types

Observed from the serialized artifacts:
- Clause classifier: `TfidfVectorizer(ngram_range=(1,2)) + LogisticRegression`
- Risk classifier: `TfidfVectorizer(ngram_range=(1,2)) + LogisticRegression`
- NER: custom spaCy NER model with labels:
  - `DATE`
  - `DURATION`
  - `LOCATION`
  - `MONEY`
  - `ORG`
  - `PARTY`

### Current training data size

Observed from the repo datasets:
- Clause classification rows: `135`
- Risk classification rows: `78`
- NER examples: `20`

Label coverage:
- Clause labels in CSV:
  - `payment`: 20
  - `termination`: 20
  - `penalty`: 20
  - `confidentiality`: 20
  - `dispute_resolution`: 20
  - `other`: 20
  - `governing_law`: 15
- Risk labels:
  - `high`: 30
  - `low`: 26
  - `medium`: 22

These are extremely small datasets for legal NLP.

## What Is Good About The Current Design

- The service is simple and easy to run.
- It fails gracefully when a trained model is missing.
- It separates:
  - entity extraction
  - clause typing
  - risk scoring
- The TF-IDF + logistic regression baseline is cheap and fast.
- The regex layer helps with money, dates, duration, and percentages.
- The architecture is understandable enough to evolve.

For a prototype, these are good choices.

## Main Problems And Why They Matter

## 1. The training data is far too small

The biggest issue is not model architecture first. It is data.

Current scale:
- 135 clause examples
- 78 risk examples
- 20 NER examples

That is nowhere near enough for real contract diversity.

Real contracts vary by:
- domain
- jurisdiction
- drafting style
- OCR quality
- template age
- counterparty sophistication
- clause nesting
- mixed obligations inside one paragraph

With the current data volume, the models will mostly learn keywords and shallow phrasing patterns, not legal meaning.

## 2. The clause splitter is too brittle for real agreements

The splitting logic in `app/utils.py` is regex-based and often groups or fragments legal meaning incorrectly.

Examples of likely failure:
- multi-sentence clauses get split into 2-sentence chunks
- governing law and dispute resolution may be merged together
- definitions sections may be treated as clauses
- bullet lists may be broken incorrectly
- nested numbering like `7.2(a)(iii)` is not modeled structurally
- long commercial clauses with conditions and carve-outs will be cut badly

Observed runtime behavior:
- A sample containing governing law + dispute resolution was merged into one returned clause and surfaced only as `dispute_resolution`.

If clause boundaries are wrong, everything downstream is wrong:
- clause type
- risk
- entity linking
- retrieval
- summaries

## 3. The clause output is incomplete by design

In `predictor.py`, only these types are guaranteed to survive filtering:
- `payment`
- `termination`
- `penalty`
- `confidentiality`
- `dispute_resolution`

And anything else only survives if risk is `high`.

This is a major product limitation because real legal review depends on many additional clause families:
- governing law
- indemnity
- limitation of liability
- IP ownership
- warranties
- assignment
- renewal
- notice
- audit rights
- exclusivity
- non-compete
- data privacy
- force majeure
- compliance
- insurance
- SLA/service credits

Important specific issue:
- The training CSV contains `governing_law`
- But the shipped clause classifier classes do not include `governing_law`
- And `governing_law` is not in `IMPORTANT_TYPES`

So even when governing law is detected by heuristics, it can still disappear from the final response if not high risk.

## 4. The system is heavily heuristic-driven

The ML layer is not purely ML-driven.

Clause type prediction first checks keyword lists like:
- `terminate`
- `confidential`
- `arbitration`
- `invoice`

Risk prediction also uses rules like:
- `without notice` -> high
- `automatic renewal` -> medium

This is useful as a bootstrap, but in real-world settings it causes:
- high false positives on keyword matches
- missed paraphrases
- poor handling of negation
- poor handling of context
- poor handling of multi-issue clauses

Example:
- "termination" appearing in a limitation clause is not the same as a termination right
- "penalty" may be mentioned descriptively, not operatively

## 5. Risk modeling is too weak for legal reality

The risk model is a 3-class text classifier:
- low
- medium
- high

That is not enough by itself.

Real legal risk depends on:
- clause type
- bargaining position
- party role
- jurisdiction
- missing safeguards
- asymmetry
- caps and carve-outs
- dependency on other clauses
- whether language is one-sided or mutual
- whether a remedy exists elsewhere in the contract

Today the model sees mostly one clause string, with no contract context.

That means it cannot reliably judge:
- whether a clause is high-risk in context
- whether a clause is only risky because another clause is missing
- whether a clause is standard for one industry but dangerous in another

## 6. Entity extraction is too limited and undertrained

Current NER labels are:
- `DATE`
- `DURATION`
- `LOCATION`
- `MONEY`
- `ORG`
- `PARTY`

The custom NER dataset has only `20` examples.

That is far too small for reliable legal entity extraction.

The model also only keeps `ORG`, `PARTY`, and `LOCATION` from spaCy NER directly, and relies on regex for:
- money
- dates
- duration
- percentages

Problems:
- no robust party-role extraction
- no clause-level linking of parties to obligations
- no explicit extraction of:
  - notice period
  - renewal term
  - liability cap
  - governing law
  - arbitration seat
  - cure period
  - deliverables
  - service levels
  - confidentiality term

This means the system is not yet doing structured legal information extraction. It is mostly doing shallow tagging.

## 7. Money extraction is currently brittle for Indian contracts

In `app/utils.py`, the money regex contains a corrupted rupee pattern:
- `â‚¹`

Observed runtime behavior:
- `extract_money("₹ 50,000")` returned `[]`
- `extract_money("Rs 50,000")` worked

That means native rupee symbol extraction is unreliable in the current Python ML utility layer.

Since Indian commercial contracts often use `₹`, this hurts real-world extraction quality.

## 8. Extracted values are never really populated

The returned clause structure includes:
- `extracted_values`

But the current analyzer always returns:
- `extracted_values: {}`

So the schema suggests structured extraction, but the runtime does not yet provide it.

This creates a gap between:
- API shape
- product expectation
- actual ML capability

## 9. There is no reproducible training pipeline in the repo

Important repo-level finding:
- `scripts/export_model.py` is empty
- I did not find a real end-to-end training pipeline for the sklearn models
- The spaCy model config exists, but the config points to:
  - `train = null`
  - `dev = null`

So the repo currently contains trained artifacts, but not a complete, reproducible training workflow.

That is a serious long-term issue because you cannot reliably:
- retrain
- compare model versions
- improve labels
- run experiments
- reproduce results

## 10. Evaluation discipline is missing

I did not find:
- benchmark reports
- train/validation/test splits
- per-class metrics
- confusion matrices
- error analysis documents
- drift analysis
- threshold tuning
- calibration analysis

I ran a rough 5-fold cross-validation baseline on the small CSVs using the same broad model family:
- Clause classification:
  - accuracy: about `0.763`
  - macro F1: about `0.765`
- Risk classification:
  - accuracy: about `0.681`
  - macro F1: about `0.603`

Even these numbers are optimistic because:
- the dataset is tiny
- the examples are short
- likely templated
- likely similar to training style

Real-world performance on messy contracts will be lower.

## 11. Model and environment reproducibility is shaky

The project requirements pin `scikit-learn==1.6.1`.

But loading the serialized models in the local environment emitted `InconsistentVersionWarning` against a newer sklearn version.

That creates risk around:
- inference differences
- broken deserialization
- non-reproducible experiments

For production ML, model artifact versioning must be strict.

## What Needs To Be Better For Real-World Use

## A. Break the problem into separate trainable tasks

Right now too much responsibility is packed into one lightweight layer.

The system should be split into these tasks:

1. Document normalization / OCR cleanup
- fix OCR artifacts
- remove headers/footers/page numbers
- preserve section structure

2. Clause segmentation
- detect true clause boundaries
- preserve headings and numbering
- keep char offsets

3. Clause classification
- ideally multi-label, not single-label only
- allow one clause to be:
  - payment
  - termination
  - indemnity
  - renewal
  - privacy
  - governing law
  - etc.

4. Risk scoring
- use clause text plus context
- include clause type and extracted values
- ideally produce probability and rationale category

5. Legal entity/value extraction
- party names
- party roles
- dates
- payment amounts
- payment frequency
- notice periods
- renewal terms
- termination triggers
- liability caps
- governing law
- arbitration venue

6. Contract-level aggregation
- summarize risks at document level
- detect missing critical clauses
- compare against playbooks or precedent

## B. Collect much better data

This is the main requirement.

### Minimum data categories needed

You need documents across:
- sports contracts
- sponsorship agreements
- endorsement agreements
- vendor/MSA/SOW
- employment/consulting
- licensing/IP deals
- NDAs
- procurement agreements
- service agreements

You also need variety across:
- clean digital PDFs
- scanned PDFs
- mobile photos
- OCR-noisy documents
- Indian legal/commercial English
- older template contracts
- heavily negotiated contracts

### Labels you should collect

For each document:
- full document text
- source quality:
  - native PDF
  - OCR
  - scan
  - email attachment
  - image

For each clause:
- start char
- end char
- heading
- clause number
- clause text
- one or more clause types
- risk label
- risk reason category
- party affected
- party benefited
- extracted structured values

For each entity/value:
- entity span
- entity label
- normalized form if applicable

### Recommended scale

For something that starts becoming useful:
- clause segmentation:
  - `1,000` to `3,000` annotated documents
- clause classification:
  - `10,000+` clauses
- risk classification:
  - `5,000+` clauses with lawyer-reviewed labels
- NER/value extraction:
  - `3,000+` documents with dense annotations

For something that starts feeling dependable:
- much more than that
- especially for cross-domain generalization

## C. Move beyond pure TF-IDF for the main legal tasks

The current TF-IDF + logistic regression baseline is fine as a bootstrap, but for real deployment you should move toward transformer-based models.

Recommended direction:

### Clause classification
- Fine-tune a transformer encoder
- Good candidate families:
  - Legal-BERT style models
  - DeBERTa style encoders
  - Modern sentence/classification transformers

Why:
- better semantic handling
- less brittle than keyword rules
- better on paraphrases
- better on long-tail language

### Risk modeling
- Use a dedicated classifier that takes:
  - clause text
  - clause type
  - extracted fields
  - optional surrounding clauses

Even better:
- use hierarchical modeling:
  - clause encoder
  - contract context encoder

### NER / field extraction
- Use token classification or span classification
- Keep regex as a support layer, not the primary solution

For some fields, a hybrid is best:
- money/date/percentages: regex + normalization
- parties/roles/obligations: learned model
- legal terms/venues/caps: learned model + rules

## D. Train on OCR-noisy text, not only clean text

Your current pipeline depends heavily on OCR upstream for image contracts and scans.

If you want this to work in reality, the ML training data must include:
- OCR errors
- broken punctuation
- merged lines
- missing symbols
- page noise
- inconsistent section numbering

Otherwise the model will overfit to idealized text and fail on the exact documents most users upload.

## E. Stop dropping non-high-risk clauses by default

For real contract review, users often need:
- full clause map
- full extraction coverage
- not just the top-risk slice

A better design is:
- keep all clauses
- assign confidence
- highlight important ones
- optionally filter in UI

The current filtering throws away potentially useful legal structure.

## F. Add confidence, calibration, and abstention

Real-world ML systems should know when they are unsure.

You should add:
- probabilities for clause type
- probabilities for risk
- calibrated thresholds
- abstain/needs-review state

Without that, the system gives hard labels even when confidence should be low.

For legal workflows, a confident wrong answer is more dangerous than an uncertain answer.

## What To Train, Specifically

## 1. Clause segmentation model

Train a model to predict clause boundaries and heading structure.

Options:
- sequence tagging over lines/sentences
- layout-aware rule+ML hybrid
- transformer sentence boundary classifier

Training unit:
- line
- sentence
- paragraph

Labels:
- clause_start
- clause_continue
- heading
- list_item

## 2. Clause type classifier

Train this as multi-label, not strictly single-label.

Suggested label set:
- payment
- term
- renewal
- termination
- breach
- penalty/liquidated damages
- confidentiality
- non-compete
- exclusivity
- IP ownership
- warranty
- indemnity
- limitation_of_liability
- dispute_resolution
- governing_law
- notice
- force_majeure
- compliance
- assignment
- audit_rights
- privacy/data_processing
- other

Why multi-label:
- many legal clauses express more than one concept

## 3. Risk model

Train on:
- clause text
- clause type
- surrounding context
- jurisdiction
- contract type

Better output:
- overall risk level
- risk reason category
- confidence

Suggested risk reason categories:
- one_sided_termination
- uncapped_liability
- vague_payment_terms
- weak_confidentiality
- missing_cure_period
- unilateral_change_right
- weak_dispute_mechanism
- missing_governing_law
- excessive_penalty

## 4. Field extraction model

Train to extract normalized structured values such as:
- effective date
- end date
- renewal term
- notice period
- payment amount
- currency
- payment cadence
- late fee
- governing law
- arbitration seat
- liability cap
- confidentiality duration
- termination triggers

This is more useful in production than only returning a short summary string.

## How To Train It Properly

## Step 1. Build an annotation schema first

Before collecting more data, define a stable schema for:
- clause boundaries
- clause types
- risk labels
- entity labels
- normalized values

If the schema is unstable, the dataset quality will collapse.

## Step 2. Use a real labeling workflow

Recommended tools:
- Label Studio
- Doccano
- Prodigy

You need:
- annotation guidelines
- examples and counterexamples
- reviewer agreement checks
- spot audits

## Step 3. Start with baseline models, then move up

Reasonable progression:
- regex + classical ML baseline
- transformer encoder for clause type and risk
- token/span model for entity extraction
- contract-level reasoning layer on top

## Step 4. Keep strict train/dev/test splits

Split by document, not by clause only.

If clauses from the same agreement appear in both train and test, metrics will look falsely strong.

## Step 5. Measure the right metrics

You should track:
- clause boundary F1
- clause type macro F1
- per-class precision/recall
- risk macro F1
- calibration error
- NER span F1
- exact match / relaxed match for structured fields
- end-to-end document success rate

Also measure by slice:
- OCR vs native PDF
- sports vs commercial
- Indian vs non-Indian drafting
- short vs long clauses

## Step 6. Add active learning

This is one of the highest leverage improvements.

Loop:
1. model predicts
2. collect low-confidence / high-disagreement cases
3. send those for annotation
4. retrain

This improves data efficiency much faster than random labeling.

## What A Strong Real-World Architecture Could Look Like

Recommended target stack:

1. OCR / document normalization layer
2. clause segmentation layer
3. clause type multi-label classifier
4. legal field extraction layer
5. risk scoring layer
6. retrieval against playbook / precedent / rulebook
7. explanation layer

Use the ML model for:
- structure
- labeling
- extraction

Use retrieval and reasoning for:
- comparison
- recommendation
- drafting guidance

Do not ask one tiny classifier to do all of legal review.

## Short-Term Improvements Without Rebuilding Everything

If you want the fastest meaningful progress while keeping the current design style:

- increase dataset size by at least 10x
- add OCR-noisy examples
- fix rupee symbol extraction
- stop filtering out non-high-risk clauses
- add more clause types
- populate `extracted_values`
- add probability outputs
- add evaluation scripts and saved metrics
- create a real training script for clause/risk models
- version models and datasets properly

These steps alone would make the current stack much less fragile.

## Medium-Term Improvements

- replace clause and risk TF-IDF models with transformer classifiers
- build a separate clause segmentation task
- train a better legal NER / field extractor
- move from single-label clause typing to multi-label typing
- add contract-context-aware risk scoring

## Long-Term Improvements

- use hierarchical document modeling
- build a legal ontology / clause taxonomy
- create human feedback loops from actual reviewer corrections
- maintain benchmark sets by contract family
- support multilingual or mixed-jurisdiction drafting if needed

## Final Assessment

Right now the ML layer is:
- useful as a demo baseline
- understandable
- fast
- easy to integrate

But it is not yet ready for dependable real-world contract analysis because:
- the data is too small
- the clause segmentation is brittle
- the label space is incomplete
- risk is under-modeled
- NER is undertrained
- structured extraction is mostly absent
- training is not reproducible from the repo
- evaluation is not production-grade

If the goal is a system that really works in production, the priority order should be:

1. better annotated data
2. proper clause segmentation
3. richer clause/risk schema
4. stronger models
5. evaluation and reproducibility
6. confidence and review workflows

## Highest-Priority Recommendations

If you only do five things next, do these:

1. Build a reproducible training pipeline for clause, risk, and NER.
2. Expand the labeled dataset dramatically, especially with OCR-noisy real contracts.
3. Replace single-label shallow clause typing with richer clause taxonomy and multi-label classification.
4. Add true structured extraction, not only summary strings.
5. Evaluate on real held-out documents by domain and OCR quality before trusting production behavior.

