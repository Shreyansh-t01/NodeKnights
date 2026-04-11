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
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}
```

## Required steps

1. Set the root directory to `ML-model-main/ml-service`
2. Ensure `requirements.txt` is installed by the platform
3. Expose the service publicly or privately as needed
4. Point the Node backend `ML_SERVICE_URL` to this deployed service

## Health check

After deployment, verify:

- `GET /`

Expected response:

```json
{ "message": "Legal text ML service is running" }
```

Then test:

- `POST /analyze`

with:

```json
{
  "text": "Payment shall be made within 30 days from the invoice date."
}
```
