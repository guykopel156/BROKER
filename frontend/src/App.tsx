import React, { type ReactElement } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer, ErrorBoundary } from './components/common';
import Layout from './components/Layout';
import AppRoutes from './routes';

function App(): ReactElement {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <Layout>
              <AppRoutes />
            </Layout>
            <ToastContainer />
          </BrowserRouter>
        </ErrorBoundary>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
