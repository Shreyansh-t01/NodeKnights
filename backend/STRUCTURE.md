# Complete Backend Structure

## 📁 Full Directory Tree

```
backend/
│
├── 📄 server.js                      # Main application entry point
├── 📄 package.json                   # Dependencies and scripts
├── 📄 .env.example                   # Environment variables template
├── 📄 .eslintrc.json                 # ESLint configuration
├── 📄 .prettierrc.json               # Code formatting rules
├── 📄 Dockerfile                     # Docker containerization
├── 📄 docker-compose.yml             # Docker Compose setup
│
├── 📖 README.md                      # Project overview & setup
├── 📖 API_DOCUMENTATION.md           # Complete API reference
├── 📖 ARCHITECTURE.md                # System design & architecture
├── 📖 DEPLOYMENT.md                  # Production deployment guide
├── 📖 STRUCTURE.md                   # This file
│
└── src/
    │
    ├── 📁 config/
    │   └── (Configuration files - to be created)
    │
    ├── 📁 database/
    │   └── firebase.js               # Firebase initialization & setup
    │
    ├── 📁 models/
    │   ├── index.js                  # Schema exports
    │   ├── DocumentSchema.js          # Document data structure
    │   └── UserSchema.js             # User profile structure
    │
    ├── 📁 services/
    │   ├── DocumentService.js        # Document CRUD operations
    │   ├── ContentExtractionService.js # Text & content extraction
    │   ├── NLPService.js             # Natural language processing
    │   └── (Additional services)
    │
    ├── 📁 integrations/
    │   ├── GmailService.js           # Gmail API integration
    │   ├── GoogleDriveService.js     # Google Drive integration
    │   └── (Additional integrations)
    │
    ├── 📁 controllers/
    │   ├── DocumentController.js     # Document request handlers
    │   └── (Additional controllers)
    │
    ├── 📁 routes/
    │   ├── index.js                  # Main route aggregator
    │   ├── documentRoutes.js         # Document endpoints
    │   └── (Additional route files)
    │
    ├── 📁 middleware/
    │   └── index.js                  # Authentication, logging, error handling
    │
    ├── 📁 validators/
    │   └── index.js                  # Input validation functions
    │
    ├── 📁 constants/
    │   └── index.js                  # App constants & enums
    │
    ├── 📁 helpers/
    │   └── logger.js                 # Logging utility class
    │
    └── 📁 utils/
        └── index.js                  # Helper functions & utilities
```

## 📦 Core Files Explained

### Server & Configuration

| File | Purpose |
|------|---------|
| `server.js` | Express app setup, middleware configuration, server start |
| `package.json` | Dependencies, scripts, project metadata |
| `.env.example` | Template for environment variables |
| `Dockerfile` | Container image definition |
| `docker-compose.yml` | Local development environment |

### Database

| File | Purpose |
|------|---------|
| `src/database/firebase.js` | Firebase Admin SDK initialization, collection names |
| `src/models/DocumentSchema.js` | Unified document structure |
| `src/models/UserSchema.js` | User profile & settings structure |

### Services (Business Logic)

| File | Purpose |
|------|---------|
| `src/services/DocumentService.js` | All Firestore CRUD operations |
| `src/services/ContentExtractionService.js` | Extract text from PDF, DOCX, images |
| `src/services/NLPService.js` | Sentiment, entities, keywords, summarization |

### Integrations

| File | Purpose |
|------|---------|
| `src/integrations/GmailService.js` | Fetch & parse emails from Gmail |
| `src/integrations/GoogleDriveService.js` | List & download files from Drive |

### API Layer

| File | Purpose |
|------|---------|
| `src/controllers/DocumentController.js` | Handle HTTP requests, coordinate services |
| `src/routes/index.js` | Main API route definitions |
| `src/routes/documentRoutes.js` | Document-specific endpoints |

### Middleware & Utilities

| File | Purpose |
|------|---------|
| `src/middleware/index.js` | Authentication, error handling, request logging |
| `src/validators/index.js` | Input validation for requests |
| `src/constants/index.js` | Status codes, error messages, limits |
| `src/helpers/logger.js` | Centralized logging system |
| `src/utils/index.js` | Async handlers, retry logic, caching |

## 🚀 Quick Start

### 1. Installation

```bash
cd backend
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your:
# - Firebase project ID and credentials
# - Google OAuth client ID/secret
# - Any other required variables
```

### 3. Firebase Setup

- Download service account JSON from Google Cloud Console
- Place at `./firebase-service-account.json`

### 4. Start Development Server

```bash
npm run dev
# Server runs on http://localhost:5000
# API available at http://localhost:5000/api
```

### 5. Test Upload Endpoint

```bash
curl -X POST http://localhost:5000/api/documents/upload \
  -H "Authorization: Bearer test-token" \
  -H "X-User-Id: test-user" \
  -F "file=@test-file.pdf" \
  -F "title=Test Document"
```

## 📊 Data Flow Summary

```
1. CLIENT UPLOAD
   Upload → Validation → Document Creation → Async Processing

2. BACKGROUND PROCESSING
   Content Extraction → NLP Analysis → Metadata Update → Complete

3. DATA RETRIEVAL
   Query → Filter → Pagination → Return to Client

4. SEARCH
   Full-Text Search → Ranking → Results
```

## 🔑 Key Features

✅ **Multi-Source Data Aggregation**
- File uploads (PDF, DOCX, images, text)
- Gmail integration
- Google Drive integration

✅ **Intelligent Content Processing**
- Text extraction from multiple formats
- Sentiment analysis
- Entity recognition
- Keyword extraction
- Text summarization

✅ **Robust Storage**
- Firebase Firestore for structured data
- Cloud Storage for files
- Optimized schema design

✅ **Production Ready**
- Error handling and logging
- Input validation
- Authentication middleware
- Asynchronous processing
- Pagination and filtering

✅ **Developer Friendly**
- Comprehensive documentation
- Well-organized code structure
- Docker for local development
- ESLint + Prettier for code quality

## 📚 API Endpoints

### Document Operations
- `POST /api/documents/upload` - Upload new document
- `GET /api/documents` - List documents with filters
- `GET /api/documents/search` - Search documents
- `GET /api/documents/:docId` - Get document details
- `PUT /api/documents/:docId` - Update document
- `DELETE /api/documents/:docId` - Delete document
- `GET /api/documents/stats` - User statistics

## 🔒 Security Features

- JWT authentication
- User-level access control
- Input validation
- File type & size validation
- CORS configuration
- Error handling with no sensitive data leaks

## 🚢 Deployment Options

1. **Google Cloud Run** (Recommended)
   - Serverless, auto-scaling
   - Integrates with Firebase
   - Container-based

2. **Google Cloud Compute Engine**
   - Full control
   - Cost-effective for steady traffic

3. **Heroku / Another Provider**
   - Easy deployment
   - Simple scaling

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## 📖 Documentation Files

1. **README.md** - Project overview, features, setup
2. **API_DOCUMENTATION.md** - Complete API reference with examples
3. **ARCHITECTURE.md** - System design, data flow, optimization
4. **DEPLOYMENT.md** - Production deployment & scaling
5. **STRUCTURE.md** (This file) - Directory structure overview

## 🔧 Available npm Scripts

```bash
npm start           # Start production server
npm run dev         # Start with auto-reload
npm test            # Run tests (configure as needed)
npm run lint        # Check code quality
npm run format      # Auto-format code with Prettier
```

## 📋 Development Checklist

- [ ] Install dependencies: `npm install`
- [ ] Set up Firebase project
- [ ] Configure `.env` file
- [ ] Add Firebase service account JSON
- [ ] Set up Google OAuth credentials
- [ ] Test upload endpoint
- [ ] Configure database indexes
- [ ] Set up monitoring/logging
- [ ] Configure security rules
- [ ] Plan data backup strategy
- [ ] Prepare deployment

## 🎯 Next Steps

1. **Configure Firebase**
   - Create Firestore database
   - Set up Cloud Storage bucket
   - Configure security rules

2. **Set Up Authentication**
   - Configure Google OAuth
   - Implement JWT token generation
   - Add password reset flow

3. **Integrate with Frontend**
   - Connect React frontend to API
   - Handle file uploads
   - Display processing status

4. **Deploy**
   - Choose hosting platform
   - Set up CI/CD pipeline
   - Configure monitoring

---

**Your backend is ready! Start with `npm run dev` and begin building.** 🚀
