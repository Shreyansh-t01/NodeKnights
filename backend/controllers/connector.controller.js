const asyncHandler = require('../utils/asyncHandler');
const { importDriveFiles } = require('../services/drive.service');
const { importGmailAttachments } = require('../services/gmail.service');

const importFromDrive = asyncHandler(async (req, res) => {
  const results = await importDriveFiles(req.body || {});

  res.status(201).json({
    success: true,
    count: results.length,
    data: results,
  });
});

const importFromGmail = asyncHandler(async (req, res) => {
  const results = await importGmailAttachments(req.body || {});

  res.status(201).json({
    success: true,
    count: results.length,
    data: results,
  });
});

module.exports = {
  importFromDrive,
  importFromGmail,
};
