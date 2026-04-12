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

function asChoice(value, allowedValues, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  let normalized = String(value).trim().toLowerCase();

  if (normalized === 'superbase') {
    normalized = 'supabase';
  }

  return allowedValues.includes(normalized) ? normalized : fallback;
}

function resolveIfPresent(value, fallback = '') {
  if (!value) {
    return fallback;
  }

  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
}

function firstHttpUrl(value) {
  const urls = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => /^https?:\/\//i.test(item));

  const preferred =
    urls.find((item) => /^https:\/\//i.test(item) && !/localhost|127\.0\.0\.1/i.test(item))
    || urls.find((item) => !/localhost|127\.0\.0\.1/i.test(item))
    || urls.find((item) => /^https:\/\//i.test(item))
    || urls[0];

  return preferred || '';
}

function joinUrl(baseUrl, pathname) {
  if (!baseUrl) {
    return '';
  }

  return `${String(baseUrl).replace(/\/+$/, '')}/${String(pathname).replace(/^\/+/, '')}`;
}

function deriveWebhookUrl(redirectUri, apiPrefix) {
  if (!redirectUri) {
    return '';
  }

  try {
    const url = new URL(redirectUri);
    return joinUrl(url.origin, `${apiPrefix}/connectors/drive/notifications`);
  } catch (error) {
    return '';
  }
}

const configuredGenAiProvider = (process.env.GENAI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'template'))
  .trim()
  .toLowerCase();

const configuredGenAiBaseUrl = process.env.GEMINI_BASE_URL
  || process.env.GENAI_BASE_URL
  || (configuredGenAiProvider === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' : '');

const configuredGenAiApiKey = process.env.GEMINI_API_KEY || process.env.GENAI_API_KEY || '';
const configuredGenAiModel = process.env.GEMINI_MODEL
  || process.env.GENAI_MODEL
  || (configuredGenAiProvider === 'gemini' ? 'gemini-2.5-flash' : '');
const configuredGenAiModelCandidates = asList(
  process.env.GEMINI_MODEL_CANDIDATES || process.env.GENAI_MODEL_CANDIDATES,
);
const configuredEmbeddingModel = process.env.GEMINI_EMBEDDING_MODEL
  || process.env.EMBEDDING_MODEL
  || 'gemini-embedding-001';
const configuredApiPrefix = process.env.API_PREFIX || '/api';
const configuredCorsOrigin = process.env.CORS_ORIGIN || '*';
const configuredGoogleRedirectUri = process.env.GOOGLE_REDIRECT_URI || '';
const configuredAppBaseUrl = process.env.APP_BASE_URL || firstHttpUrl(configuredCorsOrigin);
const configuredDriveWebhookUrl = process.env.GOOGLE_DRIVE_WEBHOOK_URL
  || deriveWebhookUrl(configuredGoogleRedirectUri, configuredApiPrefix);

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: asNumber(process.env.PORT, 3000),
  apiPrefix: configuredApiPrefix,
  corsOrigin: configuredCorsOrigin,
  maxUploadSizeMb: asNumber(process.env.MAX_UPLOAD_SIZE_MB, 20),
  tempStorageDir: resolveIfPresent(process.env.TEMP_STORAGE_DIR, path.resolve(projectRoot, 'tmp')),
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://127.0.0.1:8001',
  requirePythonMlService: asBoolean(process.env.REQUIRE_PYTHON_ML_SERVICE, false),
  strictRemoteServices: asBoolean(process.env.STRICT_REMOTE_SERVICES, false),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  firebasePrivateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  artifactStorageMode: asChoice(process.env.ARTIFACT_STORAGE_MODE, ['disabled', 'local', 'supabase'], 'disabled'),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || '',
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: configuredGoogleRedirectUri,
  googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
  googleWorkspaceUser: process.env.GOOGLE_WORKSPACE_USER || 'me',
  appBaseUrl: configuredAppBaseUrl,
  googleDriveFolderIds: asList(process.env.GOOGLE_DRIVE_FOLDER_IDS),
  googleDriveWebhookUrl: configuredDriveWebhookUrl,
  googleDriveWatchEnabled: asBoolean(process.env.GOOGLE_DRIVE_WATCH_ENABLED, false),
  googleDriveWatchChannelToken: process.env.GOOGLE_DRIVE_WATCH_CHANNEL_TOKEN || '',
  googleDriveWatchExpirationMs: asNumber(process.env.GOOGLE_DRIVE_WATCH_EXPIRATION_MS, 604800000),
  googleDriveWatchRenewalLeadMs: asNumber(process.env.GOOGLE_DRIVE_WATCH_RENEWAL_LEAD_MS, 21600000),
  googleDriveWatchRenewalCheckMs: asNumber(process.env.GOOGLE_DRIVE_WATCH_RENEWAL_CHECK_MS, 3600000),
  gmailDefaultQuery: process.env.GMAIL_DEFAULT_QUERY || 'has:attachment filename:pdf newer_than:30d',
  gmailPollEnabled: asBoolean(process.env.GMAIL_POLL_ENABLED, false),
  gmailPollIntervalMs: asNumber(process.env.GMAIL_POLL_INTERVAL_MS, 300000),
  gmailPollMaxResults: asNumber(process.env.GMAIL_POLL_MAX_RESULTS, 10),
  notificationEmailEnabled: asBoolean(process.env.NOTIFICATION_EMAIL_ENABLED, true),
  notificationEmailRecipients: asList(process.env.NOTIFICATION_EMAIL_RECIPIENTS),
  pineconeApiKey: process.env.PINECONE_API_KEY || '',
  pineconeIndexHost: process.env.PINECONE_INDEX_HOST || '',
  pineconeNamespace: process.env.PINECONE_NAMESPACE || 'contracts',
  pineconeContractNamespace: process.env.PINECONE_CONTRACT_NAMESPACE || process.env.PINECONE_NAMESPACE || 'contracts',
  pineconePrecedentNamespace: process.env.PINECONE_PRECEDENT_NAMESPACE || 'precedents',
  pineconeKnowledgeNamespace: process.env.PINECONE_KNOWLEDGE_NAMESPACE || 'knowledge',
  embeddingDimension: asNumber(process.env.EMBEDDING_DIMENSION, 128),
  precedentCollection: process.env.PRECEDENT_COLLECTION || 'precedents',
  knowledgeCollection: process.env.KNOWLEDGE_COLLECTION || 'knowledge_documents',
  genAiProvider: configuredGenAiProvider,
  genAiBaseUrl: configuredGenAiBaseUrl,
  genAiApiKey: configuredGenAiApiKey,
  genAiModel: configuredGenAiModel,
  genAiModelCandidates: configuredGenAiModelCandidates,
  embeddingModel: configuredEmbeddingModel,
  embeddingBatchSize: asNumber(process.env.EMBEDDING_BATCH_SIZE, 20),
  genAiTimeoutMs: asNumber(process.env.GENAI_TIMEOUT_MS, 30000),
  genAiTemperature: asNumber(process.env.GENAI_TEMPERATURE, 0.2),
  genAiMaxOutputTokens: asNumber(process.env.GENAI_MAX_OUTPUT_TOKENS, 1400),
  genAiThinkingBudget: asNumber(process.env.GENAI_THINKING_BUDGET, 0),
  rulebookPath: resolveIfPresent(
    process.env.RULEBOOK_PATH,
    path.resolve(projectRoot, 'data', 'rulebook.json'),
  ),
};

const featureFlags = {
  firebase: Boolean(
    env.firebaseProjectId
      && env.firebaseClientEmail
      && env.firebasePrivateKey,
  ),
  supabaseStorage: Boolean(
    env.supabaseUrl
      && env.supabaseSecretKey
      && env.supabaseStorageBucket,
  ),
  googleConnectors: Boolean(
    env.googleClientId
      && env.googleClientSecret
      && env.googleRedirectUri,
  ),
  pinecone: Boolean(env.pineconeApiKey && env.pineconeIndexHost),
  embeddingApi: Boolean(
    env.genAiBaseUrl
      && env.genAiApiKey
      && env.embeddingModel,
  ),
  externalGenAi: Boolean(
    env.genAiProvider !== 'template'
      && env.genAiBaseUrl
      && env.genAiApiKey
      && env.genAiModel
  ),
};

module.exports = {
  env,
  featureFlags,
};
