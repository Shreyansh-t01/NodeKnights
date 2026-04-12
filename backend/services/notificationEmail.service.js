const { google } = require('googleapis');

const { env, featureFlags } = require('../config/env');
const { GOOGLE_SCOPE_MAP, getOAuthClient } = require('./googleAuth.service');
const { getStoredGoogleTokens } = require('./googleTokenStore.service');

function formatRiskCounts(riskCounts = {}) {
  return `High: ${riskCounts.high || 0}, Medium: ${riskCounts.medium || 0}, Low: ${riskCounts.low || 0}`;
}

async function resolveNotificationRecipients(gmail = null) {
  if (env.notificationEmailRecipients.length) {
    return env.notificationEmailRecipients;
  }

  const workspaceUser = String(env.googleWorkspaceUser || '').trim();

  if (workspaceUser.includes('@')) {
    return [workspaceUser];
  }

  if (gmail) {
    try {
      const response = await gmail.users.getProfile({
        userId: env.googleWorkspaceUser || 'me',
      });
      const emailAddress = String(response.data.emailAddress || '').trim();

      if (emailAddress.includes('@')) {
        return [emailAddress];
      }
    } catch (error) {
      console.warn('Failed to resolve Gmail profile email for notifications:', error.message);
    }
  }

  return [];
}

function buildAppUrl() {
  const baseUrl = String(env.appBaseUrl || '').trim();
  return baseUrl ? `${baseUrl.replace(/\/+$/, '')}/insights` : '';
}

function encodeBase64Url(value = '') {
  return Buffer
    .from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildRawEmail({ recipients = [], subject = '', body = '' }) {
  return [
    `To: ${recipients.join(', ')}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
  ].join('\r\n');
}

function hasStoredSendScope(storedTokens) {
  const scopes = String(storedTokens?.scope || '')
    .split(/\s+/)
    .filter(Boolean);

  return scopes.includes(GOOGLE_SCOPE_MAP['gmail-send']);
}

async function sendDocumentNotificationEmail(notification) {
  if (!env.notificationEmailEnabled) {
    return {
      attempted: false,
      sent: false,
      recipients: [],
      reason: 'disabled',
    };
  }

  if (!featureFlags.googleConnectors) {
    return {
      attempted: false,
      sent: false,
      recipients,
      reason: 'google-oauth-not-configured',
    };
  }

  const appUrl = buildAppUrl();
  const subject = `[Legal Intelligence] ${notification.sourceLabel} document analyzed: ${notification.documentName}`;

  try {
    const auth = await getOAuthClient();
    const gmail = google.gmail({
      version: 'v1',
      auth,
    });
    const recipients = await resolveNotificationRecipients(gmail);

    if (!recipients.length) {
      return {
        attempted: false,
        sent: false,
        recipients: [],
        reason: 'no-recipients-configured',
      };
    }
    const bodyLines = [
      'A new document was ingested and analyzed automatically.',
      '',
      `Document: ${notification.documentName}`,
      `Contract title: ${notification.contractTitle}`,
      `Source: ${notification.sourceLabel}`,
      `Status: ${notification.statusLabel}`,
      `Risk counts: ${formatRiskCounts(notification.riskCounts)}`,
      `Detected at: ${notification.createdAt}`,
    ];

    if (appUrl) {
      bodyLines.push(`Open app: ${appUrl}`);
    }
    const raw = encodeBase64Url(buildRawEmail({
      recipients,
      subject,
      body: bodyLines.join('\r\n'),
    }));

    const response = await gmail.users.messages.send({
      userId: env.googleWorkspaceUser || 'me',
      requestBody: {
        raw,
      },
    });

    return {
      attempted: true,
      sent: true,
      recipients,
      sentAt: new Date().toISOString(),
      messageId: response.data.id || '',
      threadId: response.data.threadId || '',
    };
  } catch (error) {
    const storedTokens = await getStoredGoogleTokens().catch(() => null);
    const missingStoredSendScope = Boolean(storedTokens?.scope) && !hasStoredSendScope(storedTokens);

    return {
      attempted: true,
      sent: false,
      recipients: [],
      sentAt: null,
      reason: missingStoredSendScope ? 'missing-gmail-send-scope' : 'send-failed',
      error: error.message,
    };
  }
}

module.exports = {
  sendDocumentNotificationEmail,
};
