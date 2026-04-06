const pdfParseModule = require('pdf-parse');
const Tesseract = require('tesseract.js');

const AppError = require('../errors/AppError');

const legacyPdfParse = typeof pdfParseModule === 'function' ? pdfParseModule : null;
const PDFParse = typeof pdfParseModule.PDFParse === 'function' ? pdfParseModule.PDFParse : null;

function normalizeText(text = '') {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractFromPdf(buffer) {
  try {
    if (legacyPdfParse) {
      const result = await legacyPdfParse(buffer);

      return {
        text: normalizeText(result.text),
        method: 'pdf-parse-v1',
        pages: result.numpages || result.total || result.pages?.length || null,
      };
    }

    if (PDFParse) {
      const parser = new PDFParse({ data: buffer });

      try {
        const result = await parser.getText({ pageJoiner: '' });

        return {
          text: normalizeText(result.text),
          method: 'pdf-parse-v2',
          pages: result.total || result.numpages || result.pages?.length || null,
        };
      } finally {
        await parser.destroy().catch(() => {});
      }
    }

    throw new Error('Unsupported pdf-parse export shape.');
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(422, 'The uploaded PDF could not be parsed. Try a text-based PDF or a clearer scan.', {
      originalError: error.message,
    });
  }
}

async function extractFromImage(buffer) {
  const result = await Tesseract.recognize(buffer, 'eng');

  return {
    text: normalizeText(result.data.text),
    method: 'tesseract-ocr',
    confidence: result.data.confidence || null,
  };
}

async function extractTextFromDocument(file) {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    throw new AppError(400, 'The uploaded file could not be read. Please upload it again.');
  }

  const mimetype = file.mimetype || '';
  let result;

  if (mimetype === 'application/pdf') {
    result = await extractFromPdf(file.buffer);
  } else if (mimetype.startsWith('image/')) {
    result = await extractFromImage(file.buffer);
  } else {
    result = {
      text: normalizeText(file.buffer.toString('utf-8')),
      method: 'plain-text',
    };
  }

  if (!result.text || result.text.length < 20) {
    throw new AppError(422, 'The uploaded document did not contain enough readable text for analysis.');
  }

  return result;
}

module.exports = {
  extractTextFromDocument,
};
