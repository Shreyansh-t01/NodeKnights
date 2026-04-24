const fs = require('node:fs/promises');
const path = require('node:path');

const { firestore, firestoreStatus } = require('../config/firebase');
const { env, featureFlags } = require('../config/env');
const { readJsonFile, writeJsonFile } = require('../utils/jsonStore');
const { withRemoteServiceTimeout } = require('../utils/remoteServiceTimeout');

const localGoogleTokenStorePath = path.join(env.tempStorageDir, 'local-store', 'google-oauth.json');
const GOOGLE_TOKEN_COLLECTION = '_connector_tokens';
const GOOGLE_TOKEN_DOCUMENT_ID = 'google_oauth';
const GOOGLE_TOKEN_TIMEOUT_MS = Math.min(env.remoteServiceTimeoutMs, 3000);

function attachStorageMode(tokens, storageMode) {
  return tokens ? { ...tokens, storageMode } : null;
}

function normalizeStoredTokens(tokens = {}, current = null) {
  return {
    accessToken: tokens.access_token || tokens.accessToken || current?.accessToken || '',
    refreshToken: tokens.refresh_token || tokens.refreshToken || current?.refreshToken || '',
    scope: tokens.scope || current?.scope || '',
    tokenType: tokens.token_type || tokens.tokenType || current?.tokenType || '',
    expiryDate: tokens.expiry_date || tokens.expiryDate || current?.expiryDate || null,
    idToken: tokens.id_token || tokens.idToken || current?.idToken || '',
    createdAt: current?.createdAt || tokens.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function getStoredGoogleTokensLocal() {
  const tokens = await readJsonFile(localGoogleTokenStorePath, null);
  return attachStorageMode(tokens, 'local-store');
}

async function saveGoogleTokensLocal(tokens = {}) {
  const current = await getStoredGoogleTokensLocal();
  const next = normalizeStoredTokens(tokens, current);

  await writeJsonFile(localGoogleTokenStorePath, next);
  return attachStorageMode(next, 'local-store');
}

async function getStoredGoogleTokens() {
  if (firestoreStatus.enabled && firestore) {
    try {
      const snapshot = await withRemoteServiceTimeout(
        'Firestore Google token read',
        () => firestore.collection(GOOGLE_TOKEN_COLLECTION).doc(GOOGLE_TOKEN_DOCUMENT_ID).get(),
        {
          collection: GOOGLE_TOKEN_COLLECTION,
          documentId: GOOGLE_TOKEN_DOCUMENT_ID,
          timeoutMs: GOOGLE_TOKEN_TIMEOUT_MS,
        },
      );

      if (snapshot.exists) {
        return attachStorageMode(snapshot.data(), 'firestore');
      }
    } catch (error) {
      console.warn('Falling back to local Google token read:', error.message);
    }
  }

  return getStoredGoogleTokensLocal();
}

async function saveGoogleTokens(tokens = {}) {
  const current = await getStoredGoogleTokens();
  const next = normalizeStoredTokens(tokens, current);

  if (firestoreStatus.enabled && firestore) {
    try {
      const documentRef = firestore.collection(GOOGLE_TOKEN_COLLECTION).doc(GOOGLE_TOKEN_DOCUMENT_ID);

      await withRemoteServiceTimeout(
        'Firestore Google token write',
        () => documentRef.set(next, { merge: true }),
        {
          collection: GOOGLE_TOKEN_COLLECTION,
          documentId: GOOGLE_TOKEN_DOCUMENT_ID,
          timeoutMs: GOOGLE_TOKEN_TIMEOUT_MS,
        },
      );

      const snapshot = await withRemoteServiceTimeout(
        'Firestore Google token read after write',
        () => documentRef.get(),
        {
          collection: GOOGLE_TOKEN_COLLECTION,
          documentId: GOOGLE_TOKEN_DOCUMENT_ID,
          timeoutMs: GOOGLE_TOKEN_TIMEOUT_MS,
        },
      );
      const stored = snapshot.exists ? snapshot.data() : next;

      await writeJsonFile(localGoogleTokenStorePath, stored).catch(() => {});
      return attachStorageMode(stored, 'firestore');
    } catch (error) {
      console.warn('Falling back to local Google token write:', error.message);
    }
  }

  return saveGoogleTokensLocal(next);
}

async function clearStoredGoogleTokensLocal() {
  try {
    await fs.unlink(localGoogleTokenStorePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function clearStoredGoogleTokens() {
  if (firestoreStatus.enabled && firestore) {
    try {
      const documentRef = firestore.collection(GOOGLE_TOKEN_COLLECTION).doc(GOOGLE_TOKEN_DOCUMENT_ID);

      await withRemoteServiceTimeout(
        'Firestore Google token delete',
        () => documentRef.delete(),
        {
          collection: GOOGLE_TOKEN_COLLECTION,
          documentId: GOOGLE_TOKEN_DOCUMENT_ID,
          timeoutMs: GOOGLE_TOKEN_TIMEOUT_MS,
        },
      );
    } catch (error) {
      console.warn('Falling back to local Google token delete:', error.message);
    }
  }

  await clearStoredGoogleTokensLocal();
}

async function getGoogleConnectorStatus() {
  const storedTokens = await getStoredGoogleTokens();
  const hasEnvRefreshToken = Boolean(env.googleRefreshToken);
  const hasStoredRefreshToken = Boolean(storedTokens?.refreshToken);
  const connected = hasEnvRefreshToken || hasStoredRefreshToken;
  const storedTokenSource = storedTokens?.storageMode || 'none';

  return {
    configured: featureFlags.googleConnectors,
    connected,
    redirectUri: env.googleRedirectUri || null,
    tokenSource: hasEnvRefreshToken ? 'env' : hasStoredRefreshToken ? storedTokenSource : 'none',
    scopes: storedTokens?.scope
      ? storedTokens.scope.split(/\s+/).filter(Boolean)
      : [],
    hasAccessToken: Boolean(storedTokens?.accessToken),
    expiresAt: storedTokens?.expiryDate ? new Date(storedTokens.expiryDate).toISOString() : null,
    lastUpdatedAt: storedTokens?.updatedAt || null,
    localStorePath: hasStoredRefreshToken && storedTokenSource === 'local-store'
      ? localGoogleTokenStorePath
      : null,
  };
}

module.exports = {
  clearStoredGoogleTokens,
  getGoogleConnectorStatus,
  getStoredGoogleTokens,
  localGoogleTokenStorePath,
  saveGoogleTokens,
};
