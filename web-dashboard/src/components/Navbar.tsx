import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Activity,
  Download,
  Settings,
  RefreshCw,
  Server,
  CheckCircle2,
  AlertTriangle,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import {
  checkHealth,
  getApiBaseUrl,
  setApiBaseUrl,
  downloadCsvExport,
  DEFAULT_API_BASE_URL,
} from '../services/api';
import { SystemHealth } from '../types/dashboard';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  activeTab: 'OPERATIONS' | 'SECURITY';
  onTabChange: (tab: 'OPERATIONS' | 'SECURITY') => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onRefresh,
  isRefreshing = false,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState<boolean>(true);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [customUrl, setCustomUrl] = useState<string>(getApiBaseUrl());
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const performHealthCheck = async () => {
    setIsHealthLoading(true);
    try {
      const res = await checkHealth();
      setHealth(res);
    } catch {
      setHealth({
        status: 'offline',
        service: 'AuditFlow Field Capture Backend',
        endpoints: {},
      });
    } finally {
      setIsHealthLoading(false);
    }
  };

  useEffect(() => {
    performHealthCheck();
    const interval = setInterval(performHealthCheck, 15000);

    const onUrlChanged = () => {
      setCustomUrl(getApiBaseUrl());
      performHealthCheck();
    };
    window.addEventListener('auditflow_api_url_changed', onUrlChanged);

    return () => {
      clearInterval(interval);
      window.removeEventListener('auditflow_api_url_changed', onUrlChanged);
    };
  }, []);

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setApiBaseUrl(customUrl);
    setIsConfigOpen(false);
    onRefresh();
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      await downloadCsvExport();
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err: any) {
      setExportError(err.message || 'CSV Export failed');
      setTimeout(() => setExportError(null), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  const isOnline = health?.status === 'healthy';

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-md dark:shadow-lg transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400/30">
              <ShieldCheck className="h-6 w-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  AuditFlow
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded">
                  SEC ISA Core
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal hidden sm:block">
                Master Farmer Registry & Operational Monitoring
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-950/70 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => onTabChange('OPERATIONS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-2 ${
                activeTab === 'OPERATIONS'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/50'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span>Operations & Map</span>
            </button>
            <button
              onClick={() => onTabChange('SECURITY')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-2 ${
                activeTab === 'SECURITY'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/50'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Transit Reconciler</span>
            </button>
          </nav>

          {/* Action Buttons, Dark/Light Toggle & Status */}
          <div className="flex items-center space-x-2">
            {/* System Status Pill */}
            <button
              onClick={() => setIsConfigOpen(true)}
              title="Click to configure backend URL"
              className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition"
            >
              <span className="relative flex h-2 w-2">
                {isOnline ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                )}
              </span>
              <span
                className={`text-xs ${
                  isOnline
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {isHealthLoading ? 'Pinging...' : isOnline ? 'Backend Online' : 'Backend Offline'}
              </span>
              {health?.latencyMs !== undefined && isOnline && (
                <span className="text-[10px] text-slate-500 font-mono hidden md:inline">
                  {health.latencyMs}ms
                </span>
              )}
            </button>

            {/* Dark / Light Mode Toggle */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/50 transition shadow-sm"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400 animate-spin-slow" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-600" />
              )}
            </button>

            {/* Global Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh all data"
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/50 transition disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  isRefreshing ? 'animate-spin text-emerald-500' : ''
                }`}
              />
            </button>

            {/* CSV Export Button */}
            <button
              onClick={handleExportCsv}
              disabled={isExporting}
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition shadow-sm"
            >
              <Download className={`h-3.5 w-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
              <span>
                {isExporting
                  ? 'Exporting...'
                  : exportSuccess
                  ? 'Downloaded!'
                  : 'Export CSV'}
              </span>
            </button>

            {/* Settings Trigger */}
            <button
              onClick={() => setIsConfigOpen(true)}
              title="Backend Settings"
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/50 transition"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Export Feedback Banner if any */}
      {exportError && (
        <div className="bg-rose-500/20 border-t border-rose-500/40 px-4 py-1.5 text-center text-xs text-rose-700 dark:text-rose-300">
          {exportError}
        </div>
      )}

      {/* Backend Settings Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setIsConfigOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                <Server className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Backend Connection
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure target FastAPI Ingestion server
                </p>
              </div>
            </div>

            {/* Health Status Box */}
            <div
              className={`p-3 rounded-xl mb-4 border text-xs flex items-center justify-between ${
                isOnline
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                {isOnline ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                )}
                <span>
                  {isOnline
                    ? `Connected to ${health?.service || 'AuditFlow Service'}`
                    : 'Unable to reach backend server'}
                </span>
              </div>
              <button
                onClick={performHealthCheck}
                className="text-[11px] font-semibold underline hover:no-underline ml-2"
              >
                Recheck
              </button>
            </div>

            <form onSubmit={handleSaveUrl} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Backend API Base URL
                </label>
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="http://localhost:8000"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Default:{' '}
                  <span className="font-mono text-slate-600 dark:text-slate-400">
                    {DEFAULT_API_BASE_URL}
                  </span>
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCustomUrl(DEFAULT_API_BASE_URL);
                    setApiBaseUrl(DEFAULT_API_BASE_URL);
                    setIsConfigOpen(false);
                    onRefresh();
                  }}
                  className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Reset Default
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 transition"
                >
                  Save & Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
