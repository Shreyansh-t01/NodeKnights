const { Router } = require('express');

const upload = require('../middlewares/upload');
const {
  createKnowledgeEntry,
  getKnowledge,
  listKnowledge,
  runKnowledgeSearch,
  uploadKnowledge,
} = require('../controllers/knowledge.controller');

const router = Router();

router.post('/upload', upload.single('file'), uploadKnowledge);
router.post('/entries', createKnowledgeEntry);
router.post('/search', runKnowledgeSearch);
router.get('/', listKnowledge);
router.get('/:knowledgeId', getKnowledge);

module.exports = router;
