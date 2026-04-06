const { Router } = require('express');

const { semanticSearch } = require('../controllers/search.controller');

const router = Router();

router.post('/semantic', semanticSearch);

module.exports = router;
