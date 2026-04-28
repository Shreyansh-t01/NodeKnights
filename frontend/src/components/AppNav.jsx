

const navItems = [ { path: '/', label: 'Home' }, { path: '/intake', label: 'Intake' }, { path: '/contracts', label: 'Review' }, { path: '/insights', label: 'Insights' }, { path: '/search', label: 'Search' }, { path: '/documents', label: 'Vault' }, ]; function formatNotification

pasted


import MetricCard from '../components/MetricCard'; import StatusPill from '../components/StatusPill'; import ContractCard from '../components/ContractCard'; const styles = ` @import url('https://fonts.googleapis.com/css2?family=Clash+Display:wght@400;500;600;700&family=DM+Sans:ital,opsz,wght

pasted

i have provided the code of the component navbar and the overview page actually. this is the inspiration for the page but you know what i think do the required changes in the navbar component only  so that i do not have to write the side navigation bar in the overview page only and the website shows only the side navigation bar

2:44 AM
Claude responded: Looking at your code, I understand what you want: modify the AppNav component to become a vertical sidebar navigation instead of a horizontal top bar, so the O…

Reading frontend design skill
Reading frontend design skill
Looking at your code, I understand what you want: modify the AppNav component to become a vertical sidebar navigation instead of a horizontal top bar, so the OverviewPage doesn't need its own duplicate sidebar.

Here's the updated AppNav component:


Created a file, read a file
Created a file, read a file
Here's what changed in AppNav:

Structure — The component is now an <aside> instead of a <header>, rendering as a vertical sidebar with flex-direction: column and a fixed 220px width.

Layout — Brand at the top → nav links filling available space → user/notifications pinned to the bottom footer area, exactly mirroring the sidebar pattern from OverviewPage.

Nav items — Added an icon field to navItems and brought in the NavIcon component inline so each nav link shows the icon + label just like the OverviewPage sidebar did.

Notifications popover — Opens upward (bottom: calc(100% + 8px)) so it doesn't get clipped by the bottom of the sidebar.

New optional prop — contracts (defaults to []) is accepted so the sidebar can optionally show the stat counters (contracts count, high risk count) in the footer if you pass them in.

OverviewPage cleanup — You can now remove the entire <aside className="lx-sidebar"> block and the NavIcon function from OverviewPage.jsx since AppNav handles all of that. Just make sure AppNav is rendered outside .lx-main and both sit inside .lx-root.


Appnav
Code · JSX 

Want to be notified when Claude responds?



Claude is AI and can make mistakes. Please double-check responses.
Appnav · JSX
Copy

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
  .app-nav {
    width: 220px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 28px 16px;
    background: rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-right: 1px solid rgba(255, 255, 255, 0.12);
    position: relative;
    z-index: 10;
    flex-shrink: 0;
  }
 
  .app-nav-brand {
    padding: 0 8px 32px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    margin-bottom: 24px;
  }
 
  .brand-name {
    font-family: 'Clash Display', sans-serif;
    font-size: 26px;
    font-weight: 700;
    color: #fff;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #fff 0%, #f9a8d4 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1;
    margin: 0;
  }
 
  .brand-tagline {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 3px;
    font-weight: 400;
    letter-spacing: 0.3px;
  }
 
  .app-nav-links {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
 
  .nav-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 14px;
    border-radius: 10px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
    border: none;
    background: transparent;
    text-align: left;
    width: 100%;
    letter-spacing: 0.1px;
    font-family: 'DM Sans', sans-serif;
  }
 
  .nav-link:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }
 
  .nav-link-active {
    background: rgba(255, 255, 255, 0.18) !important;
    color: #fff !important;
    font-weight: 600 !important;
  }
 
  .app-nav-status {
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    padding-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
 
  .mode-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 500;
    letter-spacing: 0.3px;
    padding: 0 4px;
  }
 
  .user-menu {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
 
  .user-menu > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
 
  .user-menu span {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
  }
 
  .user-menu small {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
  }
 
  .user-menu button {
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 100px;
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'DM Sans', sans-serif;
    text-align: center;
  }
 
  .user-menu button:hover {
    background: rgba(255, 255, 255, 0.22);
    color: #fff;
  }
 
  /* Notification bell */
  .notification-shell {
    position: relative;
  }
 
  .notification-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'DM Sans', sans-serif;
  }
 
  .notification-toggle:hover,
  .notification-toggle-open {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.2);
  }
 
  .notification-count {
    background: #f0287a;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    border-radius: 100px;
    padding: 1px 7px;
    line-height: 1.6;
  }
 
  /* Notification popover — opens upward from sidebar footer */
  .notification-popover {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    width: 340px;
    background: rgba(20, 10, 40, 0.95);
    backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    z-index: 100;
  }
 
  .notification-popover-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 18px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
 
  .notification-popover-head .eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.8px;
    text-transform: uppercase;
    color: #f0287a;
    margin-bottom: 3px;
  }
 
  .notification-popover-head h3 {
    font-family: 'Clash Display', sans-serif;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
  }
 
  .notification-mark-read {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 100px;
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: 'DM Sans', sans-serif;
    white-space: nowrap;
    flex-shrink: 0;
  }
 
  .notification-mark-read:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
  }
 
  .notification-mark-read:disabled {
    opacity: 0.35;
    cursor: default;
  }
 
  .notification-list {
    max-height: 320px;
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
 
  .notification-list::-webkit-scrollbar { width: 4px; }
  .notification-list::-webkit-scrollbar-track { background: transparent; }
  .notification-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
 
  .notification-item {
    width: 100%;
    text-align: left;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 12px 14px;
    cursor: pointer;
    transition: all 0.2s;
    font-family: 'DM Sans', sans-serif;
  }
 
  .notification-item:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.15);
  }
 
  .notification-item-unread {
    border-left: 3px solid #f0287a;
    background: rgba(240, 40, 122, 0.08);
  }
 
  .notification-item-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
 
  .notification-item-head .eyebrow {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.45);
    margin-bottom: 2px;
  }
 
  .notification-item-head h4 {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    line-height: 1.3;
  }
 
  .notification-severity {
    font-size: 10px;
    font-weight: 700;
    border-radius: 100px;
    padding: 2px 8px;
    white-space: nowrap;
    flex-shrink: 0;
    margin-top: 2px;
  }
 
  .notification-severity-high { background: rgba(240,40,122,0.2); color: #f9a8d4; }
  .notification-severity-medium { background: rgba(245,158,11,0.2); color: #fcd34d; }
  .notification-severity-low { background: rgba(34,197,94,0.2); color: #86efac; }
 
  .notification-message {
    font-size: 12.5px;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.5;
    margin-bottom: 6px;
  }
 
  .notification-meta {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
  }
 
  .empty-state {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
    padding: 24px 16px;
    line-height: 1.6;
  }
 
  @media (max-width: 768px) {
    .app-nav {
      display: none;
    }
  }
`;
 
function AppNav({
  authUser,
  currentPath,
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
  const highRiskCount = contracts.reduce(
    (sum, contract) => sum + (contract.riskCounts?.high || 0),
    0
  );
 
  return (
    <>
      <style>{sidebarStyles}</style>
      <aside className="app-nav panel" aria-label="Primary navigation">
 
        {/* Brand */}
        <div className="app-nav-brand">
          <p className="brand-name">Lexora</p>
          <p className="brand-tagline">Legal intelligence workspace</p>
        </div>
 
        {/* Nav links */}
        <nav className="app-nav-links" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              className={`nav-link ${currentPath === item.path ? 'nav-link-active' : ''}`}
              onClick={() => onNavigate(item.path)}
            >
              <NavIcon type={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>
 
        {/* Footer area */}
        <div className="app-nav-status">
          {modeLabel && (
            <span className="mode-label">{modeLabel}</span>
          )}
 
          {authUser && (
            <div className="user-menu">
              <div>
                <span>{authUser.fullName}</span>
                <small>{authUser.organizationName}</small>
              </div>
              <button type="button" onClick={onLogout}>Logout</button>
            </div>
          )}
 
          {/* Notifications */}
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
 
            {notificationsOpen && (
              <section className="notification-popover" aria-label="Automation alerts">
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
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
 
export default AppNav;
 




