const crypto = require('node:crypto');
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

const DRIVE_WATCH_STATE_KEY = 'drive_changes_watch';
const DRIVE_SYNC_STATE_KEY = 'drive_changes_sync';

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/vnd.google-apps.document',
]);

let renewalTimer = null;
let activeSyncPromise = null;

function createDriveClient(auth) {
  return google.drive({
    version: 'v3',
    auth,
  });
}

async function getDriveClient() {
  const auth = await getOAuthClient();
  return createDriveClient(auth);
}

function hasConfiguredDriveFolders() {
  return env.googleDriveFolderIds.length > 0;
}

function isSupportedDriveFile(file = {}) {
  return Boolean(
    file
      && !file.trashed
      && typeof file.mimeType === 'string'
      && SUPPORTED_MIME_TYPES.has(file.mimeType),
  );
}

function parseExpiration(value) {
  if (!value) {
    return null;
  }

  const asNumber = Number(value);

  if (Number.isFinite(asNumber) && asNumber > 0) {
    return new Date(asNumber).toISOString();
  }

  const asDate = Date.parse(value);
  return Number.isFinite(asDate) ? new Date(asDate).toISOString() : null;
}

function resolveDriveFolderId(file = {}) {
  const parents = Array.isArray(file.parents) ? file.parents : [];
  return parents.find((parent) => env.googleDriveFolderIds.includes(parent)) || parents[0] || '';
}

function isMonitoredDriveFile(file = {}) {
  if (!hasConfiguredDriveFolders()) {
    return false;
  }

  const parents = Array.isArray(file.parents) ? file.parents : [];
  return parents.some((parent) => env.googleDriveFolderIds.includes(parent));
}

function buildDriveDedupeKey(file = {}) {
  return `drive:${file.id || file.fileId || ''}:${file.modifiedTime || 'unknown'}`;
}

function normalizeHeaderMap(headers = {}) {
  const normalized = {};

  Object.entries(headers).forEach(([key, value]) => {
    normalized[String(key || '').toLowerCase()] = Array.isArray(value) ? value[0] : value;
  });

  return normalized;
}

function ensureDriveWatchConfigured() {
  ensureDriveSyncConfigured();

  if (!env.googleDriveWebhookUrl) {
    throw new AppError(
      400,
      'Set GOOGLE_DRIVE_WEBHOOK_URL in the backend env file before enabling Drive watch sync.',
    );
  }
}

function ensureDriveSyncConfigured() {
  if (!hasConfiguredDriveFolders()) {
    throw new AppError(
      400,
      'Set GOOGLE_DRIVE_FOLDER_IDS in the backend env file before enabling Drive sync.',
    );
  }
}

async function getDriveFileMetadata(fileId) {
  const drive = await getDriveClient();
  const response = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, webViewLink, modifiedTime, parents, trashed',
  });

  return response.data;
}

async function listFilesInFolder(folderId, limit = 5) {
  const drive = await getDriveClient();
  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    pageSize: limit,
    orderBy: 'modifiedTime desc',
    fields: 'files(id, name, mimeType, webViewLink, modifiedTime, parents, trashed)',
  });

  return (response.data.files || []).filter((file) => isSupportedDriveFile(file));
}

async function downloadDriveFile(fileId, knownMetadata = null) {
  const drive = await getDriveClient();
  const metadata = knownMetadata || await getDriveFileMetadata(fileId);

  if (!isSupportedDriveFile(metadata)) {
    throw new AppError(400, `Unsupported Drive file type: ${metadata.mimeType}`);
  }

  if (metadata.mimeType === 'application/vnd.google-apps.document') {
    const exportResponse = await drive.files.export(
      {
        fileId,
        mimeType: 'application/pdf',
      },
      {
        responseType: 'arraybuffer',
      },
    );

    return {
      buffer: Buffer.from(exportResponse.data),
      originalname: `${metadata.name}.pdf`,
      mimetype: 'application/pdf',
      externalId: metadata.id,
      sourceUrl: metadata.webViewLink,
      modifiedTime: metadata.modifiedTime || null,
      folderId: resolveDriveFolderId(metadata),
    };
  }

  const fileResponse = await drive.files.get(
    {
      fileId,
      alt: 'media',
    },
    {
      responseType: 'arraybuffer',
    },
  );

  return {
    buffer: Buffer.from(fileResponse.data),
    originalname: metadata.name,
    mimetype: metadata.mimeType,
    externalId: metadata.id,
    sourceUrl: metadata.webViewLink,
    modifiedTime: metadata.modifiedTime || null,
    folderId: resolveDriveFolderId(metadata),
  };
}

async function processDriveFileMetadata(metadata, { trigger = 'manual-import' } = {}) {
  const fileId = metadata?.id || metadata?.fileId || '';

  if (!fileId) {
    return {
      status: 'skipped',
      reason: 'missing-file-id',
      fileId: '',
    };
  }

  if (!isSupportedDriveFile(metadata)) {
    return {
      status: 'skipped',
      reason: 'unsupported-or-trashed',
      fileId,
      mimeType: metadata?.mimeType || '',
    };
  }

  const folderId = resolveDriveFolderId(metadata);
  const dedupeKey = buildDriveDedupeKey({
    id: fileId,
    modifiedTime: metadata?.modifiedTime || null,
  });
  const existing = await getProcessedSource(dedupeKey);

  if (existing) {
    return {
      status: 'skipped',
      reason: 'already-processed',
      fileId,
      sourceKey: dedupeKey,
      contractId: existing.contractId || null,
    };
  }

  try {
    const downloaded = await downloadDriveFile(fileId, metadata);
    const payload = await ingestManualContract(downloaded, {
      source: 'google-drive',
      externalId: fileId,
      sourceUrl: metadata.webViewLink || downloaded.sourceUrl || '',
      folderId: folderId || downloaded.folderId || '',
      modifiedTime: metadata.modifiedTime || downloaded.modifiedTime || null,
      dedupeKey,
    });
    let notification = null;
    let notificationError = null;

    try {
      notification = await notifyAnalyzedDocument({
        payload,
        source: 'google-drive',
        trigger,
        details: {
          fileId,
          folderId: folderId || downloaded.folderId || '',
          sourceUrl: metadata.webViewLink || downloaded.sourceUrl || '',
        },
      });
    } catch (error) {
      notificationError = error.message;
      console.error('Drive notification creation failed:', error.message);
    }

    await markProcessedSource(dedupeKey, {
      connector: 'google-drive',
      trigger,
      fileId,
      contractId: payload.contract.id,
      notificationId: notification?.id || null,
      notificationError,
      folderId: folderId || downloaded.folderId || '',
      modifiedTime: metadata.modifiedTime || downloaded.modifiedTime || null,
      processedAt: new Date().toISOString(),
    });

    return {
      status: 'imported',
      fileId,
      sourceKey: dedupeKey,
      contractId: payload.contract.id,
      notificationId: notification?.id || null,
      notificationError,
      payload,
    };
  } catch (error) {
    return {
      status: 'failed',
      fileId,
      sourceKey: dedupeKey,
      reason: error.message,
    };
  }
}

async function importDriveFiles({ fileId, folderId, limit = 5 }) {
  if (fileId) {
    const metadata = await getDriveFileMetadata(fileId);
    const outcome = await processDriveFileMetadata(metadata, {
      trigger: 'manual-drive-import',
    });

    return outcome.status === 'imported' ? [outcome.payload] : [];
  }

  const targetFolderId = folderId || env.googleDriveFolderIds[0];

  if (!targetFolderId) {
    throw new AppError(400, 'Provide a Drive fileId or folderId, or set GOOGLE_DRIVE_FOLDER_IDS in the backend env file.');
  }

  const files = await listFilesInFolder(targetFolderId, limit);

  if (!files.length) {
    return [];
  }

  const outcomes = await Promise.all(
    files.map((driveFile) => processDriveFileMetadata(driveFile, {
      trigger: 'manual-drive-import',
    })),
  );

  return outcomes
    .filter((item) => item.status === 'imported')
    .map((item) => item.payload);
}

async function getDriveStartPageToken(drive = null) {
  const client = drive || await getDriveClient();
  const response = await client.changes.getStartPageToken({
    fields: 'startPageToken',
  });

  return response.data.startPageToken || '';
}

async function initializeDriveSyncCursor({ force = false } = {}) {
  const current = await getConnectorState(DRIVE_SYNC_STATE_KEY) || {};

  if (current.pageToken && !force) {
    return current.pageToken;
  }

  const drive = await getDriveClient();
  const pageToken = await getDriveStartPageToken(drive);

  await setConnectorState(DRIVE_SYNC_STATE_KEY, {
    ...current,
    pageToken,
    folderIds: env.googleDriveFolderIds,
    lastCursorInitializedAt: new Date().toISOString(),
  });

  return pageToken;
}

async function syncDriveChanges({ trigger = 'manual-sync' } = {}) {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    ensureDriveSyncConfigured();

    const drive = await getDriveClient();
    const syncState = await getConnectorState(DRIVE_SYNC_STATE_KEY) || {};
    let pageToken = syncState.pageToken || '';

    if (!pageToken) {
      pageToken = await getDriveStartPageToken(drive);
      await setConnectorState(DRIVE_SYNC_STATE_KEY, {
        ...syncState,
        pageToken,
        folderIds: env.googleDriveFolderIds,
        lastCursorInitializedAt: new Date().toISOString(),
        lastRunAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        lastTrigger: trigger,
        lastImportedCount: 0,
        lastSkippedCount: 0,
        lastFailedCount: 0,
        lastError: null,
      });

      return {
        trigger,
        initialized: true,
        importedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        results: [],
      };
    }

    let nextPageToken = pageToken;
    let savedStartPageToken = pageToken;
    const results = [];
    let importedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    try {
      do {
        const response = await drive.changes.list({
          pageToken: nextPageToken,
          spaces: 'drive',
          fields: 'changes(fileId,removed,file(id,name,mimeType,webViewLink,modifiedTime,parents,trashed)),nextPageToken,newStartPageToken',
        });

        const changes = Array.isArray(response.data.changes) ? response.data.changes : [];

        for (const change of changes) {
          if (change.removed || !change.file) {
            skippedCount += 1;
            results.push({
              status: 'skipped',
              reason: 'removed-or-missing',
              fileId: change.fileId || '',
            });
            continue;
          }

          if (!isMonitoredDriveFile(change.file)) {
            skippedCount += 1;
            results.push({
              status: 'skipped',
              reason: 'outside-monitored-folders',
              fileId: change.file.id || change.fileId || '',
            });
            continue;
          }

          const outcome = await processDriveFileMetadata(change.file, {
            trigger,
          });

          results.push({
            ...outcome,
            payload: undefined,
          });

          if (outcome.status === 'imported') {
            importedCount += 1;
          } else if (outcome.status === 'failed') {
            failedCount += 1;
          } else {
            skippedCount += 1;
          }
        }

        if (response.data.newStartPageToken) {
          savedStartPageToken = response.data.newStartPageToken;
        }

        nextPageToken = response.data.nextPageToken || '';
      } while (nextPageToken);

      await setConnectorState(DRIVE_SYNC_STATE_KEY, {
        ...syncState,
        pageToken: savedStartPageToken,
        folderIds: env.googleDriveFolderIds,
        lastRunAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        lastTrigger: trigger,
        lastImportedCount: importedCount,
        lastSkippedCount: skippedCount,
        lastFailedCount: failedCount,
        lastError: null,
      });

      return {
        trigger,
        initialized: false,
        importedCount,
        skippedCount,
        failedCount,
        results,
      };
    } catch (error) {
      await setConnectorState(DRIVE_SYNC_STATE_KEY, {
        ...syncState,
        pageToken,
        folderIds: env.googleDriveFolderIds,
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

async function registerDriveChangesWatch({ forceRenew = false } = {}) {
  ensureDriveWatchConfigured();

  const currentState = await getConnectorState(DRIVE_WATCH_STATE_KEY) || {};
  const currentExpiration = Date.parse(currentState.expiration || '');

  if (
    !forceRenew
    && currentState.channelId
    && Number.isFinite(currentExpiration)
    && (currentExpiration - Date.now()) > env.googleDriveWatchRenewalLeadMs
  ) {
    return currentState;
  }

  const pageToken = await initializeDriveSyncCursor();

  if (currentState.channelId && currentState.resourceId) {
    await stopDriveChangesWatch({
      state: currentState,
      suppressErrors: true,
    });
  }

  const drive = await getDriveClient();
  const requestedExpiration = Math.min(
    Date.now() + Math.max(env.googleDriveWatchExpirationMs, 60000),
    Date.now() + 604800000,
  );
  const channelId = crypto.randomUUID();
  const channelToken = env.googleDriveWatchChannelToken || currentState.channelToken || crypto.randomUUID();

  const response = await drive.changes.watch({
    pageToken,
    requestBody: {
      id: channelId,
      type: 'web_hook',
      address: env.googleDriveWebhookUrl,
      token: channelToken,
      expiration: String(requestedExpiration),
    },
  });

  const data = response.data || {};

  return setConnectorState(DRIVE_WATCH_STATE_KEY, {
    status: 'active',
    channelId,
    channelToken,
    resourceId: data.resourceId || currentState.resourceId || '',
    resourceUri: data.resourceUri || currentState.resourceUri || '',
    expiration: parseExpiration(data.expiration) || new Date(requestedExpiration).toISOString(),
    address: env.googleDriveWebhookUrl,
    folderIds: env.googleDriveFolderIds,
    pageToken,
    lastRegisteredAt: new Date().toISOString(),
  });
}

async function stopDriveChangesWatch({ state, suppressErrors = false } = {}) {
  const currentState = state || await getConnectorState(DRIVE_WATCH_STATE_KEY) || null;

  if (!currentState?.channelId || !currentState?.resourceId) {
    return currentState || {
      status: 'inactive',
    };
  }

  const drive = await getDriveClient();

  try {
    await drive.channels.stop({
      requestBody: {
        id: currentState.channelId,
        resourceId: currentState.resourceId,
      },
    });
  } catch (error) {
    if (!suppressErrors) {
      throw error;
    }

    console.warn('Drive watch stop failed:', error.message);
  }

  return setConnectorState(DRIVE_WATCH_STATE_KEY, {
    ...currentState,
    status: 'stopped',
    stoppedAt: new Date().toISOString(),
    channelId: '',
    resourceId: '',
    resourceUri: '',
    expiration: null,
  });
}

async function getDriveWatchStatus() {
  return {
    ready: featureFlags.googleConnectors
      && hasConfiguredDriveFolders()
      && Boolean(env.googleDriveWebhookUrl),
    enabled: env.googleDriveWatchEnabled,
    folderIds: env.googleDriveFolderIds,
    webhookUrlConfigured: Boolean(env.googleDriveWebhookUrl),
    watchState: await getConnectorState(DRIVE_WATCH_STATE_KEY),
    syncState: await getConnectorState(DRIVE_SYNC_STATE_KEY),
  };
}

async function handleDriveNotification(headers = {}) {
  const normalizedHeaders = normalizeHeaderMap(headers);
  const watchState = await getConnectorState(DRIVE_WATCH_STATE_KEY) || {};
  const channelId = String(normalizedHeaders['x-goog-channel-id'] || '');
  const channelToken = String(normalizedHeaders['x-goog-channel-token'] || '');
  const resourceState = String(normalizedHeaders['x-goog-resource-state'] || '').toLowerCase();
  const messageNumber = Number.parseInt(normalizedHeaders['x-goog-message-number'], 10);

  if (watchState.channelId && channelId && watchState.channelId !== channelId) {
    return {
      accepted: false,
      reason: 'channel-id-mismatch',
      resourceState,
    };
  }

  if (watchState.channelToken && channelToken && watchState.channelToken !== channelToken) {
    throw new AppError(403, 'Drive notification token did not match the configured watch channel.');
  }

  await setConnectorState(DRIVE_WATCH_STATE_KEY, {
    ...watchState,
    channelId: watchState.channelId || channelId,
    resourceId: normalizedHeaders['x-goog-resource-id'] || watchState.resourceId || '',
    resourceUri: normalizedHeaders['x-goog-resource-uri'] || watchState.resourceUri || '',
    expiration: parseExpiration(normalizedHeaders['x-goog-channel-expiration']) || watchState.expiration || null,
    lastNotificationAt: new Date().toISOString(),
    lastMessageNumber: Number.isFinite(messageNumber) ? messageNumber : (watchState.lastMessageNumber || null),
    lastResourceState: resourceState || watchState.lastResourceState || 'unknown',
  });

  const shouldSync = resourceState === 'change' || resourceState === 'changed';

  if (shouldSync) {
    void syncDriveChanges({
      trigger: 'drive-watch-notification',
    }).catch((error) => {
      console.error('Drive watch sync failed:', error.message);
    });
  }

  return {
    accepted: true,
    resourceState,
    syncTriggered: shouldSync,
  };
}

async function ensureDriveWatchSubscription() {
  const currentState = await getConnectorState(DRIVE_WATCH_STATE_KEY) || {};
  const expiration = Date.parse(currentState.expiration || '');

  if (
    !currentState.channelId
    || !Number.isFinite(expiration)
    || (expiration - Date.now()) <= env.googleDriveWatchRenewalLeadMs
  ) {
    return registerDriveChangesWatch({
      forceRenew: true,
    });
  }

  return currentState;
}

async function bootstrapDriveWatchAutomation() {
  if (!env.googleDriveWatchEnabled) {
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

  if (!hasConfiguredDriveFolders()) {
    return {
      enabled: false,
      reason: 'no-monitored-drive-folder',
    };
  }

  if (!env.googleDriveWebhookUrl) {
    return {
      enabled: false,
      reason: 'missing-webhook-url',
    };
  }

  await initializeDriveSyncCursor();
  await ensureDriveWatchSubscription();

  if (!renewalTimer) {
    renewalTimer = setInterval(() => {
      ensureDriveWatchSubscription().catch((error) => {
        console.error('Drive watch renewal failed:', error.message);
      });
    }, Math.max(env.googleDriveWatchRenewalCheckMs, 60000));

    if (typeof renewalTimer.unref === 'function') {
      renewalTimer.unref();
    }
  }

  return {
    enabled: true,
    folderIds: env.googleDriveFolderIds,
    webhookUrl: env.googleDriveWebhookUrl,
  };
}

module.exports = {
  bootstrapDriveWatchAutomation,
  getDriveWatchStatus,
  handleDriveNotification,
  importDriveFiles,
  registerDriveChangesWatch,
  stopDriveChangesWatch,
  syncDriveChanges,
};
