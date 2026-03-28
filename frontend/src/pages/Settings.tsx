import React, { useState, useEffect, useCallback, type ReactElement } from 'react';

import { Button, Card, Input, Modal } from '../components/common';
import { fetchSettings, updateSettings, fetchHealth } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const INTERVAL_OPTIONS = [
  { label: '5 min', value: 5 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
];

interface ConnectionStatus {
  name: string;
  isConnected: boolean;
}

function Settings(): ReactElement {
  const [maxLossPercent, setMaxLossPercent] = useState('10');
  const [tradingInterval, setTradingInterval] = useState(15);
  const [strategyPrompt, setStrategyPrompt] = useState('');
  const [isPaperTrading, setIsPaperTrading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connections, setConnections] = useState<ConnectionStatus[]>([
    { name: 'Backend Server', isConnected: false },
    { name: 'MongoDB', isConnected: false },
    { name: 'Claude API', isConnected: false },
    { name: 'Polygon.io', isConnected: false },
  ]);
  const [twoFaQrCode, setTwoFaQrCode] = useState('');
  const [twoFaSecret, setTwoFaSecret] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [isTwoFaEnabled, setIsTwoFaEnabled] = useState(false);
  const [showTwoFaSetup, setShowTwoFaSetup] = useState(false);
  const { showToast } = useToast();
  const { token } = useAuth();

  useEffect(() => {
    async function loadSettings(): Promise<void> {
      try {
        const data = await fetchSettings();
        setMaxLossPercent(String(data.maxLossPercent));
        setTradingInterval(data.tradingIntervalMinutes);
        setStrategyPrompt(data.strategyPrompt);
        setIsPaperTrading(data.isPaperTrading);
      } catch {
        showToast('Using default settings (backend unreachable)', 'warning');
      }
    }

    async function checkConnections(): Promise<void> {
      try {
        await fetchHealth();
        setConnections([
          { name: 'Backend Server', isConnected: true },
          { name: 'MongoDB', isConnected: true },
          { name: 'Claude API', isConnected: true },
          { name: 'Polygon.io', isConnected: true },
        ]);
      } catch {
        setConnections([
          { name: 'Backend Server', isConnected: false },
          { name: 'MongoDB', isConnected: false },
          { name: 'Claude API', isConnected: false },
          { name: 'Polygon.io', isConnected: false },
        ]);
      }
    }

    async function checkTwoFa(): Promise<void> {
      try {
        const response = await fetch('http://localhost:4000/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json();
        if (result.data?.isTwoFactorEnabled) {
          setIsTwoFaEnabled(true);
        }
      } catch { /* skip */ }
    }

    loadSettings();
    checkConnections();
    checkTwoFa();
  }, [showToast, token]);

  const handleSetup2FA = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('http://localhost:4000/api/auth/2fa/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      if (result.data) {
        setTwoFaQrCode(result.data.qrCode);
        setTwoFaSecret(result.data.secret);
        setShowTwoFaSetup(true);
      }
    } catch {
      showToast('Failed to setup 2FA', 'error');
    }
  }, [token, showToast]);

  const handleVerify2FA = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('http://localhost:4000/api/auth/2fa/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: twoFaCode }),
      });
      const result = await response.json();
      if (result.data?.success) {
        setIsTwoFaEnabled(true);
        setShowTwoFaSetup(false);
        setTwoFaCode('');
        showToast('2FA enabled successfully!', 'success');
      } else {
        showToast('Invalid code — try again', 'error');
      }
    } catch {
      showToast('Verification failed', 'error');
    }
  }, [token, twoFaCode, showToast]);

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
    try {
      await updateSettings({
        maxLossPercent: Number(maxLossPercent),
        tradingIntervalMinutes: tradingInterval,
        strategyPrompt,
        isPaperTrading,
      });
      showToast('Settings saved successfully', 'success');
    } catch {
      showToast('Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [maxLossPercent, tradingInterval, strategyPrompt, isPaperTrading, showToast]);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">Settings</h1>

      {/* Connection Status */}
      <Card title="Connection Status">
        <div className="flex flex-col gap-3">
          {connections.map((conn) => (
            <div key={conn.name} className="flex items-center justify-between">
              <span className="text-sm text-text-secondary dark:text-dark-text-secondary">{conn.name}</span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${conn.isConnected ? 'bg-profit' : 'bg-loss'}`} />
                <span className={`text-sm font-medium ${conn.isConnected ? 'text-profit' : 'text-loss'}`}>
                  {conn.isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Two-Factor Authentication */}
      <Card title="Two-Factor Authentication">
        {isTwoFaEnabled ? (
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-profit" />
            <span className="text-sm font-medium text-profit">2FA is enabled</span>
          </div>
        ) : !showTwoFaSetup ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary dark:text-dark-text-primary">Protect your account</p>
              <p className="text-xs text-text-muted dark:text-dark-text-muted mt-1">
                Use Google Authenticator or any TOTP app
              </p>
            </div>
            <Button onClick={handleSetup2FA}>Enable 2FA</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
              1. Scan this QR code with Google Authenticator
            </p>
            {twoFaQrCode && (
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img src={twoFaQrCode} alt="2FA QR Code" className="w-48 h-48" />
              </div>
            )}
            <div className="text-xs text-text-muted dark:text-dark-text-muted">
              Or enter manually: <code className="bg-surface-tertiary dark:bg-dark-surface-tertiary px-2 py-0.5 rounded text-xs">{twoFaSecret}</code>
            </div>
            <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
              2. Enter the 6-digit code from the app
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
                className="w-32 px-3 py-2 text-center text-lg tracking-widest rounded-lg border border-border dark:border-dark-border bg-surface dark:bg-dark-surface text-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button onClick={handleVerify2FA} disabled={twoFaCode.length !== 6}>Verify & Enable</Button>
            </div>
            <button
              onClick={() => setShowTwoFaSetup(false)}
              className="text-xs text-text-muted dark:text-dark-text-muted hover:text-text-primary dark:hover:text-dark-text-primary"
            >
              Cancel
            </button>
          </div>
        )}
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
