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
};

const DEFAULT_SCOPE_ALIASES = ['drive', 'gmail'];

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

  const scopes = requestedAliases
    .map((item) => GOOGLE_SCOPE_MAP[String(item).trim().toLowerCase()])
    .filter(Boolean);

  return scopes.length
    ? Array.from(new Set(scopes))
    : DEFAULT_SCOPE_ALIASES.map((alias) => GOOGLE_SCOPE_MAP[alias]);
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
const keysforenv =""

function createOAuth2Client(){
  function createOAuth2Client() {
  console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);
  console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET);
  console.log("GOOGLE_CALLBACK_URL:", process.env.GOOGLE_CALLBACK_URL);

  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_CALLBACK_URL
  ) {
    throw new Error("Google OAuth environment variables are missing");
  }

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
  );
}
}

const createUrl =  ()=>{
  const oauth2client = createOAuth2Client();
  const url = oauth2client.generateAuthUrl({
    access_type:"offline",
    prompt: "consent",
    scope:  GOOGLE_SCOPE_MAP,
  });

  return url;
}

async function getOAuthClient() {
  const oauth2Client = getOAuthBaseClient();
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
  
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: storedTokens?.accessToken || undefined,
    expiry_date: storedTokens?.expiryDate || undefined,
    scope: storedTokens?.scope || undefined,
    token_type: storedTokens?.tokenType || undefined,
  });

   console.log(oauth2Client);
  return oauth2Client;
}

console.log(keysforenv);


async function exchangeGoogleAuthCode(code) {
  const oauth2Client = getOAuthBaseClient();
  const { tokens } = await oauth2Client.getToken(code);
  const currentTokens = await getStoredGoogleTokens();
  const refreshToken = tokens.refresh_token || env.googleRefreshToken || currentTokens?.refreshToken || '';
  console.log(refreshToken);

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
    console.log(storedTokens);
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
  createGoogleAuthUrl,
  disconnectGoogleOAuth,
  exchangeGoogleAuthCode,
  getGoogleConnectorStatus,
  getOAuthClient,
  createUrl
};
