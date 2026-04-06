const multer = require('multer');

const { env } = require('../config/env');
const AppError = require('../errors/AppError');

const allowedMimeTypes = new Set([
  'application/pdf',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: env.maxUploadSizeMb * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new AppError(400, `Unsupported file type: ${file.mimetype}`));
  },
});

module.exports = upload;
