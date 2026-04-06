function StatusPill({ status, children }) {
  const toneClass = {
    ready: 'pill pill-ready',
    active: 'pill pill-ready',
    configure: 'pill pill-warning',
    fallback: 'pill pill-warning',
    disabled: 'pill pill-ink',
    'review-required': 'pill pill-danger',
    'analysis-ready': 'pill pill-ready',
  }[status] || 'pill pill-ink';

  return <span className={toneClass}>{children}</span>;
}

export default StatusPill;
