const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');

/**
 * Content Extraction Service
 * Extracts and processes content from various file formats
 */

class ContentExtractionService {
  /**
   * Extract text from PDF
   */
  static async extractFromPDF(fileBuffer) {
    try {
      const data = await pdfParse(fileBuffer);
      
      return {
        text: data.text,
        pages: data.numpages,
        info: data.info,
        metadata: {
          pageCount: data.numpages,
          title: data.info?.Title,
          author: data.info?.Author,
        },
      };
    } catch (error) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from DOCX
   */
  static async extractFromDocx(fileBuffer) {
    try {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      
      return {
        text: result.value,
        messages: result.messages,
      };
    } catch (error) {
      throw new Error(`DOCX extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from image using OCR
   */
  static async extractFromImage(imagePath) {
    try {
      const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');
      
      return {
        text,
        confidence: 'variable', // Tesseract provides per-word confidence
      };
    } catch (error) {
      throw new Error(`OCR extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract from plain text file
   */
  static async extractFromText(fileBuffer) {
    try {
      const text = fileBuffer.toString('utf-8');
      
      return {
        text,
      };
    } catch (error) {
      throw new Error(`Text extraction failed: ${error.message}`);
    }
  }

  /**
   * Generic extraction based on MIME type
   */
  static async extractContent(fileBuffer, mimeType, fileName) {
    const lowerMimeType = mimeType.toLowerCase();

    if (lowerMimeType === 'application/pdf') {
      return await this.extractFromPDF(fileBuffer);
    } else if (lowerMimeType.includes('word') || fileName.endsWith('.docx')) {
      return await this.extractFromDocx(fileBuffer);
    } else if (lowerMimeType.startsWith('image/')) {
      // Save to temp and process
      const tempPath = `/tmp/${Date.now()}_${fileName}`;
      // Write buffer to temp file (implement as needed)
      return await this.extractFromImage(tempPath);
    } else if (lowerMimeType === 'text/plain') {
      return await this.extractFromText(fileBuffer);
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  }
}

module.exports = ContentExtractionService;
