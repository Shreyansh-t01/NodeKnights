const ChunkService = require('../services/ChunkService');
const ChunkingService = require('../services/ChunkingService');
const { logger } = require('../utils');

/**
 * Chunk Controller
 * Handles chunk-related API operations
 */

class ChunkController {
  /**
   * Get all chunks for a document
   */
  static async getChunks(req, res) {
    try {
      const { documentId } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      const { userId } = req.user;

      const chunks = await ChunkService.getChunksByDocumentId(documentId, parseInt(limit), parseInt(offset));

      // Filter by userId for security
      const userChunks = chunks.filter(chunk => chunk.userId === userId);

      return res.json({
        success: true,
        chunks: userChunks,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: userChunks.length === parseInt(limit),
        },
      });
    } catch (error) {
      logger.error('Get chunks error', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get chunk by ID
   */
  static async getChunk(req, res) {
    try {
      const { chunkId } = req.params;
      const { userId } = req.user;

      const chunk = await ChunkService.getChunkById(chunkId);

      // Check ownership
      if (chunk.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      return res.json({ success: true, chunk });
    } catch (error) {
      logger.error('Get chunk error', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Create chunks for a document
   */
  static async createChunks(req, res) {
    try {
      const { documentId } = req.params;
      const { text, options = {} } = req.body;
      const { userId } = req.user;

      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      logger.log(`Creating chunks for document ${documentId}`, { userId });

      // Generate chunks
      const rawChunks = ChunkingService.chunkText(text, options);

      // Enrich chunks with NLP
      const enrichedChunks = await ChunkingService.enrichChunks(rawChunks);

      // Save chunks to database
      const savedChunks = [];
      for (const chunkData of enrichedChunks) {
        const chunk = await ChunkService.createChunk({
          ...chunkData,
          documentId,
          userId,
        });
        savedChunks.push(chunk);
      }

      return res.status(201).json({
        success: true,
        chunks: savedChunks,
        count: savedChunks.length,
      });
    } catch (error) {
      logger.error('Create chunks error', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update chunk
   */
  static async updateChunk(req, res) {
    try {
      const { chunkId } = req.params;
      const updateData = req.body;
      const { userId } = req.user;

      // Check ownership
      const existingChunk = await ChunkService.getChunkById(chunkId);
      if (existingChunk.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const chunk = await ChunkService.updateChunk(chunkId, updateData);

      return res.json({ success: true, chunk });
    } catch (error) {
      logger.error('Update chunk error', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete chunk
   */
  static async deleteChunk(req, res) {
    try {
      const { chunkId } = req.params;
      const { userId } = req.user;

      // Check ownership
      const existingChunk = await ChunkService.getChunkById(chunkId);
      if (existingChunk.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await ChunkService.deleteChunk(chunkId);

      return res.json({ success: true, message: 'Chunk deleted' });
    } catch (error) {
      logger.error('Delete chunk error', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Search chunks
   */
  static async searchChunks(req, res) {
    try {
      const { q: query } = req.query;
      const { userId } = req.user;
      const { limit = 20 } = req.query;

      if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
      }

      const chunks = await ChunkService.searchChunks(query, userId, parseInt(limit));

      return res.json({
        success: true,
        chunks,
        query,
        count: chunks.length,
      });
    } catch (error) {
      logger.error('Search chunks error', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get chunk statistics
   */
  static async getChunkStats(req, res) {
    try {
      const { documentId } = req.params;

      // Verify document ownership (you might want to check document service)
      const stats = await ChunkService.getChunkStats(documentId);

      return res.json({ success: true, stats });
    } catch (error) {
      logger.error('Get chunk stats error', error);
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ChunkController;