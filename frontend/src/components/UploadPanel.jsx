function UploadPanel({
  selectedFileName,
  uploading,
  onFileChange,
  onUpload,
}) {
  return (
    <section className="panel upload-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Manual Intake</p>
          <h3>Upload a contract</h3>
        </div>
      </div>

      <p>
        Send a PDF, text file, or contract image into the Node.js pipeline. The backend stores the raw
        document, extracts text, calls the Python ML service, and prepares vectors for Pinecone.
      </p>

      <div className="upload-row">
        <input type="file" accept=".pdf,.txt,image/*" onChange={onFileChange} />
        <button type="button" onClick={onUpload} disabled={!selectedFileName || uploading}>
          {uploading ? 'Uploading...' : 'Process Contract'}
        </button>
      </div>

      <p className="search-hint">
        {selectedFileName ? `Selected file: ${selectedFileName}` : 'No file selected yet.'}
      </p>
    </section>
  );
}

export default UploadPanel;
