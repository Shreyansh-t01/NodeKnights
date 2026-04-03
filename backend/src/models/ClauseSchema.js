/**
 * Clause Schema for Firebase
 * Schema for storing identified clauses from document processing
 */

const ClauseSchema = {
  // Core fields
  id: String, // Firestore doc ID
  documentId: String, // Reference to parent document
  userId: String, // Owner/creator

  // Clause content
  title: String, // Clause title or heading
  content: String, // The clause text
  clauseType: String, // 'legal', 'contractual', 'section', 'paragraph', 'definition'
  clauseNumber: String, // e.g., "1.1", "Article 2"

  // Metadata
  metadata: {
    startPosition: Number, // Character position in original text
    endPosition: Number,
    wordCount: Number,
    importance: Number, // 0-1, importance score
    category: String, // 'terms', 'conditions', 'rights', 'obligations', etc.
    tags: [String],
  },

  // Processing
  processing: {
    summary: String, // AI-generated summary
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
    actionItems: [
      {
        item: String,
        assignee: String,
        deadline: String,
        priority: String,
      }
    ],
  },

  // Relations
  relations: {
    parentClauseId: String, // For hierarchical clauses
    childClauseIds: [String],
    relatedClauseIds: [String],
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

  customFields: Object, // For extensibility
};

module.exports = ClauseSchema;