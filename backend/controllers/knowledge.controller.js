const asyncHandler = require('../utils/asyncHandler');
const {
  createKnowledgeFromEntries,
  getKnowledgeDetails,
  ingestKnowledgeDocument,
  listKnowledgeSummaries,
  searchKnowledge,
} = require('../services/knowledge.service');

const uploadKnowledge = asyncHandler(async (req, res) => {
  const payload = await ingestKnowledgeDocument(req.file, {
    title: req.body?.title,
    source: req.body?.source || 'file-upload',
    sourceType: req.body?.sourceType,
    documentType: req.body?.documentType,
    organization: req.body?.organization,
    jurisdiction: req.body?.jurisdiction,
    league: req.body?.league,
    sport: req.body?.sport,
    version: req.body?.version,
    effectiveFrom: req.body?.effectiveFrom,
    effectiveTo: req.body?.effectiveTo,
    clauseType: req.body?.clauseType,
    clauseTypes: req.body?.clauseTypes ? String(req.body.clauseTypes).split(',') : [],
    topics: req.body?.topics ? String(req.body.topics).split(',') : [],
    tags: req.body?.tags ? String(req.body.tags).split(',') : [],
    note: req.body?.note,
  });

  res.status(201).json({
    success: true,
    message: 'Knowledge document uploaded and indexed successfully.',
    data: payload,
  });
});

const createKnowledgeEntry = asyncHandler(async (req, res) => {
  const payload = await createKnowledgeFromEntries(req.body || {});

  res.status(201).json({
    success: true,
    message: 'Rules and policies saved and indexed successfully.',
    data: payload,
  });
});

const listKnowledge = asyncHandler(async (req, res) => {
  const knowledgeDocuments = await listKnowledgeSummaries();

  res.json({
    success: true,
    count: knowledgeDocuments.length,
    data: knowledgeDocuments,
  });
});

const getKnowledge = asyncHandler(async (req, res) => {
  const knowledge = await getKnowledgeDetails(req.params.knowledgeId);

  res.json({
    success: true,
    data: knowledge,
  });
});

const runKnowledgeSearch = asyncHandler(async (req, res) => {
  const result = await searchKnowledge(req.body || {});

  res.json({
    success: true,
    data: result,
  });
});

module.exports = {
  createKnowledgeEntry,
  getKnowledge,
  listKnowledge,
  runKnowledgeSearch,
  uploadKnowledge,
};
