const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

function cleanValue(value) {
  if (value === undefined || value === null) {
    return '';
  }

  const trimmed = String(value).trim();
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];

  if (
    trimmed.length >= 2
    && ((first === '"' && last === '"') || (first === '\'' && last === '\''))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function envValue(name, fallback = '') {
  return cleanValue(process.env[name]) || fallback;
}

function asNumber(value, fallback) {
  const normalized = cleanValue(value);

  if (!normalized) {
    return fallback;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value, fallback) {
  const normalizedValue = cleanValue(value);

  if (!normalizedValue) {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = normalizedValue.toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function asList(value) {
  const normalized = cleanValue(value);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function asChoice(value, allowedValues, fallback) {
  const rawValue = cleanValue(value);

  if (!rawValue) {
    return fallback;
  }

  let normalized = rawValue.toLowerCase();

  if (normalized === 'superbase') {
    normalized = 'supabase';
  }

  return allowedValues.includes(normalized) ? normalized : fallback;
}

function resolveIfPresent(value, fallback = '') {
  const normalized = cleanValue(value);

  if (!normalized) {
    return fallback;
  }

  return path.isAbsolute(normalized) ? normalized : path.resolve(projectRoot, normalized);
}

function resolveExistingFileIfPresent(value, fallback = '') {
  const configuredPath = resolveIfPresent(value);

  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath;
  }

  if (fallback && fs.existsSync(fallback)) {
    return fallback;
  }

  return configuredPath || fallback;
}

function isRailwayRuntime() {
  return Boolean(
    envValue('RAILWAY_ENVIRONMENT')
      || envValue('RAILWAY_SERVICE_ID')
      || envValue('RAILWAY_PROJECT_ID'),
  );
}

function resolveHost(value) {
  const host = cleanValue(value) || '0.0.0.0';
  const normalized = host.toLowerCase();

  if (
    isRailwayRuntime()
    && ['localhost', '127.0.0.1', '::1'].includes(normalized)
  ) {
    return '0.0.0.0';
  }

  return host;
}

function firstHttpUrl(value) {
  const urls = cleanValue(value)
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

function withoutTrailingSlash(value) {
  return cleanValue(value).replace(/\/+$/, '');
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

const configuredGenAiProvider = (envValue('GENAI_PROVIDER') || (envValue('GEMINI_API_KEY') ? 'gemini' : 'template'))
  .trim()
  .toLowerCase();

const configuredGenAiBaseUrl = envValue('GEMINI_BASE_URL')
  || envValue('GENAI_BASE_URL')
  || (configuredGenAiProvider === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' : '');

const configuredGenAiApiKey = envValue('GEMINI_API_KEY') || envValue('GENAI_API_KEY');
const configuredGenAiModel = envValue('GEMINI_MODEL')
  || envValue('GENAI_MODEL')
  || (configuredGenAiProvider === 'gemini' ? 'gemini-2.0-flash-lite' : '');
const configuredGenAiModelCandidates = asList(
  envValue('GEMINI_MODEL_CANDIDATES') || envValue('GENAI_MODEL_CANDIDATES'),
);
const configuredEmbeddingModel = envValue('GEMINI_EMBEDDING_MODEL')
  || envValue('EMBEDDING_MODEL')
  || 'gemini-embedding-001';
const configuredEmbeddingProvider = asChoice(
  envValue('EMBEDDING_PROVIDER'),
  ['gemini', 'pinecone', 'local'],
  'pinecone',
);
const configuredApiPrefix = envValue('API_PREFIX', '/api');
const configuredCorsOrigin = envValue('CORS_ORIGIN', '*');
const configuredGoogleRedirectUri = envValue('GOOGLE_REDIRECT_URI');
const configuredAppBaseUrl = envValue('APP_BASE_URL') || firstHttpUrl(configuredCorsOrigin);
const configuredDriveWebhookUrl = envValue('GOOGLE_DRIVE_WEBHOOK_URL')
  || deriveWebhookUrl(configuredGoogleRedirectUri, configuredApiPrefix);

const env = {
  nodeEnv: envValue('NODE_ENV', 'development'),
  port: asNumber(envValue('PORT'), 3000),
  host: resolveHost(envValue('HOST')),
  apiPrefix: configuredApiPrefix,
  corsOrigin: configuredCorsOrigin,
  maxUploadSizeMb: asNumber(envValue('MAX_UPLOAD_SIZE_MB'), 20),
  remoteServiceTimeoutMs: asNumber(envValue('REMOTE_SERVICE_TIMEOUT_MS'), 15000),
  tempStorageDir: resolveIfPresent(envValue('TEMP_STORAGE_DIR'), path.resolve(projectRoot, 'tmp')),
  mlServiceUrl: withoutTrailingSlash(envValue('ML_SERVICE_URL') || 'http://127.0.0.1:8001'),
  mlServiceTimeoutMs: asNumber(envValue('ML_SERVICE_TIMEOUT_MS'), 60000),
  requirePythonMlService: asBoolean(envValue('REQUIRE_PYTHON_ML_SERVICE'), false),
  strictRemoteServices: asBoolean(envValue('STRICT_REMOTE_SERVICES'), false),
  firebaseEnabled: asBoolean(envValue('FIREBASE_ENABLED'), true),
  firebaseProjectId: envValue('FIREBASE_PROJECT_ID'),
  firebaseClientEmail: envValue('FIREBASE_CLIENT_EMAIL'),
  firebasePrivateKey: envValue('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
  artifactStorageMode: asChoice(process.env.ARTIFACT_STORAGE_MODE, ['disabled', 'local', 'supabase'], 'disabled'),
  supabaseUrl: envValue('SUPABASE_URL'),
  supabaseSecretKey: envValue('SUPABASE_SECRET_KEY'),
  supabaseStorageBucket: envValue('SUPABASE_STORAGE_BUCKET'),
  googleClientId: envValue('GOOGLE_CLIENT_ID'),
  googleClientSecret: envValue('GOOGLE_CLIENT_SECRET'),
  googleRedirectUri: configuredGoogleRedirectUri,
  googleRefreshToken: envValue('GOOGLE_REFRESH_TOKEN'),
  googleWorkspaceUser: envValue('GOOGLE_WORKSPACE_USER', 'me'),
  appBaseUrl: configuredAppBaseUrl,
  googleDriveFolderIds: asList(envValue('GOOGLE_DRIVE_FOLDER_IDS')),
  googleDriveWebhookUrl: configuredDriveWebhookUrl,
  googleDriveWatchEnabled: asBoolean(envValue('GOOGLE_DRIVE_WATCH_ENABLED'), false),
  googleDriveWatchChannelToken: envValue('GOOGLE_DRIVE_WATCH_CHANNEL_TOKEN'),
  googleDriveWatchExpirationMs: asNumber(envValue('GOOGLE_DRIVE_WATCH_EXPIRATION_MS'), 604800000),
  googleDriveWatchRenewalLeadMs: asNumber(envValue('GOOGLE_DRIVE_WATCH_RENEWAL_LEAD_MS'), 21600000),
  googleDriveWatchRenewalCheckMs: asNumber(envValue('GOOGLE_DRIVE_WATCH_RENEWAL_CHECK_MS'), 3600000),
  gmailDefaultQuery: envValue('GMAIL_DEFAULT_QUERY', 'has:attachment filename:pdf newer_than:30d'),
  gmailPollEnabled: asBoolean(envValue('GMAIL_POLL_ENABLED'), false),
  gmailPollIntervalMs: asNumber(envValue('GMAIL_POLL_INTERVAL_MS'), 300000),
  gmailPollMaxResults: asNumber(envValue('GMAIL_POLL_MAX_RESULTS'), 10),
  notificationEmailEnabled: asBoolean(envValue('NOTIFICATION_EMAIL_ENABLED'), true),
  notificationEmailRecipients: asList(envValue('NOTIFICATION_EMAIL_RECIPIENTS')),
  pineconeApiKey: envValue('PINECONE_API_KEY'),
  pineconeIndexHost: envValue('PINECONE_INDEX_HOST'),
  pineconeNamespace: envValue('PINECONE_NAMESPACE', 'contracts'),
  pineconeContractNamespace: envValue('PINECONE_CONTRACT_NAMESPACE') || envValue('PINECONE_NAMESPACE', 'contracts'),
  pineconePrecedentNamespace: envValue('PINECONE_PRECEDENT_NAMESPACE', 'precedents'),
  pineconeKnowledgeNamespace: envValue('PINECONE_KNOWLEDGE_NAMESPACE', 'knowledge'),
  pineconeApiVersion: envValue('PINECONE_API_VERSION', '2026-04'),
  pineconeTextField: envValue('PINECONE_TEXT_FIELD', 'chunk_text'),
  pineconeIntegratedModel: envValue('PINECONE_INTEGRATED_MODEL'),
  pineconeTextUpsertBatchSize: asNumber(envValue('PINECONE_TEXT_UPSERT_BATCH_SIZE'), 96),
  embeddingDimension: asNumber(envValue('EMBEDDING_DIMENSION'), 128),
  precedentCollection: envValue('PRECEDENT_COLLECTION', 'precedents'),
  knowledgeCollection: envValue('KNOWLEDGE_COLLECTION', 'knowledge_documents'),
  genAiProvider: configuredGenAiProvider,
  genAiBaseUrl: configuredGenAiBaseUrl,
  genAiApiKey: configuredGenAiApiKey,
  genAiModel: configuredGenAiModel,
  genAiModelCandidates: configuredGenAiModelCandidates,
  embeddingProvider: configuredEmbeddingProvider,
  embeddingModel: configuredEmbeddingModel,
  embeddingBatchSize: asNumber(envValue('EMBEDDING_BATCH_SIZE'), 20),
  genAiTimeoutMs: asNumber(envValue('GENAI_TIMEOUT_MS'), 30000),
  genAiMaxRetries: asNumber(envValue('GENAI_MAX_RETRIES'), 2),
  genAiMaxConcurrentRequests: asNumber(envValue('GENAI_MAX_CONCURRENT_REQUESTS'), 1),
  genAiRetryBaseMs: asNumber(envValue('GENAI_RETRY_BASE_MS'), 1500),
  genAiRetryMaxMs: asNumber(envValue('GENAI_RETRY_MAX_MS'), 12000),
  genAiTemperature: asNumber(envValue('GENAI_TEMPERATURE'), 0.2),
  genAiMaxOutputTokens: asNumber(envValue('GENAI_MAX_OUTPUT_TOKENS'), 1400),
  genAiThinkingBudget: asNumber(envValue('GENAI_THINKING_BUDGET'), 0),
  authEnabled: asBoolean(envValue('AUTH_ENABLED'), true),
  authUsername: envValue('AUTH_USERNAME'),
  authPassword: envValue('AUTH_PASSWORD'),
  authSessionSecret: (
    envValue('AUTH_SESSION_SECRET')
    || envValue('AUTH_PASSWORD')
    || 'development-auth-session-secret-change-me'
  ),
  authSessionTtlMs: asNumber(envValue('AUTH_SESSION_TTL_MS'), 604800000),
  authUserStorePath: resolveIfPresent(
    envValue('AUTH_USER_STORE_PATH'),
    path.resolve(projectRoot, 'tmp', 'auth-store.json'),
  ),
  rulebookPath: resolveExistingFileIfPresent(
    envValue('RULEBOOK_PATH'),
    path.resolve(projectRoot, 'data', 'rulebook.json'),
  ),
};

const featureFlags = {
  firebase: Boolean(
    env.firebaseEnabled
      && env.firebaseProjectId
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
    env.embeddingProvider === 'gemini'
      && env.genAiBaseUrl
      && env.genAiApiKey
      && env.embeddingModel,
  ),
  pineconeIntegratedEmbedding: Boolean(
    env.embeddingProvider === 'pinecone'
      && env.pineconeTextField,
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
