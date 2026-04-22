# Deploy ML Service

This folder is the deployable root for the Python ML service.

If your hosting platform supports monorepo root selection, set the service root directory to:

```text
ML-model-main/ml-service
```

Do not deploy the repo root for this service.

## Start command

This service now includes both:

- `railpack.json`
- `Procfile`

The web start command is:

```text
python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}
```

## Required steps

1. Set the root directory to `ML-model-main/ml-service`
2. Ensure the root `requirements.txt` in this folder is installed by the platform
3. Expose the service publicly or privately as needed
4. Point the Node backend `ML_SERVICE_URL` to this deployed service

## Health check

Set the platform health check path to:

- `GET /healthz`

Expected response:

```json
{ "success": true, "service": "legal-text-ml-service", "status": "ready" }
```

After deployment, verify the root route too:

- `GET /`

Expected response:

```json
{ "message": "Legal text ML service is running", "status": "ready" }
```

Then test the lazy-loaded model readiness route:

- `GET /ready`

Finally test analysis:

- `POST /analyze`

with:

```json
{
  "text": "Payment shall be made within 30 days from the invoice date."
}
```
