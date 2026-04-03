# NodeKnights Backend - Architecture Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Frontend (ReactJS)                              │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ HTTP/REST
                                ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      API Gateway / Load Balancer                        │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ↓               ↓               ↓
        ┌──────────────┐┌──────────────┐┌──────────────┐
        │  API Server  ││  API Server  ││  API Server  │
        │  Instance 1  ││  Instance 2  ││  Instance 3  │
        └──────┬───────┘└──────┬───────┘└──────┬───────┘
               │               │               │
               └───────────────┼───────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ↓                      ↓                      ↓
   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
   │ Firebase    │      │   Google    │      │   Cloud     │
   │ Firestore   │      │    OAuth    │      │  Storage    │
   │ (Database)  │      │  (Auth)     │      │  (Files)    │
   └─────────────┘      └─────────────┘      └─────────────┘
        │
        │ Integrations
        │
   ┌────┴────┬─────────┬─────────┐
   ↓         ↓         ↓         ↓
 Gmail  Google Drive  Uploads  Images
```

## Data Processing Pipeline

### Upload Flow

```
User Upload
    ↓
[Authentication Middleware]
    ↓
[File Validation]
  ├─ Check MIME type
  ├─ Verify file size
  └─ Scan for malware
    ↓
[Create Document Record in Firestore]
  └─ Generate UUID
  └─ Set initial status to "processing"
    ↓
[Upload File to Cloud Storage]
    ↓
[Return Document ID to Client]
    ↓
[Async Processing in Background]
  ├─ Extract Content
  │  ├─ PDF Extraction (pdf-parse)
  │  ├─ DOCX Extraction (mammoth)
  │  ├─ Image OCR (Tesseract)
  │  └─ Text Parsing
  ├─ NLP Processing
  │  ├─ Sentiment Analysis
  │  ├─ Entity Extraction
  │  ├─ Keyword Extraction
  │  ├─ Language Detection
  │  └─ Text Summarization
  ├─ Metadata Extraction
  │  └─ Author, dates, language, etc.
  └─ Update Document Status
    ↓
[Document Ready for Analysis]
```

### Email Integration Flow

```
Gmail Account Connected
    ↓
[Fetch Emails via Gmail API]
    ├─ Use OAuth 2.0 tokens
    ├─ Extract message data
    └─ Parse MIME structure
    ↓
[Create Document Records]
    ├─ Map email fields
    ├─ Extract attachments
    └─ Store metadata
    ↓
[Process Email Content]
    ├─ Extract text
    ├─ Analyze sentiment
    └─ Extract entities
    ↓
[Enable Email Search & Analysis]
```

### Google Drive Integration Flow

```
Google Drive Account Connected
    ↓
[List Drive Files]
    ├─ Sync file metadata
    └─ Build file tree
    ↓
[On File Selection]
    ├─ Download file
    ├─ Convert if needed (Docs→PDF)
    └─ Create document record
    ↓
[Extract & Process]
    └─ (Same as Upload Flow)
    ↓
[Keep Changes Synchronized]
```

## Database Schema Design

### Firestore Collections

#### documents/
Primary collection storing all documents.

```javascript
{
  id: "uuid",
  userId: "user123",
  title: "Document Title",
  source: {
    type: "upload" | "gmail" | "google_drive",
    sourceId: "original-id",
    externalUrl: "link-to-original"
  },
  contentType: "pdf" | "email" | "image" | "document",
  
  // Extracted content
  extraction: {
    extractedText: "full text",
    textBlocks: [],
    tables: [],
    images: []
  },
  
  // Processing results
  processing: {
    summary: "brief summary",
    sentiment: { score, label },
    entities: [],
    topics: [],
    actionItems: []
  },
  
  // Status tracking
  status: {
    state: "processing" | "completed" | "failed",
    progress: 0-100,
    error: null | "error message"
  },
  
  timestamps: {
    createdAt: date,
    updatedAt: date,
    processedAt: date
  }
}
```

**Indexes:**
```
- userId + createdAt (DESC)
- userId + contentType + createdAt
- userId + status.state
```

#### users/
User account and integration information.

```javascript
{
  id: "userId",
  email: "user@example.com",
  displayName: "User Name",
  
  integrations: {
    gmail: {
      connected: boolean,
      email: "gmail@example.com"
    },
    googleDrive: {
      connected: boolean,
      email: "drive@example.com"
    }
  },
  
  usage: {
    totalDocuments: number,
    totalStorage: bytes,
    monthlyUploadUsed: bytes
  },
  
  subscription: {
    plan: "free" | "pro" | "enterprise",
    active: boolean
  }
}
```

#### sourceMetadata/
Tracks synced data from external sources.

```javascript
{
  id: "metadata:gmail:user123",
  userId: "user123",
  source: "gmail" | "google_drive",
  
  lastSync: date,
  syncStatus: "success" | "failed",
  errorMessage: null,
  
  stats: {
    totalItems: number,
    newItems: number,
    updatedItems: number
  }
}
```

#### processingQueue/
Tracks documents awaiting or in processing.

```javascript
{
  id: "queue:uuid",
  documentId: "doc-uuid",
  userId: "user123",
  
  status: "pending" | "processing" | "completed" | "failed",
  priority: 1-10,
  
  attempts: 0,
  maxAttempts: 3,
  
  createdAt: date,
  startedAt: date,
  completedAt: date,
  
  error: null | "error message"
}
```

## Performance Optimization Strategies

### Query Optimization

1. **Composite Indexes**
   - Index frequently filtered combinations
   - Query planner analysis required

2. **Pagination**
   - Always paginate large result sets
   - Use cursor-based pagination for large datasets

3. **Denormalization**
   - Store user name in document for sorting/filtering
   - Reduces need for document joins

### Processing Optimization

1. **Async Processing**
   - Background processing for heavy tasks
   - Queue system for reliability

2. **Batch Operations**
   - Process multiple items together
   - Use Firestore batch writes

3. **Caching**
   - Cache frequently accessed data
   - Use TTL for cache invalidation

### Storage Optimization

1. **Cloud Storage**
   - Store large files in GCS
   - Keep metadata in Firestore
   - Use CDN for distribution

2. **Compression**
   - Gzip API responses
   - Image optimization for web

## Security Architecture

### Authentication

```
User Login
    ↓
Google OAuth / Email/Password
    ↓
Generate JWT Token
    ↓
Store Refresh Token (Secure HTTPOnly Cookie)
    ↓
Return Access Token to Client
```

### Authorization

```
Request + JWT Token
    ↓
Verify Token Signature
    ↓
Extract User ID
    ↓
Check Resource Access
  ├─ Document owned by user? → Allow
  ├─ Document shared with user? → Allow based on permission
  └─ Deny
```

### Data Encryption

1. **In Transit**: TLS/SSL
2. **At Rest**: Firebase encryption
3. **Sensitive Fields**: Application-level encryption (tokens, secrets)

## Scalability Considerations

### Horizontal Scaling

1. **Stateless API Servers**
   - Each server independent
   - Load balanced requests
   - Session stored in secure cookies/tokens

2. **Database Scaling**
   - Firestore auto-scaling
   - Collection sharding for high writes
   - Read replicas if needed

### Caching Strategy

1. **Browser Cache**
   - Cache headers on static content
   - CDN distribution

2. **Application Cache**
   - Redis for session management
   - Cache user preferences

3. **Database Cache**
   - Firestore automatic caching
   - Application-level caching of frequently accessed data

## Monitoring & Logging

### Metrics to Track

- API response times
- Database read/write latency
- File upload success rate
- Processing queue depth
- Error rates by endpoint
- User engagement metrics

### Logging Strategy

```javascript
logger.info('Event', {
  userId: 'user123',
  action: 'document_upload',
  documentId: 'doc123',
  duration: '2.5s'
});
```

### Alerting

- API error rate > 5%
- DB latency > 500ms
- File upload failures > 10%
- Processing queue > 1000 items
- Disk space < 10%

## Disaster Recovery

### Backup Strategy

1. **Database**: Daily automated Firestore backups
2. **Files**: GCS lifecycle policies, multi-region replication
3. **Secrets**: Encrypted backup in secure location

### Recovery Procedures

1. **Database Restore**: Use Firestore backups
2. **File Recovery**: Restore from GCS backup
3. **Configuration**: Infrastructure as Code (Terraform/Bicep)

## Development Workflow

```
Feature Branch
    ↓
Local Development (Docker)
    ↓
Unit & Integration Tests
    ↓
Code Review
    ↓
Merge to Main
    ↓
Deploy to Staging
    ↓
Integration Tests
    ↓
Deploy to Production
    ↓
Monitor
```

---

For more details, see:
- [README.md](README.md) - Setup and overview
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - API reference
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment
