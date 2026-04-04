# NodeKnights Backend API

A comprehensive, production-ready backend system for multi-source data aggregation and processing using Node.js, Express, and Firebase.

## 🎯 Overview

NodeKnights Backend is designed to:
- Aggregate data from multiple sources (Gmail, Google Drive, PDF uploads, direct image insertion)
- Extract, process, and analyze content using NLP
- Store structured data in Firebase Firestore with optimized schemas
- Provide RESTful APIs for frontend consumption
- Handle asynchronous processing with robust error handling

## 📋 Architecture

### Folder Structure

```
backend/
├── src/
│   ├── config/              # Configuration files
│   ├── controllers/         # Request handlers
│   ├── services/            # Business logic
│   ├── integrations/        # Third-party integrations (Gmail, Drive, etc.)
│   ├── routes/              # API route definitions
│   ├── models/              # Data schemas
│   ├── database/            # Firebase configuration
│   ├── middleware/          # Express middleware
│   ├── validators/          # Input validation
│   ├── constants/           # Constants and enums
│   ├── helpers/             # Helper utilities
│   └── utils/               # Utility functions
├── server.js                # Application entry point
├── package.json             # Dependencies
└── .env.example             # Environment variables template
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Firebase Firestore project
- Google OAuth credentials (for Gmail & Drive integration)

### Installation

1. **Clone and setup:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Add Firebase Service Account:**
   - Download your Firebase service account JSON
   - Place at `./firebase-service-account.json`

4. **Start development server:**
   ```bash
   npm run dev       # With auto-reload
   # OR
   npm start         # Production mode
   ```

The API will be available at `http://localhost:5000/api`

## 📚 Data Models

### Document Schema

The core document model supports all data sources with a unified structure:

```javascript
{
  id: String,                    // Unique document ID
  userId: String,                // Document owner
  title: String,
  description: String,
  contentType: String,           // 'email', 'pdf', 'image', 'document', etc.
  
  source: {                      // Data source information
    type: String,                // 'gmail', 'google_drive', 'upload', etc.
    sourceId: String,
    externalUrl: String,
    accountEmail: String
  },
  
  file: {                        // File metadata
    name: String,
    size: Number,
    path: String,
    url: String,
    format: String
  },
  
  metadata: {                    // Extracted metadata
    author: String,
    language: String,
    wordCount: Number,
    keywords: [String],
    categories: [String],
    tags: [String]
  },
  
  extraction: {                  // Extracted content
    extractedText: String,
    textBlocks: Array,
    tables: Array,
    codeBlocks: Array,
    images: Array
  },
  
  processing: {                  // NLP results
    summary: String,
    sentiment: { score, label },
    entities: Array,
    topics: Array,
    actionItems: Array
  },
  
  status: {                      // Processing status
    state: String,               // 'processing', 'completed', 'failed'
    uploadProgress: Number,
    processingProgress: Number,
    error: String,
    retries: Number
  },
  
  storage: {                     // Cloud storage info
    bucket: String,
    storagePath: String,
    accessControl: Object
  },
  
  timestamps: {                  // Timing info
    createdAt: Date,
    updatedAt: Date,
    processedAt: Date
  }
}
```

## 🔌 API Endpoints

### Documents

#### Upload Document
```http
POST /api/documents/upload
Content-Type: multipart/form-data
X-User-Id: <optional-user-id>

Body:
- file: <binary>
- title: String (optional)
- description: String (optional)
```

**Response:**
```json
{
  "success": true,
  "documentId": "string",
  "message": "Document uploaded and is being processed"
}
```

#### List Documents
```http
GET /api/documents?page=1&limit=20&contentType=pdf&source=upload
X-User-Id: <optional-user-id>
```

**Response:**
```json
{
  "documents": [...],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

#### Search Documents
```http
GET /api/documents/search?q=keyword&contentType=email
X-User-Id: <optional-user-id>
```

#### Get Document
```http
GET /api/documents/{docId}
X-User-Id: <optional-user-id>
```

#### Update Document
```http
PUT /api/documents/{docId}
X-User-Id: <optional-user-id>

Body:
{
  "title": "New Title",
  "description": "New Description",
  "metadata": {...}
}
```

#### Delete Document
```http
DELETE /api/documents/{docId}
X-User-Id: <optional-user-id>
```

#### Get Statistics
```http
GET /api/documents/stats
X-User-Id: <optional-user-id>
```

## 🔧 Services Overview

### DocumentService
Handles all Firestore CRUD operations:
- `createDocument(data)` - Create new document
- `getDocumentById(docId)` - Fetch single document
- `getDocumentsByUserId(userId, page, limit, filters)` - Fetch paginated documents
- `updateDocument(docId, data)` - Update document
- `deleteDocument(docId)` - Delete document
- `searchDocuments(userId, query)` - Full-text search
- `getUserDocumentStats(userId)` - Get user statistics

### ContentExtractionService
Extracts content from various formats:
- `extractFromPDF(buffer)` - Extract PDF text and metadata
- `extractFromDocx(buffer)` - Extract Word document content
- `extractFromImage(imagePath)` - OCR text extraction
- `extractContent(buffer, mimeType, fileName)` - Generic extraction

### NLPService
Provides text analysis and processing:
- `extractEntities(text)` - Extract emails, URLs, phone numbers
- `analyzeSentiment(text)` - Sentiment analysis
- `extractKeywords(text, limit)` - Keyword extraction
- `summarizeText(text, sentenceCount)` - Text summarization
- `detectLanguage(text)` - Language detection

### GmailService
Gmail integration:
- `fetchEmails(query, maxResults)` - Fetch emails from Gmail
- `parseMessage(message)` - Parse email structure
- `watchEmails()` - Watch for new emails

### GoogleDriveService
Google Drive integration:
- `listFiles(pageSize, pageToken)` - List Drive files
- `downloadFile(fileId, mimeType)` - Download and convert files
- `getFileMetadata(fileId)` - Get file details
- `searchFiles(query, limit)` - Search for files

## 🔐 Security Features

- **Authentication**: Temporarily disabled for development
- **Authorization**: Temporarily disabled; requests use `X-User-Id` or fall back to `dev-user`
- **Validation**: Input validation on all endpoints
- **Rate Limiting**: (Implement with express-rate-limit)
- **CORS**: Configurable cross-origin requests
- **Helmet**: Security headers middleware
- **File Upload**: Size limits and type validation
- **Data Encryption**: Firebase security rules (configure in Console)

## 📊 Data Flow

```
User Upload
    ↓
File Validation (Multer)
    ↓
Document Creation (Firebase)
    ↓
Async Processing
    ├─ Content Extraction
    ├─ NLP Analysis
    ├─ Metadata Extraction
    └─ Status Update
    ↓
Ready for Client Consumption
```

## 🚄 Performance Optimization

1. **Firestore Queries**
   - Indexed queries for filtering
   - Pagination for large datasets
   - Caching layer with TTL

2. **File Processing**
   - Async/background processing
   - Batch processing support
   - Retry logic with exponential backoff

3. **Database**
   - Denormalized schema for fast reads
   - Compound indexes for common queries
   - Subcollections for related data

4. **API Responses**
   - Compression middleware
   - Request logging
   - Error handling

## 🛠️ Development

### Available Scripts

```bash
npm start          # Start production server
npm run dev        # Start with auto-reload
npm test           # Run tests
npm run lint       # Run ESLint
npm run format     # Format with Prettier
```

### Environment Variables

```env
PORT=5000
NODE_ENV=development
FIREBASE_PROJECT_ID=your-project
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
JWT_SECRET=your-jwt-secret
```

## 🧪 Testing

To implement testing:

```bash
npm install --save-dev jest supertest
```

Create tests in `src/__tests__/` directory following the pattern:
```javascript
describe('DocumentService', () => {
  test('creates document successfully', async () => {
    // test implementation
  });
});
```

## 📈 Scaling Considerations

1. **Database**: Use Firestore sharding for high write rates
2. **Processing**: Implement job queue (Bull + Redis)
3. **Storage**: Use Cloud Storage with CDN
4. **Caching**: Add Redis for frequently accessed data
5. **Load Balancing**: Deploy behind load balancer
6. **Monitoring**: Implement Cloud Monitoring with custom metrics

## 🐛 Troubleshooting

### Firebase Connection Issues
- Verify service account JSON path
- Check Firebase credentials
- Enable Firestore API in Google Cloud Console

### Large File Uploads
- Increase `bodyParser` limit in `server.js`
- Use chunked uploads for files > 50MB
- Implement Cloud Storage direct upload

### Processing Timeout
- Increase timeout in constants
- Move to job queue for slower operations
- Check resource constraints

## 📖 Additional Resources

- [Firebase Firestore Docs](https://firebase.google.com/docs/firestore)
- [Express.js Documentation](https://expressjs.com/)
- [Google APIs Documentation](https://developers.google.com/apis)
- [Natural Language Processing](https://naturalnode.github.io/natural/)

## 📄 License

ISC

## 👥 Contributing

Contributions welcome! Please follow:
1. Code style (ESLint + Prettier)
2. Test coverage
3. Documentation updates

---

**Built with ❤️ for NodeKnights**
