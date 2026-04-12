const { google } = require('googleapis');

const AppError = require('../errors/AppError');
const { env, featureFlags } = require('../config/env');
const { ingestManualContract } = require('./contract.service');
const { getOAuthClient } = require('./googleAuth.service');
const { notifyAnalyzedDocument } = require('./notification.service');
const {
  getConnectorState,
  getProcessedSource,
  markProcessedSource,
  setConnectorState,
} = require('./connectorState.service');

const GMAIL_SYNC_STATE_KEY = 'gmail_attachment_sync';

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

let pollingTimer = null;
let activeSyncPromise = null;

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function ensureGmailConfigured() {
  if (!featureFlags.googleConnectors) {
    throw new AppError(
      503,
      'Google OAuth is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to backend/.env.',
    );
  }
}

function createGmailClient(auth) {
  return google.gmail({
    version: 'v1',
    auth,
  });
}

async function getGmailClient() {
  const auth = await getOAuthClient();
  return createGmailClient(auth);
}

function collectAttachmentParts(part, attachments = []) {
  if (!part) {
    return attachments;
  }

  if (part.filename && part.body?.attachmentId && SUPPORTED_MIME_TYPES.has(part.mimeType)) {
    attachments.push({
      filename: part.filename,
      attachmentId: part.body.attachmentId,
      mimeType: part.mimeType,
      partId: part.partId || '',
    });
  }

  (part.parts || []).forEach((child) => collectAttachmentParts(child, attachments));
  return attachments;
}

function decodeBase64Url(value = '') {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
}

function normalizeMessageHeaders(headers = []) {
  return headers.reduce((accumulator, header) => {
    const key = String(header?.name || '').trim().toLowerCase();

    if (!key) {
      return accumulator;
    }

    accumulator[key] = String(header?.value || '').trim();
    return accumulator;
  }, {});
}

function buildGmailDedupeKey(message, attachment) {
  return `gmail:${message.id || ''}:${attachment.attachmentId || attachment.partId || attachment.filename || 'unknown'}`;
}

function buildGmailMessageUrl(messageId = '') {
  return messageId ? `https://mail.google.com/mail/u/0/#all/${messageId}` : '';
}

async function downloadAttachment(gmail, messageId, attachment) {
  const response = await gmail.users.messages.attachments.get({
    userId: env.googleWorkspaceUser,
    messageId,
    id: attachment.attachmentId,
  });

  return {
    buffer: decodeBase64Url(response.data.data),
    originalname: attachment.filename,
    mimetype: attachment.mimeType,
    externalId: messageId,
    messageId,
    attachmentId: attachment.attachmentId,
    sourceUrl: buildGmailMessageUrl(messageId),
  };
}

async function getMessageDetails(gmail, messageId) {
  const response = await gmail.users.messages.get({
    userId: env.googleWorkspaceUser,
    id: messageId,
    format: 'full',
  });

  return response.data;
}

async function processMessageAttachment(gmail, message, attachment, { trigger = 'manual-import' } = {}) {
  const dedupeKey = buildGmailDedupeKey(message, attachment);
  const existing = await getProcessedSource(dedupeKey);

  if (existing) {
    return {
      status: 'skipped',
      reason: 'already-processed',
      sourceKey: dedupeKey,
      messageId: message.id,
      attachmentId: attachment.attachmentId,
      contractId: existing.contractId || null,
    };
  }

  const headers = normalizeMessageHeaders(message.payload?.headers || []);

  try {
    const file = await downloadAttachment(gmail, message.id, attachment);
    const modifiedTime = message.internalDate
      ? new Date(Number(message.internalDate)).toISOString()
      : null;
    const payload = await ingestManualContract(file, {
      source: 'gmail-attachment',
      externalId: message.id,
      sourceUrl: file.sourceUrl,
      messageId: message.id,
      attachmentId: attachment.attachmentId,
      modifiedTime,
      dedupeKey,
    });
    let notification = null;
    let notificationError = null;

    try {
      notification = await notifyAnalyzedDocument({
        payload,
        source: 'gmail-attachment',
        trigger,
        details: {
          messageId: message.id,
          attachmentId: attachment.attachmentId,
          subject: headers.subject || '',
          from: headers.from || '',
          sourceUrl: file.sourceUrl,
        },
      });
    } catch (error) {
      notificationError = error.message;
      console.error('Gmail notification creation failed:', error.message);
    }

    await markProcessedSource(dedupeKey, {
      connector: 'gmail',
      trigger,
      messageId: message.id,
      attachmentId: attachment.attachmentId,
      contractId: payload.contract.id,
      notificationId: notification?.id || null,
      notificationError,
      subject: headers.subject || '',
      from: headers.from || '',
      modifiedTime,
      processedAt: new Date().toISOString(),
    });

    return {
      status: 'imported',
      sourceKey: dedupeKey,
      messageId: message.id,
      attachmentId: attachment.attachmentId,
      contractId: payload.contract.id,
      notificationId: notification?.id || null,
      notificationError,
      payload,
    };
  } catch (error) {
    return {
      status: 'failed',
      sourceKey: dedupeKey,
      messageId: message.id,
      attachmentId: attachment.attachmentId,
      reason: error.message,
    };
  }
}

async function processGmailMessage(gmail, message, { trigger = 'manual-import' } = {}) {
  const attachments = collectAttachmentParts(message.payload);

  if (!attachments.length) {
    return [{
      status: 'skipped',
      reason: 'no-supported-attachments',
      messageId: message.id,
    }];
  }

  const results = [];

  for (const attachment of attachments) {
    results.push(await processMessageAttachment(gmail, message, attachment, {
      trigger,
    }));
  }

  return results;
}

async function syncGmailAttachments({
  trigger = 'manual-gmail-sync',
  query,
  maxResults = env.gmailPollMaxResults,
  includePayloads = false,
} = {}) {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    ensureGmailConfigured();

    const gmail = await getGmailClient();
    const syncState = await getConnectorState(GMAIL_SYNC_STATE_KEY) || {};
    const effectiveQuery = query || env.gmailDefaultQuery;
    const effectiveMaxResults = parsePositiveInteger(maxResults, env.gmailPollMaxResults);
    const response = await gmail.users.messages.list({
      userId: env.googleWorkspaceUser,
      q: effectiveQuery,
      maxResults: effectiveMaxResults,
    });

    const messages = response.data.messages || [];
    const results = [];
    let importedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    try {
      for (const messageSummary of messages) {
        const message = await getMessageDetails(gmail, messageSummary.id);
        const messageResults = await processGmailMessage(gmail, message, {
          trigger,
        });

        messageResults.forEach((item) => {
          results.push(includePayloads ? item : { ...item, payload: undefined });

          if (item.status === 'imported') {
            importedCount += 1;
            return;
          }

          if (item.status === 'failed') {
            failedCount += 1;
            return;
          }

          skippedCount += 1;
        });
      }

      await setConnectorState(GMAIL_SYNC_STATE_KEY, {
        ...syncState,
        query: effectiveQuery,
        maxResults: effectiveMaxResults,
        lastRunAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        lastTrigger: trigger,
        lastImportedCount: importedCount,
        lastSkippedCount: skippedCount,
        lastFailedCount: failedCount,
        lastMessageScanCount: messages.length,
        lastError: null,
      });

      return {
        trigger,
        importedCount,
        skippedCount,
        failedCount,
        scannedMessageCount: messages.length,
        results,
      };
    } catch (error) {
      await setConnectorState(GMAIL_SYNC_STATE_KEY, {
        ...syncState,
        query: effectiveQuery,
        maxResults: effectiveMaxResults,
        lastRunAt: new Date().toISOString(),
        lastTrigger: trigger,
        lastError: error.message,
      });

      throw error;
    }
  })()
    .finally(() => {
      activeSyncPromise = null;
    });

  return activeSyncPromise;
}

async function importGmailAttachments({ query, maxResults = env.gmailPollMaxResults } = {}) {
  const result = await syncGmailAttachments({
    trigger: 'manual-gmail-import',
    query,
    maxResults: parsePositiveInteger(maxResults, env.gmailPollMaxResults),
    includePayloads: true,
  });

  return result.results
    .filter((item) => item.status === 'imported')
    .map((item) => item.payload);
}

async function getGmailPollStatus() {
  return {
    ready: featureFlags.googleConnectors,
    enabled: env.gmailPollEnabled,
    workspaceUser: env.googleWorkspaceUser,
    query: env.gmailDefaultQuery,
    maxResults: env.gmailPollMaxResults,
    syncState: await getConnectorState(GMAIL_SYNC_STATE_KEY),
  };
}

async function bootstrapGmailPollingAutomation() {
  if (!env.gmailPollEnabled) {
    return {
      enabled: false,
      reason: 'disabled',
    };
  }

  if (!featureFlags.googleConnectors) {
    return {
      enabled: false,
      reason: 'google-connectors-not-configured',
    };
  }

  await syncGmailAttachments({
    trigger: 'gmail-poll-bootstrap',
    query: env.gmailDefaultQuery,
    maxResults: env.gmailPollMaxResults,
  });

  if (!pollingTimer) {
    pollingTimer = setInterval(() => {
      syncGmailAttachments({
        trigger: 'gmail-poll-interval',
        query: env.gmailDefaultQuery,
        maxResults: env.gmailPollMaxResults,
      }).catch((error) => {
        console.error('Gmail polling sync failed:', error.message);
      });
    }, Math.max(env.gmailPollIntervalMs, 60000));

    if (typeof pollingTimer.unref === 'function') {
      pollingTimer.unref();
    }
  }

  return {
    enabled: true,
    query: env.gmailDefaultQuery,
    intervalMs: Math.max(env.gmailPollIntervalMs, 60000),
    maxResults: env.gmailPollMaxResults,
  };
}

module.exports = {
  bootstrapGmailPollingAutomation,
  getGmailPollStatus,
  importGmailAttachments,
  syncGmailAttachments,
};
