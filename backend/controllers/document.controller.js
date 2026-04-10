const asyncHandler = require('../utils/asyncHandler');
const {
  getDocumentContent,
  getDocumentDetails,
  searchDocumentsByName,
} = require('../services/document.service');

function encodeFileName(value = 'document') {
  return encodeURIComponent(value)
    .replace(/['()]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, '%2A');
}

function buildContentDisposition(fileName, type = 'inline') {
  const fallbackName = String(fileName || 'document')
    .replace(/[^\x20-\x7E]+/g, '_')
    .replace(/["\\]/g, '_');

  return `${type}; filename="${fallbackName}"; filename*=UTF-8''${encodeFileName(fileName || fallbackName)}`;
}

const searchDocuments = asyncHandler(async (req, res) => {
  const result = await searchDocumentsByName({
    query: req.query.query || '',
    limit: req.query.limit,
  });

  res.json({
    success: true,
    data: result,
  });
});

const getDocument = asyncHandler(async (req, res) => {
  const document = await getDocumentDetails(req.params.contractId);

  res.json({
    success: true,
    data: document,
  });
});

const streamDocumentContent = asyncHandler(async (req, res) => {
  const document = await getDocumentContent(req.params.contractId);
  const dispositionType = req.query.download === '1' ? 'attachment' : 'inline';

  res.setHeader('Cache-Control', 'private, max-age=60');
  res.setHeader('Content-Length', document.buffer.length);
  res.setHeader('Content-Type', document.mimeType);
  res.setHeader('Content-Disposition', buildContentDisposition(document.originalName, dispositionType));
  res.setHeader('X-Content-Type-Options', 'nosniff');

  res.send(document.buffer);
});

module.exports = {
  getDocument,
  searchDocuments,
  streamDocumentContent,
};
