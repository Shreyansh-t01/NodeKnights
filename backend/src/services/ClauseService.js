const { db, COLLECTIONS } = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Clause Service
 * Handles all Firebase Firestore operations for document clauses
 */

class ClauseService {
  /**
   * Create a new clause
   */
  static async createClause(clauseData) {
    try {
      const clauseId = uuidv4();
      const now = new Date();

      const clausePayload = {
        id: clauseId,
        ...clauseData,
        timestamps: {
          createdAt: now,
          updatedAt: now,
        },
        status: {
          state: 'processing',
          error: null,
        },
      };

      await db.collection(COLLECTIONS.CLAUSES).doc(clauseId).set(clausePayload);
      return { id: clauseId, ...clausePayload };
    } catch (error) {
      throw new Error(`Failed to create clause: ${error.message}`);
    }
  }

  /**
   * Get clause by ID
   */
  static async getClauseById(clauseId) {
    try {
      const doc = await db.collection(COLLECTIONS.CLAUSES).doc(clauseId).get();
      if (!doc.exists) {
        throw new Error('Clause not found');
      }
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      throw new Error(`Failed to get clause: ${error.message}`);
    }
  }

  /**
   * Get all clauses for a document
   */
  static async getClausesByDocumentId(documentId, limit = 50, offset = 0) {
    try {
      const query = db.collection(COLLECTIONS.CLAUSES)
        .where('documentId', '==', documentId)
        .orderBy('clauseNumber', 'asc')
        .limit(limit)
        .offset(offset);

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Failed to get clauses: ${error.message}`);
    }
  }

  /**
   * Update clause
   */
  static async updateClause(clauseId, updateData) {
    try {
      const now = new Date();
      const updatePayload = {
        ...updateData,
        timestamps: {
          updatedAt: now,
        },
      };

      await db.collection(COLLECTIONS.CLAUSES).doc(clauseId).update(updatePayload);
      return { id: clauseId, ...updatePayload };
    } catch (error) {
      throw new Error(`Failed to update clause: ${error.message}`);
    }
  }

  /**
   * Delete clause
   */
  static async deleteClause(clauseId) {
    try {
      await db.collection(COLLECTIONS.CLAUSES).doc(clauseId).delete();
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete clause: ${error.message}`);
    }
  }

  /**
   * Delete all clauses for a document
   */
  static async deleteClausesByDocumentId(documentId) {
    try {
      const query = db.collection(COLLECTIONS.CLAUSES)
        .where('documentId', '==', documentId);

      const snapshot = await query.get();
      const batch = db.batch();

      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      return { deletedCount: snapshot.docs.length };
    } catch (error) {
      throw new Error(`Failed to delete clauses: ${error.message}`);
    }
  }

  /**
   * Search clauses by content or title
   */
  static async searchClauses(query, userId, limit = 20) {
    try {
      // Note: This is a basic implementation. For production, consider using Algolia or Elasticsearch
      const snapshot = await db.collection(COLLECTIONS.CLAUSES)
        .where('userId', '==', userId)
        .limit(1000) // Search in recent clauses
        .get();

      const clauses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Simple text search (case-insensitive)
      const results = clauses.filter(clause =>
        clause.title?.toLowerCase().includes(query.toLowerCase()) ||
        clause.content?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, limit);

      return results;
    } catch (error) {
      throw new Error(`Failed to search clauses: ${error.message}`);
    }
  }

  /**
   * Get clauses by type
   */
  static async getClausesByType(documentId, clauseType) {
    try {
      const query = db.collection(COLLECTIONS.CLAUSES)
        .where('documentId', '==', documentId)
        .where('clauseType', '==', clauseType)
        .orderBy('clauseNumber', 'asc');

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Failed to get clauses by type: ${error.message}`);
    }
  }

  /**
   * Get clause statistics for a document
   */
  static async getClauseStats(documentId) {
    try {
      const query = db.collection(COLLECTIONS.CLAUSES)
        .where('documentId', '==', documentId);

      const snapshot = await query.get();
      const clauses = snapshot.docs.map(doc => doc.data());

      return {
        totalClauses: clauses.length,
        totalWords: clauses.reduce((sum, clause) => sum + (clause.metadata?.wordCount || 0), 0),
        avgClauseSize: clauses.length > 0 ?
          clauses.reduce((sum, clause) => sum + (clause.metadata?.wordCount || 0), 0) / clauses.length : 0,
        clauseTypes: clauses.reduce((acc, clause) => {
          acc[clause.clauseType] = (acc[clause.clauseType] || 0) + 1;
          return acc;
        }, {}),
        categories: clauses.reduce((acc, clause) => {
          if (clause.metadata?.category) {
            acc[clause.metadata.category] = (acc[clause.metadata.category] || 0) + 1;
          }
          return acc;
        }, {}),
      };
    } catch (error) {
      throw new Error(`Failed to get clause stats: ${error.message}`);
    }
  }
}

module.exports = ClauseService;