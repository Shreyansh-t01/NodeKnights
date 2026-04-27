import MetricCard from '../components/MetricCard';
import StatusPill from '../components/StatusPill';
import ContractCard from '../components/ContractCard';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Clash+Display:wght@400;500;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');

  :root {
    --pink: #f0287a;
    --magenta: #c4176e;
    --purple: #7c3aed;
    --indigo: #4f46e5;
    --blue: #2563eb;
    --cyan: #06b6d4;
    --white: #ffffff;
    --white-90: rgba(255,255,255,0.9);
    --white-70: rgba(255,255,255,0.7);
    --white-50: rgba(255,255,255,0.5);
    --white-20: rgba(255,255,255,0.2);
    --white-10: rgba(255,255,255,0.1);
    --white-06: rgba(255,255,255,0.06);
    --card-bg: rgba(255,255,255,0.96);
    --card-border: rgba(255,255,255,0.6);
    --shadow-card: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
    --shadow-hover: 0 16px 48px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.12);
    --nav-width: 220px;
    --radius-lg: 20px;
    --radius-md: 14px;
    --radius-sm: 10px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .lx-root {
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
    display: flex;
    background: linear-gradient(135deg, #f0287a 0%, #a21caf 25%, #7c3aed 50%, #4f46e5 70%, #2563eb 88%, #06b6d4 100%);
    background-attachment: fixed;
    position: relative;
    overflow: hidden;
  }

  .lx-root::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 70% 60% at 20% 30%, rgba(240,40,122,0.35) 0%, transparent 60%),
      radial-gradient(ellipse 80% 70% at 80% 60%, rgba(37,99,235,0.3) 0%, transparent 60%),
      radial-gradient(ellipse 50% 50% at 50% 100%, rgba(124,58,237,0.4) 0%, transparent 60%);
    pointer-events: none;
    z-index: 0;
  }

  /* Globe wireframe decoration */
  .lx-globe {
    position: fixed;
    top: -120px;
    left: 60px;
    width: 520px;
    height: 520px;
    border-radius: 50%;
    border: 1.5px solid rgba(255,255,255,0.12);
    pointer-events: none;
    z-index: 0;
  }
  .lx-globe::before {
    content: '';
    position: absolute;
    inset: 40px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .lx-globe::after {
    content: '';
    position: absolute;
    inset: 80px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.06);
  }

  /* ── SIDEBAR ── */
  .lx-sidebar {
    width: var(--nav-width);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 28px 16px;
    background: rgba(0,0,0,0.18);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-right: 1px solid rgba(255,255,255,0.12);
    position: relative;
    z-index: 10;
    flex-shrink: 0;
  }

  .lx-logo {
    padding: 0 8px 32px;
    border-bottom: 1px solid rgba(255,255,255,0.12);
    margin-bottom: 24px;
  }
  .lx-logo-name {
    font-family: 'Clash Display', sans-serif;
    font-size: 26px;
    font-weight: 700;
    color: var(--white);
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #fff 0%, #f9a8d4 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1;
  }
  .lx-logo-sub {
    font-size: 11px;
    color: var(--white-60);
    margin-top: 3px;
    font-weight: 400;
    letter-spacing: 0.3px;
  }

  .lx-nav {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .lx-nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--white-70);
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
    border: none;
    background: transparent;
    text-align: left;
    width: 100%;
    letter-spacing: 0.1px;
  }
  .lx-nav-item:hover {
    background: var(--white-10);
    color: var(--white);
  }
  .lx-nav-item.active {
    background: rgba(255,255,255,0.18);
    color: var(--white);
    font-weight: 600;
  }
  .lx-nav-icon {
    width: 18px;
    height: 18px;
    opacity: 0.85;
    flex-shrink: 0;
  }

  .lx-sidebar-footer {
    border-top: 1px solid rgba(255,255,255,0.12);
    padding-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .lx-sidebar-stat {
    display: flex;
    flex-direction: column;
    padding: 12px 14px;
    background: var(--white-06);
    border-radius: var(--radius-sm);
    border: 1px solid var(--white-10);
  }
  .lx-sidebar-stat span {
    font-size: 11px;
    color: var(--white-50);
    font-weight: 500;
    letter-spacing: 0.3px;
    text-transform: lowercase;
  }
  .lx-sidebar-stat strong {
    font-family: 'Clash Display', sans-serif;
    font-size: 28px;
    font-weight: 700;
    color: var(--white);
    line-height: 1.1;
  }

  /* ── MAIN CONTENT ── */
  .lx-main {
    flex: 1;
    overflow-y: auto;
    padding: 28px 32px 48px;
    position: relative;
    z-index: 5;
  }

  /* ── TOP BAR ── */
  .lx-topbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 28px;
    gap: 16px;
  }
  .lx-topbar-left {}
  .lx-page-eyebrow {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,0.6);
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .lx-page-title {
    font-family: 'Clash Display', sans-serif;
    font-size: 36px;
    font-weight: 700;
    color: var(--white);
    letter-spacing: -0.5px;
    line-height: 1.1;
  }
  .lx-topbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
    margin-top: 6px;
  }

  /* ── STATUS BAR ── */
  .lx-status-bar {
    display: flex;
    gap: 10px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .lx-status-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0,0,0,0.2);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 100px;
    padding: 8px 16px;
    font-size: 13px;
    color: var(--white);
    font-weight: 500;
  }
  .lx-status-chip .label {
    color: var(--white-60);
    font-weight: 400;
    margin-right: 2px;
  }

  /* ── WHITE CARD BASE ── */
  .lx-card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    transition: box-shadow 0.25s ease, transform 0.25s ease;
  }
  .lx-card:hover {
    box-shadow: var(--shadow-hover);
    transform: translateY(-2px);
  }

  /* ── COMMAND GRID ── */
  .lx-command-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    margin-bottom: 24px;
  }

  /* ── DOSSIER PANEL ── */
  .lx-dossier {
    padding: 24px;
  }
  .lx-dossier-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 20px;
    gap: 12px;
  }
  .lx-dossier-eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.8px;
    text-transform: uppercase;
    color: var(--pink);
    margin-bottom: 5px;
  }
  .lx-dossier-title {
    font-family: 'Clash Display', sans-serif;
    font-size: 18px;
    font-weight: 600;
    color: #1e1b4b;
    letter-spacing: -0.2px;
  }
  .lx-dossier-stats {
    display: flex;
    gap: 24px;
    padding: 16px 0;
    border-top: 1px solid #f1f5f9;
    border-bottom: 1px solid #f1f5f9;
    margin-bottom: 16px;
  }
  .lx-dossier-stats > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .lx-dossier-stats strong {
    font-family: 'Clash Display', sans-serif;
    font-size: 26px;
    font-weight: 700;
    color: #1e1b4b;
    line-height: 1;
  }
  .lx-dossier-stats span {
    font-size: 11px;
    color: #94a3b8;
    font-weight: 500;
    text-transform: lowercase;
    letter-spacing: 0.2px;
  }

  .lx-clause-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .lx-clause-item {
    padding: 11px 14px;
    border-radius: var(--radius-sm);
    border-left: 3px solid;
    background: #f8fafc;
  }
  .lx-clause-item.high { border-left-color: var(--pink); background: #fff5f7; }
  .lx-clause-item.medium { border-left-color: #f59e0b; background: #fffbeb; }
  .lx-clause-item.low { border-left-color: #22c55e; background: #f0fdf4; }
  .lx-clause-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: #94a3b8;
    margin-bottom: 3px;
  }
  .lx-clause-value {
    font-size: 13px;
    font-weight: 600;
    color: #1e293b;
  }

  /* ── BRIEF PANEL ── */
  .lx-brief {
    padding: 24px;
    display: flex;
    flex-direction: column;
  }
  .lx-brief-eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.8px;
    text-transform: uppercase;
    color: var(--purple);
    margin-bottom: 8px;
  }
  .lx-brief-title {
    font-family: 'Clash Display', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #1e1b4b;
    letter-spacing: -0.3px;
    margin-bottom: 12px;
    line-height: 1.25;
  }
  .lx-brief-desc {
    font-size: 13.5px;
    color: #64748b;
    line-height: 1.65;
    margin-bottom: 20px;
    flex: 1;
  }
  .lx-brief-row {
    display: flex;
    flex-direction: column;
    padding: 12px 16px;
    background: #f8fafc;
    border-radius: var(--radius-sm);
    margin-bottom: 8px;
    border: 1px solid #e2e8f0;
  }
  .lx-brief-row span {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: #94a3b8;
    margin-bottom: 3px;
  }
  .lx-brief-row strong {
    font-size: 13.5px;
    font-weight: 600;
    color: #1e293b;
  }
  .lx-brief-actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
  }

  /* ── HERO SECTION ── */
  .lx-hero-section {
    background: rgba(0,0,0,0.16);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: var(--radius-lg);
    padding: 32px;
    margin-bottom: 24px;
    position: relative;
    overflow: hidden;
  }
  .lx-hero-section::before {
    content: '';
    position: absolute;
    top: -60px; right: -60px;
    width: 200px; height: 200px;
    border-radius: 50%;
    background: rgba(255,255,255,0.05);
    pointer-events: none;
  }
  .lx-hero-eyebrow {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.6);
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 100px;
    padding: 4px 14px;
    margin-bottom: 14px;
  }
  .lx-hero-title {
    font-family: 'Clash Display', sans-serif;
    font-size: 30px;
    font-weight: 700;
    color: var(--white);
    letter-spacing: -0.5px;
    line-height: 1.2;
    margin-bottom: 12px;
    max-width: 560px;
  }
  .lx-hero-text {
    font-size: 14px;
    color: rgba(255,255,255,0.72);
    line-height: 1.7;
    max-width: 560px;
    margin-bottom: 24px;
  }
  .lx-hero-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  /* ── BUTTONS ── */
  .lx-btn-primary {
    background: var(--white);
    color: var(--purple);
    border: none;
    border-radius: 100px;
    padding: 11px 24px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'DM Sans', sans-serif;
    letter-spacing: 0.1px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  .lx-btn-primary:hover {
    background: #f0f4ff;
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.2);
  }

  .lx-btn-ghost {
    background: rgba(255,255,255,0.15);
    color: var(--white);
    border: 1.5px solid rgba(255,255,255,0.3);
    border-radius: 100px;
    padding: 10px 22px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'DM Sans', sans-serif;
    backdrop-filter: blur(8px);
  }
  .lx-btn-ghost:hover {
    background: rgba(255,255,255,0.25);
    border-color: rgba(255,255,255,0.5);
    transform: translateY(-1px);
  }

  .lx-btn-card-primary {
    flex: 1;
    background: linear-gradient(135deg, var(--pink), var(--purple));
    color: white;
    border: none;
    border-radius: 100px;
    padding: 11px 18px;
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'DM Sans', sans-serif;
    box-shadow: 0 4px 14px rgba(240,40,122,0.3);
  }
  .lx-btn-card-primary:hover {
    opacity: 0.92;
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(240,40,122,0.4);
  }

  .lx-btn-card-ghost {
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
    border-radius: 100px;
    padding: 10px 18px;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'DM Sans', sans-serif;
  }
  .lx-btn-card-ghost:hover {
    background: #e2e8f0;
    transform: translateY(-1px);
  }

  /* ── STATUS PILL OVERRIDES (inside white cards) ── */
  .lx-dossier .status-pill-ready,
  .lx-brief .status-pill-ready {
    background: #dcfce7; color: #16a34a;
  }
  .lx-dossier .status-pill-error,
  .lx-brief .status-pill-error {
    background: #fee2e2; color: #dc2626;
  }
  .lx-dossier .status-pill-configure,
  .lx-brief .status-pill-configure {
    background: #fef9c3; color: #ca8a04;
  }

  /* ── METRICS ── */
  .lx-metrics-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }

  /* MetricCard override for white-card style */
  .lx-metrics-grid .metric-card,
  .lx-metrics-grid > * {
    background: var(--card-bg) !important;
    border: 1px solid var(--card-border) !important;
    border-radius: var(--radius-lg) !important;
    box-shadow: var(--shadow-card) !important;
  }

  /* ── RECENT CONTRACTS SECTION ── */
  .lx-section-card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    padding: 24px;
    margin-bottom: 24px;
  }
  .lx-section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .lx-section-eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.8px;
    text-transform: uppercase;
    color: var(--pink);
    margin-bottom: 5px;
  }
  .lx-section-title {
    font-family: 'Clash Display', sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: #1e1b4b;
    letter-spacing: -0.3px;
  }
  .lx-view-all {
    font-size: 13px;
    font-weight: 600;
    color: var(--purple);
    cursor: pointer;
    background: none;
    border: none;
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: 'DM Sans', sans-serif;
    padding: 0;
    white-space: nowrap;
    margin-top: 4px;
  }
  .lx-view-all:hover { color: var(--pink); }

  .lx-contract-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }

  .lx-empty-state {
    font-size: 14px;
    color: #94a3b8;
    line-height: 1.6;
    grid-column: 1/-1;
    text-align: center;
    padding: 32px;
    background: #f8fafc;
    border-radius: var(--radius-md);
    border: 1px dashed #cbd5e1;
  }

  /* ContractCard override for clean card-in-card look */
  .lx-contract-grid .contract-card,
  .lx-contract-grid > * {
    border-radius: var(--radius-md) !important;
    border: 1px solid #e2e8f0 !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06) !important;
    overflow: hidden;
  }

  /* ── SCROLLBAR ── */
  .lx-main::-webkit-scrollbar { width: 5px; }
  .lx-main::-webkit-scrollbar-track { background: transparent; }
  .lx-main::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }

  /* ── RESPONSIVE ── */
  @media (max-width: 1024px) {
    .lx-command-grid { grid-template-columns: 1fr; }
    .lx-metrics-grid { grid-template-columns: repeat(2, 1fr); }
    .lx-contract-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 768px) {
    .lx-sidebar { display: none; }
    .lx-main { padding: 20px 16px 40px; }
    .lx-metrics-grid { grid-template-columns: 1fr; }
    .lx-contract-grid { grid-template-columns: 1fr; }
  }
`;

function NavIcon({ type }) {
  const icons = {
    home: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    intake: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    ),
    review: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
      </svg>
    ),
    insights: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    search: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    vault: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8L5 7h14z"/><circle cx="12" cy="14" r="2"/>
      </svg>
    ),
  };
  return icons[type] || null;
}

function OverviewPage({
  bootMode,
  health,
  metrics,
  contracts,
  selectedContractId,
  onSelectContract,
  onDeleteContract,
  deletingContractId,
  onNavigate,
}) {
  const modeLabel = bootMode === 'live'
    ? 'Live backend mode'
    : bootMode === 'offline'
      ? 'Backend not connected, retrying'
      : 'Connecting to backend';
  const recentContracts = contracts.slice(0, 3);
  const selectedContract = contracts.find((contract) => contract.id === selectedContractId) || recentContracts[0] || null;
  const highRiskCount = contracts.reduce((sum, contract) => sum + (contract.riskCounts?.high || 0), 0);
  const clauseCount = contracts.reduce((sum, contract) => sum + ((contract.clauses || []).length || 0), 0);

  return (
    <>
      <style>{styles}</style>
      <div className="lx-root">
        <div className="lx-globe" />

        {/* ── SIDEBAR ── */}
        <aside className="lx-sidebar">
          <div className="lx-logo">
            <div className="lx-logo-name">Lexora</div>
            <div className="lx-logo-sub">Legal Intelligence</div>
          </div>

          <nav className="lx-nav" aria-label="Primary navigation">
            {[
              { key: 'home', label: 'Home', path: '/', active: true },
              { key: 'intake', label: 'Intake', path: '/intake' },
              { key: 'review', label: 'Review', path: '/contracts' },
              { key: 'insights', label: 'Insights', path: '/insights' },
              { key: 'search', label: 'Search', path: '/search' },
              { key: 'vault', label: 'Vault', path: '/vault' },
            ].map(({ key, label, path, active }) => (
              <button
                key={key}
                className={`lx-nav-item${active ? ' active' : ''}`}
                onClick={() => onNavigate(path)}
                type="button"
              >
                <NavIcon type={key} />
                {label}
              </button>
            ))}
          </nav>

          <div className="lx-sidebar-footer">
            <div className="lx-sidebar-stat">
              <span>contracts</span>
              <strong>{contracts.length}</strong>
            </div>
            <div className="lx-sidebar-stat">
              <span>high risks</span>
              <strong>{highRiskCount}</strong>
            </div>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="lx-main">

          {/* Top Bar */}
          <div className="lx-topbar">
            <div className="lx-topbar-left">
              <p className="lx-page-eyebrow">Lexora Legal Intelligence</p>
              <h1 className="lx-page-title">Overview</h1>
            </div>
            <div className="lx-topbar-right">
              <StatusPill status={bootMode === 'live' ? 'ready' : bootMode === 'offline' ? 'error' : 'configure'}>
                {modeLabel}
              </StatusPill>
              <button type="button" className="lx-btn-primary" onClick={() => onNavigate('/intake')}>
                Start Intake
              </button>
            </div>
          </div>

          {/* Status Bar */}
          <div className="lx-status-bar" aria-label="System readiness">
            {[
              {
                label: 'Mode',
                status: bootMode === 'live' ? 'ready' : bootMode === 'offline' ? 'error' : 'configure',
                text: bootMode === 'live' ? 'Live backend' : bootMode === 'offline' ? 'Offline' : 'Connecting',
              },
              {
                label: 'Storage',
                status: health?.firebase?.enabled ? 'ready' : 'configure',
                text: !health ? 'Checking' : health?.firebase?.enabled ? 'Structured' : 'Needs setup',
              },
              {
                label: 'Vector Search',
                status: health?.pinecone?.enabled ? 'ready' : 'configure',
                text: !health ? 'Checking' : health?.pinecone?.enabled ? 'Indexed' : 'Needs setup',
              },
              {
                label: 'Reasoning',
                status: health?.reasoning?.enabled ? 'ready' : 'configure',
                text: !health ? 'Checking' : health?.reasoning?.enabled ? 'Active' : 'Unavailable',
              },
            ].map(({ label, status, text }) => (
              <div key={label} className="lx-status-chip">
                <span className="label">{label}</span>
                <StatusPill status={status}>{text}</StatusPill>
              </div>
            ))}
          </div>

          {/* Hero Section */}
          <section className="lx-hero-section">
            <span className="lx-hero-eyebrow">Lexora Legal Intelligence</span>
            <h2 className="lx-hero-title">Calm contract review, grounded in clauses, precedent, and risk signals.</h2>
            <p className="lx-hero-text">
              Lexora gives legal teams a focused path from document intake to clause-level review, explainable insights,
              and searchable evidence without making the workspace feel noisy.
            </p>
            <div className="lx-hero-actions" aria-label="Primary actions">
              <button type="button" className="lx-btn-primary" onClick={() => onNavigate('/intake')}>Start Intake</button>
              <button type="button" className="lx-btn-ghost" onClick={() => onNavigate('/contracts')}>Review Contracts</button>
              <button type="button" className="lx-btn-ghost" onClick={() => onNavigate('/search')}>Search Clauses</button>
            </div>
          </section>

          {/* Dossier + Brief */}
          <div className="lx-command-grid">
            <article className="lx-card lx-dossier">
              <div className="lx-dossier-head">
                <div>
                  <p className="lx-dossier-eyebrow">Review Dossier</p>
                  <h3 className="lx-dossier-title">{selectedContract?.title || 'No live contract selected'}</h3>
                </div>
                <StatusPill status={selectedContract?.status || 'configure'}>
                  {selectedContract?.status?.replace(/-/g, ' ') || 'Awaiting intake'}
                </StatusPill>
              </div>

              <div className="lx-dossier-stats">
                <div>
                  <strong>{contracts.length}</strong>
                  <span>contracts</span>
                </div>
                <div>
                  <strong>{highRiskCount}</strong>
                  <span>high risks</span>
                </div>
                <div>
                  <strong>{clauseCount}</strong>
                  <span>clauses</span>
                </div>
              </div>

              <div className="lx-clause-list">
                <div className="lx-clause-item high">
                  <p className="lx-clause-label">Termination</p>
                  <p className="lx-clause-value">Notice and cure review</p>
                </div>
                <div className="lx-clause-item medium">
                  <p className="lx-clause-label">Payment</p>
                  <p className="lx-clause-value">Obligation and timeline check</p>
                </div>
                <div className="lx-clause-item low">
                  <p className="lx-clause-label">Confidentiality</p>
                  <p className="lx-clause-value">Survival language aligned</p>
                </div>
              </div>
            </article>

            <article className="lx-card lx-brief">
              <p className="lx-brief-eyebrow">Decision Brief</p>
              <h3 className="lx-brief-title">What needs counsel attention?</h3>
              <p className="lx-brief-desc">
                Prioritize high-exposure clauses, compare them against trusted language, and keep every recommendation tied
                back to the source document.
              </p>
              <div className="lx-brief-row">
                <span>Evidence</span>
                <strong>Clause text, metadata, rules</strong>
              </div>
              <div className="lx-brief-row">
                <span>Outcome</span>
                <strong>Explain, compare, redraft</strong>
              </div>
              <div className="lx-brief-actions">
                <button type="button" className="lx-btn-card-primary" onClick={() => onNavigate('/contracts')}>
                  Review Contracts
                </button>
                <button type="button" className="lx-btn-card-ghost" onClick={() => onNavigate('/search')}>
                  Search Clauses
                </button>
              </div>
            </article>
          </div>

          {/* Metrics */}
          <section className="lx-metrics-grid" aria-label="Key metrics">
            {metrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </section>

          {/* Recent Contracts */}
          <section className="lx-section-card">
            <div className="lx-section-header">
              <div>
                <p className="lx-section-eyebrow">Recent Contracts</p>
                <h3 className="lx-section-title">Jump into review work</h3>
              </div>
              <button type="button" className="lx-view-all" onClick={() => onNavigate('/contracts')}>
                View all →
              </button>
            </div>

            <div className="lx-contract-grid">
              {contracts.length ? (
                contracts.slice(0, 3).map((contract) => (
                  <ContractCard
                    key={contract.id}
                    contract={contract}
                    isActive={contract.id === selectedContractId}
                    deletePending={deletingContractId === contract.id}
                    onDelete={onDeleteContract}
                    onSelect={(contractId) => {
                      onSelectContract(contractId);
                      onNavigate('/contracts');
                    }}
                  />
                ))
              ) : (
                <p className="lx-empty-state">
                  No live contracts are available yet. Go to Intake to upload one and populate the review workspace.
                </p>
              )}
            </div>
          </section>

        </main>
      </div>
    </>
  );
}

export default OverviewPage;