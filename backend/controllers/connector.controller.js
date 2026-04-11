const asyncHandler = require('../utils/asyncHandler');
const {
  getDriveWatchStatus,
  handleDriveNotification,
  importDriveFiles,
  registerDriveChangesWatch,
  stopDriveChangesWatch,
  syncDriveChanges,
} = require('../services/drive.service');
const { importGmailAttachments } = require('../services/gmail.service');

const importFromDrive = asyncHandler(async (req, res) => {
  const results = await importDriveFiles(req.body || {});

  res.status(201).json({
    success: true,
    count: results.length,
    data: results,
  });
});

const getDriveWatch = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await getDriveWatchStatus(),
  });
});

const startDriveWatch = asyncHandler(async (req, res) => {
  const watchState = await registerDriveChangesWatch({
    forceRenew: Boolean(req.body?.forceRenew),
  });

  res.status(201).json({
    success: true,
    message: 'Drive change watch is active.',
    data: watchState,
  });
});

const syncDriveWatch = asyncHandler(async (req, res) => {
  const result = await syncDriveChanges({
    trigger: 'manual-drive-watch-sync',
  });

  res.status(200).json({
    success: true,
    message: 'Drive changes processed successfully.',
    data: result,
  });
});

const stopDriveWatch = asyncHandler(async (req, res) => {
  const state = await stopDriveChangesWatch();

  res.status(200).json({
    success: true,
    message: 'Drive change watch stopped.',
    data: state,
  });
});

const receiveDriveNotification = asyncHandler(async (req, res) => {
  await handleDriveNotification(req.headers || {});
  res.status(204).send();
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
  getDriveWatch,
  importFromDrive,
  importFromGmail,
  receiveDriveNotification,
  startDriveWatch,
  stopDriveWatch,
  syncDriveWatch,
};
