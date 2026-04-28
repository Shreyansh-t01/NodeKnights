function formatMimeLabel(mimeType = '') {
  if (!mimeType) {
    return 'FILE';
  }

  if (mimeType === 'application/pdf') {
    return 'PDF';
  }

  if (mimeType === 'text/plain') {
    return 'TXT';
  }

  const [, subtype = 'file'] = mimeType.split('/');
  return subtype.toUpperCase();
}

function formatTimestamp(value) {
  if (!value) {
    return 'Recently added';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Recently added';
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function DocumentSearchResultCard({ document, isActive, onSelect }) {
  const typeColors = {
    'application/pdf': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
    'text/plain': { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  };

  const style = typeColors[document.mimeType] || { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' };

  return (
    <button
      type="button"
      className={`document-card ${isActive ? 'document-card-active' : ''}`}
      onClick={() => onSelect(document.id)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '14px 16px',
        borderRadius: '14px',
        border: isActive
          ? '1.5px solid rgba(168,85,247,0.6)'
          : '1.5px solid rgba(255,255,255,0.25)',
        background: isActive
          ? 'rgba(255,255,255,0.22)'
          : 'rgba(255,255,255,0.14)',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: isActive
          ? '0 4px 24px rgba(168,85,247,0.18)'
          : '0 2px 12px rgba(0,0,0,0.1)',
      }}
    >
      {/* Top row: icon + title + badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* File icon box */}
        <div style={{
          width: '40px',
          height: '46px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.18)',
          border: '1px solid rgba(255,255,255,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
            <path d="M3 0H11L17 6V19C17 20.1 16.1 21 15 21H3C1.9 21 1 20.1 1 19V2C1 0.9 1.9 0 3 0Z" fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
            <path d="M11 0L17 6H13C11.9 6 11 5.1 11 4V0Z" fill="rgba(200,180,255,0.6)" />
            <rect x="4" y="9" width="10" height="1.5" rx="0.75" fill="rgba(100,80,180,0.5)" />
            <rect x="4" y="12" width="8" height="1.5" rx="0.75" fill="rgba(100,80,180,0.5)" />
            <rect x="4" y="15" width="6" height="1.5" rx="0.75" fill="rgba(100,80,180,0.5)" />
          </svg>
        </div>

        {/* Title + source */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.6)',
            margin: '0 0 3px',
          }}>
            {document.source}
          </p>
          <h4 style={{
            fontSize: '17px',
            fontWeight: 700,
            color: '#ffffff',
            margin: 0,
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}>
            {document.title}
          </h4>
          <p style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.55)',
            margin: '3px 0 0',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {document.originalName}
          </p>
        </div>

        {/* Badge */}
        <span style={{
          fontSize: '12px',
          fontWeight: 800,
          padding: '4px 9px',
          borderRadius: '6px',
          background: 'rgba(239,68,68,0.2)',
          color: '#fca5a5',
          border: '1px solid rgba(239,68,68,0.35)',
          flexShrink: 0,
          letterSpacing: '0.05em',
        }}>
          {formatMimeLabel(document.mimeType)}
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.12)', margin: '0 -2px' }} />

      {/* Bottom row: status + date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '13px',
          color: document.available ? '#86efac' : 'rgba(255,255,255,0.4)',
          fontWeight: 500,
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: document.available ? '#4ade80' : 'rgba(255,255,255,0.25)',
            display: 'inline-block',
            boxShadow: document.available ? '0 0 6px #4ade80' : 'none',
          }} />
          {document.available ? 'Ready for preview' : 'Preview unavailable'}
        </span>
        <span style={{
          fontSize: '13px',
          color: 'rgba(255,255,255,0.5)',
          fontWeight: 500,
        }}>
          {formatTimestamp(document.createdAt)}
        </span>
      </div>
    </button>
  );
}

function DocumentViewer({ document, viewerUrl, viewerPending, viewerError }) {
  if (!document) {
    return (
      <div className="document-viewer-shell">
        <p className="empty-state">
          Search by document name and choose a result to open the original stored file here.
        </p>
      </div>
    );
  }

  if (!document.available) {
    return (
      <div className="document-viewer-shell">
        <p className="empty-state">
          {document.artifactReason || 'The original file is not available for inline preview yet.'}
        </p>
      </div>
    );
  }

  if (viewerError) {
    return (
      <div className="document-viewer-shell">
        <p className="empty-state">
          {viewerError}
        </p>
      </div>
    );
  }

  if (viewerPending || !viewerUrl) {
    return (
      <div className="document-viewer-shell">
        <p className="empty-state">
          Loading document preview...
        </p>
      </div>
    );
  }

  return (
    <div className="document-viewer-shell">
      <div className="document-actions" style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <a className="lex-btn-primary" href={viewerUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', padding: '10px 20px', fontSize: '12px', borderRadius: '8px' }}>
          Open Document
        </a>
        <a className="lex-btn-primary" href={viewerUrl} download={document.originalName || 'document'} style={{ textDecoration: 'none', padding: '10px 20px', fontSize: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
          Download Original
        </a>
      </div>

      {document.previewMode === 'image' ? (
        <img
          key={viewerUrl}
          className="document-image"
          src={viewerUrl}
          alt={document.originalName}
        />
      ) : (
        <iframe
          key={viewerUrl}
          className="document-frame"
          title={document.originalName}
          src={viewerUrl}
        />
      )}
    </div>
  );
}

function DocumentsPage({
  query,
  deferredQuery,
  pending,
  error,
  results,
  selectedDocumentId,
  selectedDocument,
  viewerUrl,
  viewerPending,
  viewerError,
  onQueryChange,
  onSubmit,
  onSelectDocument,
  modeLabel,
}) {
  return (
    <section className="workspace-grid route-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Document Search</p>
            <h3>Find a stored document</h3>
          </div>
          <span className="mode-label">{modeLabel}</span>
        </div>

        <form className="search-form" onSubmit={onSubmit}>
          <label htmlFor="document-query" className="search-label">
            Search only by document file name or contract title
          </label>
          <div className="search-row">
            <input
              id="document-query"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search for vendor agreement, nda, msa, invoice terms..."
            />
            <button type="submit" disabled={pending} className="lex-btn-primary" style={{ padding: '0 24px', borderRadius: '14px', fontWeight: '800' }}>
              {pending ? 'Searching...' : 'Find Document'}
            </button>
          </div>
          <p className="search-hint">
            File name focus: {deferredQuery || 'Type the stored document name to open the original file.'}
          </p>
        </form>

        {error ? (
          <p className="empty-state">{error}</p>
        ) : null}

        <div className="document-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
          {results.length ? (
            results.map((document) => (
              <DocumentSearchResultCard
                key={document.id}
                document={document}
                isActive={document.id === selectedDocumentId}
                onSelect={onSelectDocument}
              />
            ))
          ) : (
            <p className="empty-state">
              No stored documents matched that name. Upload a contract first or try a shorter file name.
            </p>
          )}
        </div>
      </section>

      <div className="workspace-stack">
        <section className="panel contract-context-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Selected Document</p>
              <h3>{selectedDocument?.title || 'No document selected'}</h3>
            </div>
            <span className="document-badge">
              {formatMimeLabel(selectedDocument?.mimeType)}
            </span>
          </div>

          {selectedDocument ? (
            <>
              <p className="contract-meta">
                File: {selectedDocument.originalName}
              </p>
              <p className="contract-meta">
                Source: {selectedDocument.source} | Storage: {selectedDocument.storageMode}
              </p>
              <p className="contract-meta">
                Uploaded: {formatTimestamp(selectedDocument.createdAt)}
              </p>
              <p className="contract-meta">
                Parties: {selectedDocument.parties.length ? selectedDocument.parties.join(', ') : 'Not extracted yet'}
              </p>
              <p className="contract-meta">
                Preview: {selectedDocument.textPreview || 'No extracted preview is available yet.'}
              </p>
            </>
          ) : (
            <p className="empty-state">
              Choose a search result to open the complete stored document.
            </p>
          )}
        </section>

        <section className="panel document-viewer-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Original File</p>
              <h3>Native document preview</h3>
            </div>
          </div>

          <DocumentViewer
            document={selectedDocument}
            viewerUrl={viewerUrl}
            viewerPending={viewerPending}
            viewerError={viewerError}
          />
        </section>
      </div>
    </section>
  );
}

export default DocumentsPage;
