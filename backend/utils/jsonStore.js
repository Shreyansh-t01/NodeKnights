const fs = require('node:fs/promises');
const path = require('node:path');

async function ensureDirectory(filePath) {
  console.log('went into jsonstore utils')
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  console.log("made directory for local storage")
}

async function readJsonFile(filePath, fallback) {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallback;
    }

    throw error;
  }
}

async function writeJsonFile(filePath, data) {
  await ensureDirectory(filePath);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = {
  readJsonFile,
  writeJsonFile,
  ensureDirectory,
};
