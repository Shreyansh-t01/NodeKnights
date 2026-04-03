const express = require('express');
const ClauseController = require('../controllers/ClauseController');
const { authenticate } = require('../middleware');

const router = express.Router();

// All clause routes require authentication
router.use(authenticate);

// Clause routes
router.get('/documents/:documentId/clauses', ClauseController.getClauses);
router.get('/clauses/search', ClauseController.searchClauses);
router.get('/documents/:documentId/clauses/stats', ClauseController.getClauseStats);
router.get('/clauses/:clauseId', ClauseController.getClause);
router.post('/documents/:documentId/clauses', ClauseController.createClauses);
router.put('/clauses/:clauseId', ClauseController.updateClause);
router.delete('/clauses/:clauseId', ClauseController.deleteClause);

module.exports = router;