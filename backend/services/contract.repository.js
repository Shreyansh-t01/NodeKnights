const path = require('node:path');

const { firestore, firestoreStatus } = require('../config/firebase');
const { env } = require('../config/env');
const AppError = require('../errors/AppError');
const { readJsonFile, writeJsonFile } = require('../utils/jsonStore');

const localStorePath = path.join(env.tempStorageDir, 'local-store', 'contracts.json');

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
  if (firestoreStatus.enabled && firestore) {
    try {
      return await saveContractBundleFirebase(bundle);
    } catch (error) {
      console.warn('Falling back to local contract store:', error.message);
    }
  }

  return saveContractBundleLocal(bundle);
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
  if (firestoreStatus.enabled && firestore) {
    try {
      return await listContractsFirebase();
    } catch (error) {
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
  if (firestoreStatus.enabled && firestore) {
    try {
      return await getContractByIdFirebase(contractId);
    } catch (error) {
      if (error.isOperational) {
        throw error;
      }

      console.warn('Falling back to local contract details:', error.message);
    }
  }

  return getContractByIdLocal(contractId);
}

module.exports = {
  getContractById,
  listContracts,
  saveContractBundle,
};
