const path = require('node:path');

const { firestore, firestoreStatus } = require('../config/firebase');
const { env } = require('../config/env');
const { readJsonFile, writeJsonFile } = require('../utils/jsonStore');

const localStorePath = path.join(env.tempStorageDir, 'local-store', 'notifications.json');
const NOTIFICATION_COLLECTION = '_notifications';
const MAX_LOCAL_NOTIFICATIONS = 250;

function sortNotifications(items = []) {
  return [...items].sort((left, right) => (
    new Date(right.createdAt || 0) - new Date(left.createdAt || 0)
  ));
}

function countUnreadNotifications(items = []) {
  return items.reduce((count, item) => count + (item.readAt ? 0 : 1), 0);
}

async function readLocalNotifications() {
  return readJsonFile(localStorePath, []);
}

async function writeLocalNotifications(items = []) {
  await writeJsonFile(
    localStorePath,
    sortNotifications(items).slice(0, MAX_LOCAL_NOTIFICATIONS),
  );
}

async function saveNotificationLocal(notification) {
  const current = await readLocalNotifications();
  const next = [
    notification,
    ...current.filter((item) => item.id !== notification.id),
  ];

  await writeLocalNotifications(next);
  return notification;
}

async function listNotificationsLocal({ limit = 20 } = {}) {
  const items = sortNotifications(await readLocalNotifications());

  return {
    items: items.slice(0, limit),
    unreadCount: countUnreadNotifications(items),
  };
}

async function markAllNotificationsReadLocal() {
  const current = await readLocalNotifications();
  const readAt = new Date().toISOString();
  let updatedCount = 0;

  const next = current.map((item) => {
    if (item.readAt) {
      return item;
    }

    updatedCount += 1;
    return {
      ...item,
      readAt,
      updatedAt: readAt,
    };
  });

  await writeLocalNotifications(next);

  return {
    updatedCount,
    readAt,
  };
}

async function deleteNotificationsByContractIdLocal(contractId) {
  const current = await readLocalNotifications();
  const next = current.filter((item) => item.contractId !== contractId);
  const deletedCount = current.length - next.length;

  if (deletedCount) {
    await writeLocalNotifications(next);
  }

  return {
    deletedCount,
  };
}

async function saveNotificationFirebase(notification) {
  await firestore
    .collection(NOTIFICATION_COLLECTION)
    .doc(notification.id)
    .set(notification, { merge: true });

  return notification;
}

async function listNotificationsFirebase({ limit = 20 } = {}) {
  const snapshot = await firestore
    .collection(NOTIFICATION_COLLECTION)
    .orderBy('createdAt', 'desc')
    .get();

  const items = snapshot.docs.map((document) => document.data());

  return {
    items: items.slice(0, limit),
    unreadCount: countUnreadNotifications(items),
  };
}

async function markAllNotificationsReadFirebase() {
  const snapshot = await firestore
    .collection(NOTIFICATION_COLLECTION)
    .where('readAt', '==', null)
    .get();

  const readAt = new Date().toISOString();
  const batch = firestore.batch();

  snapshot.docs.forEach((document) => {
    batch.set(document.ref, {
      readAt,
      updatedAt: readAt,
    }, { merge: true });
  });

  await batch.commit();

  return {
    updatedCount: snapshot.size,
    readAt,
  };
}

async function deleteNotificationsByContractIdFirebase(contractId) {
  const snapshot = await firestore
    .collection(NOTIFICATION_COLLECTION)
    .where('contractId', '==', contractId)
    .get();

  if (snapshot.empty) {
    return {
      deletedCount: 0,
    };
  }

  const batch = firestore.batch();

  snapshot.docs.forEach((document) => {
    batch.delete(document.ref);
  });

  await batch.commit();

  return {
    deletedCount: snapshot.size,
  };
}

async function saveNotification(notification) {
  if (firestoreStatus.enabled && firestore) {
    try {
      return await saveNotificationFirebase(notification);
    } catch (error) {
      console.warn('Falling back to local notification store:', error.message);
    }
  }

  return saveNotificationLocal(notification);
}

async function listNotifications(options = {}) {
  if (firestoreStatus.enabled && firestore) {
    try {
      return await listNotificationsFirebase(options);
    } catch (error) {
      console.warn('Falling back to local notification list:', error.message);
    }
  }

  return listNotificationsLocal(options);
}

async function markAllNotificationsRead() {
  if (firestoreStatus.enabled && firestore) {
    try {
      return await markAllNotificationsReadFirebase();
    } catch (error) {
      console.warn('Falling back to local notification updates:', error.message);
    }
  }

  return markAllNotificationsReadLocal();
}

module.exports = {
  deleteNotificationsByContractId: async (contractId) => {
    if (firestoreStatus.enabled && firestore) {
      try {
        return await deleteNotificationsByContractIdFirebase(contractId);
      } catch (error) {
        console.warn('Falling back to local notification delete:', error.message);
      }
    }

    return deleteNotificationsByContractIdLocal(contractId);
  },
  listNotifications,
  markAllNotificationsRead,
  saveNotification,
};
