const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

function asNumber(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function asList(value) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveIfPresent(value, fallback = '') {
  if (!value) {
    return fallback;
  }

  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: asNumber(process.env.PORT, 3000),
  apiPrefix: process.env.API_PREFIX || '/api',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  maxUploadSizeMb: asNumber(process.env.MAX_UPLOAD_SIZE_MB, 20),
  tempStorageDir: resolveIfPresent(process.env.TEMP_STORAGE_DIR, path.resolve(projectRoot, 'tmp')),
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://127.0.0.1:8001',
  requirePythonMlService: asBoolean(process.env.REQUIRE_PYTHON_ML_SERVICE, false),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  firebasePrivateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  firebaseServiceAccountPath: resolveIfPresent(process.env.FIREBASE_SERVICE_ACCOUNT_PATH),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || '',
  googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
  googleWorkspaceUser: process.env.GOOGLE_WORKSPACE_USER || 'me',
  googleDriveFolderIds: asList(process.env.GOOGLE_DRIVE_FOLDER_IDS),
  gmailDefaultQuery: process.env.GMAIL_DEFAULT_QUERY || 'has:attachment filename:pdf newer_than:30d',
  pineconeApiKey: process.env.PINECONE_API_KEY || '',
  pineconeIndexHost: process.env.PINECONE_INDEX_HOST || '',
  pineconeNamespace: process.env.PINECONE_NAMESPACE || 'contracts',
  embeddingDimension: asNumber(process.env.EMBEDDING_DIMENSION, 128),
  genAiProvider: process.env.GENAI_PROVIDER || 'template',
  genAiBaseUrl: process.env.GENAI_BASE_URL || '',
  genAiApiKey: process.env.GENAI_API_KEY || '',
  genAiModel: process.env.GENAI_MODEL || '',
  rulebookPath: resolveIfPresent(
    process.env.RULEBOOK_PATH,
    path.resolve(projectRoot, 'data', 'rulebook.json'),
  ),
};

const featureFlags = {
  firebase: Boolean(
    env.firebaseStorageBucket
      && (
        env.firebaseServiceAccountPath
        || (env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey)
        || process.env.GOOGLE_APPLICATION_CREDENTIALS
      ),
  ),
  googleConnectors: Boolean(
    env.googleClientId
      && env.googleClientSecret
      && env.googleRedirectUri
      && env.googleRefreshToken,
  ),
  pinecone: Boolean(env.pineconeApiKey && env.pineconeIndexHost),
  externalGenAi: Boolean(env.genAiBaseUrl && env.genAiApiKey && env.genAiModel),
};

module.exports = {
  env,
  featureFlags,
};
