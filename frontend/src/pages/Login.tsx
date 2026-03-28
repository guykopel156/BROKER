import React, { useState, useCallback, type ReactElement } from 'react';

import { useAuth } from '../context/AuthContext';

function Login(): ReactElement {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = useCallback(async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          ...(showTwoFactor ? { twoFactorCode } : {}),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error?.message ?? 'Login failed');
        setIsLoading(false);
        return;
      }

      if (result.data.requiresTwoFactor) {
        setShowTwoFactor(true);
        setIsLoading(false);
        return;
      }

      login(result.data.token, result.data.username);
    } catch {
      setError('Cannot connect to server');
    } finally {
      setIsLoading(false);
    }
  }, [username, password, twoFactorCode, showTwoFactor, login]);

  return (
    <div className="min-h-screen bg-dark-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">BROKER</h1>
          <p className="text-sm text-dark-text-muted">AI Trading Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-dark-surface-secondary border border-dark-border rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-dark-text-primary text-center">
            {showTwoFactor ? 'Two-Factor Authentication' : 'Login'}
          </h2>

          {!showTwoFactor ? (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-dark-text-secondary">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-dark-border bg-dark-surface text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter username"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-dark-text-secondary">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-dark-border bg-dark-surface text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter password"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-dark-text-secondary">Authentication Code</label>
              <input
                type="text"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-dark-border bg-dark-surface text-dark-text-primary placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-primary text-center text-lg tracking-widest"
                placeholder="000000"
                maxLength={6}
                autoFocus
              />
              <p className="text-xs text-dark-text-muted">Enter the code from your authenticator app</p>
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded-lg bg-loss-light/20 border border-loss/30">
              <p className="text-xs text-loss font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2.5 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Logging in...' : showTwoFactor ? 'Verify' : 'Login'}
          </button>

          {showTwoFactor && (
            <button
              type="button"
              onClick={() => { setShowTwoFactor(false); setTwoFactorCode(''); }}
              className="w-full text-xs text-dark-text-muted hover:text-dark-text-primary transition-colors"
            >
              Back to login
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

export default Login;
