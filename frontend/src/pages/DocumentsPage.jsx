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
  return (
    <button
      type="button"
      className={`document-card ${isActive ? 'document-card-active' : ''}`}
      onClick={() => onSelect(document.id)}
    >
      <div className="document-card-row">
        <div>
          <p className="eyebrow">{document.source}</p>
          <h4>{document.title}</h4>
        </div>
        <span className="document-badge">{formatMimeLabel(document.mimeType)}</span>
      </div>
      <p className="document-card-meta">{document.originalName}</p>
      <p className="document-card-meta">
        {document.available ? 'Original file ready for preview' : 'Original file preview unavailable'}
      </p>
      <p className="document-card-meta">
        Added {formatTimestamp(document.createdAt)}
      </p>
    </button>
  );
}

function DocumentViewer({ document, viewerUrl, downloadUrl }) {
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

  return (
    <div className="document-viewer-shell">
      <div className="document-actions">
        <a className="action-link" href={viewerUrl} target="_blank" rel="noreferrer">
          Open
        </a>
        <a className="action-link" href={downloadUrl}>
          Download
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
  downloadUrl,
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
            <button type="submit" disabled={pending}>
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

        <div className="document-list">
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
            downloadUrl={downloadUrl}
          />
        </section>
      </div>
    </section>
  );
}

export default DocumentsPage;
