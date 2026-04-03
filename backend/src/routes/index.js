const express = require('express');
const documentRoutes = require('./documentRoutes');
const chunkRoutes = require('./chunkRoutes');
const clauseRoutes = require('./clauseRoutes');

const router = express.Router();

// Mount routes
router.use('/documents', documentRoutes);
router.use('/chunks', chunkRoutes);
router.use('/clauses', clauseRoutes);

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'API is running' });
});

module.exports = router;
