const { Router } = require('express');

const {
  getDriveWatch,
  getGmailPoll,
  importFromDrive,
  importFromGmail,
  startDriveWatch,
  stopDriveWatch,
  syncGmailPoll,
  syncDriveWatch,
} = require('../controllers/connector.controller');
const {
  disconnectGoogle,
  getGoogleAuthUrl,
  getGoogleStatus,
} = require('../controllers/googleOAuth.controller');

const router = Router();

router.get('/google/auth-url', getGoogleAuthUrl);
router.get('/google/status', getGoogleStatus);
router.post('/google/disconnect', disconnectGoogle);
router.get('/drive/watch', getDriveWatch);
router.post('/drive/watch/start', startDriveWatch);
router.post('/drive/watch/sync', syncDriveWatch);
router.post('/drive/watch/stop', stopDriveWatch);
router.post('/drive/import', importFromDrive);
router.get('/gmail/poll', getGmailPoll);
router.post('/gmail/poll/sync', syncGmailPoll);
router.post('/gmail/import', importFromGmail);

module.exports = router;
