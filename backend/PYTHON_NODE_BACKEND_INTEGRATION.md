# Python Model to Node.js Backend Integration

This file explains how the trained Python legal-analysis model is connected to the Node.js backend in this project.

## Integration style

The connection is implemented as a **service-to-service HTTP integration**.

- The **Python side** runs as a FastAPI service.
- The **Node.js side** does not load Python code directly.
- Node sends extracted contract text to Python using an HTTP `POST` request.
- Python returns structured JSON.
- Node converts that JSON into its own internal contract, clause, and risk records.

This keeps the model layer separate from the backend orchestration layer.

## Files involved

### Python ML service

- [ML-model-main/ml-service/app/main.py](/d:/PROJECTS/SOLUTIONHACKATHON/ML-model-main/ml-service/app/main.py)
- [ML-model-main/ml-service/app/predictor.py](/d:/PROJECTS/SOLUTIONHACKATHON/ML-model-main/ml-service/app/predictor.py)
- [ML-model-main/ml-service/app/schemas.py](/d:/PROJECTS/SOLUTIONHACKATHON/ML-model-main/ml-service/app/schemas.py)

### Node.js backend

- [backend/services/mlAnalysis.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/mlAnalysis.service.js)
- [backend/services/contract.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/contract.service.js)
- [backend/config/env.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/config/env.js)
- [backend/.env.example](/d:/PROJECTS/SOLUTIONHACKATHON/backend/.env.example)

## How the flow works

### 1. Node receives a contract

The main ingestion flow starts in the Node backend.

Inside [backend/services/contract.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/contract.service.js), the function `ingestManualContract()` does this:

1. stores the raw file
2. extracts text from PDF, image, or text file
3. sends the extracted text to the Python ML service
4. receives structured ML output
5. converts the ML output into contract, clause, and risk records
6. stores the structured data
7. prepares vectors and insights

## 2. Node calls the Python service

The Node-to-Python connection is implemented in:

- [backend/services/mlAnalysis.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/mlAnalysis.service.js)

The key function is `analyzeWithMlService(text)`.

It sends this request:

```http
POST {ML_SERVICE_URL}/analyze
Content-Type: application/json
```

Request body:

```json
{
  "text": "full extracted contract text here"
}
```

In code, Node uses:

```js
const response = await fetch(`${env.mlServiceUrl}/analyze`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ text }),
});
```

The `ML_SERVICE_URL` value comes from the backend environment configuration.

Example in [backend/.env.example](/d:/PROJECTS/SOLUTIONHACKATHON/backend/.env.example):

```env
ML_SERVICE_URL=http://127.0.0.1:8001
```

## 3. Python receives the text

The Python API endpoint is defined in:

- [ML-model-main/ml-service/app/main.py](/d:/PROJECTS/SOLUTIONHACKATHON/ML-model-main/ml-service/app/main.py)

It exposes:

```python
@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    return analyze_text(request.text)
```

So Python receives the JSON body, reads `request.text`, and passes the raw contract text into your trained model pipeline.

## 4. Python returns structured output

The response schema is described in:

- [ML-model-main/ml-service/app/schemas.py](/d:/PROJECTS/SOLUTIONHACKATHON/ML-model-main/ml-service/app/schemas.py)

The Python service returns JSON shaped like this:

```json
{
  "entities": [
    {
      "text": "Alpha Corp",
      "label": "ORG",
      "start": 10,
      "end": 20
    }
  ],
  "clauses": [
    {
      "clause_text": "Termination without prior notice",
      "clause_type": "termination",
      "risk_label": "high",
      "extracted_values": {}
    }
  ],
  "summary": "Text analysis complete"
}
```

## 5. Node normalizes Python output

Python returns snake_case fields like:

- `clause_text`
- `clause_type`
- `risk_label`
- `extracted_values`

Node converts them into its internal structure inside:

- [backend/services/mlAnalysis.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/mlAnalysis.service.js)

That mapping looks like this conceptually:

```js
clauses: (payload.clauses || []).map((clause) => ({
  clauseText: clause.clause_text || clause.clauseText,
  clauseType: clause.clause_type || clause.clauseType || 'other',
  riskLabel: clause.risk_label || clause.riskLabel || 'low',
  extractedValues: clause.extracted_values || clause.extractedValues || {},
}))
```

This means the Node backend standardizes Python output into a cleaner JavaScript object shape before saving it.

## 6. Node continues the pipeline after ML analysis

After the Python response comes back, Node uses it to build:

- contract metadata
- clause records
- risk records
- semantic-search vectors
- dashboard insights

This logic is handled in:

- [backend/services/contract.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/contract.service.js)
- [backend/services/contract.helpers.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/contract.helpers.js)
- [backend/services/vector.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/vector.service.js)
- [backend/services/insight.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/insight.service.js)

So the Python service is responsible for **intelligence extraction**, while the Node backend is responsible for **workflow orchestration**.

## Why this design was used

I implemented it this way for these reasons:

1. Your trained model already exists in Python, so we should not rewrite that logic in Node.
2. FastAPI is a clean way to expose the trained model as a reusable ML microservice.
3. Node.js stays focused on uploads, storage, connectors, Pinecone, Firebase, and dashboard APIs.
4. The separation makes it easier to upgrade or retrain the Python model without changing the whole backend.
5. This is the standard production pattern for connecting Node apps with Python ML systems.

## Fallback behavior

If the Python ML service is not running or fails, Node does not crash the entire ingestion flow.

Inside [backend/services/mlAnalysis.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/mlAnalysis.service.js):

- `analyzeContractText()` first tries the Python service
- if that fails, it falls back to `analyzeLocally(text)`

That local fallback uses simple heuristic rules in Node to keep the system usable during development.

So the behavior is:

1. try Python ML service first
2. if unavailable, use heuristic Node fallback

## Startup sequence

To use the real trained model connection:

### Start Python ML service

From the ML service folder:

```powershell
cd ML-model-main\ml-service
python -m uvicorn app.main:app --reload --port 8001
```

### Start Node backend

From the backend folder:

```powershell
cd backend
npm run start
```

Node will then call:

```text
http://127.0.0.1:8001/analyze
```

unless you change `ML_SERVICE_URL` in the backend `.env`.

## Simple end-to-end summary

The connection is:

```text
Node backend -> HTTP POST /analyze -> FastAPI Python service -> trained model -> JSON response -> Node backend pipeline
```

In short:

- **Python** does model inference
- **Node** manages the full product workflow around that inference
