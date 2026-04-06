const fs = require('node:fs/promises');
const path = require('node:path');

const { env } = require('../config/env');
const { storage, firebaseStatus } = require('../config/firebase');
const { ensureDirectory } = require('../utils/jsonStore');

function sanitizeFileName(fileName = 'document') {
  return fileName.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-');
}

async function saveLocally(targetPath, content, encoding) {
  await ensureDirectory(targetPath);
  await fs.writeFile(targetPath, content, encoding);
  console.log("we stored the embeddings locally ")
}

async function uploadToFirebase(filePath, payload, contentType, metadata) {
  const bucket = env.firebaseStorageBucket ? storage.bucket(env.firebaseStorageBucket) : storage.bucket();
  const fileRef = bucket.file(filePath);

  await fileRef.save(payload, {
    resumable: false,
    contentType,
    metadata: {
      metadata,
    },
  });

  return {
    mode: 'firebase',
    path: filePath,
    uri: `gs://${bucket.name}/${filePath}`,
    bucket: bucket.name,
  };
}

async function uploadRawDocument({ contractId, file, source }) {
   console.log("we went to storage service")
  const safeName = sanitizeFileName(file.originalname);
  console.log(safeName,"got the safe name of the file")
  const storagePath = `contracts/raw/${contractId}/${safeName}`;
  console.log("this is the storage path",storagePath)

  try {
    if (firebaseStatus.enabled) {
      return await uploadToFirebase(storagePath, file.buffer, file.mimetype, {
        contractId,
        source,
        assetType: 'raw-document',
      });
    }
  } catch (error) {
    console.log('Falling back to local raw storage:', error.message);
    console.log('firebase status failure');
  }

  const localPath = path.join(env.tempStorageDir, 'raw', contractId, safeName);
  await saveLocally(localPath, file.buffer);

  return {
    mode: 'local',
    path: localPath,
    uri: localPath,
  };
}

async function uploadExtractedText({ contractId, text, source }) {
  const storagePath = `contracts/derived/${contractId}/extracted.txt`;

  try {
    if (firebaseStatus.enabled) {
      return await uploadToFirebase(storagePath, text, 'text/plain', {
        contractId,
        source,
        assetType: 'extracted-text',
      });
    }
  } catch (error) {
    console.warn('Falling back to local text storage:', error.message);
  }

  const localPath = path.join(env.tempStorageDir, 'derived', contractId, 'extracted.txt');
  await saveLocally(localPath, text, 'utf-8');

  return {
    mode: 'local',
    path: localPath,
    uri: localPath,
  };
}

module.exports = {
  uploadRawDocument,
  uploadExtractedText,
};
