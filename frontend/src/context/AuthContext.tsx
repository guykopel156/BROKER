import React, { createContext, useContext, useState, useCallback, useEffect, type ReactElement } from 'react';

interface AuthContextValue {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  login: (token: string, username: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'broker-token';
const USERNAME_KEY = 'broker-username';

interface AuthProviderProps {
  children: React.ReactNode;
}

function AuthProvider({ children }: AuthProviderProps): ReactElement {
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = useState<string | null>(localStorage.getItem(USERNAME_KEY));

  const isAuthenticated = Boolean(token);

  const login = useCallback((newToken: string, newUsername: string): void => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USERNAME_KEY, newUsername);
    setToken(newToken);
    setUsername(newUsername);
  }, []);

  const logout = useCallback((): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    setToken(null);
    setUsername(null);
  }, []);

  // Set auth header for all API calls
  useEffect(() => {
    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token);
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, token, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { AuthProvider, useAuth };
