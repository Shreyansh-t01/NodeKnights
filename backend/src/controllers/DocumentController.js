const DocumentService = require('../services/DocumentService');
const FileStorageService = require('../services/FileStorageService');
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
    let documentId = null;
    let uploadStage = 'validating upload request';

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
          mimeType: file.mimetype,
          format: file.mimetype.split('/')[1],
          extension: file.originalname.split('.').pop(),
        },
        source: {
          type: 'upload',
          sourceId: `upload_${Date.now()}`,
        },
      };

      uploadStage = 'creating document record';
      const document = await DocumentService.createDocument(documentData);
      documentId = document.id;

      uploadStage = 'storing file chunks';
      const storage = await FileStorageService.storeFile(document.id, file);

      uploadStage = 'updating document metadata';
      await DocumentService.updateDocument(document.id, {
        file: documentData.file,
        storage,
        status: {
          uploadProgress: 100,
        },
      });

      uploadStage = 'marking upload complete';
      await DocumentService.updateProcessingStatus(document.id, 'completed', 100);

      return res.status(201).json({
        success: true,
        documentId: document.id,
        message: 'Document uploaded successfully',
      });
    } catch (error) {
      const errorMessage = `${uploadStage} failed: ${error.message}`;

      logger.error('Upload error', {
        stage: uploadStage,
        documentId,
        error: error.message,
        stack: error.stack,
      });

      if (documentId) {
        try {
          await DocumentService.updateProcessingStatus(documentId, 'failed', 0, errorMessage);
          await FileStorageService.deleteFile(documentId);
        } catch (cleanupError) {
          logger.error(`Upload cleanup failed for ${documentId}`, {
            stage: 'cleanup',
            error: cleanupError.message,
            stack: cleanupError.stack,
          });
        }
      }

      return res.status(500).json({
        error: errorMessage,
        stage: uploadStage,
        documentId,
      });
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
