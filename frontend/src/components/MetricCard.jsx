function MetricCard({ metric }) {
  return (
    <article className={`metric-card metric-card-${metric.tone}`}>
      <p className="eyebrow">{metric.label}</p>
      <h3>{metric.value}</h3>
      <p>{metric.description}</p>
    </article>
  );
}

export default MetricCard;
