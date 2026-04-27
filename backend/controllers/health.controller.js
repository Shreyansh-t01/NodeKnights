const { firestore, firestoreStatus, firebaseStatus } = require('../config/firebase');
const { supabase, supabaseStatus } = require('../config/supabase');
const { env, featureFlags } = require('../config/env');
const { getDriveWatchStatus } = require('../services/drive.service');
const { getGmailPollStatus } = require('../services/gmail.service');
const { getGoogleConnectorStatus } = require('../services/googleAuth.service');

function buildPineconeBaseUrl() {
  return env.pineconeIndexHost.startsWith('http')
    ? env.pineconeIndexHost
    : `https://${env.pineconeIndexHost}`;
}

function pineconeHeaders(contentType = 'application/json') {
  return {
    'Content-Type': contentType,
    'Api-Key': env.pineconeApiKey,
    'X-Pinecone-Api-Version': env.pineconeApiVersion,
  };
}

function makeHealthCheckId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getFirestoreDependencyStatus() {
  if (!firestoreStatus.enabled || !firestore) {
    return {
      configured: false,
      checked: false,
      reachable: false,
      mode: firestoreStatus.mode,
      message: firestoreStatus.message,
    };
  }

  const docId = makeHealthCheckId('firestore');
  const docRef = firestore.collection('_healthchecks').doc(docId);

  try {
    await docRef.set({
      createdAt: new Date().toISOString(),
      source: 'dependency-health-check',
    });

    const snapshot = await docRef.get();

    return {
      configured: true,
      checked: true,
      reachable: snapshot.exists,
      writeVerified: snapshot.exists,
      mode: 'firestore',
      target: `_healthchecks/${docId}`,
    };
  } catch (error) {
    return {
      configured: true,
      checked: true,
      reachable: false,
      writeVerified: false,
      mode: 'firestore',
      message: error.message,
    };
  } finally {
    await docRef.delete().catch(() => {});
  }
}

async function getSupabaseDependencyStatus() {
  if (!supabaseStatus.enabled || !supabase) {
    return {
      configured: false,
      checked: false,
      reachable: false,
      mode: supabaseStatus.mode,
      message: supabaseStatus.message,
    };
  }

  const filePath = `health-check/${makeHealthCheckId('supabase')}.txt`;

  try {
    const { error: uploadError } = await supabase
      .storage
      .from(env.supabaseStorageBucket)
      .upload(filePath, Buffer.from('dependency-health-check'), {
        contentType: 'text/plain',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message || 'Supabase upload failed.');
    }

    const { error: removeError } = await supabase
      .storage
      .from(env.supabaseStorageBucket)
      .remove([filePath]);

    return {
      configured: true,
      checked: true,
      reachable: true,
      writeVerified: true,
      mode: 'supabase',
      target: `supabase://${env.supabaseStorageBucket}/${filePath}`,
      cleanup: removeError ? 'delete-failed' : 'deleted',
      cleanupMessage: removeError ? removeError.message : null,
    };
  } catch (error) {
    return {
      configured: true,
      checked: true,
      reachable: false,
      writeVerified: false,
      mode: 'supabase',
      message: error.message,
    };
  }
}

async function getPineconeDependencyStatus() {
  if (!featureFlags.pinecone) {
    return {
      configured: false,
      checked: false,
      reachable: false,
      mode: 'disabled',
      message: 'Pinecone is not configured.',
    };
  }

  const id = makeHealthCheckId('pinecone');
  const usesIntegratedText = env.embeddingProvider === 'pinecone';

  try {
    if (usesIntegratedText) {
      const upsertResponse = await fetch(
        `${buildPineconeBaseUrl()}/records/namespaces/${encodeURIComponent(env.pineconeContractNamespace)}/upsert`,
        {
          method: 'POST',
          headers: pineconeHeaders('application/x-ndjson'),
          body: `${JSON.stringify({
            _id: id,
            [env.pineconeTextField]: 'dependency health check contract clause',
            source: 'dependency-health-check',
            healthCheckId: id,
            corpusType: 'contract_clause',
          })}\n`,
        },
      );

      if (!upsertResponse.ok) {
        throw new Error(`Pinecone text upsert failed with ${upsertResponse.status}`);
      }
    } else {
      const vector = Array.from({ length: env.embeddingDimension }, (_, index) => (index === 0 ? 1 : 0));
      const upsertResponse = await fetch(`${buildPineconeBaseUrl()}/vectors/upsert`, {
        method: 'POST',
        headers: pineconeHeaders(),
        body: JSON.stringify({
          namespace: env.pineconeContractNamespace,
          vectors: [
            {
              id,
              values: vector,
              metadata: {
                source: 'dependency-health-check',
                healthCheckId: id,
              },
            },
          ],
        }),
      });

      if (!upsertResponse.ok) {
        throw new Error(`Pinecone upsert failed with ${upsertResponse.status}`);
      }
    }

    let matched = false;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const queryResponse = usesIntegratedText
        ? await fetch(
          `${buildPineconeBaseUrl()}/records/namespaces/${encodeURIComponent(env.pineconeContractNamespace)}/search`,
          {
            method: 'POST',
            headers: {
              ...pineconeHeaders(),
              Accept: 'application/json',
            },
            body: JSON.stringify({
              query: {
                inputs: {
                  text: 'dependency health check contract clause',
                },
                top_k: 1,
                filter: {
                  healthCheckId: {
                    $eq: id,
                  },
                },
              },
            }),
          },
        )
        : await fetch(`${buildPineconeBaseUrl()}/query`, {
          method: 'POST',
          headers: pineconeHeaders(),
          body: JSON.stringify({
            namespace: env.pineconeContractNamespace,
            vector: Array.from({ length: env.embeddingDimension }, (_, index) => (index === 0 ? 1 : 0)),
            topK: 1,
            includeMetadata: true,
            filter: {
              healthCheckId: {
                $eq: id,
              },
            },
          }),
        });

      if (!queryResponse.ok) {
        throw new Error(`Pinecone query failed with ${queryResponse.status}`);
      }

      const queryPayload = await queryResponse.json();
      matched = usesIntegratedText
        ? (Array.isArray(queryPayload?.result?.hits)
          && queryPayload.result.hits.some((match) => match._id === id))
        : (Array.isArray(queryPayload.matches)
          && queryPayload.matches.some((match) => match.id === id));

      if (matched) {
        break;
      }

      await delay(500);
    }

    const deleteResponse = await fetch(`${buildPineconeBaseUrl()}/vectors/delete`, {
      method: 'POST',
      headers: pineconeHeaders(),
      body: JSON.stringify({
        namespace: env.pineconeContractNamespace,
        ids: [id],
      }),
    });

    return {
      configured: true,
      checked: true,
      reachable: true,
      writeVerified: true,
      queryVerified: matched,
      mode: usesIntegratedText ? 'pinecone-integrated' : 'pinecone',
      namespace: env.pineconeContractNamespace,
      cleanup: deleteResponse.ok ? 'deleted' : 'delete-failed',
    };
  } catch (error) {
    return {
      configured: true,
      checked: true,
      reachable: false,
      writeVerified: false,
      queryVerified: false,
      mode: 'pinecone',
      message: error.message,
    };
  }
}

async function getMlServiceStatus(options = {}) {
  const timeoutMs = Math.max(
    1000,
    Number(options.timeoutMs || Math.min(env.remoteServiceTimeoutMs, 3000)) || 3000,
  );
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(env.mlServiceUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    let payload = null;

    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }
    const predictorReady = payload?.predictorReady !== false;

    return {
      enabled: true,
      required: env.requirePythonMlService,
      reachable: response.ok && predictorReady,
      target: `${env.mlServiceUrl}/analyze`,
      mode: 'python-ml-service',
      predictorReady,
      message: payload?.error || null,
    };
  } catch (error) {
    const message = error.name === 'AbortError'
      ? `ML service health check timed out after ${timeoutMs}ms.`
      : error.message;

    return {
      enabled: true,
      required: env.requirePythonMlService,
      reachable: false,
      target: `${env.mlServiceUrl}/analyze`,
      mode: env.requirePythonMlService ? 'python-ml-service-required' : 'python-ml-service-optional',
      message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getHealth(req, res) {
  const [mlServiceStatus, googleStatus, driveStatus, gmailStatus] = await Promise.all([
    getMlServiceStatus(),
    getGoogleConnectorStatus(),
    getDriveWatchStatus({ includeState: false }),
    getGmailPollStatus({ includeState: false }),
  ]);
  const workspaceRecipientConfigured = String(env.googleWorkspaceUser || '').includes('@');

  res.json({
    success: true,
    service: 'legal-intelligence-backend',
    environment: env.nodeEnv,
    strictRemoteServices: env.strictRemoteServices,
    services: {
      firestore: firestoreStatus,
      firebase: firebaseStatus,
      artifactStorage: {
        enabled: env.artifactStorageMode === 'local'
          || (env.artifactStorageMode === 'supabase' && supabaseStatus.enabled),
        mode: env.artifactStorageMode,
      },
      supabaseStorage: supabaseStatus,
      mlService: mlServiceStatus,
      pinecone: {
        enabled: featureFlags.pinecone,
        mode: featureFlags.pinecone
          ? (featureFlags.pineconeIntegratedEmbedding ? 'pinecone-integrated' : 'pinecone')
          : 'local-vector-fallback',
        embeddingProvider: env.embeddingProvider,
        embeddingModel: env.pineconeIntegratedModel || null,
        namespaces: {
          contracts: env.pineconeContractNamespace,
          precedents: env.pineconePrecedentNamespace,
          knowledge: env.pineconeKnowledgeNamespace,
        },
      },
      googleConnectors: {
        enabled: featureFlags.googleConnectors,
        connected: googleStatus.connected,
        tokenSource: googleStatus.tokenSource,
        redirectUri: googleStatus.redirectUri,
        mode: featureFlags.googleConnectors ? 'oauth-browser-flow' : 'disabled',
        drive: driveStatus,
        gmail: gmailStatus,
        notifications: {
          enabled: env.notificationEmailEnabled,
          transport: featureFlags.googleConnectors ? 'gmail-api' : 'disabled',
          recipientsConfigured: env.notificationEmailRecipients.length > 0 || workspaceRecipientConfigured,
          recipientCount: env.notificationEmailRecipients.length || (workspaceRecipientConfigured ? 1 : 0),
        },
      },
      reasoning: {
        enabled: featureFlags.externalGenAi,
        provider: featureFlags.externalGenAi ? env.genAiProvider : 'template',
        configuredProvider: env.genAiProvider,
        model: featureFlags.externalGenAi ? env.genAiModel : null,
        mode: featureFlags.externalGenAi ? 'external-genai' : 'template-fallback',
      },
    },
  });
}

async function getDependencyHealth(req, res) {
  const [firestoreCheck, supabaseCheck, pineconeCheck] = await Promise.all([
    getFirestoreDependencyStatus(),
    getSupabaseDependencyStatus(),
    getPineconeDependencyStatus(),
  ]);

  const allHealthy = [firestoreCheck, supabaseCheck, pineconeCheck]
    .filter((check) => check.configured)
    .every((check) => check.reachable);

  res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    checkedAt: new Date().toISOString(),
    strictRemoteServices: env.strictRemoteServices,
    dependencies: {
      firestore: firestoreCheck,
      supabase: supabaseCheck,
      pinecone: pineconeCheck,
    },
  });
}

module.exports = {
  getHealth,
  getDependencyHealth,
};
