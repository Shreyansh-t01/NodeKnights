const { Router } = require('express');

const { receiveDriveNotification } = require('../controllers/connector.controller');
const { handleGoogleCallback } = require('../controllers/googleOAuth.controller');

const router = Router();

router.get('/google/callback', handleGoogleCallback);
router.post('/drive/notifications', receiveDriveNotification);

module.exports = router;
