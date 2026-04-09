const fs = require('node:fs/promises');
const path = require('node:path');

const { env } = require('../config/env');
const { supabase, supabaseStatus } = require('../config/supabase');
const { ensureDirectory } = require('../utils/jsonStore');

function sanitizeFileName(fileName = 'document') {
  return fileName.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-');
}

async function saveLocally(targetPath, content, encoding) {
  await ensureDirectory(targetPath);
  await fs.writeFile(targetPath, content, encoding);
}

function buildDisabledArtifact(assetType, reason = 'Artifact storage is disabled.') {
  return {
    mode: 'disabled',
    assetType,
    reason,
    path: null,
    uri: null,
  };
}

function buildLocalArtifact(assetType, localPath) {
  return {
    mode: 'local',
    assetType,
    path: localPath,
    uri: localPath,
  };
}

function buildSupabaseArtifact(assetType, filePath) {
  return {
    mode: 'supabase',
    assetType,
    path: filePath,
    uri: `supabase://${env.supabaseStorageBucket}/${filePath}`,
    bucket: env.supabaseStorageBucket,
  };
}

async function uploadToSupabase({ assetType, filePath, payload, contentType, metadata }) {
  const { error } = await supabase
    .storage
    .from(env.supabaseStorageBucket)
    .upload(filePath, payload, {
      contentType,
      upsert: false,
      metadata,
    });

  if (error) {
    throw new Error(error.message || `Supabase upload failed for ${filePath}`);
  }

  return buildSupabaseArtifact(assetType, filePath);
}

async function storeArtifactLocally({ assetType, localPath, content, encoding }) {
  try {
    await saveLocally(localPath, content, encoding);
    return buildLocalArtifact(assetType, localPath);
  } catch (error) {
    console.warn(`Artifact storage fallback disabled for ${assetType}:`, error.message);
    return buildDisabledArtifact(assetType, `Local artifact storage failed: ${error.message}`);
  }
}

async function uploadRawDocument({ contractId, file, source }) {
  const safeName = sanitizeFileName(file.originalname);
  const storagePath = `contracts/raw/${contractId}/${safeName}`;

  if (env.artifactStorageMode === 'supabase') {
    if (!supabaseStatus.enabled || !supabase) {
      return buildDisabledArtifact('raw-document', 'Supabase Storage is not configured.');
    }

    try {
      return await uploadToSupabase({
        assetType: 'raw-document',
        filePath: storagePath,
        payload: file.buffer,
        contentType: file.mimetype,
        metadata: {
          contractId,
          source,
          assetType: 'raw-document',
        },
      });
    } catch (error) {
      console.warn('Supabase raw storage failed, disabling artifact for this upload:', error.message);
      return buildDisabledArtifact('raw-document', `Supabase raw storage failed: ${error.message}`);
    }
  }

  if (env.artifactStorageMode !== 'local') {
    return buildDisabledArtifact('raw-document');
  }

  const localPath = path.join(env.tempStorageDir, 'raw', contractId, safeName);
  return storeArtifactLocally({
    assetType: 'raw-document',
    localPath,
    content: file.buffer,
  });
}

async function uploadExtractedText({ contractId, text, source }) {
  const storagePath = `contracts/derived/${contractId}/extracted.txt`;

  if (env.artifactStorageMode === 'supabase') {
    if (!supabaseStatus.enabled || !supabase) {
      return buildDisabledArtifact('extracted-text', 'Supabase Storage is not configured.');
    }

    try {
      return await uploadToSupabase({
        assetType: 'extracted-text',
        filePath: storagePath,
        payload: text,
        contentType: 'text/plain',
        metadata: {
          contractId,
          source,
          assetType: 'extracted-text',
        },
      });
    } catch (error) {
      console.warn('Supabase text storage failed, disabling artifact for this upload:', error.message);
      return buildDisabledArtifact('extracted-text', `Supabase text storage failed: ${error.message}`);
    }
  }

  if (env.artifactStorageMode !== 'local') {
    return buildDisabledArtifact('extracted-text');
  }

  const localPath = path.join(env.tempStorageDir, 'derived', contractId, 'extracted.txt');
  return storeArtifactLocally({
    assetType: 'extracted-text',
    localPath,
    content: text,
    encoding: 'utf-8',
  });
}

module.exports = {
  uploadRawDocument,
  uploadExtractedText,
};
