const { Router } = require('express');

const {
  getDocument,
  searchDocuments,
  streamDocumentContent,
} = require('../controllers/document.controller');

const router = Router();

router.get('/', searchDocuments);
router.get('/:contractId', getDocument);
router.get('/:contractId/content', streamDocumentContent);

module.exports = router;
