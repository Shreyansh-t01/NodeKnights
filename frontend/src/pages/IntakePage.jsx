import ConnectorCard from '../components/ConnectorCard';
import UploadPanel from '../components/UploadPanel';

function IntakePage({
  connectors,
  uploadFile,
  uploading,
  uploadError,
  connectorNotice,
  connectorActionPendingId,
  onFileChange,
  onConnectorAction,
  onUpload,
}) {
  return (
    <section className="two-column route-grid">
      <UploadPanel
        selectedFileName={uploadFile?.name}
        uploading={uploading}
        error={uploadError}
        onFileChange={onFileChange}
        onUpload={onUpload}
      />

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Sources</p>
            <h3>Ingestion connectors</h3>
          </div>
        </div>
        {connectorNotice ? (
          <p className={`connector-notice connector-notice-${connectorNotice.tone}`}>{connectorNotice.message}</p>
        ) : null}
        <div className="connector-grid">
          {connectors.map((connector) => (
            <ConnectorCard
              key={connector.key}
              connector={connector}
              actionPending={connector.actionId === connectorActionPendingId}
              onAction={onConnectorAction}
            />
          ))}
        </div>
      </section>
    </section>
  );
}

export default IntakePage;
