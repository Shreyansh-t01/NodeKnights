const { db, COLLECTIONS, formatFirestoreError } = require('../database');

const FILE_CHUNK_SIZE_BYTES = 700 * 1024;

/**
 * Stores uploaded files in Firestore-sized chunks so the backend can remain
 * file-first without relying on any NLP or content extraction pipeline.
 */
class FileStorageService {
  static getDb() {
    if (!db) {
      throw new Error('Firestore is not initialized. Add a valid Firebase service account JSON file or verify FIREBASE_SERVICE_ACCOUNT_PATH.');
    }

    return db;
  }

  static getFileChunksCollection() {
    return this.getDb().collection(COLLECTIONS.FILE_CHUNKS);
  }

  static createChunkPayload(documentId, chunkIndex, chunkBuffer) {
    return {
      documentId,
      chunkIndex,
      size: chunkBuffer.length,
      data: chunkBuffer,
      createdAt: new Date(),
    };
  }

  static async storeFile(documentId, file) {
    try {
      const { buffer, mimetype, originalname, size } = file;

      if (!buffer || buffer.length === 0) {
        throw new Error('Uploaded file buffer is empty');
      }

      const chunkCount = Math.ceil(buffer.length / FILE_CHUNK_SIZE_BYTES);
      let batch = this.getDb().batch();
      let operationsInBatch = 0;

      for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
        const start = chunkIndex * FILE_CHUNK_SIZE_BYTES;
        const end = Math.min(start + FILE_CHUNK_SIZE_BYTES, buffer.length);
        const chunkBuffer = buffer.subarray(start, end);
        const chunkRef = this.getFileChunksCollection().doc(`${documentId}_${chunkIndex}`);

        batch.set(chunkRef, this.createChunkPayload(documentId, chunkIndex, chunkBuffer));
        operationsInBatch++;

        if (operationsInBatch === 500) {
          await batch.commit();
          batch = this.getDb().batch();
          operationsInBatch = 0;
        }
      }

      if (operationsInBatch > 0) {
        await batch.commit();
      }

      return {
        provider: 'firestore',
        collection: COLLECTIONS.FILE_CHUNKS,
        fileName: originalname,
        mimeType: mimetype,
        totalBytes: size,
        chunkCount,
        chunkSizeBytes: FILE_CHUNK_SIZE_BYTES,
        encoding: 'binary',
        storedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to store file chunks: ${formatFirestoreError(error, 'Storing file chunks')}`);
    }
  }

  static async deleteFile(documentId) {
    try {
      const snapshot = await this.getFileChunksCollection()
        .where('documentId', '==', documentId)
        .get();

      if (snapshot.empty) {
        return { deletedCount: 0 };
      }

      let batch = this.getDb().batch();
      let operationsInBatch = 0;
      let deletedCount = 0;

      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
        operationsInBatch++;
        deletedCount++;

        if (operationsInBatch === 500) {
          await batch.commit();
          batch = this.getDb().batch();
          operationsInBatch = 0;
        }
      }

      if (operationsInBatch > 0) {
        await batch.commit();
      }

      return { deletedCount };
    } catch (error) {
      throw new Error(`Failed to delete file chunks: ${formatFirestoreError(error, 'Deleting file chunks')}`);
    }
  }
}

module.exports = FileStorageService;
