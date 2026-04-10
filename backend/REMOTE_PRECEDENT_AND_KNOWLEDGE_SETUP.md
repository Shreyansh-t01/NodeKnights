# Remote Precedent And Knowledge Setup

Date: 2026-04-10

This guide explains the deployed storage model for:

- precedent clauses
- rulebooks / policies / playbooks
- side-by-side clause insights

The implementation now uses your existing remote stack:

- Firestore for structured records
- Pinecone for semantic retrieval
- Gemini for grounded actionable insight text

`backend/data/rulebook.json` still exists, but it is now only a fallback benchmark. Your deployed precedent bank and policy bank should live in Firestore + Pinecone.

## What Was Added

### Backend routes

- `POST /api/precedents/upload`
- `POST /api/precedents/entries`
- `GET /api/precedents`
- `GET /api/precedents/:precedentId`
- `GET /api/precedents/review/:contractId/:clauseId`

- `POST /api/knowledge/upload`
- `POST /api/knowledge/entries`
- `POST /api/knowledge/search`
- `GET /api/knowledge`
- `GET /api/knowledge/:knowledgeId`

### Insight behavior

`GET /api/contracts/:contractId/insights`

now returns clause insight cards that include:

- `currentClause`
- `precedentClause`
- `precedentMatches`
- `ruleMatches`
- Gemini-generated `whyItIsRisky`
- Gemini-generated `comparison`
- Gemini-generated `recommendedChange`

The frontend insights panel now renders the current clause and best precedent side by side.

## Where Data Is Stored

### Firestore

Contracts keep using the existing `contracts` collection.

New deployed collections:

- `precedents`
- `knowledge_documents`

Structure:

```text
precedents/{precedentId}
precedents/{precedentId}/clauses/{clauseId}

knowledge_documents/{knowledgeId}
knowledge_documents/{knowledgeId}/chunks/{chunkId}
```

### Pinecone

Use separate namespaces:

- `contracts`
- `precedents`
- `knowledge`

Environment variables:

```env
PINECONE_CONTRACT_NAMESPACE=contracts
PINECONE_PRECEDENT_NAMESPACE=precedents
PINECONE_KNOWLEDGE_NAMESPACE=knowledge
```

This separation matters because:

- contracts are the live reviewed documents
- precedents are approved comparison language
- knowledge is normative benchmark guidance

## What You Need To Do From Your Side

1. Configure Firebase Admin credentials in `backend/.env`.

```env
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

2. Configure Pinecone in `backend/.env`.

```env
PINECONE_API_KEY=...
PINECONE_INDEX_HOST=...
PINECONE_CONTRACT_NAMESPACE=contracts
PINECONE_PRECEDENT_NAMESPACE=precedents
PINECONE_KNOWLEDGE_NAMESPACE=knowledge
EMBEDDING_DIMENSION=128
```

3. Configure Gemini in `backend/.env`.

```env
GENAI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
```

4. Keep `STRICT_REMOTE_SERVICES=true` in deployment if you want the app to fail fast when Firestore/Pinecone are missing.

5. Start the backend.

```powershell
cd backend
npm run dev
```

6. Seed precedents into the remote precedent bank.

7. Seed rules / policies / playbooks into the remote knowledge bank.

8. Upload live contracts through the normal contract upload flow.

9. Open the Insights page or call:

```text
GET /api/contracts/:contractId/insights
```

High-risk clauses will now retrieve:

- best precedent clause matches
- relevant policy / rule matches
- Gemini-generated actionable guidance

## Step 1: Insert Approved Precedent Clauses

Use this when you already know which clauses are approved precedents.

Endpoint:

```text
POST /api/precedents/entries
```

Body:

```json
{
  "title": "Approved MSA Clauses 2026",
  "source": "manual-entry",
  "contractType": "Master Services Agreement",
  "organization": "Internal Legal",
  "jurisdiction": "India",
  "tags": ["approved", "gold-standard"],
  "clauses": [
    {
      "sectionHeading": "Termination",
      "clauseType": "termination",
      "riskLabel": "low",
      "clauseTextFull": "Either party may terminate for material breach only after 30 days written notice and a cure opportunity.",
      "clauseTextSummary": "Termination only after written notice and cure period"
    },
    {
      "sectionHeading": "Confidentiality",
      "clauseType": "confidentiality",
      "riskLabel": "low",
      "clauseTextFull": "Confidentiality obligations apply for three years after termination, subject to legal disclosure and prior knowledge exceptions.",
      "clauseTextSummary": "Confidentiality with carve-outs and survival period"
    }
  ]
}
```

### PowerShell example

```powershell
$body = @{
  title = "Approved MSA Clauses 2026"
  source = "manual-entry"
  contractType = "Master Services Agreement"
  organization = "Internal Legal"
  jurisdiction = "India"
  tags = @("approved", "gold-standard")
  clauses = @(
    @{
      sectionHeading = "Termination"
      clauseType = "termination"
      riskLabel = "low"
      clauseTextFull = "Either party may terminate for material breach only after 30 days written notice and a cure opportunity."
      clauseTextSummary = "Termination only after written notice and cure period"
    }
  )
} | ConvertTo-Json -Depth 8

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/precedents/entries" `
  -ContentType "application/json" `
  -Body $body
```

## Step 2: Insert Rules / Policies / Playbooks

Use this when you want benchmark guidance to be retrieved alongside precedents.

Endpoint:

```text
POST /api/knowledge/entries
```

Body:

```json
{
  "title": "Termination Playbook 2026",
  "source": "manual-entry",
  "sourceType": "playbook",
  "documentType": "policy",
  "organization": "Internal Legal",
  "jurisdiction": "India",
  "version": "2026.1",
  "topics": ["termination", "notice", "cure period"],
  "rules": [
    {
      "sectionTitle": "Termination benchmark",
      "clauseType": "termination",
      "primaryConcern": "Termination clauses should avoid unilateral immediate exit without notice or cure mechanics.",
      "benchmark": "Balanced clauses include written notice, a cure window, survival terms, and clear post-termination responsibilities.",
      "recommendedAction": "Add notice, cure, and post-termination obligations before approval."
    }
  ]
}
```

### PowerShell example

```powershell
$body = @{
  title = "Termination Playbook 2026"
  source = "manual-entry"
  sourceType = "playbook"
  documentType = "policy"
  organization = "Internal Legal"
  jurisdiction = "India"
  version = "2026.1"
  topics = @("termination", "notice", "cure period")
  rules = @(
    @{
      sectionTitle = "Termination benchmark"
      clauseType = "termination"
      primaryConcern = "Termination clauses should avoid unilateral immediate exit without notice or cure mechanics."
      benchmark = "Balanced clauses include written notice, a cure window, survival terms, and clear post-termination responsibilities."
      recommendedAction = "Add notice, cure, and post-termination obligations before approval."
    }
  )
} | ConvertTo-Json -Depth 8

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/knowledge/entries" `
  -ContentType "application/json" `
  -Body $body
```

## Step 3: Upload A Precedent Document File

If you have a PDF or text file containing approved clauses:

Endpoint:

```text
POST /api/precedents/upload
```

Form fields:

- `file`
- `title`
- `contractType`
- `organization`
- `jurisdiction`
- `note`
- `tags` as comma-separated text

The backend will:

1. extract text
2. analyze clauses
3. store the structured precedent in Firestore
4. index clause embeddings into the `precedents` Pinecone namespace

## Step 4: Upload A Rulebook / Policy File

Endpoint:

```text
POST /api/knowledge/upload
```

Form fields:

- `file`
- `title`
- `sourceType`
- `documentType`
- `organization`
- `jurisdiction`
- `version`
- `clauseType`
- `clauseTypes` as comma-separated text
- `topics` as comma-separated text

The backend will:

1. extract text
2. chunk the document
3. store the document and chunks in Firestore
4. index chunks into the `knowledge` Pinecone namespace

## How Retrieval Works During Insight Generation

When a contract has a high-risk clause:

1. the clause is identified from the stored contract
2. the system queries Pinecone `precedents` namespace for similar precedent clauses
3. the system queries Pinecone `knowledge` namespace for matching policies / rules
4. the system sends:
   - current clause
   - top precedent match
   - additional precedent matches
   - rule matches
   to Gemini
5. the insight route returns side-by-side review data

## How To Check What Was Stored

### List precedents

```text
GET /api/precedents
```

### Read one precedent

```text
GET /api/precedents/:precedentId
```

### List knowledge documents

```text
GET /api/knowledge
```

### Read one knowledge document

```text
GET /api/knowledge/:knowledgeId
```

### Search knowledge only

```text
POST /api/knowledge/search
```

Example body:

```json
{
  "query": "termination clause notice cure period",
  "clauseType": "termination",
  "topK": 5
}
```

## Recommended Operating Pattern

Use these sources in this order:

1. manual precedent clauses for your best approved language
2. manual policy/playbook rules for benchmark guidance
3. file uploads for larger precedent sets or rulebooks
4. contract uploads for live analysis

This keeps the system grounded:

- contracts = live documents under review
- precedents = approved comparison language
- knowledge = normative benchmark guidance

## Important Note

For deployment, do not rely on `backend/data/rulebook.json` as your main source of truth.

Use:

- Firestore for precedent and knowledge records
- Pinecone for retrieval
- Gemini for the final grounded rewrite guidance

The local rulebook now exists only to keep the insight route from going blank if no remote rule match is available yet.
