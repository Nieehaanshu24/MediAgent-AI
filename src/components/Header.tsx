import React from 'react';
import { Activity, ShieldAlert, Database, History, PlusCircle, Zap, Moon, Sun } from 'lucide-react';

interface HeaderProps {
  onNewCase: () => void;
  onOpenHistory: () => void;
  onOpenQuickStart?: () => void;
  casesCount: number;
  dbConnected: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNewCase,
  onOpenHistory,
  onOpenQuickStart,
  casesCount,
  dbConnected,
  darkMode,
  onToggleDarkMode,
}) => {
  return (
    <header id="mediagent-header" className="bg-surface text-ink border-b border-muted/20 sticky top-0 z-30 font-sans transition-colors">
      {/* Subtle Persistent Clinical Disclaimer */}
      <div id="disclaimer-banner" className="bg-primary/5 border-b border-primary/10 text-primary px-4 py-1 text-[11px] flex items-center justify-center text-center">
        <div className="flex items-center justify-center gap-1.5 max-w-5xl mx-auto w-full text-center font-medium">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-primary" />
          <span>Educational Clinical Prototype — Non-diagnostic research tool for CDS workflow demonstration.</span>
        </div>
      </div>

      {/* Main Bar */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-3">
        {/* Left: Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 shadow-xs">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-tight text-ink">MediAgent AI</h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 hidden sm:inline-block">
                Clinical CDS
              </span>
            </div>
            <p className="text-[11px] text-muted hidden sm:block">Multi-Agent Clinical Decision-Support Triage</p>
          </div>
        </div>

        {/* Right: Thoughtful, Clear Button Placements */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Quick Start Button */}
          {onOpenQuickStart && (
            <button
              id="header-quick-start-btn"
              type="button"
              onClick={onOpenQuickStart}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors cursor-pointer"
              title="Open Clinical Quick Start Panel"
            >
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span>Quick Start</span>
            </button>
          )}

          {/* Case History Section Button */}
          <button
            id="open-history-btn"
            type="button"
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface text-ink hover:bg-muted/5 border border-muted/20 transition-colors cursor-pointer"
            title="Open Case History Drawer to view saved clinical reports"
          >
            <History className="w-3.5 h-3.5 text-muted" />
            <span className="hidden sm:inline">History</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-muted/10 text-muted font-bold">
              {casesCount}
            </span>
          </button>

          {/* Theme Toggle (Dark / Light) */}
          <button
            id="theme-toggle-btn"
            type="button"
            onClick={onToggleDarkMode}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-muted/20 text-muted hover:text-ink hover:bg-muted/5 transition-colors cursor-pointer"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* New Case Button - Prominent Botanical Green */}
          <button
            id="start-new-case-btn"
            type="button"
            onClick={onNewCase}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-[#09472C] text-white transition-colors cursor-pointer shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Case</span>
          </button>
        </div>
      </div>
    </header>
  );
};
