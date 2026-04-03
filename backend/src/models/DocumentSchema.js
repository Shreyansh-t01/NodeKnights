/**
 * Document Schema for Firebase
 * Unified schema for documents from all sources (Gmail, Google Drive, Uploads, Images)
 */

const DocumentSchema = {
  // Core fields
  id: String, // Firestore doc ID
  userId: String, // Owner/creator
  title: String,
  description: String,
  content: String, // Extracted/processed content
  rawContent: String, // Original raw content
  contentType: String, // 'email', 'pdf', 'image', 'document', 'spreadsheet'
  fileType: String, // mime type
  
  // Source Information
  source: {
    type: String, // 'gmail', 'google_drive', 'upload', 'direct_image'
    sourceId: String, // Original ID from source
    externalUrl: String, // URL to original source
    accountEmail: String, // Gmail account or Drive account
  },
  
  // File/Media Information
  file: {
    name: String,
    size: Number, // in bytes
    path: String, // Cloud Storage path
    url: String, // Accessible URL
    format: String, // jpg, pdf, docx, xlsx, etc.
    extension: String,
  },
  
  // Extracted Metadata
  metadata: {
    author: String,
    createdDate: String, // From source
    modifiedDate: String,
    language: String, // Detected language
    wordCount: Number,
    pageCount: Number, // For PDFs
    dimensions: { // For images
      width: Number,
      height: Number,
    },
    tags: [String], // Auto-generated tags
    categories: [String], // User or AI assigned categories
    keywords: [String], // Extracted keywords
  },
  
  // Email specific
  email: {
    subject: String,
    from: String,
    to: [String],
    cc: [String],
    bcc: [String],
    messageId: String,
    threadId: String,
    labels: [String],
    isRead: Boolean,
  },
  
  // Text Extraction & Processing
  extraction: {
    extractedText: String,
    textBlocks: [
      {
        text: String,
        confidence: Number, // 0-1
        type: String, // 'heading', 'paragraph', 'table', 'image', 'code'
      }
    ],
    tables: [
      {
        headers: [String],
        rows: [[String]], // 2D array
      }
    ],
    images: [
      {
        url: String,
        description: String,
        size: Number,
      }
    ],
    codeBlocks: [
      {
        language: String,
        code: String,
      }
    ],
  },
  
  // AI/NLP Processing
  processing: {
    summary: String,
    sentiment: {
      score: Number, // -1 to 1
      label: String, // 'positive', 'negative', 'neutral'
    },
    entities: [
      {
        name: String,
        type: String, // 'PERSON', 'ORGANIZATION', 'LOCATION', 'DATE', etc.
        confidence: Number,
      }
    ],
    topics: [
      {
        name: String,
        score: Number,
      }
    ],
    actionItems: [
      {
        item: String,
        assignee: String,
        deadline: String,
        priority: String, // 'high', 'medium', 'low'
      }
    ],
  },
  
  // Storage & Access
  storage: {
    bucket: String, // Cloud Storage bucket
    storagePath: String, // Full path in storage
    isPublic: Boolean,
    accessControl: {
      owner: String,
      sharedWith: [
        {
          userId: String,
          permission: String, // 'view', 'edit', 'admin'
        }
      ],
    },
  },
  
  // Status & Tracking
  status: {
    state: String, // 'processing', 'completed', 'failed'
    uploadProgress: Number, // 0-100
    processingProgress: Number, // 0-100
    error: String, // Error message if failed
    retries: Number,
  },
  
  // Timestamps
  timestamps: {
    createdAt: new Date(),
    updatedAt: new Date(),
    processedAt: new Date(),
  },
  
  // Additional Fields
  relations: {
    parentDocumentId: String, // For nested/related documents
    relatedDocumentIds: [String],
  },
  
  customFields: Object, // For extensibility
};

module.exports = DocumentSchema;
