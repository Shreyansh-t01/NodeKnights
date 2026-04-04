const ClauseService = require('../services/ClauseService');
const { logger } = require('../utils');

/**
 * Clause Controller
 * Handles clause-related API operations
 */

class ClauseController {
  /**
   * Get all clauses for a document
   */
  static async getClauses(req, res) {
    try {
      const { documentId } = req.params;
      const { limit = 50, offset = 0, type } = req.query;
      const { userId } = req.user;

      let clauses;
      if (type) {
        clauses = await ClauseService.getClausesByType(documentId, type);
      } else {
        clauses = await ClauseService.getClausesByDocumentId(documentId, parseInt(limit), parseInt(offset));
      }

      // Filter by userId for security
      const userClauses = clauses.filter(clause => clause.userId === userId);

      return res.json({
        success: true,
        clauses: userClauses,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: userClauses.length === parseInt(limit),
        },
      });
    } catch (error) {
      logger.error('Get clauses error', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get clause by ID
   */
  static async getClause(req, res) {
    try {
      const { clauseId } = req.params;
      const { userId } = req.user;

      const clause = await ClauseService.getClauseById(clauseId);

      // Check ownership
      if (clause.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      return res.json({ success: true, clause });
    } catch (error) {
      logger.error('Get clause error', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Create clauses for a document
   */
  static async createClauses(req, res) {
    try {
      return res.status(410).json({
        error: 'Clause generation is disabled. The NLP pipeline has been removed from the backend.',
      });
    } catch (error) {
      logger.error('Create clauses error', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update clause
   */
  static async updateClause(req, res) {
    try {
      const { clauseId } = req.params;
      const updateData = req.body;
      const { userId } = req.user;

      // Check ownership
      const existingClause = await ClauseService.getClauseById(clauseId);
      if (existingClause.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const clause = await ClauseService.updateClause(clauseId, updateData);

      return res.json({ success: true, clause });
    } catch (error) {
      logger.error('Update clause error', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete clause
   */
  static async deleteClause(req, res) {
    try {
      const { clauseId } = req.params;
      const { userId } = req.user;

      // Check ownership
      const existingClause = await ClauseService.getClauseById(clauseId);
      if (existingClause.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await ClauseService.deleteClause(clauseId);

      return res.json({ success: true, message: 'Clause deleted' });
    } catch (error) {
      logger.error('Delete clause error', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Search clauses
   */
  static async searchClauses(req, res) {
    try {
      const { q: query } = req.query;
      const { userId } = req.user;
      const { limit = 20 } = req.query;

      if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
      }

      const clauses = await ClauseService.searchClauses(query, userId, parseInt(limit));

      return res.json({
        success: true,
        clauses,
        query,
        count: clauses.length,
      });
    } catch (error) {
      logger.error('Search clauses error', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get clause statistics
   */
  static async getClauseStats(req, res) {
    try {
      const { documentId } = req.params;

      // Verify document ownership (you might want to check document service)
      const stats = await ClauseService.getClauseStats(documentId);

      return res.json({ success: true, stats });
    } catch (error) {
      logger.error('Get clause stats error', error);
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ClauseController;
