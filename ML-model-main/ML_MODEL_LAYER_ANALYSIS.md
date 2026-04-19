# ML Model Layer Analysis

Date: 2026-04-19

## Scope

This review covers the current Python ML service under `ML-model-main/ml-service`, mainly:

- `app/predictor.py`
- `app/utils.py`
- `app/main.py`
- `app/schemas.py`
- `app/config.py`
- `data/clause_train.csv`
- `data/risk_train.csv`
- `data/ner_train.json`
- `models/ner`
- `models/clause_classifier/clause_model.pkl`
- `models/risk_detector/risk_model.pkl`
- `scripts/export_model.py`

I did not change the model code. This document is a technical analysis of what exists now, what will break in real-world usage, and how to turn it into a trainable, production-capable ML layer.

## Executive Summary

The current ML layer is a good prototype, but it is not ready for real-world contract intelligence.

At the moment, the system is closer to a heuristic extraction service with a few lightweight ML components than a fully trained legal AI pipeline. The main reasons are:

- The learned models are tiny TF-IDF + Logistic Regression classifiers with very small datasets.
- Core behavior is dominated by hardcoded keyword heuristics in `app/predictor.py`.
- Clause segmentation is regex-based and often merges or breaks clauses incorrectly.
- The NER dataset is extremely small and the training pipeline is not reproducible from the repo.
- Important contract information is filtered out before being returned.
- Structured values are detected only with a few regexes, and `extracted_values` is always empty.
- The repo contains inference artifacts, but not a complete training and evaluation pipeline.

My overall conclusion:

- This can work as a demo or internal prototype.
- It will not be reliable on noisy real contracts, scanned images, long agreements, diverse jurisdictions, or novel drafting styles.
- To make it production-capable, the biggest need is not "tweaking the current model" but redesigning the training data, task definitions, evaluation, and serving pipeline.

## What The Current ML Layer Actually Does

### 1. Runtime Flow

`app/main.py` exposes a single `/analyze` endpoint, which lazy-loads `app.predictor.analyze_text`.

`app/predictor.py` then does the following:

1. Runs NER using a spaCy model if available.
2. Adds regex-based `MONEY`, `DATE`, `DURATION`, and `PERCENTAGE`.
3. Splits the document into clause-like chunks using rules in `app/utils.py`.
4. Predicts clause type using heuristics first, then a serialized scikit-learn classifier.
5. Predicts risk using heuristics first, then a serialized scikit-learn classifier.
6. Builds a short clause summary.
7. Filters the result to only a small set of clause types or anything marked `high` risk.

### 2. Models In Use

The serialized models are:

- Clause classifier: `TfidfVectorizer(ngram_range=(1,2))` + `LogisticRegression`
- Risk classifier: `TfidfVectorizer(ngram_range=(1,2))` + `LogisticRegression`
- NER: spaCy pipeline with only `ner`

Observed artifact classes:

- Clause classes: `confidentiality`, `dispute_resolution`, `other`, `payment`, `penalty`, `termination`
- Risk classes: `high`, `low`, `medium`
- NER labels: `DATE`, `DURATION`, `LOCATION`, `MONEY`, `ORG`, `PARTY`

## What Is Good In The Current Design

There are a few solid choices here for a first version:

- The service is simple and easy to run.
- There is graceful fallback behavior if the spaCy model or pickled models are missing.
- The ML service is isolated behind a FastAPI endpoint, which is a good boundary.
- The current design is fast enough for prototyping because TF-IDF + Logistic Regression is cheap at inference time.
- Some heuristics are useful as guardrails for obvious clauses like payment, termination, or arbitration.

That said, those same heuristics become a limitation once the system is expected to generalize.

## Key Problems In The Current ML Layer

## 1. Heuristics dominate the behavior

In `app/predictor.py`, `predict_clause_type()` and `predict_risk()` both apply hardcoded keyword rules before or over the learned models.

Examples:

- Confidentiality is detected from words like `confidential`, `non-disclosure`, `must remain confidential`.
- Dispute clauses are detected from `dispute`, `arbitration`, `tribunal`, `court`.
- Governing law is detected from `governed by`, `governing law`, `laws of india`, `indian law`.
- Risk is forced upward for phrases like `without notice`, `immediately`, `sole discretion`.

Why this is a problem:

- The system behaves like a rule engine with ML attached, not the other way around.
- Performance on the small dev examples may look better than the learned models actually are.
- New phrasings that do not match the keywords will be missed.
- Slight wording changes can produce unstable behavior.
- It becomes hard to improve the system by training, because the hardcoded logic is masking model weaknesses.

Real-world impact:

- Contracts written by different firms, jurisdictions, or OCR pipelines will vary too much for this approach to be dependable.

## 2. Clause segmentation is too weak for real contracts

`app/utils.py` uses rule-based splitting:

- numbered sections
- headings
- paragraph grouping
- sentence chunking with `max_sentences=2`

This is okay for clean short samples, but real agreements are much messier:

- one numbered section may contain several obligations
- one obligation may span more than two sentences
- headings are inconsistent
- OCR often destroys formatting
- tables, annexures, definitions, and cross-references break simple regex splitting

Observed consequence:

- A governing-law sentence and a dispute sentence were merged into one chunk in a live sample.
- That merged chunk was returned only as `dispute_resolution`, so the governing-law signal was effectively lost.

This is one of the most important bottlenecks in the whole pipeline. If clause boundaries are wrong, everything downstream is wrong.

## 3. Important clauses are filtered out before returning results

`app/predictor.py` only returns clauses whose `clause_type` is in:

- `payment`
- `termination`
- `penalty`
- `confidentiality`
- `dispute_resolution`

or whose `risk_label` is `high`.

Problems:

- `governing_law` is detected by the predictor, but it is not in `IMPORTANT_TYPES`.
- Any clause not in the allowlist disappears from the API response even if it was classified correctly.
- This means the rest of the system never sees a full contract structure.

For a real contract system, hiding non-allowlisted clauses is usually the wrong behavior. Even if the UI only highlights some clauses, the backend should preserve all extracted structure.

## 4. Structured extraction is mostly missing

`ClauseResult` includes `extracted_values`, but in `app/predictor.py` it is always returned as `{}`.

Right now, the system extracts:

- `MONEY` via regex
- `DATE` via regex
- `DURATION` via regex
- `PERCENTAGE` via regex
- `ORG`, `PARTY`, `LOCATION` from spaCy

But it does not actually normalize and attach these values to the clause in structured form, for example:

- payer
- payee
- payment amount
- currency
- due date
- renewal term
- notice period
- jurisdiction
- governing law
- termination trigger
- penalty amount

Without normalized fields, downstream use is limited. A real product needs machine-readable contract facts, not only clause labels and loose strings.

## 5. The money extraction regex contains an encoding bug

In `app/utils.py`, `extract_money()` includes `â‚¹` instead of the proper Unicode rupee symbol `₹`.

Why this matters:

- Indian contracts often use `₹`.
- If the OCR or upload path preserves the real rupee symbol, extraction may fail.
- This is exactly the kind of data-cleanliness issue that hurts production accuracy in small but important ways.

This is not a modeling limitation by itself, but it shows the pipeline is not hardened for real document text.

## 6. The training assets are tiny

Measured training data in the repo:

- Clause classification rows: `135`
- Risk classification rows: `78`
- NER training examples: `20`

Clause label counts:

- `payment`: 20
- `termination`: 20
- `penalty`: 20
- `confidentiality`: 20
- `dispute_resolution`: 20
- `other`: 20
- `governing_law`: 15

Risk label counts:

- `high`: 30
- `medium`: 22
- `low`: 26

NER label counts:

- `MONEY`: 12
- `PARTY`: 12
- `ORG`: 11
- `DURATION`: 8
- `LOCATION`: 8
- `DATE`: 6

Average sample length:

- Clause dataset: `58.3` characters
- Risk dataset: `59.47` characters

This is far too small and too short for production legal NLP. These samples look like curated template snippets, not the distribution of actual contract language.

## 7. Current baseline quality is modest even on tiny in-domain data

I ran a simple 5-fold cross-validation baseline using the same family of models:

- Clause classification accuracy: `0.6741`
- Clause classification macro F1: `0.6688`
- Risk classification accuracy: `0.6675`
- Risk classification macro F1: `0.5872`

Interpretation:

- These numbers are not terrible for a toy baseline.
- They are not strong enough for real contract automation.
- Because the datasets are tiny and homogeneous, even these numbers may be optimistic compared with real-world performance.
- Risk classification is especially weak.

For a system that users may trust for legal insight, macro F1 around `0.59` on a tiny, curated dataset is not enough.

## 8. The clause classifier artifact does not match the training CSV

The training CSV includes `governing_law`.

However, the serialized clause model classes do not include `governing_law`.

That means at least one of the following is true:

- the pickled model was trained on an older dataset
- the training/export process did not include all labels
- the model artifacts and repo data are out of sync

This is a serious reproducibility issue. If training data and deployed artifacts are mismatched, you cannot trust retraining, debugging, or error analysis.

## 9. The training pipeline is not reproducible from the repo

I found no proper end-to-end training pipeline in the repo.

Observed issues:

- `scripts/export_model.py` is empty
- `models/ner/config.cfg` has `train = null` and `dev = null`
- There is no clear training script for clause classification
- There is no clear training script for risk classification
- There is no evaluation script that writes metrics artifacts
- There is no dataset versioning or model versioning flow

So right now the repo behaves more like:

- inference code
- some baked model artifacts
- some sample training files

rather than a real trainable ML system.

## 10. The system is not designed for OCR-heavy real documents

Your system is intended to work on uploaded contracts, including image-based contracts and scanned documents.

That introduces problems the current ML layer is not prepared for:

- OCR noise
- broken line wraps
- merged words
- incorrect punctuation
- header/footer contamination
- page numbers mixed into text
- tables and signatures
- multilingual fragments
- stamp/seal text

The current training data is clean and synthetic-looking. There is no sign that the models were trained on OCR outputs or layout-corrupted text.

As a result, the production failure mode will likely be:

- acceptable on short clean text
- poor on real scanned contracts

## 11. NER is too small and too narrow for contract intelligence

The NER model has only `20` examples total.

That is not enough for a dependable legal NER model, especially when contracts require more than basic named entities.

Important missing or underdeveloped entity/value categories include:

- governing law
- court / seat of arbitration
- effective date
- execution date
- renewal date
- notice period
- cure period
- liability cap
- indemnity trigger
- exclusivity term
- deliverable
- milestone
- invoice cycle
- tax clause references
- confidentiality exceptions
- termination for convenience / cause
- assignment / subcontracting permissions

Also, contract extraction is often not best framed as vanilla NER. Many fields are better handled as:

- span classification
- slot filling
- document QA
- clause-level relation extraction

## 12. There are no confidence scores or calibration

The API returns a label, but not:

- prediction confidence
- margin / probability
- abstention decision
- low-confidence routing

Without confidence and calibration:

- the UI cannot tell users when the model is uncertain
- the system cannot trigger human review intelligently
- bad predictions look the same as good predictions

For legal workflows, abstaining on uncertain cases is usually better than pretending to know.

## 13. The output summaries may lose legal nuance

`make_short_clause_text()` compresses clauses into simplified summaries like:

- `Payment of Rs 50,000 for 30 days`
- `Disputes to be resolved by arbitration in Mumbai`

This is helpful for UI display, but dangerous if used as a substitute for the real text, because it may drop:

- conditions
- exceptions
- party roles
- timing logic
- liability triggers

This is fine as a convenience layer, but not as the main representation of legal meaning.

## 14. Serving and artifact management need hardening

I observed a scikit-learn warning while loading the pickled models:

- artifacts were serialized under scikit-learn `1.6.1`
- the local environment used `1.8.0`

That kind of version drift can cause silent model instability in production.

At minimum, the ML layer needs:

- pinned training and serving dependencies
- reproducible model export
- artifact metadata
- checksum/version tracking

## What This Means In Practice

If you try to use this model layer on real contracts, the likely failure modes are:

- clauses split incorrectly
- many clause types not returned at all
- risk labels assigned from keywords instead of actual legal semantics
- OCR text causing major recall drop
- missing structured values
- inconsistent behavior across document styles
- retraining becoming unreliable because the artifacts are not reproducible

So the main issue is not only "the model is small." It is that the entire ML problem framing is still prototype-level.

## How To Make This Better

The right approach is to split the problem into separate trainable tasks and build a data pipeline around them.

## Recommended Task Breakdown

### 1. Document ingestion and normalization

Before ML, build a stronger preprocessing layer:

- OCR normalization
- page/paragraph cleanup
- header/footer removal
- table detection
- bullet and numbering preservation
- section boundary recovery
- sentence normalization without destroying legal phrasing

For scanned/image-heavy contracts, this matters as much as the classifier itself.

### 2. Clause segmentation

Do not rely only on regex splitting.

Better options:

- a hybrid parser that uses numbering, headings, indentation, and punctuation
- a sequence labeling model that predicts clause boundaries
- a sentence-pair or token-level boundary classifier
- if layout matters, a document-layout model for PDF/image inputs

Recommended output:

- clause span start/end
- section title
- page number
- raw text
- normalized text

### 3. Clause type classification

Move from heuristic-first classification to a real trained classifier.

Recommended direction:

- start with stronger text encoders such as Legal-BERT, RoBERTa, ModernBERT, or another encoder that handles long legal text reasonably well
- support multi-label classification, because many clauses express more than one concept
- include document context, section title, and neighboring clauses as features

Why multi-label matters:

- a clause can be both `termination` and `notice`
- a clause can be both `dispute_resolution` and `governing_law`
- a clause can contain payment plus penalty logic

Single-label classification is too restrictive for contracts.

### 4. Risk scoring

Risk should not be treated as a generic 3-class text label only.

A better approach is:

- define risk taxonomy clearly
- score risk by clause type
- include party perspective
- include rationale spans
- separate legal severity from business undesirability

Recommended modeling:

- clause-type-aware risk model
- ranking/regression or ordinal classification instead of only `low/medium/high`
- rationale extraction so users know why the clause was flagged

Also, risk labels should come from legal review guidelines, not just generic lexical cues.

### 5. Contract fact extraction

This is where real product value comes from.

Instead of returning only clause labels, train extractors for structured fields such as:

- parties
- effective date
- payment amount
- currency
- due date
- notice period
- renewal term
- arbitration seat
- governing law
- termination trigger
- penalty amount
- liability cap
- exclusivity scope

This can be modeled with:

- token classification
- span classification
- question answering
- relation extraction
- schema-guided extraction

For contracts, field extraction is often more useful than pure NER.

## What Data You Need To Train This For Real-World Use

This is the most important section.

## 1. Real contracts, not only synthetic clause snippets

You need a corpus with real variation:

- vendor agreements
- employment contracts
- service agreements
- NDAs
- licensing agreements
- lease agreements
- procurement agreements
- partnership agreements
- sponsorship agreements
- SaaS agreements
- consulting agreements

Also vary by:

- industry
- geography
- drafting style
- law firm
- OCR quality
- scan quality
- contract length
- language mixture

## 2. Annotation at the clause/span level

For each contract, annotate:

- clause boundaries
- clause type, possibly multi-label
- key entities and values
- field relationships
- risk label
- risk rationale
- page/span offsets

Recommended annotation schema per clause:

- `document_id`
- `section_id`
- `page`
- `clause_start_char`
- `clause_end_char`
- `clause_text`
- `clause_types[]`
- `risk_score`
- `risk_label`
- `risk_rationale_spans[]`
- `entities[]`
- `normalized_fields{}`

## 3. Suggested minimum data scale

Rough starting targets for something meaningfully useful:

- Clause segmentation/classification: `5,000` to `20,000` contracts, yielding `100,000+` labeled clauses
- Risk scoring: at least `20,000` to `50,000` expert-labeled clauses
- Entity/value extraction: `30,000+` annotated field instances across contract types
- OCR-robust set: a dedicated benchmark of scanned/image-derived contracts, not only native PDFs

If budget is limited, start smaller, but the current scale of `135 / 78 / 20` is far below what is needed.

## 4. Hard negative examples

Your dataset must include confusing near-misses:

- clauses mentioning payment without actually creating a payment obligation
- references to law that are not governing-law clauses
- arbitration terms inside definitions or schedules
- dates that are execution dates vs due dates vs renewal dates
- clauses with risk language that are actually standard and acceptable

Without hard negatives, the model will memorize keywords.

## 5. Human labeling guidelines

You will need consistent annotation rules.

For example:

- what counts as `termination` vs `termination_notice`
- what makes a clause `high` risk
- whether governing law and dispute resolution can co-exist on one span
- how to label boilerplate
- how to normalize values from text

If label guidelines are weak, more data will not solve the problem.

## Recommended Model Stack For A Real Product

## Phase 1: Stronger but still practical baseline

This is the quickest serious upgrade path.

- Keep the FastAPI service boundary.
- Replace single-label TF-IDF clause classification with transformer fine-tuning.
- Keep heuristics only as fallback, not as the main decision path.
- Return all clauses, not only allowlisted ones.
- Add confidence scores.
- Add clause boundary evaluation.
- Build real training/export scripts.

Good first models:

- `Legal-BERT`-style encoder for clause classification
- transformer token classifier for extraction
- calibrated classifier or ordinal model for risk

## Phase 2: Contract-aware extraction pipeline

- clause segmentation model
- multi-label clause classifier
- field extraction model
- clause-to-field relation logic
- document-level aggregation layer

This is where the system becomes truly useful.

## Phase 3: OCR and layout-aware robustness

For scanned/image contracts:

- preserve page coordinates
- use OCR confidence
- use layout blocks
- consider document-layout models when text order is unreliable

If your product depends heavily on image uploads, this phase is essential.

## How I Would Train It

A practical training plan would look like this:

## 1. Build reproducible datasets

- version the raw documents
- version the annotations
- freeze train/dev/test splits
- keep OCR text and original documents linked

Do not train from ad hoc CSV fragments only.

## 2. Define separate training tasks

Train separate models or heads for:

- clause boundary detection
- clause type classification
- risk scoring
- entity/value extraction

Do not force one tiny model to solve everything.

## 3. Use stronger evaluation

For each task, track the right metrics:

- Clause segmentation: boundary precision, recall, F1
- Clause classification: macro F1, per-label F1, confusion matrix
- Risk: macro F1, weighted F1, calibration error, PR curves
- Extraction: exact match, partial match, span F1, field-level accuracy

Also evaluate on:

- native PDF text
- OCR text
- unseen contract templates
- unseen counterparties
- unseen jurisdictions

## 4. Add abstention and human review

In legal systems, the model should be able to say:

- low confidence
- conflicting signals
- human review required

This is often more valuable than trying to force full automation.

## 5. Run error analysis after every training cycle

Track failures by:

- contract type
- OCR quality
- clause length
- class frequency
- law firm/template
- scan quality

That is how you learn whether the model is improving in a product-relevant way.

## Specific Improvements I Would Recommend Immediately

These are the highest-leverage next steps, even before a major rebuild.

1. Create real training scripts for clause classification, risk, and NER.
2. Add deterministic train/dev/test splits and save metrics artifacts.
3. Return all detected clauses to the backend, not only allowlisted ones.
4. Add confidence scores to clause and risk predictions.
5. Replace the current clause dataset with a much larger, more realistic clause corpus.
6. Replace the current risk dataset with legally reviewed examples and rationale labels.
7. Redesign extraction around structured contract fields, not just entity strings.
8. Build a dedicated OCR/noisy-text evaluation set.
9. Remove artifact/data mismatch so deployed pickles reflect the actual labeled data.
10. Decide whether the product goal is clause detection, risk review, field extraction, or all three, then train each task explicitly.

## If You Want This To Work In Real-World Legal Scenarios

The model needs to become:

- less heuristic-driven
- more data-driven
- more reproducible
- more contract-structure-aware
- more robust to OCR and layout issues
- more transparent about confidence and uncertainty

Most importantly, it needs much better training data.

If you collect strong labeled legal data and redesign the pipeline around clause boundaries, multi-label classification, structured extraction, and calibrated risk scoring, this can absolutely become a strong system.

If you keep the current architecture and only tweak keywords or add a few more rows to the CSVs, it will remain a demo.

## Bottom Line

Today, this ML layer is a prototype inference stack with:

- lightweight classifiers
- very small datasets
- non-reproducible training
- heuristic-heavy logic
- weak clause segmentation
- minimal structured extraction

To make it production-ready, the biggest investment should go into:

1. better real-world contract data
2. proper annotation design
3. reproducible training/evaluation pipelines
4. stronger clause, risk, and extraction models
5. OCR/layout robustness

That is the path from "works on sample text" to "works on real contracts."
