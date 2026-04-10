function SearchWorkbench({
  query,
  deferredQuery,
  pending,
  result,
  disabled,
  disabledMessage,
  scopeLabel,
  onQueryChange,
  onSubmit,
  modeLabel,
  onVoiceSearch,
  isListening,
  voiceSupported,
  onStopVoice,
}) {
  const recommendations = result?.reasoning?.recommendations || [];
  const supportingMatches = result?.reasoning?.supportingMatches || [];

  return (
    <section className="panel search-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Reasoning Layer</p>
          <h3>Semantic search workbench</h3>
        </div>
        <span className="mode-label">{modeLabel}</span>
      </div>

      <form className="search-form" onSubmit={onSubmit}>
        <label htmlFor="semantic-query" className="search-label">
          Ask about risk, precedent, or drafting changes
        </label>

        <div className="search-row">
          <input
            id="semantic-query"
            value={query}
            disabled={disabled}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Why is the termination clause risky and how should we rewrite it?"
          />

          <button type="submit" disabled={pending || disabled}>
            {pending ? 'Searching...' : 'Run Search'}
          </button>

          {voiceSupported ? (
            <button
              type="button"
              onClick={isListening ? onStopVoice : onVoiceSearch}
              disabled={disabled || pending}
              title={isListening ? 'Stop listening' : 'Start voice search'}
              aria-label={isListening ? 'Stop listening' : 'Start voice search'}
              className={`voice-bot-button ${isListening ? 'listening' : ''}`}
            >
              <span className="voice-bot-icon">🤖</span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              title="Voice search is not supported in this browser"
              aria-label="Voice search not supported"
              className="voice-bot-button unsupported"
            >
              <span className="voice-bot-icon">🤖</span>
            </button>
          )}
        </div>

        <p className="search-hint">
          {scopeLabel ? `Scoped contract: ${scopeLabel}` : 'Scoped contract: select a contract name first.'}
        </p>

        <p className="search-hint">
          Focused context preview: {deferredQuery || 'Start typing a contract question.'}
        </p>

        {isListening && (
          <p className="search-hint" style={{ color: '#0f9d58', fontWeight: 600 }}>
            Listening... speak your question now.
          </p>
        )}
      </form>

      <div className="search-answer">
        <h4>Answer</h4>
        <p>
          {result?.reasoning?.answer || result?.answer || (
            disabled
              ? disabledMessage
              : 'Run a semantic search to see grounded reasoning and supporting matches.'
          )}
        </p>
      </div>

      <div className="search-grid">
        <div>
          <h4>Recommendations</h4>
          {recommendations.length ? (
            <ul>
              {recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">Recommendations will appear after a successful search.</p>
          )}
        </div>

        <div>
          <h4>Supporting matches</h4>
          {supportingMatches.length ? (
            <ul>
              {supportingMatches.map((match, index) => (
                <li key={match.id || `${match.clauseType}-${index}`}>
                  <strong>{match.clauseType?.replace(/_/g, ' ') || 'Clause'}</strong> - {match.riskLabel || 'unknown'} risk
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">Matching clauses will appear here once the search index has live data.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default SearchWorkbench;
