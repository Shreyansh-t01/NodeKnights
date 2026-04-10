const fs = require('node:fs/promises');
const path = require('node:path');

const { env, featureFlags } = require('../config/env');
const { readJsonFile, writeJsonFile } = require('../utils/jsonStore');

const localGoogleTokenStorePath = path.join(env.tempStorageDir, 'local-store', 'google-oauth.json');

async function getStoredGoogleTokens() {
  return readJsonFile(localGoogleTokenStorePath, null);
}

async function saveGoogleTokens(tokens = {}) {
  const current = await getStoredGoogleTokens();
  const next = {
    accessToken: tokens.access_token || current?.accessToken || '',
    refreshToken: tokens.refresh_token || current?.refreshToken || '',
    scope: tokens.scope || current?.scope || '',
    tokenType: tokens.token_type || current?.tokenType || '',
    expiryDate: tokens.expiry_date || current?.expiryDate || null,
    idToken: tokens.id_token || current?.idToken || '',
    createdAt: current?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await writeJsonFile(localGoogleTokenStorePath, next);
  return next;
}

async function clearStoredGoogleTokens() {
  try {
    await fs.unlink(localGoogleTokenStorePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function getGoogleConnectorStatus() {
  const storedTokens = await getStoredGoogleTokens();
  const hasEnvRefreshToken = Boolean(env.googleRefreshToken);
  const hasStoredRefreshToken = Boolean(storedTokens?.refreshToken);
  const connected = hasEnvRefreshToken || hasStoredRefreshToken;

  return {
    configured: featureFlags.googleConnectors,
    connected,
    redirectUri: env.googleRedirectUri || null,
    tokenSource: hasEnvRefreshToken ? 'env' : hasStoredRefreshToken ? 'local-store' : 'none',
    scopes: storedTokens?.scope
      ? storedTokens.scope.split(/\s+/).filter(Boolean)
      : [],
    hasAccessToken: Boolean(storedTokens?.accessToken),
    expiresAt: storedTokens?.expiryDate ? new Date(storedTokens.expiryDate).toISOString() : null,
    lastUpdatedAt: storedTokens?.updatedAt || null,
    localStorePath: hasStoredRefreshToken ? localGoogleTokenStorePath : null,
  };
}

module.exports = {
  clearStoredGoogleTokens,
  getGoogleConnectorStatus,
  getStoredGoogleTokens,
  localGoogleTokenStorePath,
  saveGoogleTokens,
};
