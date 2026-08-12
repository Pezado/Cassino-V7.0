/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BacBoEvent, GameType, RouletteEvent } from './types';
import { Header } from './components/Header';
import { LiveOutcomesStrip } from './components/LiveOutcomesStrip';
import { BacBoRoadmaps } from './components/BacBoRoadmaps';
import { RouletteVisualizer } from './components/RouletteVisualizer';
import { SequenceMatcher } from './components/SequenceMatcher';
import { AiAnalystPanel } from './components/AiAnalystPanel';
import { SupremeSignalPanel } from './components/SupremeSignalPanel';
import { SeasonalAnalytics } from './components/SeasonalAnalytics';
import { RoulettePatternAnalyzer } from './components/RoulettePatternAnalyzer';
import { StrategiesAnalyticsView } from './components/StrategiesAnalyticsView';
import { syncEventsToFirebase, subscribeFirebaseEvents, clearFirebaseGameEvents } from './lib/firebaseService';
import { Brain, Compass, Search, Clock, Activity, Zap, ShieldCheck, Gauge, BarChart2 } from 'lucide-react';

export default function App() {
  const [activeGame, setActiveGame] = useState<GameType>('bacbo');
  const [activeView, setActiveView] = useState<'overview' | 'seasonal' | 'behavioral' | 'sequence' | 'sinais' | 'ai' | 'roulettePatterns' | 'strategies'>('sinais');

  const [isPolling, setIsPolling] = useState<boolean>(true);
  const [pollInterval, setPollInterval] = useState<number>(3); // seconds
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Helper to strip rounds older than 24h
  const filterRecent = useCallback((list: any[]) => {
    if (!Array.isArray(list)) return [];
    const nowMs = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    return list.filter((item) => {
      if (!item || !item.id || String(item.id).toLowerCase().includes('seed')) return false;
      if (item.timestamp) {
        const t = new Date(item.timestamp).getTime();
        if (!isNaN(t) && (nowMs - t) > TWENTY_FOUR_HOURS) return false;
      }
      return true;
    });
  }, []);

  // Accumulated Data Collections
  const [bacboEvents, setBacboEvents] = useState<BacBoEvent[]>(() => {
    try {
      const saved = localStorage.getItem('tipminer_bacbo_history');
      const parsed = saved ? JSON.parse(saved) : [];
      const nowMs = Date.now();
      return parsed.filter((item: any) => {
        if (!item || !item.id) return false;
        if (item.timestamp) {
          const t = new Date(item.timestamp).getTime();
          if (!isNaN(t) && (nowMs - t) > 24 * 60 * 60 * 1000) return false;
        }
        return true;
      });
    } catch {
      return [];
    }
  });

  const [autoRouletteEvents, setAutoRouletteEvents] = useState<RouletteEvent[]>(() => {
    try {
      const saved = localStorage.getItem('tipminer_autoroulette_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [immersiveRouletteEvents, setImmersiveRouletteEvents] = useState<RouletteEvent[]>(() => {
    try {
      const saved = localStorage.getItem('tipminer_immersiveroulette_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Web Audio Chime Sound
  const playAlertSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      // Audio context may require gesture
    }
  }, [soundEnabled]);

  // Sync to Firebase Realtime Database
  const syncToFirebaseRTDB = useCallback(async (game: GameType, events: any[]) => {
    await syncEventsToFirebase(game, events);
  }, []);

  // Fetch Game Data Function
  const fetchGameData = useCallback(async (game: GameType, initialSize = 100) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const endpoint = `/api/proxy/${game}?size=${initialSize}`;
      const res = await fetch(endpoint);
      const data = await res.json();

      if (data.history && Array.isArray(data.history)) {
        setErrorMsg(null);
        if (game === 'bacbo') {
          setBacboEvents((prev) => {
            const map = new Map<string, BacBoEvent>();
            prev.forEach((item) => map.set(item.id, item));
            data.history.forEach((item: BacBoEvent) => map.set(item.id, item));
            const merged = filterRecent(Array.from(map.values())).sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            localStorage.setItem('tipminer_bacbo_history', JSON.stringify(merged.slice(0, 300)));
            syncToFirebaseRTDB('bacbo', merged);
            return merged;
          });
        } else if (game === 'autoroulette') {
          setAutoRouletteEvents((prev) => {
            const map = new Map<string, RouletteEvent>();
            prev.forEach((item) => map.set(item.id, item));
            data.history.forEach((item: RouletteEvent) => map.set(item.id, item));
            const merged = filterRecent(Array.from(map.values())).sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            localStorage.setItem('tipminer_autoroulette_history', JSON.stringify(merged.slice(0, 300)));
            syncToFirebaseRTDB('autoroulette', merged);
            return merged;
          });
        } else if (game === 'immersiveroulette') {
          setImmersiveRouletteEvents((prev) => {
            const map = new Map<string, RouletteEvent>();
            prev.forEach((item) => map.set(item.id, item));
            data.history.forEach((item: RouletteEvent) => map.set(item.id, item));
            const merged = filterRecent(Array.from(map.values())).sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            localStorage.setItem('tipminer_immersiveroulette_history', JSON.stringify(merged.slice(0, 300)));
            syncToFirebaseRTDB('immersiveroulette', merged);
            return merged;
          });
        }
      }
    } catch (err: any) {
      console.warn('Network sync notice:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, [syncToFirebaseRTDB]);

  // Subscribe to Live Firebase Realtime Database stream for ALL games simultaneously
  useEffect(() => {
    const unsubBacbo = subscribeFirebaseEvents('bacbo', (rtdbEvents) => {
      if (rtdbEvents && rtdbEvents.length > 0) {
        setBacboEvents(rtdbEvents);
      }
    });
    const unsubAuto = subscribeFirebaseEvents('autoroulette', (rtdbEvents) => {
      if (rtdbEvents && rtdbEvents.length > 0) {
        setAutoRouletteEvents(rtdbEvents);
      }
    });
    const unsubImm = subscribeFirebaseEvents('immersiveroulette', (rtdbEvents) => {
      if (rtdbEvents && rtdbEvents.length > 0) {
        setImmersiveRouletteEvents(rtdbEvents);
      }
    });

    return () => {
      unsubBacbo();
      unsubAuto();
      unsubImm();
    };
  }, []);

  // Poll on Mount and Timer
  useEffect(() => {
    fetchGameData(activeGame);
  }, [activeGame, fetchGameData]);

  useEffect(() => {
    if (!isPolling) return;
    const timer = setInterval(() => {
      fetchGameData(activeGame);
    }, pollInterval * 1000);
    return () => clearInterval(timer);
  }, [isPolling, pollInterval, activeGame, fetchGameData]);

  // Handle Clear Database & Local History
  const handleClearHistory = async () => {
    if (confirm('Deseja realmente ZERAR o banco de dados Firebase e recomeçar do zero?')) {
      try {
        await clearFirebaseGameEvents(activeGame);
        await fetch('/api/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ game: activeGame }),
        });
      } catch (err) {
        console.error('Reset error:', err);
      }

      if (activeGame === 'bacbo') {
        setBacboEvents([]);
        localStorage.removeItem('tipminer_bacbo_history');
      } else if (activeGame === 'autoroulette') {
        setAutoRouletteEvents([]);
        localStorage.removeItem('tipminer_autoroulette_history');
      } else if (activeGame === 'immersiveroulette') {
        setImmersiveRouletteEvents([]);
        localStorage.removeItem('tipminer_immersiveroulette_history');
      }
    }
  };

  // Handle Export Data (JSON)
  const handleExportData = () => {
    let currentData: any[] = [];
    if (activeGame === 'bacbo') currentData = bacboEvents;
    else if (activeGame === 'autoroulette') currentData = autoRouletteEvents;
    else currentData = immersiveRouletteEvents;

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `tipminer_${activeGame}_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const currentEvents = activeGame === 'bacbo'
    ? bacboEvents
    : activeGame === 'autoroulette'
    ? autoRouletteEvents
    : immersiveRouletteEvents;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-cyan-500 selection:text-slate-950 pb-20">
      {/* Top Sticky Header with Section Navigation */}
      <Header
        activeGame={activeGame}
        setActiveGame={setActiveGame}
        activeView={activeView}
        setActiveView={setActiveView}
        totalRounds={currentEvents.length}
        onExportData={handleExportData}
      />

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Error notification banner if any */}
        {errorMsg && (
          <div className="p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl text-xs text-amber-300 flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              onClick={() => fetchGameData(activeGame)}
              className="px-2.5 py-1 bg-amber-900 hover:bg-amber-800 text-amber-100 rounded text-[11px] font-bold"
            >
              Reconectar
            </button>
          </div>
        )}

        {/* Live Ribbon & Outcome Strip */}
        <LiveOutcomesStrip
          game={activeGame}
          bacboEvents={bacboEvents}
          rouletteEvents={activeGame === 'autoroulette' ? autoRouletteEvents : immersiveRouletteEvents}
          showStatsSummary={activeView === 'overview'}
        />

        {/* View Switcher Output */}
        {activeView === 'overview' && (
          <div>
            {activeGame === 'bacbo' ? (
              <BacBoRoadmaps events={bacboEvents} />
            ) : (
              <RouletteVisualizer
                events={activeGame === 'autoroulette' ? autoRouletteEvents : immersiveRouletteEvents}
              />
            )}
          </div>
        )}

        {activeView === 'seasonal' && (
          <SeasonalAnalytics
            game={activeGame}
            bacboEvents={bacboEvents}
            rouletteEvents={activeGame === 'autoroulette' ? autoRouletteEvents : immersiveRouletteEvents}
            initialTab="season"
          />
        )}

        {activeView === 'behavioral' && (
          <SeasonalAnalytics
            game={activeGame}
            bacboEvents={bacboEvents}
            rouletteEvents={activeGame === 'autoroulette' ? autoRouletteEvents : immersiveRouletteEvents}
            initialTab="behavior"
          />
        )}

        {activeView === 'sequence' && (
          <SequenceMatcher
            game={activeGame}
            bacboEvents={bacboEvents}
            rouletteEvents={activeGame === 'autoroulette' ? autoRouletteEvents : immersiveRouletteEvents}
          />
        )}

        {activeView === 'roulettePatterns' && (
          <RoulettePatternAnalyzer
            activeGame={activeGame}
            autoRouletteEvents={autoRouletteEvents}
            immersiveRouletteEvents={immersiveRouletteEvents}
            onSelectGame={(game) => setActiveGame(game)}
          />
        )}

        {activeView === 'sinais' && (
          <SupremeSignalPanel
            game={activeGame}
            rounds={currentEvents}
          />
        )}

        {activeView === 'strategies' && (
          <StrategiesAnalyticsView
            game={activeGame}
            rounds={currentEvents}
          />
        )}

        {activeView === 'ai' && (
          <AiAnalystPanel
            game={activeGame}
            rounds={currentEvents}
          />
        )}
      </main>

      {/* Fixed Bottom View Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md px-2 py-1.5 shadow-2xl">
        <div className="max-w-2xl mx-auto grid grid-cols-8 gap-1">
          <button
            id="tab-sinais"
            onClick={() => setActiveView('sinais')}
            title="Painel de Sinais (Supremo)"
            className={`py-1.5 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center space-y-0.5 ${
              activeView === 'sinais'
                ? 'bg-slate-800 text-cyan-300 border border-cyan-500/50 shadow-lg ring-2 ring-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-[9px] font-extrabold hidden xs:inline truncate max-w-[42px]">Sinais</span>
          </button>

          <button
            id="tab-strategies"
            onClick={() => setActiveView('strategies')}
            title="Estratégias & Análise"
            className={`py-1.5 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center space-y-0.5 ${
              activeView === 'strategies'
                ? 'bg-slate-800 text-amber-300 border border-amber-500/50 shadow-lg ring-2 ring-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span className="text-[9px] font-extrabold hidden xs:inline truncate max-w-[42px]">Estrat.</span>
          </button>

          <button
            id="tab-overview"
            onClick={() => setActiveView('overview')}
            title="Matriz & Geral"
            className={`py-1.5 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center space-y-0.5 ${
              activeView === 'overview'
                ? 'bg-slate-800 text-cyan-300 border border-cyan-500/50 shadow-lg ring-2 ring-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Compass className="w-4 h-4 text-cyan-400" />
            <span className="text-[9px] font-extrabold hidden xs:inline truncate max-w-[42px]">Matriz</span>
          </button>

          <button
            id="tab-seasonal"
            onClick={() => setActiveView('seasonal')}
            title="Sazonalidade & Empates"
            className={`py-1.5 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center space-y-0.5 ${
              activeView === 'seasonal'
                ? 'bg-slate-800 text-amber-300 border border-amber-500/50 shadow-lg ring-2 ring-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-[9px] font-extrabold hidden xs:inline truncate max-w-[42px]">Sazonal</span>
          </button>

          <button
            id="tab-behavioral"
            onClick={() => setActiveView('behavioral')}
            title="7 Análises Comportamentais"
            className={`py-1.5 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center space-y-0.5 ${
              activeView === 'behavioral'
                ? 'bg-slate-800 text-purple-300 border border-purple-500/50 shadow-lg ring-2 ring-purple-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Gauge className="w-4 h-4 text-purple-400" />
            <span className="text-[9px] font-extrabold hidden xs:inline truncate max-w-[42px]">Análise</span>
          </button>

          <button
            id="tab-sequence"
            onClick={() => setActiveView('sequence')}
            title="Buscador de Padrões"
            className={`py-1.5 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center space-y-0.5 ${
              activeView === 'sequence'
                ? 'bg-slate-800 text-emerald-300 border border-emerald-500/50 shadow-lg ring-2 ring-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Search className="w-4 h-4 text-emerald-400" />
            <span className="text-[9px] font-extrabold hidden xs:inline truncate max-w-[42px]">Buscar</span>
          </button>

          <button
            id="tab-roulettePatterns"
            onClick={() => setActiveView('roulettePatterns')}
            title="Padrões de Roleta"
            className={`py-1.5 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center space-y-0.5 ${
              activeView === 'roulettePatterns'
                ? 'bg-slate-800 text-rose-300 border border-rose-500/50 shadow-lg ring-2 ring-rose-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-rose-400" />
            <span className="text-[9px] font-extrabold hidden xs:inline truncate max-w-[42px]">Roletas</span>
          </button>

          <button
            id="tab-ai"
            onClick={() => setActiveView('ai')}
            title="IA Estratégica"
            className={`py-1.5 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center space-y-0.5 ${
              activeView === 'ai'
                ? 'bg-slate-800 text-purple-200 border border-purple-400/50 shadow-lg ring-2 ring-purple-400/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Brain className="w-4 h-4 text-purple-300" />
            <span className="text-[9px] font-extrabold hidden xs:inline truncate max-w-[42px]">IA</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-slate-300">CASSINO V-7.0</span>
          </div>
          <div className="text-[11px] text-slate-600 font-mono">
            Estatísticas e análise ao vivo
          </div>
        </div>
      </footer>
    </div>
  );
}
