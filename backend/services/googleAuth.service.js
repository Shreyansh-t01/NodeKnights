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
      'Google OAuth is configured but not connected yet. Open /api/connectors/google/auth-url and complete the browser consent flow first.',
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
    tokenSource: 'local-store',
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
  GOOGLE_SCOPE_MAP,
  createGoogleAuthUrl,
  disconnectGoogleOAuth,
  exchangeGoogleAuthCode,
  getGoogleConnectorStatus,
  getOAuthClient,
  normalizeScopes,
};
