const path = require('node:path');

const { firestore, firestoreStatus } = require('../config/firebase');
const { env } = require('../config/env');
const { readJsonFile, writeJsonFile } = require('../utils/jsonStore');

const localStorePath = path.join(env.tempStorageDir, 'local-store', 'connector-state.json');
const STATE_COLLECTION = '_connector_state';
const PROCESSED_SOURCE_COLLECTION = '_source_ingestion_index';

function buildEmptyLocalState() {
  return {
    states: {},
    processedSources: {},
  };
}

function encodeDocumentId(value = '') {
  return encodeURIComponent(String(value || ''));
}

async function readLocalState() {
  return readJsonFile(localStorePath, buildEmptyLocalState());
}

async function writeLocalState(state) {
  await writeJsonFile(localStorePath, state);
}

async function getConnectorStateLocal(key) {
  const current = await readLocalState();
  return current.states[key] || null;
}

async function setConnectorStateLocal(key, value) {
  const current = await readLocalState();
  current.states[key] = {
    ...(current.states[key] || {}),
    ...value,
    key,
    updatedAt: new Date().toISOString(),
  };

  await writeLocalState(current);
  return current.states[key];
}

async function getProcessedSourceLocal(sourceKey) {
  const current = await readLocalState();
  return current.processedSources[sourceKey] || null;
}

async function markProcessedSourceLocal(sourceKey, payload = {}) {
  const current = await readLocalState();
  current.processedSources[sourceKey] = {
    ...(current.processedSources[sourceKey] || {}),
    ...payload,
    sourceKey,
    updatedAt: new Date().toISOString(),
  };

  await writeLocalState(current);
  return current.processedSources[sourceKey];
}

async function deleteProcessedSourceLocal(sourceKey) {
  const current = await readLocalState();
  const existing = current.processedSources[sourceKey] || null;

  if (existing) {
    delete current.processedSources[sourceKey];
    await writeLocalState(current);
  }

  return existing;
}

async function deleteProcessedSourcesByContractIdLocal(contractId) {
  const current = await readLocalState();
  const removed = [];

  Object.entries(current.processedSources).forEach(([sourceKey, value]) => {
    if (value?.contractId === contractId) {
      removed.push(value);
      delete current.processedSources[sourceKey];
    }
  });

  if (removed.length) {
    await writeLocalState(current);
  }

  return {
    deletedCount: removed.length,
    items: removed,
  };
}

async function getConnectorState(key) {
  if (firestoreStatus.enabled && firestore) {
    try {
      const snapshot = await firestore.collection(STATE_COLLECTION).doc(key).get();
      return snapshot.exists ? snapshot.data() : null;
    } catch (error) {
      console.warn('Falling back to local connector state read:', error.message);
    }
  }

  return getConnectorStateLocal(key);
}

async function setConnectorState(key, value) {
  const nextValue = {
    ...value,
    key,
    updatedAt: new Date().toISOString(),
  };

  if (firestoreStatus.enabled && firestore) {
    try {
      await firestore.collection(STATE_COLLECTION).doc(key).set(nextValue, { merge: true });
      const snapshot = await firestore.collection(STATE_COLLECTION).doc(key).get();
      return snapshot.data();
    } catch (error) {
      console.warn('Falling back to local connector state write:', error.message);
    }
  }

  return setConnectorStateLocal(key, nextValue);
}

async function getProcessedSource(sourceKey) {
  const documentId = encodeDocumentId(sourceKey);

  if (firestoreStatus.enabled && firestore) {
    try {
      const snapshot = await firestore.collection(PROCESSED_SOURCE_COLLECTION).doc(documentId).get();
      return snapshot.exists ? snapshot.data() : null;
    } catch (error) {
      console.warn('Falling back to local processed-source read:', error.message);
    }
  }

  return getProcessedSourceLocal(sourceKey);
}

async function markProcessedSource(sourceKey, payload = {}) {
  const nextValue = {
    ...payload,
    sourceKey,
    updatedAt: new Date().toISOString(),
  };
  const documentId = encodeDocumentId(sourceKey);

  if (firestoreStatus.enabled && firestore) {
    try {
      await firestore.collection(PROCESSED_SOURCE_COLLECTION).doc(documentId).set(nextValue, { merge: true });
      const snapshot = await firestore.collection(PROCESSED_SOURCE_COLLECTION).doc(documentId).get();
      return snapshot.data();
    } catch (error) {
      console.warn('Falling back to local processed-source write:', error.message);
    }
  }

  return markProcessedSourceLocal(sourceKey, nextValue);
}

async function deleteProcessedSource(sourceKey) {
  const documentId = encodeDocumentId(sourceKey);

  if (firestoreStatus.enabled && firestore) {
    try {
      const ref = firestore.collection(PROCESSED_SOURCE_COLLECTION).doc(documentId);
      const snapshot = await ref.get();

      if (!snapshot.exists) {
        return null;
      }

      const existing = snapshot.data();
      await ref.delete();
      return existing;
    } catch (error) {
      console.warn('Falling back to local processed-source delete:', error.message);
    }
  }

  return deleteProcessedSourceLocal(sourceKey);
}

async function deleteProcessedSourcesByContractId(contractId) {
  if (firestoreStatus.enabled && firestore) {
    try {
      const snapshot = await firestore
        .collection(PROCESSED_SOURCE_COLLECTION)
        .where('contractId', '==', contractId)
        .get();

      if (snapshot.empty) {
        return {
          deletedCount: 0,
          items: [],
        };
      }

      const batch = firestore.batch();
      const items = snapshot.docs.map((document) => document.data());

      snapshot.docs.forEach((document) => {
        batch.delete(document.ref);
      });

      await batch.commit();

      return {
        deletedCount: snapshot.size,
        items,
      };
    } catch (error) {
      console.warn('Falling back to local processed-source bulk delete:', error.message);
    }
  }

  return deleteProcessedSourcesByContractIdLocal(contractId);
}

module.exports = {
  deleteProcessedSource,
  deleteProcessedSourcesByContractId,
  getConnectorState,
  getProcessedSource,
  markProcessedSource,
  setConnectorState,
};
