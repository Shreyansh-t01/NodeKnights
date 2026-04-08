# Free File Storage Replacement Guide

Checked against the current codebase and current official provider docs on April 8, 2026.

## Short answer

For this backend, the best free replacement for Firebase Storage is **Cloudflare R2**.

Why:

- your code only needs simple object storage
- R2 is object storage, just like Firebase Storage
- R2 has a free tier with `10 GB-month / month`
- R2 is S3-compatible, so Node integration is straightforward
- it matches your current upload pattern better than database-style platforms

Best managed alternative:

- **Supabase Storage**

Best hackathon-friendly alternative if you want a backend platform feel:

- **Appwrite Storage**

## What your system actually needs

Your current storage usage is much simpler than a full Firebase setup.

From the code:

- raw uploaded files are stored in [storage.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/storage.service.js#L38)
- extracted text is stored in [storage.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/storage.service.js#L68)
- uploads come from `multer.memoryStorage()` in [upload.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/middlewares/upload.js#L15)
- max upload size is `20 MB` from [env.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/config/env.js#L73)

Current object paths:

- raw file: `contracts/raw/{contractId}/{sanitizedFileName}`
- extracted text: `contracts/derived/{contractId}/extracted.txt`

Current storage metadata:

- `contractId`
- `source`
- `assetType`

Current returned artifact shape:

```js
{
  mode,
  path,
  uri,
  bucket
}
```

Important observation:

- your backend does **not** currently need advanced Firebase Storage features
- it only needs private object upload for a binary file and a text file
- this means almost any object store can replace Firebase Storage cleanly

## Important architecture note

Right now Firebase Storage and Firestore are enabled together through the same feature flag in [env.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/config/env.js#L107) and initialization flow in [firebase.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/config/firebase.js#L47).

That means:

- replacing only Firebase Storage is not fully clean in the current architecture
- the better design is to separate:
  - structured database provider
  - file storage provider

Recommended future split:

- `FIRESTORE_PROVIDER=firebase|local`
- `FILE_STORAGE_PROVIDER=r2|supabase|appwrite|local`

## Recommendation ranking

### 1. Cloudflare R2 - Recommended

Best overall fit for your code.

Why it matches:

- object storage model is almost one-to-one with your current Firebase Storage usage
- bucket + object key + metadata maps directly to your current `storagePath`, `payload`, and `metadata`
- `PutObject` can store:
  - file body
  - content type
  - metadata
- R2 supports the S3 API, so you can use `@aws-sdk/client-s3`

Why it is the strongest free option:

- official R2 pricing page shows free tier of `10 GB-month / month`, `1 million` Class A operations, and `10 million` Class B operations
- direct egress from R2 is free

Why it fits your current limits:

- your app only accepts up to `20 MB`
- R2 has no small free-tier file-size cap like Supabase free storage

Tradeoffs:

- a bit more backend wiring than Firebase Admin SDK
- you will manage bucket credentials yourself

### 2. Supabase Storage

Best if you may later replace both Firebase Storage and Firestore with one platform.

Why it is good:

- very nice dashboard
- bucket and file path model feels close to Firebase Storage
- upload API supports `contentType` and `metadata`
- private buckets are easy to set up

Tradeoffs:

- official docs show only `1 GB` free storage quota
- official docs show free projects can be paused for inactivity
- official docs say the standard upload path is ideal for small files and recommend resumable uploads for files above `6 MB`

That last point does not make Supabase unusable here, but it is less comfortable than R2 for your current `20 MB` upload ceiling.

### 3. Appwrite Storage

Best if you want a hackathon-friendly backend product with a nice console and automatic chunk handling.

Why it is good:

- free tier currently lists `2 GB storage`
- Node server SDK supports `InputFile.fromBuffer(buffer, filename)`
- Node server SDK also supports `InputFile.fromPlainText(content, filename)`
- Appwrite docs say files above `5 MB` are chunked automatically when using their SDK

Tradeoffs:

- free plan allows only `1 Bucket`
- free projects are paused after `1 week of inactivity`
- object model is less path-centric than R2/S3
- not as direct a conceptual match to your current `bucket + path + metadata` flow

## Why Cloudflare R2 is the best fit here

This is the important code-level reason:

Your current Firebase upload helper is basically:

```js
upload(filePath, payload, contentType, metadata)
```

R2 with S3 client is also basically:

```js
PutObject({
  Bucket,
  Key: filePath,
  Body: payload,
  ContentType: contentType,
  Metadata: metadata,
})
```

That is why R2 is the cleanest replacement.

It preserves your current design:

- one bucket
- object key paths
- metadata on stored objects
- server-side uploads from Node
- private storage by default

## Setup guide for Cloudflare R2

### 1. Create an R2 bucket

In Cloudflare Dashboard:

1. Go to `R2 object storage`
2. Click `Create bucket`
3. Choose a bucket name, for example `solutionhackathon-contracts`
4. Choose a location close to your users/backend
5. Keep storage class as `Standard`

You can also create it with Wrangler:

```bash
npx wrangler r2 bucket create solutionhackathon-contracts
```

### 2. Generate R2 API credentials

In Cloudflare Dashboard:

1. Go to `Storage & databases > R2 > Overview`
2. Click `Manage` in API Tokens
3. Create an API token
4. Give it `Object Read & Write`
5. Restrict it to only the bucket you created
6. Copy:
   - `Access Key ID`
   - `Secret Access Key`
   - endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

### 3. Install the Node dependency

From `backend`:

```bash
npm install @aws-sdk/client-s3
```

### 4. Add env vars

Add something like this to `backend/.env`:

```env
FILE_STORAGE_PROVIDER=r2
R2_BUCKET=solutionhackathon-contracts
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_REGION=auto
```

### 5. Suggested integration shape

Create a small storage client, for example:

- `backend/config/objectStorage.js`

Example shape:

```js
const { S3Client } = require('@aws-sdk/client-s3');

const r2 = new S3Client({
  region: process.env.R2_REGION || 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
```

Then replace the Firebase upload helper in [storage.service.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/services/storage.service.js#L18) with an R2 uploader using `PutObjectCommand`.

### 6. Suggested returned artifact shape

Keep your existing contract metadata structure stable:

```js
{
  mode: 'r2',
  path: filePath,
  uri: `r2://${bucket}/${filePath}`,
  bucket,
}
```

That way the rest of your pipeline does not need to care which provider was used.

### 7. Example upload mapping

Raw document:

- bucket: `solutionhackathon-contracts`
- key: `contracts/raw/{contractId}/{safeName}`

Extracted text:

- bucket: `solutionhackathon-contracts`
- key: `contracts/derived/{contractId}/extracted.txt`

Example object metadata:

```js
{
  contractId,
  source,
  assetType: 'raw-document',
}
```

and:

```js
{
  contractId,
  source,
  assetType: 'extracted-text',
}
```

### 8. Verification checklist

After integrating:

1. Start the backend
2. Upload a PDF through your existing contract upload endpoint
3. Confirm upload response says artifacts were stored via `r2`
4. Confirm objects appear in the R2 bucket
5. Confirm a contract record still contains stable `artifacts.rawDocument` and `artifacts.extractedText` references

## Suggested code changes before switching

These are the most useful refactors before changing provider:

1. Decouple Firebase Storage from Firestore feature flags
2. Add a provider switch in storage service
3. Keep local filesystem fallback for dev mode
4. Leave contract record artifact shape unchanged

## Supabase setup guide

Use this if you prefer Supabase instead of R2.

### Setup

1. Create a Supabase project
2. Open `Storage`
3. Create a private bucket, for example `contracts`
4. Set file size limit to `20 MB`
5. Restrict MIME types to your current allowed list:
   - `application/pdf`
   - `text/plain`
   - `image/png`
   - `image/jpeg`
   - `image/jpg`
   - `image/webp`
6. Copy:
   - Project URL
   - server-side secret key or service role key

### Env suggestion

```env
FILE_STORAGE_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your_server_secret
SUPABASE_STORAGE_BUCKET=contracts
```

### Node dependency

```bash
npm install @supabase/supabase-js
```

### Integration note

Supabase can preserve your current path design:

- `contracts/raw/{contractId}/{safeName}`
- `contracts/derived/{contractId}/extracted.txt`

It also supports upload options including:

- `contentType`
- `metadata`
- `upsert`

### Supabase cautions

- free storage quota is currently `1 GB`
- free file-size limit is currently `50 MB`
- free projects may be paused after inactivity
- for files above `6 MB`, Supabase recommends resumable upload for reliability

## Appwrite setup guide

Use this if you want the easiest SDK experience for uploading buffers and plain text.

### Setup

1. Create an Appwrite project
2. Open `Storage`
3. Create one bucket, for example `contracts`
4. Set max file size to `20 MB`
5. Restrict allowed extensions to your current file types
6. Generate an API key with:
   - `files.write`
   - `files.read`
   - `buckets.read`
   - optionally `buckets.write` if you want to manage buckets programmatically

### Env suggestion

```env
FILE_STORAGE_PROVIDER=appwrite
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key
APPWRITE_BUCKET_ID=contracts
```

### Node dependency

```bash
npm install node-appwrite
```

### Integration note

Appwrite's Node SDK supports:

- `InputFile.fromBuffer(buffer, filename)`
- `InputFile.fromPlainText(text, filename)`

That is a very good match for your current raw file and extracted text flow.

### Appwrite cautions

- free storage is currently `2 GB`
- free projects are paused after `1 week of inactivity`
- free tier includes only `1 Bucket`

## One more important limit in your current code

Changing storage provider alone does **not** let you handle very large files.

Your current backend still:

- caps uploads at `20 MB`
- keeps uploads in memory with `multer.memoryStorage()`

So if by "complete doc" you mean very large scans or hundreds-of-megabytes files, you will also need to change:

- [upload.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/middlewares/upload.js#L15)
- [env.js](/d:/PROJECTS/SOLUTIONHACKATHON/backend/config/env.js#L73)

For now, for normal contract PDFs and extracted text files, R2 is enough.

## Final recommendation

Use **Cloudflare R2** if your goal is:

- free object storage
- full-document storage
- minimal conceptual change from Firebase Storage
- better free capacity than Supabase/Appwrite

Use **Supabase Storage** if your goal is:

- one platform that could later replace Firebase Storage and Firestore together

Use **Appwrite Storage** if your goal is:

- fastest hackathon integration from buffers and plain text uploads

## Official sources

Cloudflare R2:

- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/r2/get-started/s3/
- https://developers.cloudflare.com/r2/api/s3/api/
- https://developers.cloudflare.com/r2/buckets/create-buckets/

Supabase:

- https://supabase.com/docs/guides/storage/pricing
- https://supabase.com/docs/guides/storage/uploads/file-limits
- https://supabase.com/docs/reference/javascript/storage-createbucket
- https://supabase.com/docs/reference/javascript/storage-from-upload
- https://supabase.com/docs/guides/api/api-keys
- https://supabase.com/docs/guides/platform/billing-on-supabase

Appwrite:

- https://appwrite.io/pricing
- https://appwrite.io/docs/products/storage
- https://appwrite.io/docs/products/storage/buckets
- https://appwrite.io/docs/products/storage/upload-download
- https://appwrite.io/docs/advanced/platform/api-keys
