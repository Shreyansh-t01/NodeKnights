const navItems = [
  { path: '/', label: 'Overview' },
  { path: '/intake', label: 'Intake' },
  { path: '/contracts', label: 'Contracts' },
  { path: '/insights', label: 'Insights' },
  { path: '/search', label: 'Search' },
  { path: '/documents', label: 'Documents' },
];

function AppNav({ currentPath, onNavigate, modeLabel }) {
  return (
    <header className="app-nav panel">
      <div className="app-nav-brand">
        <p className="eyebrow">Legal Intelligence System</p>
        <h2>Contract Review Workspace</h2>
      </div>

      <nav className="app-nav-links" aria-label="Primary">
        {navItems.map((item) => (
          <button
            key={item.path}
            type="button"
            className={`nav-link ${currentPath === item.path ? 'nav-link-active' : ''}`}
            onClick={() => onNavigate(item.path)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="app-nav-status">
        <span className="mode-label">{modeLabel}</span>
      </div>
    </header>
  );
}

export default AppNav;
