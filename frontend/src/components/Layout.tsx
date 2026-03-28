import React, { type ReactElement } from 'react';

import Navbar from './Navbar';

interface LayoutProps {
  children: React.ReactNode;
}

function Layout({ children }: LayoutProps): ReactElement {
  return (
    <div className="min-h-screen bg-surface dark:bg-dark-surface text-text-primary dark:text-dark-text-primary transition-colors duration-200">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}

export default Layout;
