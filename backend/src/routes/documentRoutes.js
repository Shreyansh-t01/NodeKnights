const express = require('express');
const multer = require('multer');
const DocumentController = require('../controllers/DocumentController');
const { authenticate } = require('../middleware');
const { validateFileUpload } = require('../validators');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/plain',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

const uploadDocumentHandlers = [
  authenticate,
  upload.single('file'),
  validateFileUpload,
  DocumentController.uploadDocument,
];

// Document routes
router.post('/upload', ...uploadDocumentHandlers);
router.get('/', authenticate, DocumentController.listDocuments);
router.get('/search', authenticate, DocumentController.searchDocuments);
router.get('/stats', authenticate, DocumentController.getStats);
router.get('/:docId', authenticate, DocumentController.getDocument);
router.put('/:docId', authenticate, DocumentController.updateDocument);
router.delete('/:docId', authenticate, DocumentController.deleteDocument);

router.uploadDocumentHandlers = uploadDocumentHandlers;

module.exports = router;
