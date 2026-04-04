const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { cert, getApp, getApps, initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

const backendRoot = path.resolve(__dirname, '../../');
const defaultServiceAccountFileNames = [
  'firebase-service-account.json',
  'solution-hackathon-3cfa4-firebase-adminsdk-fbsvc-f90d764e1d.json',
];

const resolveServiceAccountPath = configuredPath => {
  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(backendRoot, configuredPath);
  }

  // Support both the documented generic filename and the current project-specific export name.
  const existingDefaultPath = defaultServiceAccountFileNames
    .map(fileName => path.join(backendRoot, fileName))
    .find(candidatePath => fs.existsSync(candidatePath));

  return existingDefaultPath || path.join(backendRoot, defaultServiceAccountFileNames[0]);
};

const serviceAccountPath = resolveServiceAccountPath(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
const configuredDatabaseId = process.env.FIREBASE_DATABASE_ID || '(default)';

let app;
let db;
let firebaseConfig = {
  projectId: null,
  databaseId: configuredDatabaseId,
  serviceAccountPath,
};

const formatFirestoreError = (error, operation = 'Firestore operation') => {
  const message = error?.message || 'Unknown Firestore error';
  const isNotFoundError = error?.code === 5 || message.includes('5 NOT_FOUND');

  if (isNotFoundError) {
    const projectLabel = firebaseConfig.projectId || 'unknown-project';
    const databaseLabel = firebaseConfig.databaseId || '(default)';

    return `${operation} failed because Firestore database "${databaseLabel}" was not found for Firebase project "${projectLabel}". Create Cloud Firestore for that project in the Firebase console, or set FIREBASE_DATABASE_ID if you are using a named database.`;
  }

  return message;
};

try {
  if (!fs.existsSync(serviceAccountPath)) {
    console.warn(`Firebase service account not found at ${serviceAccountPath}`);
    console.warn('Firebase features will be disabled until proper credentials are provided');
  } else {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;
    const databaseId = configuredDatabaseId;

    const appOptions = {
      credential: cert(serviceAccount),
    };

    if (projectId) {
      appOptions.projectId = projectId;
    }

    app = getApps().length ? getApp() : initializeApp(appOptions);
    db = databaseId === '(default)' ? getFirestore(app) : getFirestore(app, databaseId);
    firebaseConfig = {
      projectId,
      databaseId,
      serviceAccountPath,
    };

    console.log(
      `Firebase initialized successfully for project ${projectId || 'unknown-project'} using Firestore database ${databaseId}`,
    );
  }
} catch (error) {
  console.error(`Firebase initialization error: ${error.message}`);
  console.error('Please add a valid Firebase service account JSON file or verify FIREBASE_SERVICE_ACCOUNT_PATH.');
}

const COLLECTIONS = {
  DOCUMENTS: 'documents',
  USERS: 'users',
  FILE_CHUNKS: 'fileChunks',
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
  FIREBASE_CONFIG: firebaseConfig,
  formatFirestoreError,
};
