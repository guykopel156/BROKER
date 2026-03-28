import React, { type ReactElement } from 'react';

import { ThemeProvider } from './context/ThemeContext';

function App(): ReactElement {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-surface dark:bg-dark-surface text-text-primary dark:text-dark-text-primary transition-colors duration-200">
        <h1 className="text-2xl font-bold p-4">AI Trading Dashboard</h1>
      </div>
    </ThemeProvider>
  );
}

export default App;
