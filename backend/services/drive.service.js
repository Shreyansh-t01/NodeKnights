const { google } = require('googleapis');

const AppError = require('../errors/AppError');
const { env } = require('../config/env');
const { ingestManualContract } = require('./contract.service');
const { getOAuthClient } = require('./googleAuth.service');

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/vnd.google-apps.document',
]);

async function listFilesInFolder(folderId, limit = 5) {
  const auth = await getOAuthClient();
  const drive = google.drive({
    version: 'v3',
    auth,
  });

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    pageSize: limit,
    fields: 'files(id, name, mimeType, webViewLink)',
  });

  return (response.data.files || []).filter((file) => SUPPORTED_MIME_TYPES.has(file.mimeType));
}

async function downloadDriveFile(fileId) {
  const auth = await getOAuthClient();
  const drive = google.drive({
    version: 'v3',
    auth,
  });
  const metadataResponse = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, webViewLink',
  });

  const metadata = metadataResponse.data;

  if (!SUPPORTED_MIME_TYPES.has(metadata.mimeType)) {
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
  };
}

async function importDriveFiles({ fileId, folderId, limit = 5 }) {
  if (fileId) {
    const file = await downloadDriveFile(fileId);
    return [await ingestManualContract(file, {
      source: 'google-drive',
      externalId: file.externalId,
    })];
  }

  const targetFolderId = folderId || env.googleDriveFolderIds[0];

  if (!targetFolderId) {
    throw new AppError(400, 'Provide a Drive fileId or folderId, or set GOOGLE_DRIVE_FOLDER_IDS in the backend env file.');
  }

  const files = await listFilesInFolder(targetFolderId, limit);

  if (!files.length) {
    return [];
  }

  return Promise.all(files.map(async (driveFile) => {
    const downloaded = await downloadDriveFile(driveFile.id);
    return ingestManualContract(downloaded, {
      source: 'google-drive',
      externalId: driveFile.id,
    });
  }));
}

module.exports = {
  importDriveFiles,
};
