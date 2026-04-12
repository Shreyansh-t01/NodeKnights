const { Router } = require('express');

const {
  listNotificationFeed,
  markNotificationsRead,
} = require('../controllers/notification.controller');

const router = Router();

router.get('/', listNotificationFeed);
router.post('/read', markNotificationsRead);

module.exports = router;
