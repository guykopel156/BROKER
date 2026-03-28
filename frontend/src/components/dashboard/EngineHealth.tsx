import React, { type ReactElement } from 'react';

import { formatTokenCount } from '../../utils/formatters';

import type { EngineHealthData } from '../../types';

interface EngineHealthProps {
  data: EngineHealthData;
}

interface HealthRowProps {
  label: string;
  value: string;
  barPercent?: number;
  barColor?: string;
}

const MAX_LATENCY_MS = 200;

function HealthRow({ label, value, barPercent, barColor = 'bg-primary' }: HealthRowProps): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary dark:text-dark-text-secondary">{label}</span>
        <span className="text-sm font-semibold text-primary">{value}</span>
      </div>
      {barPercent !== undefined && (
        <div className="h-1.5 w-full rounded-full bg-surface-tertiary dark:bg-dark-surface-tertiary">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-300`}
            style={{ width: `${Math.min(barPercent, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function EngineHealth({ data }: EngineHealthProps): ReactElement {
  const latencyPercent = (data.apiLatencyMs / MAX_LATENCY_MS) * 100;

  return (
    <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-dark-text-muted mb-4">
        Claude Engine Health
      </h3>
      <div className="flex flex-col gap-4">
        <HealthRow
          label={`API Latency (${data.exchange})`}
          value={`${data.apiLatencyMs}ms`}
          barPercent={latencyPercent}
          barColor="bg-profit"
        />
        <HealthRow
          label="Neural Processing Load"
          value={`${data.processingLoadPercent}%`}
          barPercent={data.processingLoadPercent}
          barColor="bg-primary"
        />
        <HealthRow
          label="Memory Context"
          value={formatTokenCount(data.memoryContextTokens)}
        />
      </div>
    </div>
  );
}

export default EngineHealth;
