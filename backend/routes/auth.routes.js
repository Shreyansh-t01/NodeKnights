const { Router } = require('express');

const {
  login,
  logout,
  me,
  register,
} = require('../controllers/auth.controller');

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', me);
router.post('/logout', logout);

module.exports = router;
