const { firestore, firestoreStatus } = require('../config/firebase');
const { env } = require('../config/env');
const AppError = require('../errors/AppError');
const { withRemoteServiceTimeout } = require('../utils/remoteServiceTimeout');

const FIRESTORE_OPERATION_TIMEOUT_MS = Math.min(env.remoteServiceTimeoutMs, 5000);

function requireFirestore() {
  if (!firestoreStatus.enabled || !firestore) {
    throw new AppError(503, 'Firestore must be configured before rules and policies can be stored or retrieved.', {
      service: 'firestore',
      collection: env.knowledgeCollection,
    });
  }

  return firestore;
}

function withFirestoreTimeout(operation, task) {
  return withRemoteServiceTimeout(`Firestore knowledge ${operation}`, task, {
    service: 'firestore',
    collection: env.knowledgeCollection,
    operation,
    timeoutMs: FIRESTORE_OPERATION_TIMEOUT_MS,
  });
}

async function saveKnowledgeBundle({ knowledgeDocument, chunks = [] }) {
  await withFirestoreTimeout('write', async () => {
    const db = requireFirestore();
    const knowledgeRef = db.collection(env.knowledgeCollection).doc(knowledgeDocument.id);
    const batch = db.batch();

    batch.set(knowledgeRef, knowledgeDocument);

    chunks.forEach((chunk) => {
      batch.set(knowledgeRef.collection('chunks').doc(chunk.id), chunk);
    });

    await batch.commit();
  });

  return {
    mode: 'firebase',
    location: `${env.knowledgeCollection}/${knowledgeDocument.id}`,
  };
}

async function listKnowledgeDocuments() {
  const snapshot = await withFirestoreTimeout('list', () => {
    const db = requireFirestore();
    return db.collection(env.knowledgeCollection).get();
  });

  return snapshot.docs
    .map((document) => document.data())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getKnowledgeDocumentById(knowledgeId) {
  return withFirestoreTimeout('read', async () => {
    const db = requireFirestore();
    const knowledgeRef = db.collection(env.knowledgeCollection).doc(knowledgeId);
    const knowledgeDoc = await knowledgeRef.get();

    if (!knowledgeDoc.exists) {
      throw new AppError(404, `Knowledge document not found: ${knowledgeId}`);
    }

    const chunksSnapshot = await knowledgeRef.collection('chunks').get();

    return {
      knowledgeDocument: knowledgeDoc.data(),
      chunks: chunksSnapshot.docs
        .map((document) => document.data())
        .sort((a, b) => a.position - b.position),
    };
  });
}

module.exports = {
  getKnowledgeDocumentById,
  listKnowledgeDocuments,
  saveKnowledgeBundle,
};
