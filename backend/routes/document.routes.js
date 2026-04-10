const { Router } = require('express');

const {
  getDocument,
  searchDocuments,
  streamDocumentContent,
  downloadInsightPdf, // ✅ NEW IMPORT
} = require('../controllers/document.controller');

const router = Router();

// Existing routes
router.get('/', searchDocuments);
router.get('/:contractId', getDocument);
router.get('/:contractId/content', streamDocumentContent);

// ✅ NEW ROUTE (PDF Download)
router.post('/download-insight-pdf', downloadInsightPdf);

module.exports = router;
