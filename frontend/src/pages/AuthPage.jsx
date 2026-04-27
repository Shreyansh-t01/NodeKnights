function AuthPage({
  pending,
  error,
  loginForm,
  testerCredentials,
  onLoginChange,
  onLoginSubmit,
}) {
  const hasTesterCredentials = Boolean(
    testerCredentials?.enabled
      && testerCredentials?.username
      && testerCredentials?.password,
  );

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <div className="brand-mark" aria-hidden="true">
            <span className="brand-mark-spine" />
            <span className="brand-mark-line brand-mark-line-top" />
            <span className="brand-mark-line brand-mark-line-bottom" />
          </div>
          <div>
            <p className="brand-name">Lexora</p>
            <p className="brand-tagline">Legal intelligence workspace</p>
          </div>
        </div>

        <div className="auth-copy">
          <p className="eyebrow">Secure Workspace</p>
          <h1>Sign in to your review desk.</h1>
          <p>
            Use your configured workspace credentials to open your private Lexora review environment.
          </p>
        </div>

        {hasTesterCredentials ? (
          <details className="auth-tester-box">
            <summary className="auth-tester-summary">
              <span>
                <strong>Tester login credentials</strong>
                <small>Open this box to view the login details.</small>
              </span>
              <span className="auth-tester-arrow" aria-hidden="true">&#9662;</span>
            </summary>

            <div className="auth-tester-body">
              <div className="auth-tester-row">
                <span>Tester username</span>
                <code>{testerCredentials.username}</code>
              </div>
              <div className="auth-tester-row">
                <span>Tester password</span>
                <code>{testerCredentials.password}</code>
              </div>
            </div>
          </details>
        ) : null}

        {error ? (
          <p className="auth-error" role="alert">{error}</p>
        ) : null}

        <form className="auth-form" onSubmit={onLoginSubmit}>
          <label>
            Username
            <input
              value={loginForm.username}
              onChange={(event) => onLoginChange('username', event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={loginForm.password}
              onChange={(event) => onLoginChange('password', event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <button type="submit" disabled={pending}>
            {pending ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default AuthPage;
