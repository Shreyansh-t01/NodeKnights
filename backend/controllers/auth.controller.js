const asyncHandler = require('../utils/asyncHandler');
const {
  getUserFromToken,
  loginUser,
  logoutToken,
  registerUser,
} = require('../services/auth.service');
const { readBearerToken } = require('../middlewares/authenticate');

const register = asyncHandler(async (req, res) => {
  const auth = await registerUser(req.body);

  res.status(201).json({
    success: true,
    message: 'Registration complete.',
    data: auth,
  });
});

const login = asyncHandler(async (req, res) => {
  const auth = await loginUser(req.body);

  res.json({
    success: true,
    message: 'Login successful.',
    data: auth,
  });
});

const me = asyncHandler(async (req, res) => {
  const token = readBearerToken(req);
  const auth = await getUserFromToken(token);

  res.json({
    success: true,
    data: {
      user: auth.user,
      expiresAt: auth.session.expiresAt,
    },
  });
});

const logout = asyncHandler(async (req, res) => {
  const token = readBearerToken(req);

  if (token) {
    await logoutToken(token);
  }

  res.json({
    success: true,
    message: 'Logged out successfully.',
  });
});

module.exports = {
  login,
  logout,
  me,
  register,
};
