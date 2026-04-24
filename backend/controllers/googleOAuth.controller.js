const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../errors/AppError');
const { env } = require('../config/env');
const {
  buildGoogleAppRedirectUrl,
  createGoogleOAuthState,
  createGoogleAuthUrl,
  disconnectGoogleOAuth,
  exchangeGoogleAuthCode,
  getGoogleConnectorStatus,
  parseGoogleOAuthState,
} = require('../services/googleAuth.service');

function buildCallbackHtml({
  title,
  message,
  details = [],
  actionHref = '',
  actionLabel = 'Return to Lexora',
}) {
  const detailItems = details
    .filter(Boolean)
    .map((item) => `<li>${item}</li>`)
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f4f7fb; color: #172033; margin: 0; padding: 32px; }
      .card { max-width: 720px; margin: 0 auto; background: #ffffff; border: 1px solid #d7dfeb; border-radius: 8px; padding: 24px; }
      h1 { margin-top: 0; }
      p, li { line-height: 1.6; }
      code { background: #eef3f8; padding: 2px 6px; border-radius: 4px; }
      .action { display: inline-block; margin-top: 16px; padding: 10px 16px; border-radius: 999px; background: #0f5f55; color: #ffffff; text-decoration: none; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>${message}</p>
      ${detailItems ? `<ul>${detailItems}</ul>` : ''}
      ${actionHref ? `<a class="action" href="${actionHref}">${actionLabel}</a>` : ''}
    </div>
  </body>
</html>`;
}

function parseScopeList(value = '') {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function wantsHtml(req) {
  return String(req.headers.accept || '').includes('text/html');
}

function buildReturnLink(returnTo = '') {
  return buildGoogleAppRedirectUrl(returnTo || '/intake') || env.appBaseUrl || '';
}

function redirectToApp(res, { returnTo = '', status = '', message = '' }) {
  const redirectUrl = buildGoogleAppRedirectUrl(returnTo, {
    google_oauth: status,
    google_oauth_message: message,
  });

  if (!redirectUrl) {
    return false;
  }

  res.redirect(302, redirectUrl);
  return true;
}

function respondWithCallbackFailure(req, res, {
  returnTo = '',
  title = 'Google OAuth Failed',
  message = 'Google consent did not complete. Start the flow again from Lexora and try again.',
  statusCode = 400,
}) {
  if (wantsHtml(req) && returnTo && redirectToApp(res, {
    returnTo,
    status: 'error',
    message,
  })) {
    return true;
  }

  if (wantsHtml(req)) {
    res
      .status(statusCode)
      .type('html')
      .send(buildCallbackHtml({
        title,
        message,
        details: [
          'Start the Google connector flow again from the Lexora Intake workspace.',
          `Redirect URI: <code>${env.googleRedirectUri}</code>`,
        ],
        actionHref: buildReturnLink(returnTo),
      }));
    return true;
  }

  return false;
}

const getGoogleAuthUrl = asyncHandler(async (req, res) => {
  const scopes = parseScopeList(req.query.scopes || '');
  const state = createGoogleOAuthState({
    returnTo: req.query.returnTo ? String(req.query.returnTo) : '',
  });
  const statePayload = parseGoogleOAuthState(state);

  const result = createGoogleAuthUrl({
    scopes,
    state,
  });

  res.json({
    success: true,
    data: {
      ...result,
      returnTo: statePayload?.returnTo || '/intake',
    },
  });
});

const getGoogleStatus = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await getGoogleConnectorStatus(),
  });
});

const handleGoogleCallback = asyncHandler(async (req, res) => {
  const state = parseGoogleOAuthState(req.query.state ? String(req.query.state) : '');
  const returnTo = state?.returnTo || '';

  if (!state) {
    if (respondWithCallbackFailure(req, res, {
      title: 'Google OAuth Could Not Be Verified',
      message: 'This Google consent response is missing a valid Lexora session state. Start the flow again from Lexora Intake.',
      statusCode: 400,
    })) {
      return;
    }

    throw new AppError(400, 'Google OAuth state was missing, invalid, or expired. Start the connection from Lexora and try again.');
  }

  if (req.query.error) {
    if (respondWithCallbackFailure(req, res, {
      returnTo,
      message: 'Google consent was cancelled or denied before Lexora could finish the connection.',
      statusCode: 400,
    })) {
      return;
    }

    throw new AppError(400, `Google OAuth returned an error: ${req.query.error}`);
  }

  if (!req.query.code) {
    if (respondWithCallbackFailure(req, res, {
      returnTo,
      message: 'Google OAuth did not return an authorization code to the backend.',
      statusCode: 400,
    })) {
      return;
    }

    throw new AppError(400, 'Google OAuth callback did not include an authorization code.');
  }

  let result;

  try {
    result = await exchangeGoogleAuthCode(String(req.query.code));
  } catch (error) {
    if (respondWithCallbackFailure(req, res, {
      returnTo,
      message: 'Google consent reached the backend, but token exchange did not finish successfully. Start the flow again from Lexora Intake.',
      statusCode: error.statusCode || 500,
    })) {
      return;
    }

    throw error;
  }

  if (wantsHtml(req) && redirectToApp(res, {
    returnTo,
    status: 'success',
    message: 'Google Drive and Gmail access is connected.',
  })) {
    return;
  }

  if (wantsHtml(req)) {
    res
      .status(200)
      .type('html')
      .send(buildCallbackHtml({
        title: 'Google OAuth Connected',
        message: 'Your backend now has a stored Google refresh token for Drive and Gmail connectors.',
        details: [
          `Redirect URI: <code>${result.redirectUri}</code>`,
          `Refresh token stored: <code>${String(result.refreshTokenStored)}</code>`,
          `Token store: <code>${result.tokenSource}</code>`,
          result.scopes.length ? `Scopes: <code>${result.scopes.join(', ')}</code>` : '',
          'You can return to the app and run the Gmail or Drive import routes now.',
        ],
        actionHref: buildReturnLink(returnTo),
      }));
    return;
  }

  res.json({
    success: true,
    message: 'Google OAuth connected successfully.',
    data: {
      ...result,
      appRedirectUrl: buildGoogleAppRedirectUrl(returnTo, {
        google_oauth: 'success',
        google_oauth_message: 'Google Drive and Gmail access is connected.',
      }),
    },
  });
});

const disconnectGoogle = asyncHandler(async (req, res) => {
  const status = await disconnectGoogleOAuth();

  res.json({
    success: true,
    message: 'Stored Google OAuth tokens were cleared.',
    data: status,
  });
});

module.exports = {
  disconnectGoogle,
  getGoogleAuthUrl,
  getGoogleStatus,
  handleGoogleCallback,
};
