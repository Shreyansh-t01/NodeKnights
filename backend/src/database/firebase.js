const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
  path.join(__dirname, '../../firebase-service-account.json');

let db;

try {
  // Check if service account file exists
  if (!fs.existsSync(serviceAccountPath)) {
    console.warn(`⚠️  Firebase service account not found at ${serviceAccountPath}`);
    console.warn('⚠️  Firebase features will be disabled until proper credentials are provided');
  } else {
    if (!admin.apps.length) {
      // Read and parse service account key safely
      const serviceAccountContent = fs.readFileSync(serviceAccountPath, 'utf8');
      const serviceAccountKey = JSON.parse(serviceAccountContent);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    }
    db = admin.firestore();
    
    console.log('✅ Firebase initialized successfully');
  }
} catch (error) {
  console.error('⚠️  Firebase initialization error:', error.message);
  console.error('    Please add a valid firebase-service-account.json file');
}

// Collections constants
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
  db,
  admin,
  COLLECTIONS,
};
