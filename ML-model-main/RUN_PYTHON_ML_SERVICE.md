# Run Python ML Service

This file contains the exact command to start the Python ML backend service for contract analysis.

## PowerShell command

Open a new PowerShell terminal and run:

```powershell
cd d:\PROJECTS\SOLUTIONHACKATHON
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir .\ML-model-main\ml-service --port 8001 --reload
```

## What this does

- uses your local project virtual environment
- starts the FastAPI app from `app.main`
- points Uvicorn to `ML-model-main/ml-service`
- runs the service on `http://127.0.0.1:8001`
- enables auto-reload during development

## Quick health check

After starting the service, run this in another terminal:

```powershell
Invoke-WebRequest http://127.0.0.1:8001/
```

Expected response:

```json
{"message":"Legal text ML service is running"}
```

## If you do not want auto-reload

Use this instead:

```powershell
cd d:\PROJECTS\SOLUTIONHACKATHON
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir .\ML-model-main\ml-service --port 8001
```

## Important note

Keep this terminal open while using the Node.js backend, because the backend sends contract text to:

```text
http://127.0.0.1:8001/analyze
```
