const { google } = require('googleapis');

const { env, featureFlags } = require('../config/env');
const AppError = require('../errors/AppError');

function getOAuthClient() {
  if (!featureFlags.googleConnectors) {
    throw new AppError(
      503,
      'Google connectors are not configured. Add your OAuth client credentials and refresh token to backend/.env.',
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    env.googleClientId,
    env.googleClientSecret,
    env.googleRedirectUri,
  );

  oauth2Client.setCredentials({
    refresh_token: env.googleRefreshToken,
  });

  return oauth2Client;
}

module.exports = {
  getOAuthClient,
};
