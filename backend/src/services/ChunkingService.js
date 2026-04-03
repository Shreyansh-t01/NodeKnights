const NLPService = require('./NLPService');
const { logger } = require('../utils');

/**
 * Chunking Service
 * Handles text chunking and clause identification
 */

class ChunkingService {
  /**
   * Chunk text into smaller pieces
   */
  static chunkText(text, options = {}) {
    const {
      chunkSize = 1000, // characters
      overlap = 200, // overlap between chunks
      method = 'fixed_size', // 'fixed_size', 'sentence', 'paragraph', 'semantic'
      maxChunks = 100,
    } = options;

    if (!text || text.trim().length === 0) {
      return [];
    }

    const chunks = [];
    let start = 0;
    let chunkIndex = 0;

    switch (method) {
    case 'sentence':
      return this.chunkBySentences(text, maxChunks);

    case 'paragraph':
      return this.chunkByParagraphs(text, maxChunks);

    case 'semantic':
      return this.chunkSemantically(text, maxChunks);

    case 'fixed_size':
    default:
      while (start < text.length && chunks.length < maxChunks) {
        let end = Math.min(start + chunkSize, text.length);

        // Try to end at a word boundary
        if (end < text.length) {
          const lastSpace = text.lastIndexOf(' ', end);
          if (lastSpace > start + chunkSize * 0.8) {
            end = lastSpace;
          }
        }

        const chunkText = text.slice(start, end).trim();
        if (chunkText.length > 0) {
          chunks.push({
            content: chunkText,
            chunkIndex,
            chunkType: 'fixed_size',
            metadata: {
              startPosition: start,
              endPosition: start + chunkText.length,
              wordCount: chunkText.split(/\s+/).length,
              sentenceCount: this.countSentences(chunkText),
            },
          });
          chunkIndex++;
        }

        // Move start position with overlap
        start = Math.max(start + 1, end - overlap);
      }
      break;
    }

    return chunks;
  }

  /**
   * Chunk text by sentences
   */
  static chunkBySentences(text, maxChunks = 100) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks = [];
    let currentChunk = '';
    let currentPos = 0;
    let chunkIndex = 0;

    for (let i = 0; i < sentences.length && chunks.length < maxChunks; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;

      const sentenceWithPeriod = sentence.endsWith('.') ? sentence : `${sentence}.`;
      const potentialChunk = currentChunk ? `${currentChunk} ${sentenceWithPeriod}` : sentenceWithPeriod;

      // If adding this sentence would make the chunk too long, create a chunk with current content
      if (potentialChunk.length > 800 && currentChunk) {
        // Find the actual position of currentChunk in the text
        const startPos = text.indexOf(currentChunk.trim(), currentPos);

        chunks.push({
          content: currentChunk.trim(),
          chunkIndex,
          chunkType: 'sentence',
          metadata: {
            startPosition: startPos,
            endPosition: startPos + currentChunk.trim().length,
            wordCount: currentChunk.trim().split(/\s+/).length,
            sentenceCount: this.countSentences(currentChunk.trim()),
          },
        });
        chunkIndex++;
        currentPos = startPos + currentChunk.trim().length + 1; // +1 for separator
        currentChunk = sentenceWithPeriod;
      } else {
        currentChunk = potentialChunk;
      }

      // If this is the last sentence, create a chunk with whatever we have
      if (i === sentences.length - 1 && currentChunk) {
        const startPos = text.indexOf(currentChunk.trim(), currentPos);

        chunks.push({
          content: currentChunk.trim(),
          chunkIndex,
          chunkType: 'sentence',
          metadata: {
            startPosition: startPos !== -1 ? startPos : currentPos,
            endPosition: (startPos !== -1 ? startPos : currentPos) + currentChunk.trim().length,
            wordCount: currentChunk.trim().split(/\s+/).length,
            sentenceCount: this.countSentences(currentChunk.trim()),
          },
        });
      }
    }

    return chunks;
  }

  /**
   * Chunk text by paragraphs
   */
  static chunkByParagraphs(text, maxChunks = 100) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const chunks = [];
    let currentPos = 0;
    let chunkIndex = 0;

    for (let i = 0; i < paragraphs.length && chunks.length < maxChunks; i++) {
      const paragraph = paragraphs[i].trim();
      if (!paragraph) continue;

      // Find the actual position of this paragraph in the text
      const startPos = text.indexOf(paragraph, currentPos);

      chunks.push({
        content: paragraph,
        chunkIndex,
        chunkType: 'paragraph',
        metadata: {
          startPosition: startPos,
          endPosition: startPos + paragraph.length,
          wordCount: paragraph.split(/\s+/).length,
          sentenceCount: this.countSentences(paragraph),
        },
      });

      chunkIndex++;
      // Update position for next search (account for the paragraph + separator)
      currentPos = startPos + paragraph.length + 1; // At least +1 for the separator
    }

    return chunks;
  }

  /**
   * Semantic chunking (basic implementation)
   */
  static chunkSemantically(text, maxChunks = 100) {
    // For now, use sentence-based chunking with semantic grouping
    // In a real implementation, this would use embeddings or topic modeling
    return this.chunkBySentences(text, maxChunks);
  }

  /**
   * Extract clauses from text
   */
  static async extractClauses(text, documentType = 'general') {
    const clauses = [];

    // Basic clause identification patterns
    const patterns = {
      legal: [
        /(?:Article|Section|Clause)\s+(\d+(?:\.\d+)*)/gi,
        /(?:^\d+\.|\(\d+\))/gm,
        /(?:Terms|Conditions|Rights|Obligations|Definitions)/gi,
      ],
      contractual: [
        /(?:Party|Parties|Agreement|Contract|Terms)/gi,
        /(?:shall|will|must|agree to)/gi,
        /(?:payment|fee|compensation|consideration)/gi,
      ],
      general: [
        /^[A-Z][^.!?]*[:.]/gm, // Headings
        /(?:Chapter|Part|Division)\s+\d+/gi,
      ],
    };

    const applicablePatterns = patterns[documentType] || patterns.general;
    let clauseIndex = 1;
    let currentPos = 0;

    // Split text into potential sections
    const sections = text.split(/\n\s*\n/).filter(s => s.trim().length > 10);

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim();
      const startPos = text.indexOf(section, currentPos);

      // Check if section matches clause patterns
      const matches = applicablePatterns.some(pattern => pattern.test(section));

      if (matches || section.length > 200) { // Long sections are likely clauses
        const title = this.extractClauseTitle(section);
        const clauseType = this.determineClauseType(section, documentType);

        clauses.push({
          title: title || `Clause ${clauseIndex}`,
          content: section,
          clauseType,
          clauseNumber: clauseIndex.toString(),
          metadata: {
            startPosition: startPos,
            endPosition: startPos + section.length,
            wordCount: section.split(/\s+/).length,
            importance: this.calculateImportance(section),
            category: this.categorizeClause(section),
          },
        });

        clauseIndex++;
      }

      // Update position for next search (account for the section + \n\n)
      currentPos = startPos + section.length + 2;
    }

    return clauses;
  }

  /**
   * Extract clause title
   */
  static extractClauseTitle(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const firstLine = lines[0];

    // Check if first line looks like a title
    if (firstLine && firstLine.length < 100 && /^[A-Z]/.test(firstLine)) {
      return firstLine.replace(/[:.]$/, '');
    }

    return null;
  }

  /**
   * Determine clause type
   */
  static determineClauseType(text, documentType) {
    const lowerText = text.toLowerCase();

    if (documentType === 'legal') {
      if (lowerText.includes('definition')) return 'definition';
      if (lowerText.includes('term') || lowerText.includes('condition')) return 'terms';
      if (lowerText.includes('right') || lowerText.includes('obligation')) return 'contractual';
    }

    if (lowerText.includes('article') || lowerText.includes('section')) return 'legal';
    if (lowerText.includes('shall') || lowerText.includes('must') || lowerText.includes('agree')) return 'contractual';

    return 'section';
  }

  /**
   * Calculate clause importance
   */
  static calculateImportance(text) {
    const lowerText = text.toLowerCase();
    let score = 0.5; // Base score

    // Increase score for legal/contractual keywords
    const keywords = ['shall', 'must', 'agree', 'obligation', 'liability', 'termination', 'breach'];
    keywords.forEach(keyword => {
      if (lowerText.includes(keyword)) score += 0.1;
    });

    // Increase score for monetary terms
    if (/\$\d+|\d+\s+dollar/.test(lowerText)) score += 0.2;

    return Math.min(1.0, score);
  }

  /**
   * Categorize clause
   */
  static categorizeClause(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('payment') || lowerText.includes('fee') || lowerText.includes('compensation')) {
      return 'financial';
    }
    if (lowerText.includes('term') || lowerText.includes('duration') || lowerText.includes('period')) {
      return 'temporal';
    }
    if (lowerText.includes('confidential') || lowerText.includes('privacy') || lowerText.includes('data')) {
      return 'confidentiality';
    }
    if (lowerText.includes('liability') || lowerText.includes('warranty') || lowerText.includes('indemnification')) {
      return 'liability';
    }

    return 'general';
  }

  /**
   * Count sentences in text
   */
  static countSentences(text) {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  }

  /**
   * Process chunks with NLP
   */
  static async enrichChunks(chunks) {
    const enrichedChunks = [];

    for (const chunk of chunks) {
      try {
        const sentiment = await NLPService.analyzeSentiment(chunk.content);
        const keywords = NLPService.extractKeywords(chunk.content);
        const entities = await NLPService.extractEntities(chunk.content);

        enrichedChunks.push({
          ...chunk,
          processing: {
            keywords,
            entities,
            sentiment,
          },
          status: {
            state: 'completed',
          },
        });
      } catch (error) {
        logger.error('Error enriching chunk', error);
        enrichedChunks.push({
          ...chunk,
          status: {
            state: 'failed',
            error: error.message,
          },
        });
      }
    }

    return enrichedChunks;
  }

  /**
   * Process clauses with NLP
   */
  static async enrichClauses(clauses) {
    const enrichedClauses = [];

    for (const clause of clauses) {
      try {
        const summary = NLPService.summarizeText(clause.content);
        const keywords = NLPService.extractKeywords(clause.content);
        const entities = await NLPService.extractEntities(clause.content);
        const sentiment = await NLPService.analyzeSentiment(clause.content);

        enrichedClauses.push({
          ...clause,
          processing: {
            summary,
            keywords,
            entities,
            sentiment,
          },
          status: {
            state: 'completed',
          },
        });
      } catch (error) {
        logger.error('Error enriching clause', error);
        enrichedClauses.push({
          ...clause,
          status: {
            state: 'failed',
            error: error.message,
          },
        });
      }
    }

    return enrichedClauses;
  }
}

module.exports = ChunkingService;