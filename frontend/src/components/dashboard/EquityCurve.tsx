import React, { type ReactElement } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

import { formatCompactCurrency } from '../../utils/formatters';

import type { EquityPoint } from '../../types';

interface EquityCurveProps {
  data: EquityPoint[];
}

function EquityCurve({ data }: EquityCurveProps): ReactElement {
  const firstValue = data[0]?.value ?? 0;
  const lastValue = data[data.length - 1]?.value ?? 0;
  const changePercent = firstValue > 0
    ? ((lastValue - firstValue) / firstValue) * 100
    : 0;
  const isPositive = changePercent >= 0;

  return (
    <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-dark-text-muted">
          Equity Curve (24H)
        </h3>
        <span className={`text-sm font-bold ${isPositive ? 'text-profit' : 'text-loss'}`}>
          {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
        </span>
      </div>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={['dataMin - 1000', 'dataMax + 1000']} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-dark-surface-secondary)',
                border: '1px solid var(--color-dark-border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value) => [formatCompactCurrency(Number(value)), 'Value']}
              labelStyle={{ color: 'var(--color-dark-text-muted)' }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={isPositive ? '#22c55e' : '#ef4444'}
              strokeWidth={2}
              fill="url(#equityGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default EquityCurve;
