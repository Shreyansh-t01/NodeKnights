const { db, FieldValue, COLLECTIONS, formatFirestoreError } = require('../database');
const { v4: uuidv4 } = require('uuid');
const FileStorageService = require('./FileStorageService');
const ChunkService = require('./ChunkService');
const ClauseService = require('./ClauseService');

const isPlainObject = value => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (value instanceof Date || Array.isArray(value) || Buffer.isBuffer(value)) {
    return false;
  }

  return Object.getPrototypeOf(value) === Object.prototype;
};

const flattenForFirestore = (value, prefix = '', output = {}) => {
  Object.entries(value).forEach(([key, nestedValue]) => {
    if (typeof nestedValue === 'undefined') {
      return;
    }

    const path = prefix ? `${prefix}.${key}` : key;

    if (isPlainObject(nestedValue)) {
      flattenForFirestore(nestedValue, path, output);
      return;
    }

    output[path] = nestedValue;
  });

  return output;
};

/**
 * Base Document Service
 * Handles all Firebase Firestore operations for documents
 */

class DocumentService {
  static getDb() {
    if (!db) {
      throw new Error('Firestore is not initialized. Add a valid Firebase service account JSON file or verify FIREBASE_SERVICE_ACCOUNT_PATH.');
    }

    return db;
  }

  static getDocumentsCollection() {
    return this.getDb().collection(COLLECTIONS.DOCUMENTS);
  }

  /**
   * Create a new document
   */
  static async createDocument(documentData) {
    try {
      const docId = uuidv4();
      const now = new Date();
      
      const documentPayload = {
        id: docId,
        ...documentData,
        timestamps: {
          createdAt: now,
          updatedAt: now,
          processedAt: null,
        },
        status: {
          state: 'processing',
          uploadProgress: 0,
          processingProgress: 0,
          error: null,
          retries: 0,
        },
      };
      
      await this.getDocumentsCollection().doc(docId).set(documentPayload);
      return { id: docId, ...documentPayload };
    } catch (error) {
      throw new Error(`Failed to create document: ${formatFirestoreError(error, 'Creating document')}`);
    }
  }

  /**
   * Get document by ID
   */
  static async getDocumentById(docId) {
    try {
      const doc = await this.getDocumentsCollection().doc(docId).get();
      if (!doc.exists) {
        throw new Error('Document not found');
      }
      return doc.data();
    } catch (error) {
      throw new Error(`Failed to fetch document: ${formatFirestoreError(error, 'Fetching document')}`);
    }
  }

  /**
   * Query documents by user with pagination
   */
  static async getDocumentsByUserId(userId, page = 1, limit = 20, filters = {}) {
    try {
      let query = this.getDocumentsCollection().where('userId', '==', userId);
      
      // Apply filters
      if (filters.contentType) {
        query = query.where('contentType', '==', filters.contentType);
      }
      if (filters.source) {
        query = query.where('source.type', '==', filters.source);
      }
      if (filters.status) {
        query = query.where('status.state', '==', filters.status);
      }
        
      // Sorting and pagination
      query = query.orderBy('timestamps.createdAt', 'desc')
        .limit(limit * page)
        .offset(limit * (page - 1));
      
      const snapshot = await query.get();
      const documents = snapshot.docs.map(doc => doc.data());
      
      return {
        documents,
        total: snapshot.size,
        page,
        limit,
      };
    } catch (error) {
      throw new Error(`Failed to fetch documents: ${formatFirestoreError(error, 'Listing documents')}`);
    }
  }

  /**
   * Update document
   */
  static async updateDocument(docId, updateData) {
    try {
      const payload = flattenForFirestore({
        ...updateData,
        timestamps: {
          ...(updateData.timestamps || {}),
          updatedAt: new Date(),
        },
      });

      await this.getDocumentsCollection().doc(docId).update(payload);
      return await this.getDocumentById(docId);
    } catch (error) {
      throw new Error(`Failed to update document: ${formatFirestoreError(error, 'Updating document')}`);
    }
  }

  /**
   * Update document processing status
   */
  static async updateProcessingStatus(docId, status, progress = 0, error = null) {
    try {
      this.getDb();

      const update = {
        'status.state': status,
        'status.processingProgress': progress,
        'timestamps.updatedAt': new Date(),
      };
      
      if (error) {
        update['status.error'] = error;
        update['status.retries'] = FieldValue.increment(1);
      }
      
      if (status === 'completed') {
        update['timestamps.processedAt'] = new Date();
      }
      
      await this.getDocumentsCollection().doc(docId).update(update);
    } catch (error) {
      throw new Error(`Failed to update processing status: ${formatFirestoreError(error, 'Updating processing status')}`);
    }
  }

  /**
   * Delete document
   */
  static async deleteDocument(docId) {
    try {
      await Promise.allSettled([
        FileStorageService.deleteFile(docId),
        ChunkService.deleteChunksByDocumentId(docId),
        ClauseService.deleteClausesByDocumentId(docId),
      ]);

      await this.getDocumentsCollection().doc(docId).delete();
      return { success: true, message: 'Document deleted' };
    } catch (error) {
      throw new Error(`Failed to delete document: ${formatFirestoreError(error, 'Deleting document')}`);
    }
  }

  /**
   * Search documents with full-text capabilities
   */
  static async searchDocuments(userId, searchQuery, contentType = null) {
    try {
      let query = this.getDocumentsCollection()
        .where('userId', '==', userId);
      
      if (contentType) {
        query = query.where('contentType', '==', contentType);
      }
      
      // Note: For production, implement Algolia or Firebase full-text search extension
      const snapshot = await query.get();
      
      const results = snapshot.docs
        .map(doc => doc.data())
        .filter(doc => {
          const normalizedQuery = searchQuery.toLowerCase();
          const matchTitle = doc.title?.toLowerCase().includes(normalizedQuery);
          const matchDescription = doc.description?.toLowerCase().includes(normalizedQuery);
          const matchFileName = doc.file?.name?.toLowerCase().includes(normalizedQuery);
          const matchExtension = doc.file?.extension?.toLowerCase().includes(normalizedQuery);
          const matchTags =
            doc.metadata?.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery)) ||
            doc.metadata?.categories?.some(category => category.toLowerCase().includes(normalizedQuery)) ||
            doc.metadata?.keywords?.some(keyword => keyword.toLowerCase().includes(normalizedQuery));

          return matchTitle || matchDescription || matchFileName || matchExtension || matchTags;
        });
      
      return results;
    } catch (error) {
      throw new Error(`Search failed: ${formatFirestoreError(error, 'Searching documents')}`);
    }
  }

  /**
   * Bulk update documents
   */
  static async bulkUpdateDocuments(docIds, updateData) {
    try {
      const firestore = this.getDb();
      const batch = firestore.batch();
      const payload = flattenForFirestore({
        ...updateData,
        timestamps: {
          ...(updateData.timestamps || {}),
          updatedAt: new Date(),
        },
      });
      
      docIds.forEach(docId => {
        const docRef = this.getDocumentsCollection().doc(docId);
        batch.update(docRef, payload);
      });
      
      await batch.commit();
      return { success: true, updatedCount: docIds.length };
    } catch (error) {
      throw new Error(`Bulk update failed: ${formatFirestoreError(error, 'Bulk updating documents')}`);
    }
  }

  /**
   * Get document stats for a user
   */
  static async getUserDocumentStats(userId) {
    try {
      const snapshot = await this.getDocumentsCollection()
        .where('userId', '==', userId)
        .get();
      
      const documents = snapshot.docs.map(doc => doc.data());
      
      const stats = {
        totalDocuments: documents.length,
        byContentType: {},
        bySource: {},
        byStatus: {},
        totalSize: 0,
      };
      
      documents.forEach(doc => {
        // Count by content type
        stats.byContentType[doc.contentType] = 
          (stats.byContentType[doc.contentType] || 0) + 1;
        
        // Count by source
        stats.bySource[doc.source.type] = 
          (stats.bySource[doc.source.type] || 0) + 1;
        
        // Count by status
        stats.byStatus[doc.status.state] = 
          (stats.byStatus[doc.status.state] || 0) + 1;
        
        // Total size
        stats.totalSize += doc.file?.size || 0;
      });
      
      return stats;
    } catch (error) {
      throw new Error(`Failed to get stats: ${formatFirestoreError(error, 'Fetching document stats')}`);
    }
  }
}

module.exports = DocumentService;
