const asyncHandler = require('../utils/asyncHandler');
const {
  getNotificationFeed,
  markNotificationFeedAsRead,
} = require('../services/notification.service');

function parseLimit(value, fallback = 20) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, 50);
}

const listNotificationFeed = asyncHandler(async (req, res) => {
  const data = await getNotificationFeed({
    limit: parseLimit(req.query.limit, 20),
  });

  res.json({
    success: true,
    data,
  });
});

const markNotificationsRead = asyncHandler(async (req, res) => {
  const data = await markNotificationFeedAsRead();

  res.json({
    success: true,
    message: 'Notifications marked as read.',
    data,
  });
});

module.exports = {
  listNotificationFeed,
  markNotificationsRead,
};
