const asyncHandler = require('../utils/asyncHandler');
const {
  ingestManualContract,
  listContractSummaries,
  getContractDetails,
  buildContractInsights,
  deleteContractRecord,
} = require('../services/contract.service');

const uploadContract = asyncHandler(async (req, res) => {
  const payload = await ingestManualContract(req.file, {
    source: 'manual-upload',
  });

  res.status(201).json({
    success: true,
    message: 'Contract uploaded and processed successfully.',
    data: payload,
  });
});

const listContracts = asyncHandler(async (req, res) => {
  const contracts = await listContractSummaries();

  res.json({
    success: true,
    count: contracts.length,
    data: contracts,
  });
});

const getContract = asyncHandler(async (req, res) => {
  const contract = await getContractDetails(req.params.contractId);

  res.json({
    success: true,
    data: contract,
  });
});

const getInsights = asyncHandler(async (req, res) => {
  const insights = await buildContractInsights(
    req.params.contractId,
    req.body?.clauseId || req.query.clauseId,
  );

  res.json({
    success: true,
    data: insights,
  });
});

const deleteContract = asyncHandler(async (req, res) => {
  const result = await deleteContractRecord(req.params.contractId);

  res.json({
    success: true,
    message: 'Contract deleted successfully.',
    data: result,
  });
});

module.exports = {
  deleteContract,
  getContract,
  getInsights,
  listContracts,
  uploadContract,
};
