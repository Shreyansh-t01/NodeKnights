function AuthPage({
  pending,
  error,
  loginForm,
  onLoginChange,
  onLoginSubmit,
}) {
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
