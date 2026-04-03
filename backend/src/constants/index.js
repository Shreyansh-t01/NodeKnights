/**
 * Constants and Enumerations
 */

const CONTENT_TYPES = {
  EMAIL: 'email',
  PDF: 'pdf',
  IMAGE: 'image',
  DOCUMENT: 'document',
  SPREADSHEET: 'spreadsheet',
  UPLOAD: 'upload',
};

const SOURCE_TYPES = {
  GMAIL: 'gmail',
  GOOGLE_DRIVE: 'google_drive',
  UPLOAD: 'upload',
  DIRECT_IMAGE: 'direct_image',
};

const PROCESSING_STATUS = {
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  QUEUED: 'queued',
};

const ERROR_MESSAGES = {
  INVALID_FILE: 'Invalid file type',
  FILE_TOO_LARGE: 'File size exceeds limit',
  EXTRACTION_FAILED: 'Failed to extract content',
  PROCESSING_FAILED: 'Processing failed',
  UNAUTHORIZED: 'Unauthorized access',
  NOT_FOUND: 'Resource not found',
  INTERNAL_ERROR: 'Internal server error',
};

const API_LIMITS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_DOCUMENTS_PER_REQUEST: 100,
  DEFAULT_PAGE_LIMIT: 20,
  MAX_PAGE_LIMIT: 100,
  REQUEST_TIMEOUT: 30000, // 30 seconds
};

const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
];

module.exports = {
  CONTENT_TYPES,
  SOURCE_TYPES,
  PROCESSING_STATUS,
  ERROR_MESSAGES,
  API_LIMITS,
  SUPPORTED_FILE_TYPES,
};
