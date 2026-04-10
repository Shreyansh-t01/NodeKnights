const fs = require('node:fs/promises');

const AppError = require('../errors/AppError');
const { env } = require('../config/env');
const { supabase, supabaseStatus } = require('../config/supabase');
const { getContractById, listContracts } = require('./contract.repository');

function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

function parseLimit(value, fallback = 20) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, 50);
}

function getPreviewMode(mimeType = '') {
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }

  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  if (mimeType.startsWith('text/')) {
    return 'text';
  }

  return 'browser';
}

function buildEmptyRiskCounts() {
  return {
    low: 0,
    medium: 0,
    high: 0,
  };
}

function buildDocumentSummary(contract) {
  const metadata = contract.metadata || {};
  const rawArtifact = contract.artifacts?.rawDocument || null;

  return {
    id: contract.id,
    title: contract.title,
    originalName: metadata.originalName || contract.title || 'Document',
    mimeType: metadata.mimeType || 'application/octet-stream',
    contractType: metadata.contractType || 'Contract',
    source: contract.source || metadata.source || 'unknown',
    status: contract.status || 'unknown',
    parties: metadata.parties || [],
    riskCounts: metadata.riskCounts || buildEmptyRiskCounts(),
    textPreview: contract.textPreview || '',
    createdAt: contract.createdAt || null,
    updatedAt: contract.updatedAt || contract.createdAt || null,
    available: Boolean(rawArtifact && rawArtifact.mode !== 'disabled' && rawArtifact.path),
    storageMode: rawArtifact?.mode || 'disabled',
    previewMode: getPreviewMode(metadata.mimeType || ''),
    artifactReason: rawArtifact?.reason || null,
  };
}

function scoreDocument(contract, query) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return 1;
  }

  const title = normalizeText(contract.title);
  const originalName = normalizeText(contract.metadata?.originalName);
  const combined = `${title} ${originalName}`.trim();
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  if (!combined || !terms.every((term) => combined.includes(term))) {
    return 0;
  }

  let score = terms.length * 10;

  if (title === normalizedQuery || originalName === normalizedQuery) {
    score += 500;
  } else if (title.startsWith(normalizedQuery) || originalName.startsWith(normalizedQuery)) {
    score += 300;
  } else if (combined.includes(normalizedQuery)) {
    score += 180;
  }

  terms.forEach((term) => {
    if (originalName.includes(term)) {
      score += 25;
    }

    if (title.includes(term)) {
      score += 15;
    }
  });

  return score;
}

async function searchDocumentsByName({ query = '', limit = 20 } = {}) {
  const documents = await listContracts();
  const cappedLimit = parseLimit(limit);
  const rawQuery = String(query || '').trim();
  const normalizedQuery = normalizeText(rawQuery);

  const matches = documents
    .map((contract) => ({
      contract,
      score: scoreDocument(contract, normalizedQuery),
    }))
    .filter((item) => !normalizedQuery || item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return new Date(right.contract.createdAt || 0) - new Date(left.contract.createdAt || 0);
    });

  const items = matches
    .slice(0, cappedLimit)
    .map((item) => buildDocumentSummary(item.contract));

  return {
    query: rawQuery,
    total: matches.length,
    items,
  };
}

async function getDocumentDetails(contractId) {
  const bundle = await getContractById(contractId);
  return buildDocumentSummary(bundle.contract);
}

async function readSupabaseArtifact(artifact) {
  if (!supabaseStatus.enabled || !supabase) {
    throw new AppError(503, 'Supabase Storage is not configured for document retrieval.');
  }

  const bucket = artifact.bucket || env.supabaseStorageBucket;
  const { data, error } = await supabase.storage.from(bucket).download(artifact.path);

  if (error) {
    throw new AppError(502, 'Failed to read the stored document from Supabase.', {
      originalError: error.message,
      bucket,
      path: artifact.path,
    });
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function readLocalArtifact(artifact) {
  try {
    return await fs.readFile(artifact.path);
  } catch (error) {
    throw new AppError(404, 'The stored document file could not be found locally.', {
      originalError: error.message,
      path: artifact.path,
    });
  }
}

async function readArtifactBuffer(artifact) {
  if (!artifact || artifact.mode === 'disabled') {
    throw new AppError(404, 'The original document file is not available for preview.');
  }

  if (!artifact.path) {
    throw new AppError(404, 'The stored document path is missing.');
  }

  if (artifact.mode === 'supabase') {
    return readSupabaseArtifact(artifact);
  }

  if (artifact.mode === 'local') {
    return readLocalArtifact(artifact);
  }

  throw new AppError(409, `Unsupported document storage mode: ${artifact.mode}`);
}

async function getDocumentContent(contractId) {
  const bundle = await getContractById(contractId);
  const contract = bundle.contract;
  const rawArtifact = contract.artifacts?.rawDocument || null;

  return {
    buffer: await readArtifactBuffer(rawArtifact),
    originalName: contract.metadata?.originalName || contract.title || 'document',
    mimeType: contract.metadata?.mimeType || 'application/octet-stream',
  };
}

module.exports = {
  getDocumentContent,
  getDocumentDetails,
  searchDocumentsByName,
};
