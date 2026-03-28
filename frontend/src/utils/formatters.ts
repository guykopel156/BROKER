const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COMPACT_USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});

const PERCENT_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US');

export function formatCurrency(value: number): string {
  return USD_FORMATTER.format(value);
}

export function formatCompactCurrency(value: number): string {
  return COMPACT_USD_FORMATTER.format(value);
}

export function formatPercent(value: number): string {
  return PERCENT_FORMATTER.format(value / 100);
}

export function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

export function formatPnl(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${formatCurrency(value)}`;
}

export function formatPnlPercent(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

export function formatTokenCount(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k tokens`;
  }
  return `${value} tokens`;
}
