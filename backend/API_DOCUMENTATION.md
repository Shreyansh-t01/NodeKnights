# NodeKnights Backend - API Documentation

## Base URL

```
http://localhost:5000/api
```

## Authentication

Authentication is temporarily disabled for development.
All endpoints (except `/health`) can be called without a JWT.

```
X-User-Id: <optional-user-id>
```

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### HTTP Status Codes

- **200** - Success
- **201** - Created
- **400** - Bad Request
- **401** - Unauthorized
- **403** - Forbidden
- **404** - Not Found
- **413** - Payload Too Large
- **500** - Internal Server Error

---

## Endpoints

### Health Check

#### GET /health

Check API health status.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 1234.56
}
```

---

### Documents API

#### POST /documents/upload

Upload and process a new document.

This endpoint works with a file-only upload. `title`, `description`, and `contentType` are optional.
If you omit `title`, the backend uses the uploaded filename.
If you omit `description`, the backend stores an empty string.

**Headers:**
```
X-User-Id: <optional-user-id>
Content-Type: multipart/form-data
```

**Body Parameters:**
- `file` (required): File to upload (PDF, DOCX, images, TXT)
- `title` (optional): Document title
- `description` (optional): Document description
- `contentType` (optional): Content type hint

**Postman setup:**
- Method: `POST`
- URL: `http://localhost:5000/api/documents/upload`
- Body tab: `form-data`
- Key: `file`
- Key type: `File`
- Value: choose your file from disk
- Optional extra keys: `title`, `description`, `contentType` as Text

**Minimal working example:**
```bash
curl -X POST http://localhost:5000/api/documents/upload \
  -F "file=@document.pdf"
```

**Example:**
```bash
curl -X POST http://localhost:5000/api/documents/upload \
  -F "file=@document.pdf" \
  -F "title=My Document" \
  -F "description=Important doc"
```

**Response (201):**
```json
{
  "success": true,
  "documentId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Document uploaded and is being processed"
}
```

**Errors:**
- `400` - No file provided or invalid file type
- `413` - File too large

---

#### GET /documents

List user documents with filtering and pagination.

**Query Parameters:**
- `page` (optional, default=1): Page number
- `limit` (optional, default=20, max=100): Items per page
- `contentType` (optional): Filter by type (email, pdf, image, document)
- `source` (optional): Filter by source (gmail, google_drive, upload)
- `status` (optional): Filter by status (processing, completed, failed)

**Example:**
```bash
curl http://localhost:5000/api/documents?page=1&limit=20&contentType=pdf \
  -H "X-User-Id: dev-user"
```

**Response (200):**
```json
{
  "documents": [
    {
      "id": "doc123",
      "title": "Document Title",
      "contentType": "pdf",
      "source": { "type": "upload" },
      "status": { "state": "completed" },
      "timestamps": { "createdAt": "2024-01-01T00:00:00Z" }
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

---

#### GET /documents/search

Search documents by keyword with full-text capabilities.

**Query Parameters:**
- `q` (required): Search query
- `contentType` (optional): Filter by content type

**Example:**
```bash
curl "http://localhost:5000/api/documents/search?q=invoice&contentType=pdf" \
  -H "X-User-Id: dev-user"
```

**Response (200):**
```json
{
  "results": [
    {
      "id": "doc123",
      "title": "Invoice 2024",
      "snippet": "...invoice details..."
    }
  ],
  "count": 5
}
```

---

#### GET /documents/:docId

Retrieve specific document details.

**Path Parameters:**
- `docId` (required): Document ID

**Example:**
```bash
curl http://localhost:5000/api/documents/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-User-Id: dev-user"
```

**Response (200):**
```json
{
  "id": "doc123",
  "userId": "user456",
  "title": "Document Title",
  "description": "Description",
  "contentType": "pdf",
  "file": {
    "name": "document.pdf",
    "size": 12345,
    "format": "pdf",
    "url": "gs://bucket/document.pdf"
  },
  "extraction": {
    "extractedText": "Full document text...",
    "textBlocks": [],
    "tables": []
  },
  "processing": {
    "summary": "Brief summary...",
    "sentiment": {
      "score": 0.5,
      "label": "neutral"
    },
    "entities": [
      {
        "name": "John Doe",
        "type": "PERSON",
        "confidence": 0.95
      }
    ],
    "keywords": [
      { "name": "invoice", "score": 5 }
    ]
  },
  "metadata": {
    "language": "en",
    "wordCount": 500,
    "author": "John Doe"
  },
  "status": {
    "state": "completed",
    "processingProgress": 100
  },
  "timestamps": {
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:05:00Z",
    "processedAt": "2024-01-01T00:05:00Z"
  }
}
```

**Errors:**
- `404` - Document not found
- `403` - Unauthorized access

---

#### PUT /documents/:docId

Update document metadata.

**Path Parameters:**
- `docId` (required): Document ID

**Body (JSON):**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "metadata": {
    "tags": ["important", "review"],
    "categories": ["financial"]
  },
  "customFields": {
    "department": "Finance"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "document": {
    "id": "doc123",
    "title": "Updated Title",
    "...": "..."
  }
}
```

**Errors:**
- `400` - Invalid update fields
- `404` - Document not found
- `403` - Unauthorized

---

#### DELETE /documents/:docId

Delete a document.

**Path Parameters:**
- `docId` (required): Document ID

**Example:**
```bash
curl -X DELETE http://localhost:5000/api/documents/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-User-Id: dev-user"
```

**Response (200):**
```json
{
  "success": true,
  "message": "Document deleted"
}
```

**Errors:**
- `404` - Document not found
- `403` - Unauthorized

---

#### GET /documents/stats

Get document statistics for the user.

**Example:**
```bash
curl http://localhost:5000/api/documents/stats \
  -H "X-User-Id: dev-user"
```

**Response (200):**
```json
{
  "totalDocuments": 42,
  "byContentType": {
    "pdf": 20,
    "email": 15,
    "image": 7
  },
  "bySource": {
    "upload": 25,
    "gmail": 12,
    "google_drive": 5
  },
  "byStatus": {
    "completed": 40,
    "processing": 2,
    "failed": 0
  },
  "totalSize": 5242880
}
```

---

## Rate Limiting

Current limits (to be implemented):
- 100 requests per hour per user
- 10 concurrent file uploads per user
- 50MB max file size

## Pagination

For list endpoints:
- Use `page` and `limit` query parameters
- Max limit is 100 items
- Default limit is 20 items

```
GET /documents?page=2&limit=25
```

Response includes:
```json
{
  "documents": [...],
  "total": 100,
  "page": 2,
  "limit": 25
}
```

## Webhooks (Coming Soon)

Subscribe to document processing events:

```javascript
POST /webhooks/subscribe
{
  "url": "https://your-domain.com/webhook",
  "events": ["document.completed", "document.failed"]
}
```

---

## Code Examples

### JavaScript/Fetch

```javascript
// Upload document
const form = new FormData();
form.append('file', fileInput.files[0]);
form.append('title', 'My Document');

const response = await fetch('http://localhost:5000/api/documents/upload', {
  method: 'POST',
  headers: {
    'X-User-Id': 'dev-user'
  },
  body: form
});

const data = await response.json();
console.log(data.documentId);
```

### Python

```python
import requests

# Upload document
files = {'file': open('document.pdf', 'rb')}
data = {'title': 'My Document'}
headers = {
    'X-User-Id': 'dev-user'
}

response = requests.post(
    'http://localhost:5000/api/documents/upload',
    files=files,
    data=data,
    headers=headers
)

print(response.json())
```

### cURL

```bash
# Upload
curl -X POST http://localhost:5000/api/documents/upload \
  -H "X-User-Id: dev-user" \
  -F "file=@document.pdf" \
  -F "title=My Document"

# List
curl http://localhost:5000/api/documents \
  -H "X-User-Id: dev-user"

# Get
curl http://localhost:5000/api/documents/doc123 \
  -H "X-User-Id: dev-user"
```

---

## Changelog

### v1.0.0 (Current)
- Initial API release
- Document upload and processing
- Full-text search
- NLP analysis (sentiment, entities, keywords)
- Document statistics

### Upcoming
- Email integration (Gmail)
- Drive integration (Google Drive)
- Batch operations
- Webhook notifications
- Advanced search filters
- Custom metadata fields
