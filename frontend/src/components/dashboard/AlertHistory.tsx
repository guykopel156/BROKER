import React, { type ReactElement } from 'react';

import type { AlertItem } from '../../mocks/alertsData';

interface AlertHistoryProps {
  alerts: AlertItem[];
}

type AlertType = 'trade' | 'loss-limit' | 'engine-paused' | 'error';

const TYPE_STYLES: Record<AlertType, { dot: string; text: string }> = {
  trade: { dot: 'bg-primary', text: 'text-primary' },
  'loss-limit': { dot: 'bg-loss', text: 'text-loss' },
  'engine-paused': { dot: 'bg-warning', text: 'text-warning' },
  error: { dot: 'bg-loss', text: 'text-loss' },
};

const TYPE_LABELS: Record<AlertType, string> = {
  trade: 'Trade',
  'loss-limit': 'Loss Limit',
  'engine-paused': 'Engine',
  error: 'Error',
};

function AlertHistory({ alerts }: AlertHistoryProps): ReactElement {
  return (
    <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl">
      <div className="px-4 py-3 border-b border-border dark:border-dark-border">
        <h2 className="text-sm font-semibold text-text-primary dark:text-dark-text-primary">
          Alert History
        </h2>
      </div>
      <div className="divide-y divide-border dark:divide-dark-border max-h-96 overflow-y-auto">
        {alerts.map((alert) => {
          const style = TYPE_STYLES[alert.type];
          return (
            <div key={alert.id} className="px-4 py-3 flex items-start gap-3">
              <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${style.dot}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-semibold uppercase ${style.text}`}>
                    {TYPE_LABELS[alert.type]}
                  </span>
                  <span className="text-xs text-text-muted dark:text-dark-text-muted">
                    {alert.timestamp}
                  </span>
                </div>
                <p className="text-sm text-text-primary dark:text-dark-text-primary">
                  {alert.message}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AlertHistory;
