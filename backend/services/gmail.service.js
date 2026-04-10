const { google } = require('googleapis');

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
]);

function collectAttachmentParts(part, attachments = []) {
  if (!part) {
    return attachments;
  }

  if (part.filename && part.body?.attachmentId && SUPPORTED_MIME_TYPES.has(part.mimeType)) {
    attachments.push({
      filename: part.filename,
      attachmentId: part.body.attachmentId,
      mimeType: part.mimeType,
    });
  }

  (part.parts || []).forEach((child) => collectAttachmentParts(child, attachments));
  return attachments;
}

function decodeBase64Url(value = '') {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
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
  };
}

async function importGmailAttachments({ query, maxResults = 5 }) {
  const auth = await getOAuthClient();
  const gmail = google.gmail({
    version: 'v1',
    auth,
  });
  const searchQuery = query || env.gmailDefaultQuery;

  const listResponse = await gmail.users.messages.list({
    userId: env.googleWorkspaceUser,
    q: searchQuery,
    maxResults,
  });

  const messages = listResponse.data.messages || [];
  const ingestedContracts = [];

  for (const message of messages) {
    const messageResponse = await gmail.users.messages.get({
      userId: env.googleWorkspaceUser,
      id: message.id,
    });

    const attachments = collectAttachmentParts(messageResponse.data.payload);

    for (const attachment of attachments) {
      const file = await downloadAttachment(gmail, message.id, attachment);
      const result = await ingestManualContract(file, {
        source: 'gmail-attachment',
        externalId: message.id,
      });

      ingestedContracts.push(result);
    }
  }

  return ingestedContracts;
}

module.exports = {
  importGmailAttachments,
};
