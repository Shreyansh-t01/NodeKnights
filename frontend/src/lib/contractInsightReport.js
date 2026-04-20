const PDF_PAGE_WIDTH = 595.28;
const PDF_PAGE_HEIGHT = 841.89;
const PDF_MARGIN_X = 48;
const PDF_MARGIN_TOP = 52;
const PDF_MARGIN_BOTTOM = 56;
const PDF_CONTENT_WIDTH = PDF_PAGE_WIDTH - (PDF_MARGIN_X * 2);
const FONT_REGULAR = 'regular';
const FONT_BOLD = 'bold';

const measureContext = (() => {
  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  return canvas.getContext('2d');
})();

function formatClauseType(value = 'Clause') {
  return String(value || 'Clause').replace(/_/g, ' ');
}

function renderClauseBody(clause, fallback = 'Clause text is unavailable.') {
  return clause?.clauseTextFull || clause?.clauseTextSummary || clause?.clauseText || fallback;
}

function getInsightNotice(contract, insights) {
  const step = (contract?.pipeline || []).find((item) => item.key === 'insights');

  if (step && ['warning', 'failed'].includes(step.status)) {
    return step.detail || 'Gemini insights are not generated yet for this contract.';
  }

  if (insights?.degraded && insights?.geminiError) {
    return 'Gemini insights are not generated yet for this contract.';
  }

  return '';
}

function normalizePdfText(value = '') {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u2018|\u2019/g, '\'')
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00a0/g, ' ')
    .replace(/\u00a7/g, 'Section')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
}

function escapePdfText(value = '') {
  return normalizePdfText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function textToPdfBytes(value = '') {
  return Uint8Array.from([...value].map((character) => character.charCodeAt(0)));
}

function byteLength(value = '') {
  return textToPdfBytes(value).length;
}

function measureText(text, size, font) {
  const safeText = normalizePdfText(text);

  if (!safeText) {
    return 0;
  }

  if (!measureContext) {
    return safeText.length * size * 0.53;
  }

  measureContext.font = `${font === FONT_BOLD ? '700' : '400'} ${size}px Helvetica, Arial, sans-serif`;
  return measureContext.measureText(safeText).width;
}

function splitLongToken(token, maxWidth, size, font) {
  const chunks = [];
  let current = '';

  for (const character of token) {
    const nextValue = `${current}${character}`;

    if (current && measureText(nextValue, size, font) > maxWidth) {
      chunks.push(current);
      current = character;
    } else {
      current = nextValue;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.length ? chunks : [''];
}

function wrapText(text, options = {}) {
  const {
    size = 10.5,
    font = FONT_REGULAR,
    prefix = '',
    indent = 0,
  } = options;

  const normalized = normalizePdfText(text).replace(/\t/g, '  ');
  const prefixWidth = prefix ? measureText(prefix, size, font) : 0;
  const continuationIndent = prefix ? prefixWidth : 0;
  const segments = normalized.split('\n');
  const lines = [];

  segments.forEach((segment, segmentIndex) => {
    const words = segment.trim().split(/\s+/).filter(Boolean);

    if (!words.length) {
      if (segmentIndex < segments.length - 1) {
        lines.push({ text: '', xOffset: indent });
      }
      return;
    }

    let current = '';
    let firstLine = true;

    words.forEach((word) => {
      const currentIndent = indent + (firstLine ? 0 : continuationIndent);
      const currentPrefix = firstLine ? prefix : '';
      const trial = current ? `${current} ${word}` : word;
      const renderedTrial = `${currentPrefix}${trial}`;

      if (measureText(renderedTrial, size, font) <= (PDF_CONTENT_WIDTH - currentIndent)) {
        current = trial;
        return;
      }

      if (current) {
        lines.push({
          text: `${currentPrefix}${current}`,
          xOffset: currentIndent,
          size,
          font,
        });

        current = '';
        firstLine = false;
      }

      const activeIndent = indent + (firstLine ? 0 : continuationIndent);
      const activePrefix = firstLine ? prefix : '';
      const activeWidth = firstLine
        ? Math.max(PDF_CONTENT_WIDTH - activeIndent - prefixWidth, 24)
        : Math.max(PDF_CONTENT_WIDTH - activeIndent, 24);

      if (measureText(word, size, font) <= activeWidth) {
        current = word;
        return;
      }

      splitLongToken(word, activeWidth, size, font).forEach((chunk, chunkIndex, chunks) => {
        const chunkIndent = indent + (firstLine ? 0 : continuationIndent);
        const chunkPrefix = firstLine ? prefix : '';

        if (chunkIndex === chunks.length - 1) {
          current = chunk;
          return;
        }

        lines.push({
          text: `${chunkPrefix}${chunk}`,
          xOffset: chunkIndent,
          size,
          font,
        });

        firstLine = false;
      });
    });

    if (current) {
      const currentIndent = indent + (firstLine ? 0 : continuationIndent);
      const currentPrefix = firstLine ? prefix : '';
      lines.push({
        text: `${currentPrefix}${current}`,
        xOffset: currentIndent,
        size,
        font,
      });
    }

    if (segmentIndex < segments.length - 1) {
      lines.push({ text: '', xOffset: indent, size, font });
    }
  });

  return lines;
}

function buildTextBlock(text, options = {}) {
  return {
    type: 'text',
    text,
    font: options.font || FONT_REGULAR,
    size: options.size || 10.5,
    indent: options.indent || 0,
    prefix: options.prefix || '',
    marginBefore: options.marginBefore ?? 0,
    marginAfter: options.marginAfter ?? 0,
    lineHeight: options.lineHeight || ((options.size || 10.5) * 1.38),
  };
}

function formatDateTime(value) {
  if (!value) {
    return 'Not available';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate);
}

function formatStatusLabel(value = '') {
  return String(value || 'unknown').replace(/-/g, ' ');
}

function formatListValue(items = [], fallback = 'Not available') {
  return Array.isArray(items) && items.length ? items.join(', ') : fallback;
}

function formatRiskCounts(contract = {}) {
  const counts = contract.riskCounts || {};
  return `Low ${counts.low ?? 0}, Medium ${counts.medium ?? 0}, High ${counts.high ?? 0}`;
}

function buildInsightReportBlocks({ contract, insights, pending, error }) {
  const summaryHeadline = pending ? 'Refreshing insights...' : insights?.headline || 'Contract insight summary';
  const summaryText = error || insights?.summary || 'Insight summary will appear here after analysis completes.';
  const insightNotice = getInsightNotice(contract, insights);
  const blocks = [
    buildTextBlock('Contract Analysis Report', {
      font: FONT_BOLD,
      size: 20,
      marginAfter: 8,
      lineHeight: 24,
    }),
    buildTextBlock(contract?.title || 'Contract', {
      font: FONT_BOLD,
      size: 15,
      marginAfter: 4,
      lineHeight: 18,
    }),
    buildTextBlock(`Generated on ${formatDateTime(new Date())}`, {
      size: 10,
      marginAfter: 18,
      lineHeight: 13,
    }),
    buildTextBlock('Contract Snapshot', {
      font: FONT_BOLD,
      size: 14,
      marginAfter: 8,
      lineHeight: 17,
    }),
    buildTextBlock(`Source: ${contract?.source || 'Not available'}`, {
      prefix: '- ',
      marginAfter: 4,
    }),
    buildTextBlock(`Status: ${formatStatusLabel(contract?.status)}`, {
      prefix: '- ',
      marginAfter: 4,
    }),
    buildTextBlock(`Type: ${contract?.contractType || 'Contract'}`, {
      prefix: '- ',
      marginAfter: 4,
    }),
    buildTextBlock(`Parties: ${formatListValue(contract?.parties, 'Not extracted yet')}`, {
      prefix: '- ',
      marginAfter: 4,
    }),
    buildTextBlock(`Dates: ${formatListValue(contract?.dates, 'Awaiting extraction')}`, {
      prefix: '- ',
      marginAfter: 4,
    }),
    buildTextBlock(`Risk counts: ${formatRiskCounts(contract)}`, {
      prefix: '- ',
      marginAfter: 4,
    }),
    buildTextBlock(`Created: ${formatDateTime(contract?.createdAt)}`, {
      prefix: '- ',
      marginAfter: 4,
    }),
    buildTextBlock(`Last updated: ${formatDateTime(contract?.updatedAt)}`, {
      prefix: '- ',
      marginAfter: 10,
    }),
  ];

  if (contract?.textPreview) {
    blocks.push(buildTextBlock(`Preview: ${contract.textPreview}`, {
      marginAfter: 16,
    }));
  }

  blocks.push(
    buildTextBlock('Insight Summary', {
      font: FONT_BOLD,
      size: 14,
      marginAfter: 8,
      lineHeight: 17,
    }),
    buildTextBlock(summaryHeadline, {
      font: FONT_BOLD,
      size: 12.5,
      marginAfter: 6,
      lineHeight: 15,
    }),
    buildTextBlock(summaryText, {
      marginAfter: 6,
    }),
  );

  if (pending) {
    blocks.push(buildTextBlock('The latest insight refresh was still running when this report was generated.', {
      marginAfter: 6,
    }));
  }

  if (insightNotice) {
    blocks.push(buildTextBlock(`Insight notice: ${insightNotice}`, {
      marginAfter: 6,
    }));
  }

  blocks.push(
    buildTextBlock('Next Steps', {
      font: FONT_BOLD,
      size: 14,
      marginBefore: 10,
      marginAfter: 8,
      lineHeight: 17,
    }),
  );

  if ((insights?.nextSteps || []).length) {
    (insights.nextSteps || []).forEach((step) => {
      blocks.push(buildTextBlock(step, {
        prefix: '- ',
        marginAfter: 4,
      }));
    });
  } else {
    blocks.push(buildTextBlock('No recommended next steps are available.', {
      marginAfter: 4,
    }));
  }

  blocks.push(
    buildTextBlock('Priority Items', {
      font: FONT_BOLD,
      size: 14,
      marginBefore: 10,
      marginAfter: 8,
      lineHeight: 17,
    }),
  );

  if ((insights?.topRiskItems || []).length) {
    (insights.topRiskItems || []).forEach((item) => {
      blocks.push(buildTextBlock(item, {
        prefix: '- ',
        marginAfter: 4,
      }));
    });
  } else {
    blocks.push(buildTextBlock('No priority items are available.', {
      marginAfter: 4,
    }));
  }

  blocks.push(
    buildTextBlock('Clause Analysis', {
      font: FONT_BOLD,
      size: 14,
      marginBefore: 10,
      marginAfter: 8,
      lineHeight: 17,
    }),
  );

  if ((insights?.clauseInsights || []).length) {
    insights.clauseInsights.forEach((insight, index) => {
      const comparisonSourceType = insight.precedentClause?.sourceType || insight.precedentMatches?.[0]?.sourceType || '';
      const bestComparisonLabel = comparisonSourceType === 'precedent' ? 'Best Precedent' : 'Best Comparison';
      const additionalComparisonLabel = comparisonSourceType === 'precedent'
        ? 'Additional Precedents'
        : 'Additional Comparable Clauses';
      const emptyComparisonTitle = comparisonSourceType === 'precedent'
        ? 'No stored precedent yet'
        : 'No stored comparison yet';

      blocks.push(
        buildTextBlock(`${index + 1}. ${formatClauseType(insight.clauseType || 'Clause')} (${formatClauseType(insight.riskLabel || 'high')} risk)`, {
          font: FONT_BOLD,
          size: 12.5,
          marginBefore: index ? 12 : 0,
          marginAfter: 6,
          lineHeight: 15,
        }),
        buildTextBlock(`Current Clause Title: ${insight.currentClause?.contractTitle || contract?.title || 'Current contract'}`, {
          marginAfter: 4,
        }),
        buildTextBlock(`Current Clause Text: ${renderClauseBody(insight.currentClause, renderClauseBody(insight))}`, {
          marginAfter: 6,
        }),
        buildTextBlock(`${bestComparisonLabel}: ${insight.precedentClause?.title || emptyComparisonTitle}`, {
          marginAfter: 4,
        }),
        buildTextBlock(
          insight.precedentClause
            ? `Comparison Text: ${renderClauseBody(insight.precedentClause)}`
            : 'Comparison Text: This panel fills from your indexed precedent bank or the closest matching clause from another indexed contract.',
          {
            marginAfter: 6,
          },
        ),
        buildTextBlock(`Why it is risky: ${insight.whyItIsRisky || 'Not available.'}`, {
          marginAfter: 4,
        }),
        buildTextBlock(`Comparison: ${insight.comparison || 'Not available.'}`, {
          marginAfter: 4,
        }),
        buildTextBlock(`Recommended change: ${insight.recommendedChange || 'Not available.'}`, {
          marginAfter: 6,
        }),
      );

      if ((insight.ruleMatches || []).length) {
        blocks.push(buildTextBlock('Rules And Policies', {
          font: FONT_BOLD,
          size: 11.5,
          marginAfter: 6,
          lineHeight: 14,
        }));

        (insight.ruleMatches || []).forEach((rule) => {
          const ruleText = [
            rule.title || 'Benchmark guidance',
            rule.benchmark || rule.textSummary || rule.textFull || 'No benchmark text available.',
            rule.recommendedAction ? `Expected action: ${rule.recommendedAction}` : '',
          ].filter(Boolean).join(' | ');

          blocks.push(buildTextBlock(ruleText, {
            prefix: '- ',
            marginAfter: 4,
          }));
        });
      }

      if ((insight.precedentMatches || []).length > 1) {
        blocks.push(buildTextBlock(additionalComparisonLabel, {
          font: FONT_BOLD,
          size: 11.5,
          marginAfter: 6,
          lineHeight: 14,
        }));

        insight.precedentMatches.slice(1).forEach((match) => {
          const score = typeof match.score === 'number' ? ` (${match.score.toFixed(2)})` : '';
          blocks.push(buildTextBlock(`${match.title || formatClauseType(match.clauseType || 'precedent')}${score}`, {
            prefix: '- ',
            marginAfter: 4,
          }));
        });
      }
    });
  } else {
    blocks.push(buildTextBlock(
      insightNotice || 'No automatic clause insights were generated because this contract does not currently have any high-risk clauses.',
      {
        marginAfter: 4,
      },
    ));
  }

  return blocks;
}

function paginateBlocks(blocks) {
  const pages = [{ items: [] }];
  let currentPage = pages[0];
  let cursorY = PDF_PAGE_HEIGHT - PDF_MARGIN_TOP;

  const startNewPage = () => {
    currentPage = { items: [] };
    pages.push(currentPage);
    cursorY = PDF_PAGE_HEIGHT - PDF_MARGIN_TOP;
  };

  blocks.forEach((block) => {
    const marginBefore = currentPage.items.length ? block.marginBefore || 0 : 0;

    if ((cursorY - marginBefore) < PDF_MARGIN_BOTTOM) {
      startNewPage();
    } else {
      cursorY -= marginBefore;
    }

    const lines = wrapText(block.text, block);

    lines.forEach((line) => {
      const lineHeight = line.text ? (block.lineHeight || 14) : Math.max((block.lineHeight || 14) * 0.6, 8);

      if ((cursorY - lineHeight) < PDF_MARGIN_BOTTOM) {
        startNewPage();
      }

      if (line.text) {
        currentPage.items.push({
          text: line.text,
          x: PDF_MARGIN_X + (line.xOffset || 0),
          y: cursorY,
          font: line.font || block.font,
          size: line.size || block.size,
        });
      }

      cursorY -= lineHeight;
    });

    cursorY -= block.marginAfter || 0;
  });

  return pages;
}

function createContentStream(page, index, total) {
  const commands = [];

  page.items.forEach((item) => {
    commands.push('BT');
    commands.push(`/${item.font === FONT_BOLD ? 'F2' : 'F1'} ${item.size.toFixed(2)} Tf`);
    commands.push(`1 0 0 1 ${item.x.toFixed(2)} ${item.y.toFixed(2)} Tm`);
    commands.push(`(${escapePdfText(item.text)}) Tj`);
    commands.push('ET');
  });

  commands.push('BT');
  commands.push('/F1 9 Tf');
  commands.push(`1 0 0 1 ${PDF_MARGIN_X.toFixed(2)} 26.00 Tm`);
  commands.push(`(Page ${index + 1} of ${total}) Tj`);
  commands.push('ET');

  return commands.join('\n');
}

function formatPdfDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '20260101000000';
  }

  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ];

  return parts.join('');
}

// Builds a lightweight text-first PDF so the report can download without extra dependencies.
function buildPdfDocument({ title, pages }) {
  const fontRegularId = 1;
  const fontBoldId = 2;
  const pagesId = 3;
  const pageIds = [];
  const contentIds = [];
  let nextId = 4;

  pages.forEach(() => {
    pageIds.push(nextId++);
    contentIds.push(nextId++);
  });

  const catalogId = nextId++;
  const infoId = nextId++;
  const maxId = nextId - 1;
  const objects = new Array(maxId + 1).fill('');

  objects[fontRegularId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[fontBoldId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  objects[pagesId] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  pages.forEach((page, index) => {
    const contentStream = createContentStream(page, index, pages.length);
    const pageId = pageIds[index];
    const contentId = contentIds[index];

    objects[pageId] = [
      '<<',
      '/Type /Page',
      `/Parent ${pagesId} 0 R`,
      `/MediaBox [0 0 ${PDF_PAGE_WIDTH.toFixed(2)} ${PDF_PAGE_HEIGHT.toFixed(2)}]`,
      `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >>`,
      `/Contents ${contentId} 0 R`,
      '>>',
    ].join('\n');

    objects[contentId] = `<< /Length ${byteLength(contentStream)} >>\nstream\n${contentStream}\nendstream`;
  });

  objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[infoId] = [
    '<<',
    `/Title (${escapePdfText(title)})`,
    '/Producer (Codex)',
    `/CreationDate (D:${formatPdfDate(new Date())})`,
    '>>',
  ].join('\n');

  let pdf = '%PDF-1.4\n';
  const offsets = new Array(maxId + 1).fill(0);

  for (let id = 1; id <= maxId; id += 1) {
    offsets[id] = byteLength(pdf);
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = byteLength(pdf);
  pdf += `xref\n0 ${maxId + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (let id = 1; id <= maxId; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += [
    'trailer',
    `<< /Size ${maxId + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
  ].join('\n');

  return textToPdfBytes(pdf);
}

function buildReportFileName(contract) {
  const baseName = String(contract?.title || 'contract-analysis-report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'contract-analysis-report';

  return `${baseName}-analysis-report.pdf`;
}

export function downloadContractInsightReport({ contract, insights, pending = false, error = '' }) {
  if (!contract || typeof document === 'undefined') {
    throw new Error('A contract must be selected before exporting a report.');
  }

  const title = `${contract.title || 'Contract'} Analysis Report`;
  const pages = paginateBlocks(buildInsightReportBlocks({
    contract,
    insights,
    pending,
    error,
  }));
  const pdfBytes = buildPdfDocument({ title, pages });
  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
  const downloadUrl = URL.createObjectURL(pdfBlob);
  const anchor = document.createElement('a');

  anchor.href = downloadUrl;
  anchor.download = buildReportFileName(contract);
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  window.setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 1000);
}

export {
  formatClauseType,
  renderClauseBody,
  getInsightNotice,
};
