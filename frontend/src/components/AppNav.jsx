const navItems = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/intake', label: 'Intake', icon: 'intake' },
  { path: '/contracts', label: 'Review', icon: 'review' },
  { path: '/insights', label: 'Insights', icon: 'insights' },
  { path: '/search', label: 'Search', icon: 'search' },
  { path: '/documents', label: 'Vault', icon: 'vault' },
];

function formatNotificationTime(value) {
  if (!value) return 'Moments ago';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Moments ago';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function describeEmailStatus(notification) {
  if (notification.email?.sent) return 'Email sent';
  if (notification.email?.attempted) {
    if (notification.email?.reason === 'missing-gmail-send-scope')
      return 'Email blocked: reconnect Google for send access';
    return 'Email delivery failed';
  }
  if (notification.email?.reason === 'no-recipients-configured')
    return 'Email recipients not configured';
  return 'In-app alert ready';
}

function NavIcon({ type }) {
  const icons = {
    home: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    intake: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
    review: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="9" x2="15" y2="9" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" />
      </svg>
    ),
    insights: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    search: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    vault: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 3H8L5 7h14z" /><circle cx="12" cy="14" r="2" />
      </svg>
    ),
  };
  return icons[type] || null;
}

const sidebarStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  .lx-sidebar {
    width: 240px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 32px 18px 24px;
    background: rgba(0,0,0,0.22);
    backdrop-filter: blur(28px);
    -webkit-backdrop-filter: blur(28px);
    border-right: 1px solid rgba(255,255,255,0.15);
    position: relative;
    z-index: 10;
    flex-shrink: 0;
    font-family: 'Inter', 'Segoe UI', sans-serif;
  }

  /* ── Brand ── */
  .lx-logo {
    padding: 0 6px 28px;
    border-bottom: 1px solid rgba(255,255,255,0.15);
    margin-bottom: 28px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .lx-logo-icon {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 100%);
    border: 1px solid rgba(255,255,255,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  .lx-logo-text {}
  .lx-logo-name {
    font-size: 20px;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.5px;
    line-height: 1;
    margin: 0;
    text-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
  .lx-logo-sub {
    font-size: 10px;
    color: rgba(255,255,255,0.55);
    margin-top: 3px;
    font-weight: 500;
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }

  /* ── Section label ── */
  .lx-nav-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
    padding: 0 14px;
    margin-bottom: 8px;
  }

  /* ── Nav ── */
  .lx-nav {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .lx-nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 12px;
    cursor: pointer;
    color: rgba(255,255,255,0.65);
    font-size: 14.5px;
    font-weight: 700;
    transition: all 0.2s ease;
    border: 1px solid transparent;
    background: transparent;
    text-align: left;
    width: 100%;
    letter-spacing: 0.1px;
    font-family: 'Outfit', sans-serif;
    position: relative;
  }
  .lx-nav-item:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.12);
    color: #fff;
    transform: translateX(2px);
  }
  .lx-nav-item.active {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    color: #fff;
    font-weight: 800;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(12px);
  }
  .lx-nav-item.active::before {
    content: '';
    position: absolute;
    left: -18px;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 24px;
    border-radius: 0 4px 4px 0;
    background: linear-gradient(180deg, #00e5ff, #06b6d4);
    box-shadow: 0 0 8px rgba(0,229,255,0.5);
  }
  .lx-nav-icon {
    width: 18px;
    height: 18px;
    opacity: 0.8;
    flex-shrink: 0;
  }
  .lx-nav-item.active .lx-nav-icon {
    opacity: 1;
  }

  /* ── Footer ── */
  .lx-sidebar-footer {
    border-top: 1px solid rgba(255,255,255,0.12);
    padding-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* ── User chip — compact, not cluttered ── */
  .lx-user-chip {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: rgba(255,255,255,0.08);
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.1);
    transition: all 0.2s;
  }
  .lx-user-chip:hover {
    background: rgba(255,255,255,0.12);
  }
  .lx-user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: linear-gradient(135deg, #06b6d4, #7b2fbe);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 800;
    color: #fff;
    text-transform: uppercase;
    box-shadow: 0 2px 8px rgba(6,182,212,0.3);
  }
  .lx-user-info {
    flex: 1;
    min-width: 0;
  }
  .lx-user-name {
    font-size: 13.5px;
    font-weight: 800;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lx-user-org {
    font-size: 11px;
    color: rgba(255,255,255,0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lx-logout-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: rgba(255,255,255,0.4);
    transition: color 0.2s;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .lx-logout-btn:hover {
    color: #ef4444;
  }

  /* ── Notification toggle ── */
  .lx-notification-shell {
    position: relative;
  }

  .lx-notification-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 9px 14px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    color: rgba(255,255,255,0.7);
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'Inter', 'Segoe UI', sans-serif;
  }
  .lx-notification-toggle:hover,
  .lx-notification-toggle-open {
    background: rgba(255,255,255,0.12);
    color: #fff;
    border-color: rgba(255,255,255,0.2);
  }

  .lx-notification-count {
    background: linear-gradient(135deg, #f0287a, #ef4444);
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    border-radius: 100px;
    padding: 2px 7px;
    line-height: 1.4;
    box-shadow: 0 2px 6px rgba(240,40,122,0.4);
  }

  /* ── Notification popover ── */
  .lx-notification-popover {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    width: 340px;
    background: rgba(15,8,30,0.96);
    backdrop-filter: blur(28px);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 16px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.25);
    overflow: hidden;
    z-index: 100;
  }

  .lx-notification-popover-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 18px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  .lx-notification-popover-head .eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.8px;
    text-transform: uppercase;
    color: #00e5ff;
    margin-bottom: 3px;
  }
  .lx-notification-popover-head h3 {
    font-size: 15px;
    font-weight: 700;
    color: #fff;
    margin: 0;
  }

  .lx-notification-mark-read {
    background: rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.7);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 100px;
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: 'Inter', 'Segoe UI', sans-serif;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .lx-notification-mark-read:hover:not(:disabled) {
    background: rgba(255,255,255,0.18);
    color: #fff;
  }
  .lx-notification-mark-read:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .lx-notification-list {
    max-height: 320px;
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lx-notification-list::-webkit-scrollbar { width: 4px; }
  .lx-notification-list::-webkit-scrollbar-track { background: transparent; }
  .lx-notification-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }

  .lx-notification-item {
    width: 100%;
    text-align: left;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 12px 14px;
    cursor: pointer;
    transition: all 0.2s;
    font-family: 'Inter', 'Segoe UI', sans-serif;
  }
  .lx-notification-item:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.15);
  }
  .lx-notification-item-unread {
    border-left: 3px solid #00e5ff;
    background: rgba(0,229,255,0.06);
  }

  .lx-notification-item-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .lx-notification-item-head .eyebrow {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.4);
    margin-bottom: 2px;
  }
  .lx-notification-item-head h4 {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    line-height: 1.3;
    margin: 0;
  }

  .lx-notification-severity {
    font-size: 10px;
    font-weight: 700;
    border-radius: 100px;
    padding: 2px 8px;
    white-space: nowrap;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .lx-notification-severity-high { background: rgba(240,40,122,0.2); color: #f9a8d4; }
  .lx-notification-severity-medium { background: rgba(245,158,11,0.2); color: #fcd34d; }
  .lx-notification-severity-low { background: rgba(34,197,94,0.2); color: #86efac; }

  .lx-notification-message {
    font-size: 12.5px;
    color: rgba(255,255,255,0.55);
    line-height: 1.5;
    margin-bottom: 6px;
  }

  .lx-notification-meta {
    font-size: 11px;
    color: rgba(255,255,255,0.3);
  }

  .lx-notification-empty {
    font-size: 13px;
    color: rgba(255,255,255,0.4);
    text-align: center;
    padding: 24px 16px;
    line-height: 1.6;
  }

  @media (max-width: 768px) {
    .lx-sidebar {
      display: none;
    }
  }
`;

function AppNav({
  authUser,
  currentPath,
  theme,
  onToggleTheme,
  notifications = [],
  notificationsOpen,
  notificationUnreadCount,
  onLogout,
  onMarkNotificationsRead,
  onNavigate,
  onNotificationSelect,
  onToggleNotifications,
  modeLabel,
  contracts = [],
}) {
  const userInitial = authUser?.fullName ? authUser.fullName.charAt(0) : '?';

  return (
    <>
      <style>{sidebarStyles}</style>
      <aside className="lx-sidebar" aria-label="Primary navigation">

        {/* Brand */}
        <div className="lx-logo">
          <div className="lx-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z" fill="white" fillOpacity="0.9" />
              <path d="M9 12l2 2 4-4" stroke="#7b2fbe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="lx-logo-text">
            <p className="lx-logo-name">Lexora</p>
            <p className="lx-logo-sub">Legal Intelligence</p>
          </div>
        </div>

        {/* Nav links */}
        <p className="lx-nav-label">Navigation</p>
        <nav className="lx-nav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              className={`lx-nav-item${currentPath === item.path ? ' active' : ''}`}
              onClick={() => onNavigate(item.path)}
            >
              <NavIcon type={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer area — clean, compact */}
        <div className="lx-sidebar-footer">

          {/* User chip (compact) */}
          {authUser && (
            <div className="lx-user-chip">
              <div className="lx-user-avatar">{userInitial}</div>
              <div className="lx-user-info">
                <div className="lx-user-name">{authUser.fullName}</div>
                <div className="lx-user-org">{authUser.organizationName}</div>
              </div>
              
              <button type="button" className="lx-logout-btn" onClick={onLogout} title="Logout">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          )}

          {/* Notifications */}
          <div className="lx-notification-shell">
            <button
              type="button"
              className={`lx-notification-toggle ${notificationsOpen ? 'lx-notification-toggle-open' : ''}`}
              onClick={onToggleNotifications}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
                Alerts
              </span>
              {notificationUnreadCount ? (
                <span className="lx-notification-count">{notificationUnreadCount}</span>
              ) : null}
            </button>

            {notificationsOpen && (
              <section className="lx-notification-popover" aria-label="Automation alerts">
                <div className="lx-notification-popover-head">
                  <div>
                    <p className="eyebrow">Automation Alerts</p>
                    <h3>Latest activity</h3>
                  </div>
                  <button
                    type="button"
                    className="lx-notification-mark-read"
                    onClick={onMarkNotificationsRead}
                    disabled={!notificationUnreadCount}
                  >
                    Mark All Read
                  </button>
                </div>

                <div className="lx-notification-list">
                  {notifications.length ? (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        className={`lx-notification-item ${notification.readAt ? '' : 'lx-notification-item-unread'}`}
                        onClick={() => onNotificationSelect(notification)}
                      >
                        <div className="lx-notification-item-head">
                          <div>
                            <p className="eyebrow">{notification.sourceLabel}</p>
                            <h4>{notification.title}</h4>
                          </div>
                          <span className={`lx-notification-severity lx-notification-severity-${notification.severity}`}>
                            {notification.statusLabel}
                          </span>
                        </div>
                        <p className="lx-notification-message">{notification.message}</p>
                        <p className="lx-notification-meta">
                          {formatNotificationTime(notification.createdAt)} | {describeEmailStatus(notification)}
                        </p>
                      </button>
                    ))
                  ) : (
                    <p className="lx-notification-empty">No alerts yet.</p>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export default AppNav;
