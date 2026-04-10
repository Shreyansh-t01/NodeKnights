const asyncHandler = require('../utils/asyncHandler');
const {
  createPrecedentFromEntries,
  getClausePrecedents,
  getPrecedentDetails,
  ingestPrecedentDocument,
  listPrecedentSummaries,
} = require('../services/precedent.service');

const uploadPrecedent = asyncHandler(async (req, res) => {
  const payload = await ingestPrecedentDocument(req.file, {
    title: req.body?.title,
    source: req.body?.source || 'file-upload',
    contractType: req.body?.contractType,
    organization: req.body?.organization,
    jurisdiction: req.body?.jurisdiction,
    note: req.body?.note,
    tags: req.body?.tags ? String(req.body.tags).split(',') : [],
  });

  res.status(201).json({
    success: true,
    message: 'Precedent document uploaded and indexed successfully.',
    data: payload,
  });
});

const createPrecedentEntry = asyncHandler(async (req, res) => {
  const payload = await createPrecedentFromEntries(req.body || {});

  res.status(201).json({
    success: true,
    message: 'Precedent clauses saved and indexed successfully.',
    data: payload,
  });
});

const listPrecedents = asyncHandler(async (req, res) => {
  const precedents = await listPrecedentSummaries();

  res.json({
    success: true,
    count: precedents.length,
    data: precedents,
  });
});

const getPrecedent = asyncHandler(async (req, res) => {
  const precedent = await getPrecedentDetails(req.params.precedentId);

  res.json({
    success: true,
    data: precedent,
  });
});

const listClausePrecedents = asyncHandler(async (req, res) => {
  const topK = Number(req.query?.topK) || 3;
  const payload = await getClausePrecedents(req.params.contractId, req.params.clauseId, topK);

  res.json({
    success: true,
    data: payload,
  });
});

module.exports = {
  createPrecedentEntry,
  getPrecedent,
  listClausePrecedents,
  listPrecedents,
  uploadPrecedent,
};
