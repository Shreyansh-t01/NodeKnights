const { Router } = require('express');

const upload = require('../middlewares/upload');
const {
  uploadContract,
  listContracts,
  getContract,
  getInsights,
} = require('../controllers/contract.controller');

const router = Router();

router.post('/upload', upload.single('file'), uploadContract);
router.get('/', listContracts);
router.get('/:contractId', getContract);
router.get('/:contractId/insights', getInsights);
router.post('/:contractId/insights', getInsights);

module.exports = router;
