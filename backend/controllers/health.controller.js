const { firebaseStatus } = require('../config/firebase');
const { env, featureFlags } = require('../config/env');

async function getMlServiceStatus() {
  try {
    const response = await fetch(env.mlServiceUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    return {
      enabled: true,
      required: env.requirePythonMlService,
      reachable: response.ok,
      target: `${env.mlServiceUrl}/analyze`,
      mode: 'python-ml-service',
    };
  } catch (error) {
    return {
      enabled: true,
      required: env.requirePythonMlService,
      reachable: false,
      target: `${env.mlServiceUrl}/analyze`,
      mode: env.requirePythonMlService ? 'python-ml-service-required' : 'python-ml-service-optional',
      message: error.message,
    };
  }
}

async function getHealth(req, res) {
  const mlServiceStatus = await getMlServiceStatus();

  res.json({
    success: true,
    service: 'legal-intelligence-backend',
    environment: env.nodeEnv,
    services: {
      firebase: firebaseStatus,
      mlService: mlServiceStatus,
      pinecone: {
        enabled: featureFlags.pinecone,
        mode: featureFlags.pinecone ? 'pinecone' : 'local-vector-fallback',
      },
      googleConnectors: {
        enabled: featureFlags.googleConnectors,
        mode: featureFlags.googleConnectors ? 'oauth-refresh-token' : 'disabled',
      },
      reasoning: {
        enabled: true,
        provider: featureFlags.externalGenAi ? env.genAiProvider : 'template',
      },
    },
  });
}

module.exports = {
  getHealth,
};
