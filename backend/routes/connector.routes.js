const { Router } = require('express');

const {
  importFromDrive,
  importFromGmail,
} = require('../controllers/connector.controller');

const router = Router();

router.post('/drive/import', importFromDrive);
router.post('/gmail/import', importFromGmail);

module.exports = router;
