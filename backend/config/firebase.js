const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const { env, featureFlags } = require('./env');

function resolveFirebaseCredential() {
  if (env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey) {
    return cert({
      projectId: env.firebaseProjectId,
      clientEmail: env.firebaseClientEmail,
      privateKey: env.firebasePrivateKey,
    });
  }

  return null;
}

let firebaseApp = null;
let firestore = null;

const firestoreStatus = {
  enabled: false,
  mode: 'disabled',
  message: 'Firestore credentials are not configured. Local contract storage will be used.',
};

try {
  const credential = resolveFirebaseCredential();

  if (credential && featureFlags.firebase) {
    firebaseApp = getApps()[0] || initializeApp({
      credential,
      projectId: env.firebaseProjectId || undefined,
    });

    firestore = getFirestore(firebaseApp);

    firestoreStatus.enabled = true;
    firestoreStatus.mode = 'firestore';
    firestoreStatus.message = 'Firestore is configured.';
  }
} catch (error) {
  firestoreStatus.enabled = false;
  firestoreStatus.mode = 'fallback';
  firestoreStatus.message = `Firestore initialization failed: ${error.message}`;
}

module.exports = {
  firebaseApp,
  firestore,
  firestoreStatus,
  firebaseStatus: firestoreStatus,
};
