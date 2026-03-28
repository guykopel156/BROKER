import React, { useState, useCallback, type ReactElement } from 'react';

import { Button, Card, Input, Modal } from '../components/common';

const INTERVAL_OPTIONS = [
  { label: '5 min', value: 5 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
];

const DEFAULT_STRATEGY = `You are an autonomous AI trading agent managing a real brokerage account. Your goal is to generate consistent, risk-managed returns through active stock trading.

=== RISK MANAGEMENT ===
- Never risk more than 2% of total portfolio value on a single trade
- Maximum 5 open positions at any time
- Keep at least 20% of portfolio in cash at all times

=== ENTRY CRITERIA (need at least 2) ===
- RSI below 35 (oversold) or above 65 with momentum
- Price bouncing off key moving average (20 or 50 day)
- Volume spike (1.5x+ average) confirming direction
- MACD crossover in the direction of the trade

=== EXIT CRITERIA ===
- Take profit: 2-5% gain
- Stop loss: 1-2% below entry
- Time stop: exit if no progress after 2 trading days`;

function Settings(): ReactElement {
  const [maxLossPercent, setMaxLossPercent] = useState('10');
  const [tradingInterval, setTradingInterval] = useState(15);
  const [strategyPrompt, setStrategyPrompt] = useState(DEFAULT_STRATEGY);
  const [isPaperTrading, setIsPaperTrading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleToggleTradingMode = useCallback((): void => {
    if (isPaperTrading) {
      setIsModalOpen(true);
    } else {
      setIsPaperTrading(true);
    }
  }, [isPaperTrading]);

  const handleConfirmLiveMode = useCallback((): void => {
    setIsPaperTrading(false);
    setIsModalOpen(false);
  }, []);

  const handleSave = useCallback(async (): Promise<void> => {
    setIsSaving(true);
    // Will connect to backend API later
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsSaving(false);
  }, []);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">Settings</h1>

      {/* Connection Status */}
      <Card title="Connection Status">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary dark:text-dark-text-secondary">IBKR Gateway</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-loss" />
              <span className="text-sm font-medium text-loss">Disconnected</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary dark:text-dark-text-secondary">MongoDB</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-profit" />
              <span className="text-sm font-medium text-profit">Connected</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary dark:text-dark-text-secondary">Claude API</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-profit" />
              <span className="text-sm font-medium text-profit">Connected</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary dark:text-dark-text-secondary">Polygon.io</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-profit" />
              <span className="text-sm font-medium text-profit">Connected</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Trading Mode */}
      <Card title="Trading Mode">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary dark:text-dark-text-primary">
              {isPaperTrading ? 'Paper Trading (Simulated)' : 'Live Trading (Real Money)'}
            </p>
            <p className="text-xs text-text-muted dark:text-dark-text-muted mt-1">
              {isPaperTrading
                ? 'Trades are simulated. No real money is used.'
                : 'Trades use real money from your IBKR account.'}
            </p>
          </div>
          <button
            onClick={handleToggleTradingMode}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isPaperTrading ? 'bg-surface-tertiary dark:bg-dark-surface-tertiary' : 'bg-loss'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isPaperTrading ? 'translate-x-1' : 'translate-x-6'
              }`}
            />
          </button>
        </div>
      </Card>

      {/* Risk Management */}
      <Card title="Risk Management">
        <div className="flex flex-col gap-4">
          <Input
            label="Max Loss Limit (%)"
            type="number"
            value={maxLossPercent}
            onChange={(e) => setMaxLossPercent(e.target.value)}
            placeholder="e.g. 10"
          />
          <p className="text-xs text-text-muted dark:text-dark-text-muted">
            Claude will automatically pause if portfolio loses more than this percentage in a day.
          </p>
        </div>
      </Card>

      {/* Trading Interval */}
      <Card title="Trading Interval">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-text-muted dark:text-dark-text-muted">
            How often Claude analyzes the market and makes decisions.
          </p>
          <div className="flex flex-wrap gap-2">
            {INTERVAL_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setTradingInterval(option.value)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  tradingInterval === option.value
                    ? 'bg-primary text-white'
                    : 'bg-surface-tertiary dark:bg-dark-surface-tertiary text-text-secondary dark:text-dark-text-secondary hover:bg-border dark:hover:bg-dark-border'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Strategy Prompt */}
      <Card title="Claude Strategy Prompt">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-text-muted dark:text-dark-text-muted">
            This prompt defines how Claude makes trading decisions. Edit to customize the strategy.
          </p>
          <textarea
            value={strategyPrompt}
            onChange={(e) => setStrategyPrompt(e.target.value)}
            rows={12}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border dark:border-dark-border bg-surface dark:bg-dark-surface text-text-primary dark:text-dark-text-primary placeholder-text-muted font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
          />
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} isLoading={isSaving} size="lg">
          Save Settings
        </Button>
      </div>

      {/* Live Mode Confirmation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Switch to Live Trading?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmLiveMode}>
              Enable Live Trading
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
            You are about to switch to <strong className="text-loss">live trading mode</strong>.
            This means Claude will execute real trades using real money from your IBKR account.
          </p>
          <div className="p-3 rounded-lg bg-loss-light dark:bg-red-900/20 border border-loss/30">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Warning: Real money will be at risk. Make sure you have tested thoroughly with paper trading first.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default Settings;
