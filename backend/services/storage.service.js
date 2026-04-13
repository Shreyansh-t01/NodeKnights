const fs = require('node:fs/promises');
const path = require('node:path');

const { env } = require('../config/env');
const { supabase, supabaseStatus } = require('../config/supabase');
const AppError = require('../errors/AppError');
const { ensureDirectory } = require('../utils/jsonStore');

function sanitizeFileName(fileName = 'document') {
  return fileName.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-');
}

async function saveLocally(targetPath, content, encoding) {
  await ensureDirectory(targetPath);
  await fs.writeFile(targetPath, content, encoding);
}

async function pruneEmptyParentDirectories(filePath) {
  const stopPath = path.resolve(env.tempStorageDir);
  let currentPath = path.dirname(filePath);

  while (currentPath.startsWith(stopPath) && currentPath !== stopPath) {
    try {
      await fs.rmdir(currentPath);
      currentPath = path.dirname(currentPath);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTEMPTY') {
        return;
      }

      throw error;
    }
  }
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

function buildSupabaseRequiredError(message, details = {}) {
  return new AppError(503, message, {
    service: 'supabase',
    fallbackDisabled: true,
    ...details,
  });
}

async function uploadRawDocument({ contractId, file, source }) {
  const safeName = sanitizeFileName(file.originalname);
  const storagePath = `contracts/raw/${contractId}/${safeName}`;

  if (env.artifactStorageMode === 'supabase') {
    if (!supabaseStatus.enabled || !supabase) {
      if (env.strictRemoteServices) {
        throw buildSupabaseRequiredError('Supabase Storage is required for raw document uploads but is not configured.', {
          assetType: 'raw-document',
          target: storagePath,
        });
      }

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
      if (env.strictRemoteServices) {
        throw buildSupabaseRequiredError('Supabase Storage upload failed for the raw document and local fallback is disabled.', {
          assetType: 'raw-document',
          target: storagePath,
          originalError: error.message,
        });
      }

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
      if (env.strictRemoteServices) {
        throw buildSupabaseRequiredError('Supabase Storage is required for extracted text uploads but is not configured.', {
          assetType: 'extracted-text',
          target: storagePath,
        });
      }

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
      if (env.strictRemoteServices) {
        throw buildSupabaseRequiredError('Supabase Storage upload failed for extracted text and local fallback is disabled.', {
          assetType: 'extracted-text',
          target: storagePath,
          originalError: error.message,
        });
      }

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

async function deleteSupabaseArtifact(artifact) {
  if (!supabaseStatus.enabled || !supabase) {
    if (env.strictRemoteServices) {
      throw buildSupabaseRequiredError('Supabase Storage is required for artifact deletion but is not configured.', {
        assetType: artifact?.assetType || 'artifact',
        target: artifact?.path || null,
      });
    }

    return {
      assetType: artifact?.assetType || 'artifact',
      mode: 'supabase',
      path: artifact?.path || null,
      status: 'skipped',
      reason: 'Supabase Storage is not configured.',
    };
  }

  const bucket = artifact.bucket || env.supabaseStorageBucket;
  const { error } = await supabase
    .storage
    .from(bucket)
    .remove([artifact.path]);

  if (error) {
    throw new Error(error.message || `Supabase delete failed for ${artifact.path}`);
  }

  return {
    assetType: artifact.assetType || 'artifact',
    mode: 'supabase',
    path: artifact.path,
    status: 'deleted',
  };
}

async function deleteLocalArtifact(artifact) {
  await fs.rm(artifact.path, {
    force: true,
  });
  await pruneEmptyParentDirectories(artifact.path);

  return {
    assetType: artifact.assetType || 'artifact',
    mode: 'local',
    path: artifact.path,
    status: 'deleted',
  };
}

async function deleteArtifact(artifact) {
  if (!artifact || artifact.mode === 'disabled') {
    return {
      assetType: artifact?.assetType || 'artifact',
      mode: artifact?.mode || 'disabled',
      path: artifact?.path || null,
      status: 'skipped',
      reason: artifact?.reason || 'Artifact storage is disabled.',
    };
  }

  if (!artifact.path) {
    return {
      assetType: artifact.assetType || 'artifact',
      mode: artifact.mode,
      path: null,
      status: 'skipped',
      reason: 'Stored artifact path is missing.',
    };
  }

  if (artifact.mode === 'supabase') {
    return deleteSupabaseArtifact(artifact);
  }

  if (artifact.mode === 'local') {
    return deleteLocalArtifact(artifact);
  }

  throw new AppError(409, `Unsupported artifact storage mode: ${artifact.mode}`);
}

async function deleteStoredArtifacts(artifacts = {}) {
  const targets = [artifacts.rawDocument, artifacts.extractedText];
  const results = [];

  for (const artifact of targets) {
    results.push(await deleteArtifact(artifact));
  }

  return {
    deletedCount: results.filter((item) => item.status === 'deleted').length,
    skippedCount: results.filter((item) => item.status === 'skipped').length,
    results,
  };
}

module.exports = {
  deleteStoredArtifacts,
  uploadRawDocument,
  uploadExtractedText,
};
