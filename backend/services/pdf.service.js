const PDFDocument = require('pdfkit');

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function addSectionTitle(doc, title) {
  doc.moveDown();
  doc.font('Helvetica-Bold').fontSize(14).text(title);
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(11);
}

function addBulletList(doc, items = []) {
  if (!items.length) {
    doc.text('N/A');
    return;
  }

  items.forEach((item) => {
    doc.text(`• ${item}`, {
      indent: 12,
      paragraphGap: 6,
    });
  });
}

function addClauseList(doc, clauses = []) {
  if (!clauses.length) {
    doc.text('N/A');
    return;
  }

  clauses.forEach((clause, index) => {
    const clauseName = clause?.name || clause?.title || `Clause ${index + 1}`;
    const clauseRisk = clause?.risk || 'unknown';
    const clauseReason = clause?.reason || clause?.summary || 'No reason provided';

    doc
      .font('Helvetica-Bold')
      .text(`${index + 1}. ${clauseName} (${clauseRisk})`);
    doc
      .font('Helvetica')
      .text(`Reason: ${clauseReason}`, {
        indent: 14,
        paragraphGap: 8,
      });
  });
}

function generateInsightPdfBuffer(data = {}) {
  return new Promise((resolve, reject) => {
    try {
      const {
        title = 'Insight Report',
        summary = 'No summary provided.',
        nextSteps = [],
        priorityItems = [],
        highRiskClauses = [],
      } = data;

      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
      });

      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.font('Helvetica-Bold').fontSize(20).text('Legal Insight Report');
      doc.moveDown(0.5);

      doc.font('Helvetica').fontSize(12).text(`Contract: ${title}`);
      doc.moveDown();

      addSectionTitle(doc, 'Summary');
      doc.text(summary || 'No summary provided.', {
        paragraphGap: 8,
      });

      addSectionTitle(doc, 'Next Steps');
      addBulletList(doc, normalizeArray(nextSteps));

      addSectionTitle(doc, 'Priority Items');
      addBulletList(doc, normalizeArray(priorityItems));

      addSectionTitle(doc, 'High Risk Clauses');
      addClauseList(doc, normalizeArray(highRiskClauses));

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateInsightPdfBuffer,
};