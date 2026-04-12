require('dotenv').config();
const http = require('node:http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { env } = require('./config/env');
const healthRoutes = require('./routes/health.routes');
const contractRoutes = require('./routes/contract.routes');
const connectorRoutes = require('./routes/connector.routes');
const notificationRoutes = require('./routes/notification.routes');
const searchRoutes = require('./routes/search.routes');
const documentRoutes = require('./routes/document.routes');
const precedentRoutes = require('./routes/precedent.routes');
const knowledgeRoutes = require('./routes/knowledge.routes');
const { syncSearchIndexes } = require('./services/searchIndex.service');
const { bootstrapDriveWatchAutomation } = require('./services/drive.service');
const { bootstrapGmailPollingAutomation } = require('./services/gmail.service');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const corsOrigin = env.corsOrigin === '*'
  ? true
  : env.corsOrigin.split(',').map((value) => value.trim()).filter(Boolean);

app.use(helmet());
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    service: 'legal-intelligence-backend',
    status: 'running',
    docs: {
      health: `${env.apiPrefix}/health`,
      contracts: `${env.apiPrefix}/contracts`,
      connectors: `${env.apiPrefix}/connectors`,
      notifications: `${env.apiPrefix}/notifications`,
      search: `${env.apiPrefix}/search`,
      documents: `${env.apiPrefix}/documents`,
      precedents: `${env.apiPrefix}/precedents`,
      knowledge: `${env.apiPrefix}/knowledge`,
    },
  });
});

app.use(`${env.apiPrefix}/health`, healthRoutes);
app.use(`${env.apiPrefix}/contracts`, contractRoutes);
app.use(`${env.apiPrefix}/connectors`, connectorRoutes);
app.use(`${env.apiPrefix}/notifications`, notificationRoutes);
app.use(`${env.apiPrefix}/search`, searchRoutes);
app.use(`${env.apiPrefix}/documents`, documentRoutes);
app.use(`${env.apiPrefix}/precedents`, precedentRoutes);
app.use(`${env.apiPrefix}/knowledge`, knowledgeRoutes);

app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);

server.listen(env.port, () => {
  console.log(`Legal intelligence backend listening on port ${env.port}`);

  Promise.allSettled([
    bootstrapDriveWatchAutomation(),
    bootstrapGmailPollingAutomation(),
  ]).then((results) => {
    const [driveResult, gmailResult] = results;

    if (driveResult.status === 'fulfilled' && driveResult.value?.enabled) {
      console.log(`Drive watch automation enabled for folders: ${driveResult.value.folderIds.join(', ')}`);
    } else if (driveResult.status === 'rejected') {
      console.error('Drive watch automation startup failed:', driveResult.reason?.message || driveResult.reason);
    }

    if (gmailResult.status === 'fulfilled' && gmailResult.value?.enabled) {
      console.log(`Gmail polling enabled every ${gmailResult.value.intervalMs}ms for query: ${gmailResult.value.query}`);
    } else if (gmailResult.status === 'rejected') {
      console.error('Gmail polling startup failed:', gmailResult.reason?.message || gmailResult.reason);
    }
  });

  syncSearchIndexes()
    .then((result) => {
      console.log(`Search indexes refreshed: ${result.contracts.vectorCount} contract vectors, ${result.precedents.vectorCount} precedent vectors, ${result.knowledge.vectorCount + (result.rulebook.chunkCount || 0)} knowledge vectors.`);
    })
    .catch((error) => {
      console.error('Search index refresh failed:', error.message);
    });
});

server.on('error', (error) => {
  console.error('Server startup error:', error);
  process.exit(1);
});
