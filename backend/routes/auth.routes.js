const { Router } = require('express');

const {
  login,
  logout,
  me,
  register,
  testerCredentials,
} = require('../controllers/auth.controller');

const router = Router();

router.get('/tester-credentials', testerCredentials);
router.post('/register', register);
router.post('/login', login);
router.get('/me', me);
router.post('/logout', logout);

module.exports = router;
