import React, { type ReactElement } from 'react';

import { useToast } from '../../context/ToastContext';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'bg-profit-light text-green-800 dark:bg-green-900 dark:text-green-200 border-profit',
  error: 'bg-loss-light text-red-800 dark:bg-red-900 dark:text-red-200 border-loss',
  warning: 'bg-warning-light text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-warning',
  info: 'bg-info-light text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-info',
};

const VARIANT_ICONS: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

function ToastContainer(): ReactElement {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg animate-slide-in ${VARIANT_CLASSES[toast.variant]}`}
        >
          <span className="text-lg font-bold">{VARIANT_ICONS[toast.variant]}</span>
          <span className="text-sm font-medium flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-current opacity-60 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export default ToastContainer;
