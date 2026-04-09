const { Router } = require('express');

const { getHealth, getDependencyHealth } = require('../controllers/health.controller');

const router = Router();

router.get('/', getHealth);
router.get('/dependencies', getDependencyHealth);

module.exports = router;
