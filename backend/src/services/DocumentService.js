const { db, COLLECTIONS } = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Base Document Service
 * Handles all Firebase Firestore operations for documents
 */

class DocumentService {
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
      
      await db.collection(COLLECTIONS.DOCUMENTS).doc(docId).set(documentPayload);
      return { id: docId, ...documentPayload };
    } catch (error) {
      throw new Error(`Failed to create document: ${error.message}`);
    }
  }

  /**
   * Get document by ID
   */
  static async getDocumentById(docId) {
    try {
      const doc = await db.collection(COLLECTIONS.DOCUMENTS).doc(docId).get();
      if (!doc.exists) {
        throw new Error('Document not found');
      }
      return doc.data();
    } catch (error) {
      throw new Error(`Failed to fetch document: ${error.message}`);
    }
  }

  /**
   * Query documents by user with pagination
   */
  static async getDocumentsByUserId(userId, page = 1, limit = 20, filters = {}) {
    try {
      let query = db.collection(COLLECTIONS.DOCUMENTS).where('userId', '==', userId);
      
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
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }
  }

  /**
   * Update document
   */
  static async updateDocument(docId, updateData) {
    try {
      updateData.timestamps.updatedAt = new Date();
      await db.collection(COLLECTIONS.DOCUMENTS).doc(docId).update(updateData);
      return await this.getDocumentById(docId);
    } catch (error) {
      throw new Error(`Failed to update document: ${error.message}`);
    }
  }

  /**
   * Update document processing status
   */
  static async updateProcessingStatus(docId, status, progress = 0, error = null) {
    try {
      const update = {
        'status.state': status,
        'status.processingProgress': progress,
        'timestamps.updatedAt': new Date(),
      };
      
      if (error) {
        update['status.error'] = error;
        update['status.retries'] = db.FieldValue.increment(1);
      }
      
      if (status === 'completed') {
        update['timestamps.processedAt'] = new Date();
      }
      
      await db.collection(COLLECTIONS.DOCUMENTS).doc(docId).update(update);
    } catch (error) {
      throw new Error(`Failed to update processing status: ${error.message}`);
    }
  }

  /**
   * Delete document
   */
  static async deleteDocument(docId) {
    try {
      await db.collection(COLLECTIONS.DOCUMENTS).doc(docId).delete();
      return { success: true, message: 'Document deleted' };
    } catch (error) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  /**
   * Search documents with full-text capabilities
   */
  static async searchDocuments(userId, searchQuery, contentType = null) {
    try {
      let query = db.collection(COLLECTIONS.DOCUMENTS)
        .where('userId', '==', userId);
      
      if (contentType) {
        query = query.where('contentType', '==', contentType);
      }
      
      // Note: For production, implement Algolia or Firebase full-text search extension
      const snapshot = await query.get();
      
      const results = snapshot.docs
        .map(doc => doc.data())
        .filter(doc => {
          const matchTitle = doc.title?.toLowerCase().includes(searchQuery.toLowerCase());
          const matchDescription = doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
          const matchContent = doc.content?.toLowerCase().includes(searchQuery.toLowerCase());
          const matchKeywords = doc.metadata?.keywords?.some(k => 
            k.toLowerCase().includes(searchQuery.toLowerCase())
          );
          
          return matchTitle || matchDescription || matchContent || matchKeywords;
        });
      
      return results;
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Bulk update documents
   */
  static async bulkUpdateDocuments(docIds, updateData) {
    try {
      const batch = db.batch();
      
      updateData.timestamps.updatedAt = new Date();
      
      docIds.forEach(docId => {
        const docRef = db.collection(COLLECTIONS.DOCUMENTS).doc(docId);
        batch.update(docRef, updateData);
      });
      
      await batch.commit();
      return { success: true, updatedCount: docIds.length };
    } catch (error) {
      throw new Error(`Bulk update failed: ${error.message}`);
    }
  }

  /**
   * Get document stats for a user
   */
  static async getUserDocumentStats(userId) {
    try {
      const snapshot = await db.collection(COLLECTIONS.DOCUMENTS)
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
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  }
}

module.exports = DocumentService;
