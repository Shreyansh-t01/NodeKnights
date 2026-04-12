require('dotenv').config();

const { syncSearchIndexes } = require('../services/searchIndex.service');

syncSearchIndexes()
  .then((result) => {
    console.log(JSON.stringify({
      success: true,
      completedAt: result.completedAt,
      contracts: result.contracts,
      precedents: result.precedents,
      knowledge: {
        ...result.knowledge,
        rulebookChunkCount: result.rulebook.chunkCount,
      },
    }, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(JSON.stringify({
      success: false,
      message: error.message,
      details: error.details || null,
    }, null, 2));
    process.exit(1);
  });
