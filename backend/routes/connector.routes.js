const { Router } = require('express');

const {
  getDriveWatch,
  importFromDrive,
  importFromGmail,
  receiveDriveNotification,
  startDriveWatch,
  stopDriveWatch,
  syncDriveWatch,
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
router.get('/drive/watch', getDriveWatch);
router.post('/drive/watch/start', startDriveWatch);
router.post('/drive/watch/sync', syncDriveWatch);
router.post('/drive/watch/stop', stopDriveWatch);
router.post('/drive/notifications', receiveDriveNotification);
router.post('/drive/import', importFromDrive);
router.post('/gmail/import', importFromGmail);

module.exports = router;
