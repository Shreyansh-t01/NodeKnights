# Deploy ML Service

This folder is the deployable root for the Python ML service.

If your hosting platform supports monorepo root selection, set the service root directory to:

```text
ML-model-main/ml-service
```

Do not deploy the repo root for this service.

If you accidentally set the root directory to `ML-model-main`, the parent
`ML-model-main/railpack.json` can still start the same service with
`python ml-service/start.py`. The preferred root is still
`ML-model-main/ml-service` because that is where the deployable app lives.

## Start command

This service now includes both:

- `railpack.json`
- `Procfile`

The web start command is:

```text
python start.py
```

`start.py` reads the platform-provided `PORT`, defaults to `8001` locally, and
sets the app directory explicitly before starting Uvicorn.

## Required steps

1. Set the root directory to `ML-model-main/ml-service`
2. Ensure the root `requirements.txt` in this folder is installed by the platform
3. Expose the service publicly or privately as needed
4. Point the Node backend `ML_SERVICE_URL` to this deployed service

## Railway env warning

Do not manually add `PORT` for this service. Railway provides it at runtime.
Also remove `HOST` if it is set to `localhost` or `127.0.0.1`; the startup
wrapper will force `0.0.0.0` on Railway, but stale service variables can still
make deploy debugging confusing.

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
