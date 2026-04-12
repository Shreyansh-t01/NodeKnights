const navItems = [
  { path: '/', label: 'Overview' },
  { path: '/intake', label: 'Intake' },
  { path: '/contracts', label: 'Contracts' },
  { path: '/insights', label: 'Insights' },
  { path: '/search', label: 'Search' },
  { path: '/documents', label: 'Documents' },
];

function formatNotificationTime(value) {
  if (!value) {
    return 'Moments ago';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Moments ago';
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function describeEmailStatus(notification) {
  if (notification.email?.sent) {
    return 'Email sent';
  }

  if (notification.email?.attempted) {
    if (notification.email?.reason === 'missing-gmail-send-scope') {
      return 'Email blocked: reconnect Google for send access';
    }

    return 'Email delivery failed';
  }

  if (notification.email?.reason === 'no-recipients-configured') {
    return 'Email recipients not configured';
  }

  return 'In-app alert ready';
}

function AppNav({
  currentPath,
  notifications = [],
  notificationsOpen,
  notificationUnreadCount,
  onMarkNotificationsRead,
  onNavigate,
  onNotificationSelect,
  onToggleNotifications,
  modeLabel,
}) {
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

        <div className="notification-shell">
          <button
            type="button"
            className={`notification-toggle ${notificationsOpen ? 'notification-toggle-open' : ''}`}
            onClick={onToggleNotifications}
          >
            <span>Alerts</span>
            {notificationUnreadCount ? (
              <span className="notification-count">{notificationUnreadCount}</span>
            ) : null}
          </button>

          {notificationsOpen ? (
            <section className="notification-popover panel" aria-label="Automation alerts">
              <div className="notification-popover-head">
                <div>
                  <p className="eyebrow">Automation Alerts</p>
                  <h3>Latest document activity</h3>
                </div>
                <button
                  type="button"
                  className="notification-mark-read"
                  onClick={onMarkNotificationsRead}
                  disabled={!notificationUnreadCount}
                >
                  Mark All Read
                </button>
              </div>

              <div className="notification-list">
                {notifications.length ? (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      className={`notification-item ${notification.readAt ? '' : 'notification-item-unread'}`}
                      onClick={() => onNotificationSelect(notification)}
                    >
                      <div className="notification-item-head">
                        <div>
                          <p className="eyebrow">{notification.sourceLabel}</p>
                          <h4>{notification.title}</h4>
                        </div>
                        <span className={`notification-severity notification-severity-${notification.severity}`}>
                          {notification.statusLabel}
                        </span>
                      </div>
                      <p className="notification-message">{notification.message}</p>
                      <p className="notification-meta">
                        {formatNotificationTime(notification.createdAt)} | {describeEmailStatus(notification)}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="empty-state">No automatic document alerts have arrived yet.</p>
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export default AppNav;
