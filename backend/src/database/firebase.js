const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { cert, getApp, getApps, initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

const backendRoot = path.resolve(__dirname, '../../');

const resolveServiceAccountPath = configuredPath => {
  if (!configuredPath) {
    return path.join(backendRoot, 'firebase-service-account.json');
  }

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(backendRoot, configuredPath);
};

const serviceAccountPath = resolveServiceAccountPath(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

let app;
let db;

try {
  if (!fs.existsSync(serviceAccountPath)) {
    console.warn(`Firebase service account not found at ${serviceAccountPath}`);
    console.warn('Firebase features will be disabled until proper credentials are provided');
  } else {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;

    const appOptions = {
      credential: cert(serviceAccount),
    };

    if (projectId) {
      appOptions.projectId = projectId;
    }

    app = getApps().length ? getApp() : initializeApp(appOptions);
    db = getFirestore(app);

    console.log(`Firebase initialized successfully for project ${projectId || 'unknown-project'}`);
  }
} catch (error) {
  console.error(`Firebase initialization error: ${error.message}`);
  console.error('Please add a valid firebase-service-account.json file');
}

const COLLECTIONS = {
  DOCUMENTS: 'documents',
  USERS: 'users',
  CHUNKS: 'chunks',
  CLAUSES: 'clauses',
  SOURCE_METADATA: 'sourceMetadata',
  PROCESSING_QUEUE: 'processingQueue',
  AUDIT_LOG: 'auditLog',
};

module.exports = {
  app,
  db,
  admin,
  FieldValue,
  COLLECTIONS,
};
