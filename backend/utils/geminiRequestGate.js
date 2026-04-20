const { env } = require('../config/env');

const maxConcurrentRequests = Math.max(1, Number(env.genAiMaxConcurrentRequests) || 1);
let activeRequestCount = 0;
const waitingResolvers = [];

async function acquireGeminiRequestSlot() {
  if (activeRequestCount < maxConcurrentRequests) {
    activeRequestCount += 1;
    return;
  }

  await new Promise((resolve) => {
    waitingResolvers.push(resolve);
  });
}

function releaseGeminiRequestSlot() {
  activeRequestCount = Math.max(0, activeRequestCount - 1);

  if (!waitingResolvers.length || activeRequestCount >= maxConcurrentRequests) {
    return;
  }

  activeRequestCount += 1;
  const nextResolver = waitingResolvers.shift();
  nextResolver();
}

async function withGeminiRequestSlot(task) {
  await acquireGeminiRequestSlot();

  try {
    return await task();
  } finally {
    releaseGeminiRequestSlot();
  }
}

module.exports = {
  withGeminiRequestSlot,
};
