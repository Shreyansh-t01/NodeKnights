const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../errors/AppError');
const {
  createGoogleAuthUrl,
  disconnectGoogleOAuth,
  exchangeGoogleAuthCode,
  getGoogleConnectorStatus,
} = require('../services/googleAuth.service');

function buildCallbackHtml({ title, message, details = [] }) {
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
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>${message}</p>
      ${detailItems ? `<ul>${detailItems}</ul>` : ''}
    </div>
  </body>
</html>`;
}

const getGoogleAuthUrl = asyncHandler(async (req, res) => {
  const scopes = String(req.query.scopes || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const result = createGoogleAuthUrl({
    scopes,
    state: req.query.state ? String(req.query.state) : '',
  });

 

  res.json({
    success: true,
    data: result,
  });

});

const getGoogleStatus = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await getGoogleConnectorStatus(),
  });
});

const handleGoogleCallback = asyncHandler(async (req, res) => {
  if (req.query.error) {
    throw new AppError(400, `Google OAuth returned an error: ${req.query.error}`);
  }

  if (!req.query.code) {
    throw new AppError(400, 'Google OAuth callback did not include an authorization code.');
  }

  const result = await exchangeGoogleAuthCode(String(req.query.code));
  const acceptHeader = String(req.headers.accept || '');

  if (acceptHeader.includes('text/html')) {
    res
      .status(200)
      .type('html')
      .send(buildCallbackHtml({
        title: 'Google OAuth Connected',
        message: 'Your backend now has a stored Google refresh token for Drive and Gmail connectors.',
        details: [
          `Redirect URI: <code>${result.redirectUri}</code>`,
          `Refresh token stored: <code>${String(result.refreshTokenStored)}</code>`,
          result.scopes.length ? `Scopes: <code>${result.scopes.join(', ')}</code>` : '',
          'You can return to the app and run the Gmail or Drive import routes now.',
        ],
      }));
    return;
  }

  res.json({
    success: true,
    message: 'Google OAuth connected successfully.',
    data: result,
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
