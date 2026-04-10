const { firestore, firestoreStatus } = require('../config/firebase');
const { env } = require('../config/env');
const AppError = require('../errors/AppError');

function requireFirestore() {
  if (!firestoreStatus.enabled || !firestore) {
    throw new AppError(503, 'Firestore must be configured before precedents can be stored or retrieved.', {
      service: 'firestore',
      collection: env.precedentCollection,
    });
  }

  return firestore;
}

async function savePrecedentBundle({ precedent, clauses = [] }) {
  const db = requireFirestore();
  const precedentRef = db.collection(env.precedentCollection).doc(precedent.id);
  const batch = db.batch();

  batch.set(precedentRef, precedent);

  clauses.forEach((clause) => {
    batch.set(precedentRef.collection('clauses').doc(clause.id), clause);
  });

  await batch.commit();

  return {
    mode: 'firebase',
    location: `${env.precedentCollection}/${precedent.id}`,
  };
}

async function listPrecedents() {
  const db = requireFirestore();
  const snapshot = await db.collection(env.precedentCollection).get();

  return snapshot.docs
    .map((document) => document.data())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getPrecedentById(precedentId) {
  const db = requireFirestore();
  const precedentRef = db.collection(env.precedentCollection).doc(precedentId);
  const precedentDoc = await precedentRef.get();

  if (!precedentDoc.exists) {
    throw new AppError(404, `Precedent not found: ${precedentId}`);
  }

  const clausesSnapshot = await precedentRef.collection('clauses').get();

  return {
    precedent: precedentDoc.data(),
    clauses: clausesSnapshot.docs
      .map((document) => document.data())
      .sort((a, b) => a.position - b.position),
  };
}

module.exports = {
  getPrecedentById,
  listPrecedents,
  savePrecedentBundle,
};
