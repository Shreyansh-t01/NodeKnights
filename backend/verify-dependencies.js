
/**
 * Dependency Verification Script
 * Verifies all required modules can be loaded correctly
 */

// Load environment variables
require('dotenv').config();

console.log('🔍 NodeKnights Backend - Dependency Verification\n');

const checks = {
  passed: [],
  failed: [],
};

const test = (name, fn) => {
  try {
    fn();
    checks.passed.push(name);
    console.log(`✅ ${name}`);
  } catch (error) {
    checks.failed.push({ name, error: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  }
};

// Test NPM Dependencies
console.log('📦 Testing NPM Dependencies...\n');

test('dotenv', () => require('dotenv'));
test('express', () => require('express'));
test('multer', () => require('multer'));
test('compression', () => require('compression'));
test('uuid', () => require('uuid'));
test('pdf-parse', () => require('pdf-parse'));
test('mammoth', () => require('mammoth'));
test('natural', () => require('natural'));
test('firebase-admin', () => require('firebase-admin'));
test('axios', () => require('axios'));

// Test Internal Modules
console.log('\n📂 Testing Internal Modules...\n');

test('Database (firebase)', () => {
  const { db, admin, COLLECTIONS } = require('./src/database/firebase');
  if (!COLLECTIONS) throw new Error('COLLECTIONS not exported');
  if (db === undefined) throw new Error('db not initialized');
  if (admin === undefined) throw new Error('admin not initialized');
});

test('Models (DocumentSchema)', () => {
  const { DocumentSchema } = require('./src/models');
  if (!DocumentSchema) throw new Error('DocumentSchema not exported');
});

test('Models (UserSchema)', () => {
  const { UserSchema } = require('./src/models');
  if (!UserSchema) throw new Error('UserSchema not exported');
});

test('Services (DocumentService)', () => {
  const DocumentService = require('./src/services/DocumentService');
  if (!DocumentService.createDocument) throw new Error('Methods not found');
});

test('Services (ContentExtractionService)', () => {
  const ContentExtractionService = require('./src/services/ContentExtractionService');
  if (!ContentExtractionService.extractContent) throw new Error('Methods not found');
});

test('Services (NLPService)', () => {
  const NLPService = require('./src/services/NLPService');
  if (!NLPService.analyzeSentiment) throw new Error('Methods not found');
});

test('Integrations (GmailService)', () => {
  const GmailService = require('./src/integrations/GmailService');
  if (!GmailService) throw new Error('GmailService not exported');
});

test('Integrations (GoogleDriveService)', () => {
  const GoogleDriveService = require('./src/integrations/GoogleDriveService');
  if (!GoogleDriveService) throw new Error('GoogleDriveService not exported');
});

test('Controllers (DocumentController)', () => {
  const DocumentController = require('./src/controllers/DocumentController');
  if (!DocumentController.uploadDocument) throw new Error('Methods not found');
});

test('Routes (Main)', () => {
  const routes = require('./src/routes');
  if (!routes) throw new Error('Routes not exported');
});

test('Routes (Document)', () => {
  const documentRoutes = require('./src/routes/documentRoutes');
  if (!documentRoutes) throw new Error('Document routes not exported');
});

test('Middleware', () => {
  const { authenticate, errorHandler, requestLogger } = require('./src/middleware');
  if (!authenticate || !errorHandler || !requestLogger) {
    throw new Error('Middleware not properly exported');
  }
});

test('Validators', () => {
  const validators = require('./src/validators');
  if (!validators.validateFileUpload) throw new Error('Validators not found');
});

test('Constants', () => {
  const constants = require('./src/constants');
  if (!constants.CONTENT_TYPES) throw new Error('Constants not found');
});

test('Utils (Logger)', () => {
  const { logger } = require('./src/utils');
  if (!logger || !logger.info) throw new Error('Logger not properly exported');
});

test('Helpers', () => {
  const Logger = require('./src/helpers/logger');
  if (!Logger) throw new Error('Logger helper not exported');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 Verification Summary\n');

console.log(`✅ Passed: ${checks.passed.length}`);
console.log(`❌ Failed: ${checks.failed.length}`);

if (checks.failed.length > 0) {
  console.log('\n⚠️  Failed Checks:\n');
  checks.failed.forEach(({ name, error }) => {
    console.log(`  • ${name}`);
    console.log(`    └─ ${error}\n`);
  });
  process.exit(1);
} else {
  console.log('\n🎉 All dependencies verified successfully!\n');
  console.log('You can now run: npm start');
  process.exit(0);
}
