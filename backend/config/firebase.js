const fs = require('node:fs');
const path = require('node:path');
const { initializeApp, cert, applicationDefault, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const { env, featureFlags } = require('./env');

function loadServiceAccountFromFile(filePath) {
  if (!filePath) {
    return null;
  }

  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Firebase service account file not found at ${absolutePath}`);
  }

  return JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
}

function resolveFirebaseCredential() {
  if (env.firebaseServiceAccountPath) {
    return cert(loadServiceAccountFromFile(env.firebaseServiceAccountPath));
  }

  if (env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey) {
    return cert({
      projectId: env.firebaseProjectId,
      clientEmail: env.firebaseClientEmail,
      privateKey: env.firebasePrivateKey,
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return applicationDefault();
  }

  return null;
}

let firebaseApp = null;
let firestore = null;
let storage = null;

const firebaseStatus = {
  enabled: false,
  mode: 'disabled',
  message: 'Firebase credentials are not configured. Local fallback storage will be used.',
};

try {
  const credential = resolveFirebaseCredential();

  if (credential && featureFlags.firebase) {
    firebaseApp = getApps()[0] || initializeApp({
      credential,
      projectId: env.firebaseProjectId || undefined,
      storageBucket: env.firebaseStorageBucket || undefined,
    });

    firestore = getFirestore(firebaseApp);
    storage = getStorage(firebaseApp);

    firebaseStatus.enabled = true;
    firebaseStatus.mode = 'firebase';
    firebaseStatus.message = 'Firebase Storage and Firestore are configured.';
  }
} catch (error) {
  firebaseStatus.enabled = false;
  firebaseStatus.mode = 'fallback';
  firebaseStatus.message = `Firebase initialization failed: ${error.message}`;
}

module.exports = {
  firebaseApp,
  firestore,
  storage,
  firebaseStatus,
};
