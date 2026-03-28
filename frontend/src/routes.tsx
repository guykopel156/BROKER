import React, { lazy, Suspense, type ReactElement } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Strategy = lazy(() => import('./pages/Strategy'));
const TradeLog = lazy(() => import('./pages/TradeLog'));
const Positions = lazy(() => import('./pages/Positions'));
const MyStocks = lazy(() => import('./pages/MyStocks'));
const Charts = lazy(() => import('./pages/Charts'));
const Settings = lazy(() => import('./pages/Settings'));

function AppRoutes(): ReactElement {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/strategy" element={<Strategy />} />
        <Route path="/trade-log" element={<TradeLog />} />
        <Route path="/positions" element={<Positions />} />
        <Route path="/my-stocks" element={<MyStocks />} />
        <Route path="/charts" element={<Charts />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
