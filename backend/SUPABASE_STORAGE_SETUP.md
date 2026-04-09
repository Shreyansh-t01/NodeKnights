# Supabase Storage Setup

This backend keeps **Firestore** for structured contract data and uses **Supabase Storage** only for document artifacts.

## What Supabase stores

When enabled, the backend stores:

- raw uploaded files at `contracts/raw/{contractId}/{safeName}`
- extracted text files at `contracts/derived/{contractId}/extracted.txt`

Firestore still stores:

- contract record
- clauses
- risks
- artifact references

## Required env vars

Fill these in `backend/.env`:

```env
ARTIFACT_STORAGE_MODE=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxx
SUPABASE_STORAGE_BUCKET=your_bucket_name
```

Keep your Firestore env vars as they already are:

```env
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

## Bucket settings

Create a **private** bucket in Supabase Storage.

Recommended settings:

- max file size: `20 MB`
- allowed MIME types:
  - `application/pdf`
  - `text/plain`
  - `image/png`
  - `image/jpeg`
  - `image/jpg`
  - `image/webp`

These match [upload.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/middlewares/upload.js#L6).

## How the backend behaves

Artifact storage mode is controlled by:

- `disabled`
- `local`
- `supabase`

Behavior:

- `disabled`: do not store raw/extracted artifacts
- `local`: store artifacts under `backend/tmp/...`
- `supabase`: upload artifacts into your Supabase bucket

If Supabase upload fails for one request:

- the backend does not crash
- that artifact is marked as disabled for that request
- Firestore/Pinecone processing can still continue

## Files changed for this integration

- `backend/config/env.js`
- `backend/config/supabase.js`
- `backend/services/storage.service.js`
- `backend/controllers/health.controller.js`
- `backend/package.json`

## Verification steps

1. Fill the Supabase env vars.
2. Set `ARTIFACT_STORAGE_MODE=supabase`.
3. Restart the backend.
4. Check `GET /api/health`.
5. Confirm:
   - `services.supabaseStorage.enabled` is `true`
   - `services.supabaseStorage.mode` is `supabase`
   - `services.artifactStorage.mode` is `supabase`
6. Upload one contract.
7. Confirm the uploaded files appear in your Supabase bucket.
8. Confirm Firestore contract creation still works.

## Artifact URI format

The backend records uploaded Supabase artifacts like this:

```js
{
  mode: 'supabase',
  path: 'contracts/raw/contract_xxx/file.pdf',
  uri: 'supabase://bucket-name/contracts/raw/contract_xxx/file.pdf',
  bucket: 'bucket-name'
}
```

## Important note about keys

Use a **server-side secret key** in the backend:

- `SUPABASE_SECRET_KEY=sb_secret_...`

Do not use a browser publishable key for backend uploads.
