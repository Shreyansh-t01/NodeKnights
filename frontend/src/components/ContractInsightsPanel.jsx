import { useState } from 'react';

function ContractInsightsPanel({ contract, insights, pending }) {
  const [isDownloading, setIsDownloading] = useState(false);

 const handleDownloadPdf = async () => {
  if (!contract || !insights) {
    alert('No insight data available to download.');
    return;
  }

  try {
    setIsDownloading(true);

    const payload = {
      title: contract.title || 'insight-report',
      summary: insights.summary || insights.headline || 'No summary available.',
      nextSteps: insights.nextSteps || [],
      priorityItems: insights.topRiskItems || [],
      highRiskClauses: (insights.clauseInsights || []).map((item, index) => ({
        name: item.clauseType?.replace(/_/g, ' ') || `Clause ${index + 1}`,
        risk: item.riskLabel || 'high',
        reason: item.whyItIsRisky || item.recommendedChange || 'No reason provided.',
      })),
    };

    console.log('Sending PDF payload:', payload);

    const response = await fetch('http://localhost:3000/api/documents/download-insight-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    console.log('Response headers content-type:', response.headers.get('content-type'));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error response:', errorText);
      throw new Error(`HTTP ${response.status} - ${errorText}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeFileName = `${contract.title || 'insight-report'}.pdf`;

    link.href = url;
    link.download = safeFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download PDF error:', error);
    alert(`Failed to download PDF: ${error.message}`);
  } finally {
    setIsDownloading(false);
  }
};

  if (!contract) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">AI Insights</p>
            <h3>No contract selected</h3>
          </div>
        </div>

        <p className="empty-state">
          Upload a contract and select it from the list to generate live AI insights.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">AI Insights</p>
          <h3>{contract.title}</h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="mode-label">Auto-generated only for high-risk clauses</span>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloading || pending}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid #d0d7e2',
              background: '#ffffff',
              cursor: isDownloading || pending ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {isDownloading ? 'Downloading...' : 'Download PDF'}
          </button>
        </div>
      </div>

      <div className="insight-summary">
        <h4>{pending ? 'Refreshing insights...' : insights?.headline || 'Contract insight summary'}</h4>
        <p>{insights?.summary || 'Insight summary will appear here after analysis completes.'}</p>
      </div>

      <div className="insight-grid">
        <div className="insight-card">
          <h4>Next Steps</h4>
          <ul>
            {(insights?.nextSteps || []).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>

        <div className="insight-card">
          <h4>Priority Items</h4>
          <ul>
            {(insights?.topRiskItems || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="insight-stack">
        <div className="panel-header">
          <div>
            <p className="eyebrow">High Risk Clauses</p>
            <h3>Automatic clause insights</h3>
          </div>
        </div>

        {(insights?.clauseInsights || []).length ? (
          insights.clauseInsights.map((insight) => (
            <article key={insight.clauseId} className="insight-card">
              <div className="insight-meta">
                <strong>{insight.clauseType?.replace(/_/g, ' ') || 'Clause'}</strong>
                <span>{insight.riskLabel || 'high'} risk</span>
              </div>
              <p><strong>Why it is risky:</strong> {insight.whyItIsRisky}</p>
              <p><strong>Comparison:</strong> {insight.comparison}</p>
              <p><strong>Recommended change:</strong> {insight.recommendedChange}</p>
            </article>
          ))
        ) : (
          <p className="empty-state">
            No automatic clause insights were generated because this contract does not currently have any high-risk clauses.
          </p>
        )}
      </div>
    </section>
  );
}

export default ContractInsightsPanel;

