const natural = require('natural');

/**
 * NLP Processing Service
 * Handles text analysis, summarization, and entity extraction
 */

class NLPService {
  /**
   * Extract key entities from text
   */
  static async extractEntities(text) {
    try {
      // Tokenize
      const tokenizer = new natural.WordTokenizer();
      tokenizer.tokenize(text);

      // Simple entity extraction (for production, use spaCy or similar)
      const entities = [];
      
      // Extract basic patterns
      const emailPattern = /[\w.-]+@[\w.-]+\.\w+/g;
      const urlPattern = /https?:\/\/[^\s]+/g;
      const phonePattern = /\+?[\d\s\-()]{10,}/g;

      (text.match(emailPattern) || []).forEach(email => {
        entities.push({ name: email, type: 'EMAIL' });
      });

      (text.match(urlPattern) || []).forEach(url => {
        entities.push({ name: url, type: 'URL' });
      });

      (text.match(phonePattern) || []).forEach(phone => {
        entities.push({ name: phone, type: 'PHONE' });
      });

      return entities;
    } catch (error) {
      throw new Error(`Entity extraction failed: ${error.message}`);
    }
  }

  /**
   * Analyze sentiment
   */
  static async analyzeSentiment(text) {
    try {
      const analyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
      const tokenizer = new natural.WordTokenizer();
      const tokens = tokenizer.tokenize(text.toLowerCase());

      const score = analyzer.getSentiment(tokens);
      
      let label = 'neutral';
      if (score > 0.1) label = 'positive';
      else if (score < -0.1) label = 'negative';

      return {
        score: score, // -1 to 1
        label: label,
        tokens: tokens.length,
      };
    } catch (error) {
      throw new Error(`Sentiment analysis failed: ${error.message}`);
    }
  }

  /**
   * Extract keywords
   */
  static extractKeywords(text, limit = 10) {
    try {
      const tokenizer = new natural.WordTokenizer();
      const tokens = tokenizer.tokenize(text.toLowerCase());

      // Remove common stop words
      const stopWords = new natural.StopWordsEn();
      const filtered = tokens.filter(token => !stopWords.words.includes(token) && token.length > 3);   // stop words remove karne ke liye likha hai

      // Calculate frequency
      const frequency = {};
      filtered.forEach(token => {
        frequency[token] = (frequency[token] || 0) + 1;
      });

      // Sort by frequency
      const keywords = Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([keyword, freq]) => ({ keyword, frequency: freq }));

      return keywords;
    } catch (error) {
      throw new Error(`Keyword extraction failed: ${error.message}`);
    }
  }

  /**
   * Summarize text
   */
  static summarizeText(text, sentenceCount = 3) {
    try {
      const tokenizer = new natural.SentenceTokenizer();
      const sentences = tokenizer.tokenize(text);

      if (sentences.length <= sentenceCount) {
        return text;
      }

      // Calculate sentence scores based on keyword frequency
      const keywords = this.extractKeywords(text, 20);
      const keywordSet = new Set(keywords.map(k => k.keyword));

      const scores = sentences.map(sentence => {
        const words = sentence.toLowerCase().split(/\s+/);
        const matches = words.filter(w => keywordSet.has(w)).length;
        return { sentence: sentence.trim(), score: matches };
      });

      // Get top sentences in original order
      const topSentences = scores
        .sort((a, b) => b.score - a.score)
        .slice(0, sentenceCount)
        .sort((a, b) => {
          return sentences.indexOf(a.sentence) - sentences.indexOf(b.sentence);
        })
        .map(s => s.sentence);

      return topSentences.join(' ');
    } catch (error) {
      throw new Error(`Summarization failed: ${error.message}`);
    }
  }

  /**
   * Detect language
   */
  static detectLanguage(text) {
    try {
      // Simple language detection (for production, use langdetect or similar)
      const englishWords = ['the', 'a', 'an', 'and', 'or', 'is', 'are', 'was', 'were'];
      const words = text.toLowerCase().split(/\s+/);
      const englishMatches = words.filter(w => englishWords.includes(w)).length;
      
      if (englishMatches / words.length > 0.1) {
        return 'en';
      }
      return 'unknown';
    } catch (error) {
      throw new Error(`Language detection failed: ${error.message}`);
    }
  }
}

module.exports = NLPService;
