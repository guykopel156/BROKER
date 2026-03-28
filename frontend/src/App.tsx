import React, { type ReactElement } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { ThemeProvider } from './context/ThemeContext';
import AppRoutes from './routes';

function App(): ReactElement {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-surface dark:bg-dark-surface text-text-primary dark:text-dark-text-primary transition-colors duration-200">
          <AppRoutes />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
