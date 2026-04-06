function WorkflowPanel({ contract }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Workflow</p>
          <h3>{contract.title}</h3>
        </div>
      </div>

      <div className="timeline">
        {(contract.pipeline || []).length ? (
          (contract.pipeline || []).map((step) => (
            <div key={step.key} className="timeline-item">
              <span className="timeline-dot" />
              <div>
                <h4>{step.label}</h4>
                <p>{step.detail}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="empty-state">Pipeline details will appear here once contract processing finishes.</p>
        )}
      </div>
    </section>
  );
}

export default WorkflowPanel;
