/**
 * Validators
 * Validates input data and request parameters
 */

const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File is required' });
  }

  if (req.file.size === 0) {
    return res.status(400).json({ error: 'File is empty' });
  }

  next();
};

const validateDocumentUpdate = (req, res, next) => {
  const allowedFields = ['title', 'description', 'metadata', 'customFields'];
  const fields = Object.keys(req.body);

  const invalidFields = fields.filter(field => !allowedFields.includes(field));

  if (invalidFields.length > 0) {
    return res.status(400).json({
      error: `Invalid fields: ${invalidFields.join(', ')}`,
    });
  }

  next();
};

const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;

  if (page && (isNaN(page) || page < 1)) {
    return res.status(400).json({ error: 'Invalid page number' });
  }

  if (limit && (isNaN(limit) || limit < 1 || limit > 100)) {
    return res.status(400).json({ error: 'Invalid limit (max 100)' });
  }

  next();
};

module.exports = {
  validateFileUpload,
  validateDocumentUpdate,
  validatePagination,
};
