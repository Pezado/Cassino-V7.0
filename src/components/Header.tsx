import React from 'react';
import { GameType } from '../types';
import {
  Activity,
  BarChart2,
  Brain,
  Clock,
  Compass,
  Download,
  Gauge,
  Search,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface HeaderProps {
  activeGame: GameType;
  setActiveGame: (game: GameType) => void;
  activeView: 'overview' | 'seasonal' | 'behavioral' | 'sequence' | 'sinais' | 'ai' | 'roulettePatterns' | 'strategies';
  setActiveView: (view: 'overview' | 'seasonal' | 'behavioral' | 'sequence' | 'sinais' | 'ai' | 'roulettePatterns' | 'strategies') => void;
  totalRounds: number;
  onExportData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeGame,
  setActiveGame,
  activeView,
  setActiveView,
  totalRounds,
  onExportData,
}) => {
  const navItems = [
    {
      id: 'sinais',
      label: 'Painel de Sinais (Supremo)',
      shortLabel: 'Sinais',
      icon: <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />,
    },
    {
      id: 'strategies',
      label: 'Estratégias & Análise',
      shortLabel: 'Estratégias',
      icon: <ShieldCheck className="w-4 h-4 text-amber-400" />,
    },
    {
      id: 'overview',
      label: 'Matriz & Geral',
      shortLabel: 'Matriz',
      icon: <Compass className="w-4 h-4 text-cyan-400" />,
    },
    {
      id: 'seasonal',
      label: 'Sazonalidade & Empates',
      shortLabel: 'Sazonal',
      icon: <Clock className="w-4 h-4 text-amber-400" />,
    },
    {
      id: 'behavioral',
      label: '7 Análises Comportamentais',
      shortLabel: 'Análises',
      icon: <Gauge className="w-4 h-4 text-purple-400" />,
    },
    {
      id: 'sequence',
      label: 'Buscador de Padrões',
      shortLabel: 'Buscador',
      icon: <Search className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: 'roulettePatterns',
      label: 'Padrões de Roleta',
      shortLabel: 'Roletas',
      icon: <BarChart2 className="w-4 h-4 text-rose-400" />,
    },
    {
      id: 'ai',
      label: 'IA Estratégica',
      shortLabel: 'IA',
      icon: <Brain className="w-4 h-4 text-purple-300" />,
    },
  ];

  return (
    <header className="bg-slate-900/95 border-b border-slate-800 sticky top-0 z-40 shadow-xl backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-2.5 space-y-2.5">
        {/* Top Bar: Brand, Download & Game Selector */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {/* Logo & Download */}
          <div className="flex items-center justify-between w-full sm:w-auto space-x-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-emerald-500 to-amber-500 p-[2px] shadow-lg shadow-cyan-500/20 shrink-0">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1">
                    CASSINO <span className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400 bg-clip-text text-transparent">V-7.0</span>
                  </h1>
                  <button
                    id="btn-export-data"
                    onClick={onExportData}
                    className="px-2 py-0.5 bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-700/80 rounded-lg text-cyan-300 hover:text-white text-[11px] font-bold transition-all flex items-center space-x-1 shadow-md shrink-0"
                    title="Baixar Histórico de Jogos (JSON)"
                  >
                    <Download className="w-3 h-3 text-cyan-400" />
                    <span className="hidden xs:inline">Baixar Histórico</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex sm:hidden items-center space-x-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[11px] text-slate-300">
              <Activity className="w-3 h-3 text-cyan-400" />
              <span className="font-bold text-emerald-400 font-mono">{totalRounds}</span>
            </div>
          </div>

          {/* Game Selector Buttons (BACBO Live 🇺🇸, Auto Roleta, Roleta Imersiva) */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/90 w-full sm:w-auto">
            <button
              id="game-bacbo"
              onClick={() => setActiveGame('bacbo')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all text-center whitespace-nowrap ${
                activeGame === 'bacbo'
                  ? 'bg-gradient-to-r from-cyan-600 to-emerald-600 text-white shadow-lg border border-cyan-400/50 ring-2 ring-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              BACBO Live 🇺🇸
            </button>

            <button
              id="game-autoroulette"
              onClick={() => setActiveGame('autoroulette')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all text-center whitespace-nowrap ${
                activeGame === 'autoroulette'
                  ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-lg border border-red-400/50 ring-2 ring-rose-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Auto Roleta
            </button>

            <button
              id="game-immersiveroulette"
              onClick={() => setActiveGame('immersiveroulette')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all text-center whitespace-nowrap ${
                activeGame === 'immersiveroulette'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg border border-purple-400/50 ring-2 ring-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Roleta Imersiva
            </button>
          </div>

          {/* Desktop Base Count */}
          <div className="hidden sm:flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs text-slate-300">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Base Coletada:</span>
            <span className="font-bold text-emerald-400 font-mono">{totalRounds}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
