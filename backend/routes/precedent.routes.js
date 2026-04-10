const { Router } = require('express');

const upload = require('../middlewares/upload');
const {
  createPrecedentEntry,
  getPrecedent,
  listClausePrecedents,
  listPrecedents,
  uploadPrecedent,
} = require('../controllers/precedent.controller');

const router = Router();

router.post('/upload', upload.single('file'), uploadPrecedent);
router.post('/entries', createPrecedentEntry);
router.get('/', listPrecedents);
router.get('/review/:contractId/:clauseId', listClausePrecedents);
router.get('/:precedentId', getPrecedent);

module.exports = router;
