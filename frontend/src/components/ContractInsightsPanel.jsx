import { useState } from 'react';

import {
  downloadContractInsightReport,
  formatClauseType,
  renderClauseBody,
} from '../lib/contractInsightReport';
import {
  getHighRiskClauses,
  getInsightNotice,
  getInsightStatus,
  getInsightStatusLabel,
  INSIGHT_STATUS,
} from '../lib/contractInsights';
import StatusPill from './StatusPill';

function formatList(items = [], fallback = 'Not available') {
  return Array.isArray(items) && items.length ? items.join(', ') : fallback;
}

function formatExtractedValuesSummary(extractedValues = {}) {
  const entries = Object.entries(extractedValues).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== '';
  });
  if (!entries.length) return '';
  return entries.slice(0, 3).map(([key, value]) => {
    const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
    const normalizedValue = Array.isArray(value) ? value.join(', ') : String(value);
    return `${label}: ${normalizedValue}`;
  }).join(' | ');
}

function renderClauseDetailText(clause) {
  return clause?.clauseText || clause?.clausePreview || 'Clause text is unavailable.';
}

function ContractInsightsPanel({
  contract,
  insights,
  pending,
  error,
  onGenerateInsights,
}) {
  const [reportPending, setReportPending] = useState(false);
  const [reportError, setReportError] = useState('');

  if (!contract) {
    return (
      <section className="panel" style={{ textAlign: 'center', padding: '80px 20px', minHeight: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ padding: '20px', borderRadius: '100px', background: 'rgba(255,255,255,0.05)', marginBottom: '24px' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--lex-cyan-glow)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="9" x2="15" y2="9"></line>
            <line x1="9" y1="13" x2="15" y2="13"></line>
            <line x1="9" y1="17" x2="13" y2="17"></line>
          </svg>
        </div>
        <p className="eyebrow" style={{ color: 'var(--lex-cyan-glow)' }}>Insights Engine</p>
        <h2 style={{ fontSize: '2.4rem', color: '#fff', margin: '16px 0', fontWeight: '800' }}>Ready for Audit</h2>
        <p style={{ maxWidth: '460px', color: 'var(--muted)', fontSize: '15px' }}>
          Select a master agreement or contract document from the vault to initiate the Lexora AI Review Flow.
        </p>
      </section>
    );
  }

  const status = getInsightStatus(contract, insights);
  const highRiskClauses = (insights?.highRiskClauses || []).length
    ? insights.highRiskClauses
    : getHighRiskClauses(contract);
  const clauseInsights = insights?.clauseInsights || [];
  const riskCounts = contract.riskCounts || { low: 0, medium: 0, high: 0 };

  const handleDownloadReport = () => {
    setReportPending(true);
    setReportError('');
    downloadContractInsightReport(contract, insights)
      .catch((err) => {
        setReportError(err?.message || 'Failed to generate report');
      })
      .finally(() => {
        setReportPending(false);
      });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* ── HERO HEADER CARD ── */}
      <section className="panel" style={{
        padding: '32px',
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px' }}>
          <div style={{ flex: 1 }}>
            <p className="eyebrow" style={{ fontSize: '11px', color: 'var(--lex-cyan-glow)' }}>Contract Intelligence Overview</p>
            <h1 style={{ fontSize: '2.6rem', color: '#fff', margin: '12px 0 16px', fontWeight: '900', letterSpacing: '-1.5px' }}>
              {contract.title}
            </h1>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <StatusPill status={contract.status}>{contract.status.replace(/-/g, ' ')}</StatusPill>
              <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
                Extracted: {formatExtractedValuesSummary(contract.extractedValues)}
              </span>
            </div>
          </div>
          <button
            className="lex-btn-primary"
            style={{ padding: '12px 24px', borderRadius: '12px', fontWeight: '800' }}
            onClick={() => onGenerateInsights(contract.id)}
            disabled={pending || status === INSIGHT_STATUS.GENERATING}
          >
            {status === INSIGHT_STATUS.READY ? 'Re-run AI Analysis' : 'Run Intelligence Audit'}
          </button>
        </div>
      </section>

      {/* ── INSIGHTS GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '32px' }}>

        {/* Left Column: Clauses and Risks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {/* HIGH RISK SECTION */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ fontSize: '1.4rem' }}>Strategic Risks</h3>
              <div style={{ padding: '4px 10px', borderRadius: '100px', background: 'var(--lex-magenta)', color: '#fff', fontSize: '11px', fontWeight: '900' }}>
                {highRiskClauses.length} DETECTED
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {highRiskClauses.map((clause, i) => (
                <div key={i} className="panel" style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '24px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <p className="eyebrow" style={{ color: '#ff2d95', fontWeight: '900', letterSpacing: '0.08em', fontSize: '11px' }}>
                      {clause.clauseLabel || formatClauseType(clause.clauseType)}
                    </p>
                    <StatusPill status={clause.riskLabel || 'high'}>{clause.riskLabel || 'High Risk'}</StatusPill>
                  </div>
                  <p style={{ color: '#fff', fontSize: '15px', lineHeight: '1.6', marginBottom: '20px', fontWeight: '500' }}>
                    {renderClauseDetailText(clause)}
                  </p>
                  <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0, 229, 255, 0.3)', boxShadow: 'inset 0 0 15px rgba(0, 229, 255, 0.1)' }}>
                    <p style={{ fontSize: '11px', color: 'var(--lex-cyan-glow)', fontWeight: '900', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Lexora AI Reasoning</p>
                    <p style={{ fontSize: '14px', color: '#fff', lineHeight: '1.7', fontWeight: '600' }}>
                      {clause.reasoning || "Clause deviates significantly from standard legal benchmarks for this document type."}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Metadate & Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {/* Metadata Card */}
          <section className="panel" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Audit Metadata</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>High Risks</span>
                <span style={{ color: 'var(--lex-magenta)', fontWeight: '800' }}>{riskCounts.high}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Medium Risk</span>
                <span style={{ color: '#fbbf24', fontWeight: '800' }}>{riskCounts.medium}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Clean Clauses</span>
                <span style={{ color: 'var(--lex-cyan-glow)', fontWeight: '800' }}>{riskCounts.low}</span>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', marginTop: '4px' }}>
                <button
                  className="lex-btn-secondary"
                  style={{ width: '100%', fontWeight: '800' }}
                  onClick={handleDownloadReport}
                  disabled={reportPending}
                >
                  {reportPending ? 'Preparing...' : 'Download Report'}
                </button>
              </div>
            </div>
          </section>

          {/* AI Workbench Summary */}
          <section className="panel" style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(124,58,237,0.1) 100%)', border: '1px solid rgba(6,182,212,0.2)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>AI Summary</h3>
            <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'rgba(255,255,255,0.8)' }}>
              Integrated Audit Flow complete. Lexora has identified {highRiskClauses.length} mission-critical risks and mapped the document against {clauseInsights.length} legal compliance benchmarks.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}

export default ContractInsightsPanel;
