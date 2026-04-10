const { Router } = require('express');

const {
  importFromDrive,
  importFromGmail,
} = require('../controllers/connector.controller');
const {
  disconnectGoogle,
  getGoogleAuthUrl,
  getGoogleStatus,
  handleGoogleCallback,
} = require('../controllers/googleOAuth.controller');

const router = Router();

router.get('/google/auth-url', getGoogleAuthUrl);
router.get('/google/callback', handleGoogleCallback);
router.get('/google/status', getGoogleStatus);
router.post('/google/disconnect', disconnectGoogle);
router.post('/drive/import', importFromDrive);
router.post('/gmail/import', importFromGmail);

module.exports = router;
