import React, { type ReactElement, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

function Input({ label, error, className = '', id, ...rest }: InputProps): ReactElement {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-text-secondary dark:text-dark-text-secondary"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3 py-2 text-sm rounded-lg border bg-surface dark:bg-dark-surface-secondary text-text-primary dark:text-dark-text-primary placeholder-text-muted dark:placeholder-dark-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
          error
            ? 'border-loss focus:ring-loss'
            : 'border-border dark:border-dark-border'
        } ${className}`}
        {...rest}
      />
      {error && (
        <span className="text-xs text-loss">{error}</span>
      )}
    </div>
  );
}

export default Input;
