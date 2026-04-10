require('dotenv').config();
const http = require('node:http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { env } = require('./config/env');
const healthRoutes = require('./routes/health.routes');
const contractRoutes = require('./routes/contract.routes');
const connectorRoutes = require('./routes/connector.routes');
const searchRoutes = require('./routes/search.routes');
const documentRoutes = require('./routes/document.routes');
const precedentRoutes = require('./routes/precedent.routes');
const knowledgeRoutes = require('./routes/knowledge.routes');
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
app.use(`${env.apiPrefix}/search`, searchRoutes);
app.use(`${env.apiPrefix}/documents`, documentRoutes);
app.use(`${env.apiPrefix}/precedents`, precedentRoutes);
app.use(`${env.apiPrefix}/knowledge`, knowledgeRoutes);

app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);

server.listen(env.port, () => {
  console.log(`Legal intelligence backend listening on port ${env.port}`);
});

server.on('error', (error) => {
  console.error('Server startup error:', error);
  process.exit(1);
});
