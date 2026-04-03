/**
 * Chunk Schema for Firebase
 * Schema for storing text chunks from document processing
 */

const ChunkSchema = {
  // Core fields
  id: String, // Firestore doc ID
  documentId: String, // Reference to parent document
  userId: String, // Owner/creator

  // Chunk content
  content: String, // The chunk text
  chunkIndex: Number, // Position in the document (0-based)
  chunkType: String, // 'sentence', 'paragraph', 'fixed_size', 'semantic'

  // Metadata
  metadata: {
    startPosition: Number, // Character position in original text
    endPosition: Number,
    wordCount: Number,
    sentenceCount: Number,
    language: String,
    confidence: Number, // 0-1, confidence in chunk quality
  },

  // Processing
  processing: {
    embeddings: [Number], // Vector embeddings for similarity search
    keywords: [String],
    entities: [
      {
        name: String,
        type: String,
        confidence: Number,
      }
    ],
    sentiment: {
      score: Number,
      label: String,
    },
  },

  // Status
  status: {
    state: String, // 'processing', 'completed', 'failed'
    error: String,
  },

  // Timestamps
  timestamps: {
    createdAt: new Date(),
    updatedAt: new Date(),
  },

  // Relations
  relations: {
    nextChunkId: String,
    previousChunkId: String,
  },

  customFields: Object, // For extensibility
};

module.exports = ChunkSchema;