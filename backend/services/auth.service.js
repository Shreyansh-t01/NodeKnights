const crypto = require('node:crypto');

const AppError = require('../errors/AppError');
const { env } = require('../config/env');
const { readJsonFile, writeJsonFile } = require('../utils/jsonStore');

const STORE_FALLBACK = {
  users: [],
  sessions: [],
};

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function normalizeUsername(username = '') {
  return String(username || '').trim().toLowerCase();
}

function usernameToLocalEmail(username = '') {
  const normalized = normalizeUsername(username);

  if (normalized.includes('@')) {
    return normalized;
  }

  return `${normalized || 'owner'}@lexora.local`;
}

function sanitizeString(value = '') {
  return String(value || '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash = '') {
  const [salt, expectedHash] = String(storedHash).split(':');

  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  if (actualHash.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualHash, expectedBuffer);
}

function signToken(sessionId, userId, expiresAt) {
  const payload = Buffer.from(JSON.stringify({
    sid: sessionId,
    sub: userId,
    exp: expiresAt,
  })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', env.authSessionSecret)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

function parseToken(token = '') {
  const [payload, signature] = String(token).split('.');

  if (!payload || !signature) {
    throw new AppError(401, 'Authentication token is invalid.');
  }

  const expectedSignature = crypto
    .createHmac('sha256', env.authSessionSecret)
    .update(payload)
    .digest('base64url');

  if (
    signature.length !== expectedSignature.length
    || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    throw new AppError(401, 'Authentication token is invalid.');
  }

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
  } catch (error) {
    throw new AppError(401, 'Authentication token is invalid.');
  }
}

async function readAuthStore() {
  const store = await readJsonFile(env.authUserStorePath, STORE_FALLBACK);

  return {
    users: Array.isArray(store.users) ? store.users : [],
    sessions: Array.isArray(store.sessions) ? store.sessions : [],
  };
}

async function writeAuthStore(store) {
  await writeJsonFile(env.authUserStorePath, {
    users: store.users || [],
    sessions: store.sessions || [],
    updatedAt: nowIso(),
  });
}

function serializeUser(user) {
  return {
    id: user.id,
    username: user.username || user.email,
    fullName: user.fullName,
    email: user.email,
    organizationName: user.organizationName,
    organizationType: user.organizationType,
    roleTitle: user.roleTitle,
    jurisdiction: user.jurisdiction,
    notificationEmail: user.notificationEmail,
    practiceFocus: user.practiceFocus,
    accountRole: user.accountRole || 'member',
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || null,
  };
}

function validateRegistrationPayload(payload = {}) {
  const username = normalizeUsername(payload.username || payload.email);
  const fullName = sanitizeString(payload.fullName);
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || '');
  const organizationName = sanitizeString(payload.organizationName);
  const organizationType = sanitizeString(payload.organizationType || 'in-house legal team');
  const roleTitle = sanitizeString(payload.roleTitle);
  const jurisdiction = sanitizeString(payload.jurisdiction);
  const notificationEmail = normalizeEmail(payload.notificationEmail || email);
  const practiceFocus = sanitizeString(payload.practiceFocus || 'Contract review');

  const missing = [];

  if (!fullName) missing.push('fullName');
  if (!username) missing.push('username');
  if (!email) missing.push('email');
  if (!password) missing.push('password');
  if (!organizationName) missing.push('organizationName');
  if (!roleTitle) missing.push('roleTitle');
  if (!jurisdiction) missing.push('jurisdiction');

  if (missing.length) {
    throw new AppError(400, 'Registration is missing required profile fields.', { fields: missing });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, 'Enter a valid work email address.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail)) {
    throw new AppError(400, 'Enter a valid notification email address.');
  }

  if (password.length < 10) {
    throw new AppError(400, 'Password must be at least 10 characters long.');
  }

  return {
    fullName,
    username,
    email,
    password,
    organizationName,
    organizationType,
    roleTitle,
    jurisdiction,
    notificationEmail,
    practiceFocus,
  };
}

function createSessionForUser(user) {
  const sessionId = randomId('session');
  const issuedAt = nowIso();
  const expiresAt = new Date(Date.now() + env.authSessionTtlMs).toISOString();

  return {
    session: {
      id: sessionId,
      userId: user.id,
      createdAt: issuedAt,
      expiresAt,
    },
    token: signToken(sessionId, user.id, expiresAt),
  };
}

async function registerUser(payload) {
  const cleanPayload = validateRegistrationPayload(payload);
  const store = await readAuthStore();
  const existingUser = store.users.find((user) => (
    user.email === cleanPayload.email
    || normalizeUsername(user.username) === cleanPayload.username
  ));

  if (existingUser) {
    throw new AppError(409, 'A user already exists with this email address.');
  }

  const user = {
    id: randomId('user'),
    username: cleanPayload.username,
    fullName: cleanPayload.fullName,
    email: cleanPayload.email,
    organizationName: cleanPayload.organizationName,
    organizationType: cleanPayload.organizationType,
    roleTitle: cleanPayload.roleTitle,
    jurisdiction: cleanPayload.jurisdiction,
    notificationEmail: cleanPayload.notificationEmail,
    practiceFocus: cleanPayload.practiceFocus,
    passwordHash: hashPassword(cleanPayload.password),
    accountRole: store.users.length ? 'member' : 'owner',
    createdAt: nowIso(),
    lastLoginAt: nowIso(),
  };
  const { session, token } = createSessionForUser(user);

  store.users.push(user);
  store.sessions.push(session);
  await writeAuthStore(store);

  return {
    token,
    expiresAt: session.expiresAt,
    user: serializeUser(user),
  };
}

async function loginUser({ username = '', email = '', password = '' }) {
  const loginId = normalizeUsername(username || email);
  const store = await readAuthStore();
  const user = store.users.find((item) => (
    normalizeUsername(item.username) === loginId
    || normalizeEmail(item.email) === loginId
  ));

  if (!user || !verifyPassword(String(password || ''), user.passwordHash)) {
    throw new AppError(401, 'Email or password is incorrect.');
  }

  user.lastLoginAt = nowIso();

  const { session, token } = createSessionForUser(user);
  store.sessions = store.sessions.filter((item) => new Date(item.expiresAt).getTime() > Date.now());
  store.sessions.push(session);
  await writeAuthStore(store);

  return {
    token,
    expiresAt: session.expiresAt,
    user: serializeUser(user),
  };
}

async function getUserFromToken(token) {
  const payload = parseToken(token);

  if (!payload.sid || !payload.sub || !payload.exp) {
    throw new AppError(401, 'Authentication token is invalid.');
  }

  if (new Date(payload.exp).getTime() <= Date.now()) {
    throw new AppError(401, 'Authentication token has expired.');
  }

  const store = await readAuthStore();
  const session = store.sessions.find((item) => item.id === payload.sid && item.userId === payload.sub);

  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    throw new AppError(401, 'Authentication session has expired.');
  }

  const user = store.users.find((item) => item.id === payload.sub);

  if (!user) {
    throw new AppError(401, 'Authentication user no longer exists.');
  }

  return {
    session,
    user: serializeUser(user),
  };
}

async function logoutToken(token) {
  const payload = parseToken(token);
  const store = await readAuthStore();
  const nextSessions = store.sessions.filter((session) => session.id !== payload.sid);

  if (nextSessions.length !== store.sessions.length) {
    store.sessions = nextSessions;
    await writeAuthStore(store);
  }
}

async function bootstrapAuthUser() {
  if (!env.authUsername || !env.authPassword) {
    return {
      created: false,
      reason: 'missing-bootstrap-credentials',
    };
  }

  const store = await readAuthStore();
  const username = normalizeUsername(env.authUsername);
  const email = usernameToLocalEmail(username);
  const existingUser = store.users.find((user) => (
    normalizeUsername(user.username) === username
    || user.email === email
    || user.accountRole === 'owner'
  ));

  if (existingUser) {
    existingUser.username = username;
    existingUser.email = email;
    existingUser.passwordHash = hashPassword(env.authPassword);
    existingUser.accountRole = 'owner';
    existingUser.fullName = existingUser.fullName || 'Lexora Owner';
    existingUser.organizationName = existingUser.organizationName || 'Lexora Workspace';
    existingUser.organizationType = existingUser.organizationType || 'legal intelligence workspace';
    existingUser.roleTitle = existingUser.roleTitle || 'Owner';
    existingUser.jurisdiction = existingUser.jurisdiction || 'India';
    existingUser.notificationEmail = existingUser.notificationEmail || email;
    existingUser.practiceFocus = existingUser.practiceFocus || 'Contract review, clause risk, and precedent search';
    await writeAuthStore(store);

    return {
      created: false,
      username,
      reason: 'updated-existing-owner',
    };
  }

  const user = {
    id: randomId('user'),
    username,
    fullName: 'Lexora Owner',
    email,
    organizationName: 'Lexora Workspace',
    organizationType: 'legal intelligence workspace',
    roleTitle: 'Owner',
    jurisdiction: 'India',
    notificationEmail: email,
    practiceFocus: 'Contract review, clause risk, and precedent search',
    passwordHash: hashPassword(env.authPassword),
    accountRole: 'owner',
    createdAt: nowIso(),
    lastLoginAt: null,
  };

  store.users.push(user);
  await writeAuthStore(store);

  return {
    created: true,
    username,
  };
}

module.exports = {
  bootstrapAuthUser,
  getUserFromToken,
  loginUser,
  logoutToken,
  registerUser,
};
