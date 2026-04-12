const { v4: uuidv4 } = require('uuid');

const {
  listNotifications,
  markAllNotificationsRead,
  saveNotification,
} = require('./notification.repository');
const { sendDocumentNotificationEmail } = require('./notificationEmail.service');

function formatSourceLabel(source = '') {
  const normalized = String(source || '').trim().toLowerCase();

  if (normalized === 'google-drive') {
    return 'Google Drive';
  }

  if (normalized === 'gmail-attachment') {
    return 'Gmail';
  }

  return normalized || 'Platform';
}

function formatStatusLabel(status = '') {
  return String(status || 'analysis-ready')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildNotificationMessage({
  contract,
  sourceLabel,
  statusLabel,
  riskCounts,
}) {
  const highRiskCount = riskCounts.high || 0;
  const mediumRiskCount = riskCounts.medium || 0;

  if (highRiskCount > 0) {
    return `${contract.title} was analyzed from ${sourceLabel} and needs review with ${highRiskCount} high-risk clause${highRiskCount === 1 ? '' : 's'}.`;
  }

  if (mediumRiskCount > 0) {
    return `${contract.title} was analyzed from ${sourceLabel} and is ready with ${mediumRiskCount} medium-risk clause${mediumRiskCount === 1 ? '' : 's'} flagged.`;
  }

  return `${contract.title} was analyzed from ${sourceLabel} and is marked ${statusLabel.toLowerCase()}.`;
}

async function notifyAnalyzedDocument({
  payload,
  source = '',
  trigger = '',
  details = {},
} = {}) {
  const contract = payload?.contract;

  if (!contract) {
    return null;
  }

  const riskCounts = contract.metadata?.riskCounts || { low: 0, medium: 0, high: 0 };
  const sourceLabel = formatSourceLabel(source || contract.source);
  const statusLabel = formatStatusLabel(contract.status);
  const createdAt = new Date().toISOString();
  const notification = {
    id: `notification_${uuidv4()}`,
    type: 'document-analyzed',
    severity: (riskCounts.high || 0) > 0 ? 'attention' : 'info',
    title: `New ${sourceLabel} document analyzed`,
    message: buildNotificationMessage({
      contract,
      sourceLabel,
      statusLabel,
      riskCounts,
    }),
    source: contract.source || source || 'unknown',
    sourceLabel,
    trigger: trigger || 'unknown',
    contractId: contract.id,
    contractTitle: contract.title,
    documentName: contract.metadata?.originalName || contract.title || 'Document',
    status: contract.status,
    statusLabel,
    riskCounts,
    readAt: null,
    createdAt,
    updatedAt: createdAt,
    details: {
      appPath: '/insights',
      sourceContext: contract.sourceContext || null,
      ...details,
    },
  };

  const email = await sendDocumentNotificationEmail(notification);

  return saveNotification({
    ...notification,
    email,
  });
}

async function getNotificationFeed({ limit = 20 } = {}) {
  return listNotifications({
    limit,
  });
}

async function markNotificationFeedAsRead() {
  return markAllNotificationsRead();
}

module.exports = {
  getNotificationFeed,
  markNotificationFeedAsRead,
  notifyAnalyzedDocument,
};
