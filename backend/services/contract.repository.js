const path = require('node:path');

const { firestore, firestoreStatus } = require('../config/firebase');
const { env } = require('../config/env');
const AppError = require('../errors/AppError');
const { readJsonFile, writeJsonFile } = require('../utils/jsonStore');

const localStorePath = path.join(env.tempStorageDir, 'local-store', 'contracts.json');

function buildFirestoreRequiredError(operation, error) {
  return new AppError(503, `Firestore ${operation} failed and local fallback is disabled.`, {
    service: 'firestore',
    operation,
    fallbackDisabled: true,
    originalError: error?.message || null,
  });
}

async function saveContractBundleLocal(bundle) {
  const current = await readJsonFile(localStorePath, []);
  const next = current.filter((item) => item.contract.id !== bundle.contract.id);
  next.push(bundle);
  await writeJsonFile(localStorePath, next);

  return {
    mode: 'local-json',
    location: localStorePath,
  };
}

async function saveContractBundleFirebase(bundle) {
  const contractRef = firestore.collection('contracts').doc(bundle.contract.id);
  const batch = firestore.batch();

  batch.set(contractRef, bundle.contract);

  bundle.clauses.forEach((clause) => {
    batch.set(contractRef.collection('clauses').doc(clause.id), clause);
  });

  bundle.risks.forEach((risk) => {
    batch.set(contractRef.collection('risks').doc(risk.id), risk);
  });

  await batch.commit();

  return {
    mode: 'firebase',
    location: `contracts/${bundle.contract.id}`,
  };
}

async function saveContractBundle(bundle) {
  if (env.strictRemoteServices && (!firestoreStatus.enabled || !firestore)) {
    throw buildFirestoreRequiredError('persistence', new Error('Firestore is not configured.'));
  }

  if (firestoreStatus.enabled && firestore) {
    try {
      return await saveContractBundleFirebase(bundle);
    } catch (error) {
      if (env.strictRemoteServices) {
        throw buildFirestoreRequiredError('persistence', error);
      }

      console.warn('Falling back to local contract store:', error.message);
    }
  }

  return saveContractBundleLocal(bundle);
}

function matchesSourceIdentity(contract = {}, identity = {}) {
  const sourceContext = contract.sourceContext || {};

  if (identity.source && contract.source !== identity.source) {
    return false;
  }

  if (identity.dedupeKey && sourceContext.dedupeKey === identity.dedupeKey) {
    return true;
  }

  if (
    identity.messageId
    && identity.attachmentId
    && sourceContext.messageId === identity.messageId
    && sourceContext.attachmentId === identity.attachmentId
  ) {
    return true;
  }

  if (identity.externalId && sourceContext.externalId === identity.externalId) {
    return true;
  }

  return false;
}

async function findContractBySourceIdentityLocal(identity = {}) {
  const current = await readJsonFile(localStorePath, []);
  const match = current.find((item) => matchesSourceIdentity(item.contract, identity));

  return match?.contract || null;
}

async function findContractBySourceIdentityFirebase(identity = {}) {
  const queries = [];

  if (identity.dedupeKey) {
    queries.push(
      firestore
        .collection('contracts')
        .where('sourceContext.dedupeKey', '==', identity.dedupeKey)
        .limit(1),
    );
  }

  if (identity.messageId) {
    queries.push(
      firestore
        .collection('contracts')
        .where('sourceContext.messageId', '==', identity.messageId)
        .limit(5),
    );
  }

  if (identity.externalId) {
    queries.push(
      firestore
        .collection('contracts')
        .where('sourceContext.externalId', '==', identity.externalId)
        .limit(5),
    );
  }

  for (const query of queries) {
    const snapshot = await query.get();
    const match = snapshot.docs
      .map((document) => document.data())
      .find((contract) => matchesSourceIdentity(contract, identity));

    if (match) {
      return match;
    }
  }

  return null;
}

async function findContractBySourceIdentity(identity = {}) {
  if (env.strictRemoteServices && (!firestoreStatus.enabled || !firestore)) {
    throw buildFirestoreRequiredError('source identity lookup', new Error('Firestore is not configured.'));
  }

  if (firestoreStatus.enabled && firestore) {
    try {
      return await findContractBySourceIdentityFirebase(identity);
    } catch (error) {
      if (env.strictRemoteServices) {
        throw buildFirestoreRequiredError('source identity lookup', error);
      }

      console.warn('Falling back to local source identity lookup:', error.message);
    }
  }

  return findContractBySourceIdentityLocal(identity);
}

async function listContractsLocal() {
  const current = await readJsonFile(localStorePath, []);

  return current
    .map((item) => item.contract)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function listContractsFirebase() {
  const snapshot = await firestore.collection('contracts').get();

  return snapshot.docs
    .map((document) => document.data())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function listContracts() {
  if (env.strictRemoteServices && (!firestoreStatus.enabled || !firestore)) {
    throw buildFirestoreRequiredError('list', new Error('Firestore is not configured.'));
  }

  if (firestoreStatus.enabled && firestore) {
    try {
      return await listContractsFirebase();
    } catch (error) {
      if (env.strictRemoteServices) {
        throw buildFirestoreRequiredError('list', error);
      }

      console.warn('Falling back to local contract list:', error.message);
    }
  }

  return listContractsLocal();
}

async function getContractByIdLocal(contractId) {
  const current = await readJsonFile(localStorePath, []);
  const match = current.find((item) => item.contract.id === contractId);

  if (!match) {
    throw new AppError(404, `Contract not found: ${contractId}`);
  }

  return match;
}

async function getContractByIdFirebase(contractId) {
  const contractRef = firestore.collection('contracts').doc(contractId);
  const contractDoc = await contractRef.get();

  if (!contractDoc.exists) {
    throw new AppError(404, `Contract not found: ${contractId}`);
  }

  const [clausesSnapshot, risksSnapshot] = await Promise.all([
    contractRef.collection('clauses').get(),
    contractRef.collection('risks').get(),
  ]);

  return {
    contract: contractDoc.data(),
    clauses: clausesSnapshot.docs
      .map((document) => document.data())
      .sort((a, b) => a.position - b.position),
    risks: risksSnapshot.docs
      .map((document) => document.data())
      .sort((a, b) => b.score - a.score),
  };
}

async function getContractById(contractId) {
  if (env.strictRemoteServices && (!firestoreStatus.enabled || !firestore)) {
    throw buildFirestoreRequiredError('read', new Error('Firestore is not configured.'));
  }

  if (firestoreStatus.enabled && firestore) {
    try {
      return await getContractByIdFirebase(contractId);
    } catch (error) {
      if (error.isOperational) {
        throw error;
      }

      if (env.strictRemoteServices) {
        throw buildFirestoreRequiredError('read', error);
      }

      console.warn('Falling back to local contract details:', error.message);
    }
  }

  return getContractByIdLocal(contractId);
}

async function saveContractOverviewInsightsLocal(contractId, overviewInsights) {
  const current = await readJsonFile(localStorePath, []);
  const match = current.find((item) => item.contract.id === contractId);

  if (!match) {
    throw new AppError(404, `Contract not found: ${contractId}`);
  }

  const cachedInsights = {
    ...(match.contract.cachedInsights || {}),
    overview: overviewInsights,
    generatedAt: new Date().toISOString(),
    provider: overviewInsights?.provider || 'gemini',
    degraded: Boolean(overviewInsights?.degraded),
  };
  const next = current.map((item) => (
    item.contract.id === contractId
      ? {
        ...item,
        contract: {
          ...item.contract,
          cachedInsights,
        },
      }
      : item
  ));

  await writeJsonFile(localStorePath, next);

  return cachedInsights;
}

async function saveContractOverviewInsightsFirebase(contractId, overviewInsights) {
  const contractRef = firestore.collection('contracts').doc(contractId);
  const contractDoc = await contractRef.get();

  if (!contractDoc.exists) {
    throw new AppError(404, `Contract not found: ${contractId}`);
  }

  const cachedInsights = {
    ...(contractDoc.data()?.cachedInsights || {}),
    overview: overviewInsights,
    generatedAt: new Date().toISOString(),
    provider: overviewInsights?.provider || 'gemini',
    degraded: Boolean(overviewInsights?.degraded),
  };

  await contractRef.set({
    cachedInsights,
  }, { merge: true });

  return cachedInsights;
}

async function saveContractOverviewInsights(contractId, overviewInsights) {
  if (env.strictRemoteServices && (!firestoreStatus.enabled || !firestore)) {
    throw buildFirestoreRequiredError('insight cache write', new Error('Firestore is not configured.'));
  }

  if (firestoreStatus.enabled && firestore) {
    try {
      return await saveContractOverviewInsightsFirebase(contractId, overviewInsights);
    } catch (error) {
      if (env.strictRemoteServices) {
        throw buildFirestoreRequiredError('insight cache write', error);
      }

      console.warn('Falling back to local insight cache write:', error.message);
    }
  }

  return saveContractOverviewInsightsLocal(contractId, overviewInsights);
}

async function deleteContractBundleLocal(contractId) {
  const current = await readJsonFile(localStorePath, []);
  const match = current.find((item) => item.contract.id === contractId);

  if (!match) {
    throw new AppError(404, `Contract not found: ${contractId}`);
  }

  const next = current.filter((item) => item.contract.id !== contractId);
  await writeJsonFile(localStorePath, next);

  return {
    mode: 'local-json',
    location: localStorePath,
    deletedCounts: {
      contracts: 1,
      clauses: match.clauses.length,
      risks: match.risks.length,
    },
  };
}

async function deleteContractBundleFirebase(contractId) {
  const contractRef = firestore.collection('contracts').doc(contractId);
  const contractDoc = await contractRef.get();

  if (!contractDoc.exists) {
    throw new AppError(404, `Contract not found: ${contractId}`);
  }

  const [clausesSnapshot, risksSnapshot] = await Promise.all([
    contractRef.collection('clauses').get(),
    contractRef.collection('risks').get(),
  ]);
  const batch = firestore.batch();

  clausesSnapshot.docs.forEach((document) => {
    batch.delete(document.ref);
  });

  risksSnapshot.docs.forEach((document) => {
    batch.delete(document.ref);
  });

  batch.delete(contractRef);
  await batch.commit();

  return {
    mode: 'firebase',
    location: `contracts/${contractId}`,
    deletedCounts: {
      contracts: 1,
      clauses: clausesSnapshot.size,
      risks: risksSnapshot.size,
    },
  };
}

async function deleteContractBundle(contractId) {
  if (env.strictRemoteServices && (!firestoreStatus.enabled || !firestore)) {
    throw buildFirestoreRequiredError('delete', new Error('Firestore is not configured.'));
  }

  if (firestoreStatus.enabled && firestore) {
    return deleteContractBundleFirebase(contractId);
  }

  return deleteContractBundleLocal(contractId);
}

module.exports = {
  deleteContractBundle,
  findContractBySourceIdentity,
  getContractById,
  listContracts,
  saveContractOverviewInsights,
  saveContractBundle,
};
