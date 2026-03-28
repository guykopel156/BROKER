import React, { useEffect, type ReactElement } from 'react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  isVisible: boolean;
  onClose: () => void;
  durationMs?: number;
}

const AUTO_DISMISS_MS = 5000;

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

function Toast({
  message,
  variant = 'info',
  isVisible,
  onClose,
  durationMs = AUTO_DISMISS_MS,
}: ToastProps): ReactElement | null {
  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(onClose, durationMs);
    return () => clearTimeout(timer);
  }, [isVisible, onClose, durationMs]);

  if (!isVisible) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg transition-all duration-300 ${VARIANT_CLASSES[variant]}`}>
      <span className="text-lg font-bold">{VARIANT_ICONS[variant]}</span>
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-current opacity-60 hover:opacity-100 transition-opacity"
      >
        ✕
      </button>
    </div>
  );
}

export default Toast;
