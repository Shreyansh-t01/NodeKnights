const { db, COLLECTIONS } = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Chunk Service
 * Handles all Firebase Firestore operations for text chunks
 */

class ChunkService {
  /**
   * Create a new chunk
   */
  static async createChunk(chunkData) {
    try {
      const chunkId = uuidv4();
      const now = new Date();

      const chunkPayload = {
        id: chunkId,
        ...chunkData,
        timestamps: {
          createdAt: now,
          updatedAt: now,
        },
        status: {
          state: 'processing',
          error: null,
        },
      };

      await db.collection(COLLECTIONS.CHUNKS).doc(chunkId).set(chunkPayload);
      return { id: chunkId, ...chunkPayload };
    } catch (error) {
      throw new Error(`Failed to create chunk: ${error.message}`);
    }
  }

  /**
   * Get chunk by ID
   */
  static async getChunkById(chunkId) {
    try {
      const doc = await db.collection(COLLECTIONS.CHUNKS).doc(chunkId).get();
      if (!doc.exists) {
        throw new Error('Chunk not found');
      }
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      throw new Error(`Failed to get chunk: ${error.message}`);
    }
  }

  /**
   * Get all chunks for a document
   */
  static async getChunksByDocumentId(documentId, limit = 50, offset = 0) {
    try {
      const query = db.collection(COLLECTIONS.CHUNKS)
        .where('documentId', '==', documentId)
        .orderBy('chunkIndex', 'asc')
        .limit(limit)
        .offset(offset);

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw new Error(`Failed to get chunks: ${error.message}`);
    }
  }

  /**
   * Update chunk
   */
  static async updateChunk(chunkId, updateData) {
    try {
      const now = new Date();
      const updatePayload = {
        ...updateData,
        timestamps: {
          updatedAt: now,
        },
      };

      await db.collection(COLLECTIONS.CHUNKS).doc(chunkId).update(updatePayload);
      return { id: chunkId, ...updatePayload };
    } catch (error) {
      throw new Error(`Failed to update chunk: ${error.message}`);
    }
  }

  /**
   * Delete chunk
   */
  static async deleteChunk(chunkId) {
    try {
      await db.collection(COLLECTIONS.CHUNKS).doc(chunkId).delete();
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete chunk: ${error.message}`);
    }
  }

  /**
   * Delete all chunks for a document
   */
  static async deleteChunksByDocumentId(documentId) {
    try {
      const query = db.collection(COLLECTIONS.CHUNKS)
        .where('documentId', '==', documentId);

      const snapshot = await query.get();
      const batch = db.batch();

      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      return { deletedCount: snapshot.docs.length };
    } catch (error) {
      throw new Error(`Failed to delete chunks: ${error.message}`);
    }
  }

  /**
   * Search chunks by content
   */
  static async searchChunks(query, userId, limit = 20) {
    try {
      // Note: This is a basic implementation. For production, consider using Algolia or Elasticsearch
      const snapshot = await db.collection(COLLECTIONS.CHUNKS)
        .where('userId', '==', userId)
        .limit(1000) // Search in recent chunks
        .get();

      const chunks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Simple text search (case-insensitive)
      const results = chunks.filter(chunk =>
        chunk.content.toLowerCase().includes(query.toLowerCase())
      ).slice(0, limit);

      return results;
    } catch (error) {
      throw new Error(`Failed to search chunks: ${error.message}`);
    }
  }

  /**
   * Get chunk statistics for a document
   */
  static async getChunkStats(documentId) {
    try {
      const query = db.collection(COLLECTIONS.CHUNKS)
        .where('documentId', '==', documentId);

      const snapshot = await query.get();
      const chunks = snapshot.docs.map(doc => doc.data());

      return {
        totalChunks: chunks.length,
        totalWords: chunks.reduce((sum, chunk) => sum + (chunk.metadata?.wordCount || 0), 0),
        avgChunkSize: chunks.length > 0 ?
          chunks.reduce((sum, chunk) => sum + (chunk.metadata?.wordCount || 0), 0) / chunks.length : 0,
        chunkTypes: chunks.reduce((acc, chunk) => {
          acc[chunk.chunkType] = (acc[chunk.chunkType] || 0) + 1;
          return acc;
        }, {}),
      };
    } catch (error) {
      throw new Error(`Failed to get chunk stats: ${error.message}`);
    }
  }
}

module.exports = ChunkService;