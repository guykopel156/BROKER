import React, { type ReactElement } from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

function Card({ title, children, footer, className = '' }: CardProps): ReactElement {
  return (
    <div className={`bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl shadow-sm ${className}`}>
      {title && (
        <div className="px-4 py-3 border-b border-border dark:border-dark-border">
          <h3 className="text-sm font-semibold text-text-primary dark:text-dark-text-primary">{title}</h3>
        </div>
      )}
      <div className="p-4">{children}</div>
      {footer && (
        <div className="px-4 py-3 border-t border-border dark:border-dark-border">{footer}</div>
      )}
    </div>
  );
}

export default Card;
