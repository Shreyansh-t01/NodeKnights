const DocumentService = require('../services/DocumentService');
const ContentExtractionService = require('../services/ContentExtractionService');
const NLPService = require('../services/NLPService');
const ChunkingService = require('../services/ChunkingService');
const ChunkService = require('../services/ChunkService');
const ClauseService = require('../services/ClauseService');
const { logger } = require('../utils');

/**
 * Documents Controller
 * Handles document-related API operations
 */

class DocumentController {
  /**
   * Upload and process a new document
   */
  static async uploadDocument(req, res) {
    try {
      const userId = req.user?.userId;
      const { title, description, contentType } = req.body || {};
      const file = req.file;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      logger.info(`Processing upload for user ${userId}`, { fileName: file.originalname });

      // Create document record
      const documentData = {
        userId,
        title: title || file.originalname,
        description: description || '',
        contentType: contentType || 'upload',
        file: {
          name: file.originalname,
          size: file.size,
          format: file.mimetype.split('/')[1],
          extension: file.originalname.split('.').pop(),
        },
        source: {
          type: 'upload',
          sourceId: `upload_${Date.now()}`,
        },
      };

      const document = await DocumentService.createDocument(documentData);

      // Extract content asynchronously
      DocumentController.processDocumentAsync(
        document.id,
        file.buffer,
        file.mimetype,
        file.originalname,
      ).catch(processingError => {
        logger.error(`Unhandled document processing failure for ${document.id}`, processingError);
      });

      return res.status(201).json({
        success: true,
        documentId: document.id,
        message: 'Document uploaded and is being processed',
      });
    } catch (error) {
      logger.error('Upload error', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Process document asynchronously
   */
  static async processDocumentAsync(docId, fileBuffer, mimeType, fileName) {
    try {
      // Update extraction
      const extraction = await ContentExtractionService.extractContent(fileBuffer, mimeType, fileName);
      
      // Analyze NLP
      const sentiment = await NLPService.analyzeSentiment(extraction.text);
      const keywords = NLPService.extractKeywords(extraction.text);
      const entities = await NLPService.extractEntities(extraction.text);
      const summary = NLPService.summarizeText(extraction.text);
      const language = NLPService.detectLanguage(extraction.text);

      // Get document to get userId
      const document = await DocumentService.getDocumentById(docId);

      // Update document with processed data
      await DocumentService.updateDocument(docId, {
        extraction: {
          extractedText: extraction.text,
        },
        processing: {
          summary,
          sentiment,
          entities,
          topics: keywords.map(k => ({ name: k.keyword, score: k.frequency })),
        },
        metadata: {
          language,
          keywords: keywords.map(k => k.keyword),
          wordCount: extraction.text.split(/\s+/).length,
          pageCount: extraction.metadata?.pageCount,
        },
      });

      // Create chunks
      try {
        const rawChunks = ChunkingService.chunkText(extraction.text, { method: 'fixed_size' });
        const enrichedChunks = await ChunkingService.enrichChunks(rawChunks);

        for (const chunkData of enrichedChunks) {
          await ChunkService.createChunk({
            ...chunkData,
            documentId: docId,
            userId: document.userId,
          });
        }
        logger.info(`Created ${enrichedChunks.length} chunks for document ${docId}`);
      } catch (chunkError) {
        logger.error(`Chunk creation failed for document ${docId}`, chunkError);
      }

      // Create clauses
      try {
        const rawClauses = await ChunkingService.extractClauses(extraction.text, 'general');
        const enrichedClauses = await ChunkingService.enrichClauses(rawClauses);

        for (const clauseData of enrichedClauses) {
          await ClauseService.createClause({
            ...clauseData,
            documentId: docId,
            userId: document.userId,
          });
        }
        logger.info(`Created ${enrichedClauses.length} clauses for document ${docId}`);
      } catch (clauseError) {
        logger.error(`Clause creation failed for document ${docId}`, clauseError);
      }

      await DocumentService.updateProcessingStatus(docId, 'completed', 100);
      logger.info(`Document ${docId} processed successfully`);
    } catch (error) {
      logger.error(`Document processing failed for ${docId}`, error);
      try {
        await DocumentService.updateProcessingStatus(docId, 'failed', 0, error.message);
      } catch (statusError) {
        logger.error(`Failed to mark document ${docId} as failed`, statusError);
      }
    }
  }

  /**
   * Get document by ID
   */
  static async getDocument(req, res) {
    try {
      const { docId } = req.params;
      const document = await DocumentService.getDocumentById(docId);

      // Verify ownership
      if (document.userId !== req.user.userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      return res.status(200).json(document);
    } catch (error) {
      logger.error('Get document error', error);
      return res.status(404).json({ error: error.message });
    }
  }

  /**
   * List user documents
   */
  static async listDocuments(req, res) {
    try {
      const { userId } = req.user;
      const { page = 1, limit = 20, contentType, source, status } = req.query;

      const filters = {
        contentType,
        source,
        status,
      };

      const result = await DocumentService.getDocumentsByUserId(
        userId,
        parseInt(page),
        parseInt(limit),
        filters,
      );

      return res.status(200).json(result);
    } catch (error) {
      logger.error('List documents error', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Search documents
   */
  static async searchDocuments(req, res) {
    try {
      const { userId } = req.user;
      const { q, contentType } = req.query;

      if (!q) {
        return res.status(400).json({ error: 'Search query required' });
      }

      const results = await DocumentService.searchDocuments(userId, q, contentType);

      return res.status(200).json({
        results,
        count: results.length,
      });
    } catch (error) {
      logger.error('Search error', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update document
   */
  static async updateDocument(req, res) {
    try {
      const { docId } = req.params;
      const { userId } = req.user;
      const updateData = req.body;

      const document = await DocumentService.getDocumentById(docId);
      
      if (document.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const updated = await DocumentService.updateDocument(docId, updateData);

      return res.status(200).json(updated);
    } catch (error) {
      logger.error('Update error', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete document
   */
  static async deleteDocument(req, res) {
    try {
      const { docId } = req.params;
      const { userId } = req.user;

      const document = await DocumentService.getDocumentById(docId);
      
      if (document.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      await DocumentService.deleteDocument(docId);

      return res.status(200).json({ success: true, message: 'Document deleted' });
    } catch (error) {
      logger.error('Delete error', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get document statistics
   */
  static async getStats(req, res) {
    try {
      const { userId } = req.user;
      const stats = await DocumentService.getUserDocumentStats(userId);

      return res.status(200).json(stats);
    } catch (error) {
      logger.error('Stats error', error);
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = DocumentController;
