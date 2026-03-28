import React, { type ReactElement } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastContainer, ErrorBoundary } from './components/common';
import Layout from './components/Layout';
import ChatWidget from './components/ChatWidget';
import Login from './pages/Login';
import AppRoutes from './routes';

function AuthenticatedApp(): ReactElement {
  return (
    <BrowserRouter>
      <Layout>
        <AppRoutes />
      </Layout>
      <ToastContainer />
      <ChatWidget />
    </BrowserRouter>
  );
}

function AppContent(): ReactElement {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return <AuthenticatedApp />;
}

function App(): ReactElement {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ErrorBoundary>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ErrorBoundary>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
