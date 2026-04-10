const asyncHandler = require('../utils/asyncHandler');
const { runSemanticSearch } = require('../services/search.service');

const semanticSearch = asyncHandler(async (req, res) => {
  const result = await runSemanticSearch(req.body || {});

  res.status(200).json({
    success: true,
    message: 'Semantic search completed successfully.',
    data: result,
  });
});

module.exports = {
  semanticSearch,
};
