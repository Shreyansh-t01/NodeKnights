const asyncHandler = require('../utils/asyncHandler');
const { runSemanticSearch } = require('../services/search.service');

const semanticSearch = asyncHandler(async (req, res) => {
  const result = await runSemanticSearch(req.body || {});

  res.json({
    success: true,
    data: result,
  });
});

module.exports = {
  semanticSearch,
};
