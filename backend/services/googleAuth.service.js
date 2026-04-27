const crypto = require('node:crypto');
const { google } = require('googleapis');

const { env, featureFlags } = require('../config/env');
const AppError = require('../errors/AppError');
const {
  clearStoredGoogleTokens,
  getGoogleConnectorStatus,
  getStoredGoogleTokens,
  saveGoogleTokens,
} = require('./googleTokenStore.service');

const GOOGLE_SCOPE_MAP = {
  drive: 'https://www.googleapis.com/auth/drive.readonly',
  gmail: 'https://www.googleapis.com/auth/gmail.readonly',
  'gmail-send': 'https://www.googleapis.com/auth/gmail.send',
};

const DEFAULT_SCOPE_ALIASES = ['drive', 'gmail', 'gmail-send'];
const DEFAULT_GOOGLE_OAUTH_RETURN_TO = '/intake';
const GOOGLE_OAUTH_STATE_TTL_MS = 15 * 60 * 1000;

function normalizeGoogleOAuthReturnTo(value = '') {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return DEFAULT_GOOGLE_OAUTH_RETURN_TO;
  }

  if (
    normalized.startsWith('http://')
    || normalized.startsWith('https://')
    || normalized.startsWith('//')
  ) {
    return DEFAULT_GOOGLE_OAUTH_RETURN_TO;
  }

  return normalized.startsWith('/') ? normalized : `/${normalized.replace(/^\/+/, '')}`;
}

function createGoogleOAuthState({ returnTo = DEFAULT_GOOGLE_OAUTH_RETURN_TO } = {}) {
  const payload = {
    returnTo: normalizeGoogleOAuthReturnTo(returnTo),
    createdAt: Date.now(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', env.authSessionSecret)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

function parseGoogleOAuthState(state = '') {
  const rawState = String(state || '').trim();

  if (!rawState) {
    return null;
  }

  const [encodedPayload, signature] = rawState.split('.');

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac('sha256', env.authSessionSecret)
    .update(encodedPayload)
    .digest('base64url');
  const providedSignatureBuffer = Buffer.from(signature, 'utf8');
  const expectedSignatureBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    providedSignatureBuffer.length !== expectedSignatureBuffer.length
    || !crypto.timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    const createdAt = Number(payload?.createdAt);

    if (!Number.isFinite(createdAt) || (Date.now() - createdAt) > GOOGLE_OAUTH_STATE_TTL_MS) {
      return null;
    }

    return {
      returnTo: normalizeGoogleOAuthReturnTo(payload?.returnTo),
      createdAt,
    };
  } catch (error) {
    return null;
  }
}

function buildGoogleAppRedirectUrl(returnTo = DEFAULT_GOOGLE_OAUTH_RETURN_TO, params = {}) {
  if (!env.appBaseUrl) {
    return '';
  }

  const baseUrl = env.appBaseUrl.endsWith('/') ? env.appBaseUrl : `${env.appBaseUrl}/`;
  const url = new URL(normalizeGoogleOAuthReturnTo(returnTo), baseUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

function ensureGoogleOAuthConfigured() {
  if (!featureFlags.googleConnectors) {
    throw new AppError(
      503,
      'Google OAuth is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to backend/.env.',
    );
  }
}

function getOAuthBaseClient() {
  ensureGoogleOAuthConfigured();

  return new google.auth.OAuth2(
    env.googleClientId,
    env.googleClientSecret,
    env.googleRedirectUri,
  );
}

function normalizeScopes(scopeAliases = []) {
  const requestedAliases = Array.isArray(scopeAliases) && scopeAliases.length
    ? scopeAliases
    : DEFAULT_SCOPE_ALIASES;

  return Array.from(new Set(
    requestedAliases
      .map((item) => {
        const normalized = String(item || '').trim().toLowerCase();
        return GOOGLE_SCOPE_MAP[normalized] || String(item || '').trim();
      })
      .filter(Boolean),
  ));
}

function attachTokenPersistence(oauth2Client, fallbackRefreshToken = '') {
  oauth2Client.on('tokens', (tokens = {}) => {
    if (!Object.keys(tokens).length) {
      return;
    }

    void saveGoogleTokens({
      ...tokens,
      refresh_token: tokens.refresh_token || fallbackRefreshToken,
    }).catch((error) => {
      console.warn('Failed to persist refreshed Google tokens:', error.message);
    });
  });

  return oauth2Client;
}

function createGoogleAuthUrl({ scopes = [], state = '' } = {}) {
  const oauth2Client = getOAuthBaseClient();
  const normalizedScopes = normalizeScopes(scopes);

  return {
    redirectUri: env.googleRedirectUri,
    scopes: normalizedScopes,
    url: oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: normalizedScopes,
      state: state || undefined,
    }),
  };
}

async function getOAuthClient() {
  const storedTokens = await getStoredGoogleTokens();
  const refreshToken = env.googleRefreshToken || storedTokens?.refreshToken || '';

  if (!refreshToken) {
    throw new AppError(
      503,
      'Google OAuth is configured but not connected yet. Start the Connect Google flow in Lexora Intake and complete the browser consent flow first.',
      {
        authUrlPath: `${env.apiPrefix}/connectors/google/auth-url`,
        redirectUri: env.googleRedirectUri,
      },
    );
  }

  const oauth2Client = attachTokenPersistence(getOAuthBaseClient(), refreshToken);

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: storedTokens?.accessToken || undefined,
    expiry_date: storedTokens?.expiryDate || undefined,
    scope: storedTokens?.scope || undefined,
    token_type: storedTokens?.tokenType || undefined,
  });

  return oauth2Client;
}

async function exchangeGoogleAuthCode(code) {
  const oauth2Client = attachTokenPersistence(getOAuthBaseClient());
  const { tokens } = await oauth2Client.getToken(code);
  const currentTokens = await getStoredGoogleTokens();
  const refreshToken = tokens.refresh_token || env.googleRefreshToken || currentTokens?.refreshToken || '';

  if (!refreshToken) {
    throw new AppError(
      502,
      'Google OAuth completed but no refresh token was returned. Re-run consent with prompt=consent or revoke the previous app grant and try again.',
    );
  }

  const storedTokens = await saveGoogleTokens({
    ...tokens,
    refresh_token: refreshToken,
  });

  return {
    connected: true,
    tokenSource: storedTokens.storageMode || 'local-store',
    redirectUri: env.googleRedirectUri,
    scopes: storedTokens.scope
      ? storedTokens.scope.split(/\s+/).filter(Boolean)
      : [],
    expiresAt: storedTokens.expiryDate ? new Date(storedTokens.expiryDate).toISOString() : null,
    refreshTokenStored: Boolean(storedTokens.refreshToken),
  };
}

async function disconnectGoogleOAuth() {
  await clearStoredGoogleTokens();
  return getGoogleConnectorStatus();
}

module.exports = {
  buildGoogleAppRedirectUrl,
  createGoogleOAuthState,
  GOOGLE_SCOPE_MAP,
  createGoogleAuthUrl,
  disconnectGoogleOAuth,
  exchangeGoogleAuthCode,
  getGoogleConnectorStatus,
  getOAuthClient,
  normalizeScopes,
  parseGoogleOAuthState,
};
