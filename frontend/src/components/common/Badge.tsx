import React, { type ReactElement } from 'react';

type BadgeVariant = 'buy' | 'sell' | 'filled' | 'pending' | 'failed' | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  buy: 'bg-profit-light text-green-800 dark:bg-green-900 dark:text-green-200',
  sell: 'bg-loss-light text-red-800 dark:bg-red-900 dark:text-red-200',
  filled: 'bg-profit-light text-green-800 dark:bg-green-900 dark:text-green-200',
  pending: 'bg-warning-light text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  failed: 'bg-loss-light text-red-800 dark:bg-red-900 dark:text-red-200',
  default: 'bg-surface-tertiary text-text-secondary dark:bg-dark-surface-tertiary dark:text-dark-text-secondary',
};

function Badge({ variant = 'default', children, className = '' }: BadgeProps): ReactElement {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${VARIANT_CLASSES[variant]} ${className}`}>
      {children}
    </span>
  );
}

export default Badge;
