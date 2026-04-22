const AppError = require('../errors/AppError');
const { env } = require('../config/env');
const { getUserFromToken } = require('../services/auth.service');

function readBearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return '';
  }

  return token.trim();
}

async function authenticate(req, res, next) {
  if (!env.authEnabled) {
    req.auth = null;
    next();
    return;
  }

  const token = readBearerToken(req);

  if (!token) {
    next(new AppError(401, 'Sign in to access Lexora.'));
    return;
  }

  try {
    const auth = await getUserFromToken(token);
    req.auth = auth;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  authenticate,
  readBearerToken,
};
