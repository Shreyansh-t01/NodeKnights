const express = require('express');
const ChunkController = require('../controllers/ChunkController');
const { authenticate } = require('../middleware');

const router = express.Router();

// All chunk routes require authentication
router.use(authenticate);

// Chunk routes
router.get('/documents/:documentId/chunks', ChunkController.getChunks);
router.get('/chunks/search', ChunkController.searchChunks);
router.get('/documents/:documentId/chunks/stats', ChunkController.getChunkStats);
router.get('/chunks/:chunkId', ChunkController.getChunk);
router.post('/documents/:documentId/chunks', ChunkController.createChunks);
router.put('/chunks/:chunkId', ChunkController.updateChunk);
router.delete('/chunks/:chunkId', ChunkController.deleteChunk);

module.exports = router;