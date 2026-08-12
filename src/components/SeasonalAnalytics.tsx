import React, { useState, useMemo, useEffect } from 'react';
import { BacBoEvent, GameType, RouletteEvent } from '../types';
import { computeSupremePrediction } from '../lib/supremeEngine';
import { subscribeFirebaseTieMinutes } from '../lib/firebaseService';
import {
  calculate10MinIntervals,
  calculateChopRate,
  calculateDayOfWeekSeasonality,
  calculateDetailedMaxStreaks,
  calculateDiceScoreDominance,
  calculateExactTieScores,
  calculateHourlyColorAverages,
  calculateLongTermTrends,
  calculateMinuteDecadeSeasonality,
  calculateMonthlySeasonality,
  calculateOptimalBettingHours,
  calculatePrecedingTieScores,
  calculateRouletteSeasonalDetails,
  calculateScoreClusters,
  calculateScoreDiffBehavior,
  calculateTableVolatility,
  calculateTieGaps,
  filterEventsByDate,
  getHourlyDistribution,
} from '../utils/analyticsEngine';
import {
  Clock,
  Filter,
  Zap,
  HelpCircle,
  TrendingUp,
  BarChart2,
  Info,
  Activity,
  Layers,
  Repeat,
  Compass,
  Gauge,
  Calendar,
  Award,
  Target,
  Sparkles,
  ShieldCheck,
  CalendarDays,
} from 'lucide-react';

interface SeasonalAnalyticsProps {
  game: GameType;
  bacboEvents: BacBoEvent[];
  rouletteEvents: RouletteEvent[];
  initialTab?: 'season' | 'behavior';
}

export const SeasonalAnalytics: React.FC<SeasonalAnalyticsProps> = ({
  game,
  bacboEvents,
  rouletteEvents,
  initialTab = 'season',
}) => {
  const isBacBo = game === 'bacbo';
  const rawEvents = isBacBo ? bacboEvents : rouletteEvents;

  // Date Filter State
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'season' | 'bettingHours' | 'behavior'>(
    initialTab === 'behavior' ? 'behavior' : 'season'
  );

  React.useEffect(() => {
    if (initialTab === 'behavior') {
      setActiveTab('behavior');
    }
  }, [initialTab]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return filterEventsByDate(rawEvents, selectedDateFilter);
  }, [rawEvents, selectedDateFilter]);

  const keyExtractor = (item: any) => {
    if (isBacBo) return item.outcome;
    return item.color;
  };

  // Core Metrics
  const hourlyAverages = useMemo(() => calculateHourlyColorAverages(filteredEvents as BacBoEvent[]), [filteredEvents]);
  const maxStreaks = useMemo(() => calculateDetailedMaxStreaks(filteredEvents as BacBoEvent[]), [filteredEvents]);
  const precedingTieScores = useMemo(() => calculatePrecedingTieScores(filteredEvents as BacBoEvent[]), [filteredEvents]);
  const exactTieScores = useMemo(() => calculateExactTieScores(filteredEvents as BacBoEvent[]), [filteredEvents]);
  const tenMinIntervals = useMemo(() => calculate10MinIntervals(filteredEvents as BacBoEvent[]), [filteredEvents]);
  const hourlyDist = useMemo(() => getHourlyDistribution(filteredEvents, keyExtractor), [filteredEvents, isBacBo]);

  // Advanced Seasonality & Long-Term Trend Metrics
  const dayOfWeekSeasonality = useMemo(() => calculateDayOfWeekSeasonality(filteredEvents, isBacBo), [filteredEvents, isBacBo]);
  const monthlySeasonality = useMemo(() => calculateMonthlySeasonality(filteredEvents, isBacBo), [filteredEvents, isBacBo]);
  const optimalHours = useMemo(() => calculateOptimalBettingHours(filteredEvents, isBacBo), [filteredEvents, isBacBo]);
  const longTermTrends = useMemo(() => calculateLongTermTrends(filteredEvents, isBacBo), [filteredEvents, isBacBo]);
  const rouletteSeasonal = useMemo(() => (!isBacBo ? calculateRouletteSeasonalDetails(filteredEvents) : null), [filteredEvents, isBacBo]);

  // 7 Behavioral Analysis Modules
  const scoreDominance = useMemo(() => calculateDiceScoreDominance(filteredEvents as BacBoEvent[]), [filteredEvents]);
  const chopRateData = useMemo(() => calculateChopRate(filteredEvents as BacBoEvent[]), [filteredEvents]);
  const diffBehavior = useMemo(() => calculateScoreDiffBehavior(filteredEvents as BacBoEvent[]), [filteredEvents]);
  const minuteDecades = useMemo(() => calculateMinuteDecadeSeasonality(filteredEvents as BacBoEvent[]), [filteredEvents]);
  const scoreClusters = useMemo(() => calculateScoreClusters(filteredEvents as BacBoEvent[]), [filteredEvents]);
  const tableVolatility = useMemo(() => calculateTableVolatility(filteredEvents as BacBoEvent[]), [filteredEvents]);
  const tieGapsData = useMemo(() => calculateTieGaps(filteredEvents as BacBoEvent[]), [filteredEvents]);

  // Formatter for timestamp
  const formatTimeHM = (ts?: string) => {
    if (!ts) return '--:--';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const [firebaseTieMinutes, setFirebaseTieMinutes] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeFirebaseTieMinutes(game, (list) => {
      setFirebaseTieMinutes(list);
    });
    return () => unsubscribe();
  }, [game]);

  const latestIntel = useMemo(() => {
    if (!filteredEvents || filteredEvents.length === 0) return null;
    const pred = computeSupremePrediction(game, filteredEvents);
    return pred.intel20ProMax || null;
  }, [filteredEvents, game]);

  return (
    <div className="space-y-6">
      {/* Date Filter & Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-cyan-950/80 border border-cyan-800/80 rounded-xl text-cyan-400">
            <Filter className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <span>Filtro por Data e Período</span>
              <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded-full font-mono">
                {filteredEvents.length} rodadas registradas
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Selecione o dia para consultar dados históricos e comportamentais passados.
            </p>
          </div>
        </div>

        {/* Date Selector Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedDateFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              selectedDateFilter === 'all'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setSelectedDateFilter('today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              selectedDateFilter === 'today'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => setSelectedDateFilter('yesterday')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              selectedDateFilter === 'yesterday'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Ontem
          </button>
          <button
            onClick={() => setSelectedDateFilter('2days')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              selectedDateFilter === '2days'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            2 dias atrás
          </button>

          <input
            type="date"
            onChange={(e) => setSelectedDateFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* ESTATÍSTICA 20 PRO MAX ULTRA - ANÁLISE MATRIZ 360° */}
      <div className="bg-slate-950 border-2 border-cyan-500/40 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xl font-mono text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-900/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg">🧠</span>
            <h3 className="font-black text-cyan-300 uppercase tracking-wide text-xs sm:text-sm">
              Estatística 20 Pro Max Ultra — Análise Sazonal 360°
            </h3>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-black uppercase tracking-wider animate-pulse">
            🔥 Vigiai e Orai 👁️
          </span>
        </div>

        <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-slate-300 text-[11px] leading-relaxed italic flex items-center gap-2">
          <span>✨</span>
          <span>
            "A sazonalidade revela o ritmo invisível das mesas. Mapeie horários, dias da semana e tendências acumuladas para maximizar a assertividade."
          </span>
        </div>

        {/* Mapeamento de Padrões e Inteligência Recorrente */}
        {latestIntel && latestIntel.scoreSimilarityInsights.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-extrabold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>🎲</span>
              <span>Análise de Semelhança de Score & Transições:</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {latestIntel.scoreSimilarityInsights.map((insight, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-800/80 text-slate-200 text-[11px] font-medium leading-tight flex items-center justify-between gap-2"
                >
                  <span>{insight}</span>
                  <span className="text-[10px] text-cyan-400 font-bold">Matriz Sazonal</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Minutos dos Empates Registrados no Firebase */}
        <div className="space-y-2 pt-1 border-t border-slate-900">
          <div className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span>🛡️</span>
              <span>Minutos dos {isBacBo ? 'Empates' : 'Zeros'} Registrados (Firebase):</span>
            </span>
            <span className="text-[10px] text-slate-400 font-bold">
              Total Gravado: {firebaseTieMinutes.length}
            </span>
          </div>

          {firebaseTieMinutes.length === 0 ? (
            <div className="p-2.5 bg-slate-900/50 rounded-lg text-slate-500 text-[11px] italic text-center">
              Aguardando primeiro evento da sessão para gravar minutos no Firebase...
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1 no-scrollbar">
              {firebaseTieMinutes.slice(-15).reverse().map((tie, idx) => (
                <span
                  key={tie.id || idx}
                  className="px-2.5 py-1 bg-amber-950/90 text-amber-300 border border-amber-800/80 rounded-lg text-[10px] font-bold flex items-center gap-1"
                >
                  <span>🛡️ Minuto {tie.minute !== undefined ? String(tie.minute).padStart(2, '0') : '--'}</span>
                  {tie.timeStr && <span className="text-[9px] text-amber-400/80">({tie.timeStr})</span>}
                  {tie.score && <span className="text-[9px] text-slate-300 font-mono">[{tie.score}]</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Primary Analytics Navigation Tabs */}
      <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto shadow-lg">
        <button
          onClick={() => setActiveTab('season')}
          className={`flex-1 min-w-[160px] px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center space-x-2 ${
            activeTab === 'season'
              ? 'bg-gradient-to-r from-cyan-950 to-slate-850 text-cyan-400 border border-cyan-800 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-950'
          }`}
        >
          <Clock className="w-4 h-4 text-cyan-400" />
          <span>Sazonalidade & Tendências de Longo Prazo</span>
        </button>

        <button
          onClick={() => setActiveTab('bettingHours')}
          className={`flex-1 min-w-[160px] px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center space-x-2 ${
            activeTab === 'bettingHours'
              ? 'bg-gradient-to-r from-emerald-950 to-slate-850 text-emerald-400 border border-emerald-800 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-950'
          }`}
        >
          <Award className="w-4 h-4 text-emerald-400" />
          <span>Melhores Horários de Apostas</span>
        </button>

        <button
          onClick={() => setActiveTab('behavior')}
          className={`flex-1 min-w-[160px] px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center space-x-2 ${
            activeTab === 'behavior'
              ? 'bg-gradient-to-r from-purple-950 to-slate-850 text-purple-400 border border-purple-800 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-950'
          }`}
        >
          <Activity className="w-4 h-4 text-purple-400" />
          <span>7 Análises Comportamentais</span>
        </button>
      </div>

      {/* Tab 1: Sazonalidade & Tendências de Longo Prazo */}
      {activeTab === 'season' && (
        <div className="space-y-6">
          {/* Module 1 & 2: Hourly Color Averages & Streaks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Module 1: Média de cores por hora */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-white tracking-wide">
                  Média por Hora na Sessão
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  {hourlyAverages.totalHoursWithData}h de amostragem
                </span>
              </div>

              <div className="space-y-3">
                {/* Tie / Green Card */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex items-center space-x-4 transition-all hover:border-amber-500/40">
                  <div className="w-12 h-12 bg-amber-500/20 border border-amber-400/40 rounded-xl flex items-center justify-center shrink-0">
                    <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-lg flex items-center justify-center font-extrabold text-slate-950 text-sm shadow-md">
                      {isBacBo ? 'E' : '0'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-extrabold text-slate-100 leading-snug">
                      Média de {hourlyAverages.tie.avgPerHour} {isBacBo ? 'empate' : 'verde (0)'} por hora
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>Total de {hourlyAverages.tie.total}</span>
                      <span className="bg-slate-900 border border-slate-800 text-amber-400 font-mono font-bold px-2 py-0.5 rounded text-[11px]">
                        {hourlyAverages.tie.percentage}%
                      </span>
                      <span>{isBacBo ? 'empates' : 'zeros'} no período</span>
                    </div>
                  </div>
                </div>

                {/* Player / Red Card */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex items-center space-x-4 transition-all hover:border-blue-500/40">
                  <div className="w-12 h-12 bg-blue-500/20 border border-blue-400/40 rounded-xl flex items-center justify-center shrink-0">
                    <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center font-extrabold text-white text-sm shadow-md">
                      {isBacBo ? 'P' : 'V'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-extrabold text-slate-100 leading-snug">
                      Média de {hourlyAverages.player.avgPerHour} {isBacBo ? 'jogador' : 'vermelho'} por hora
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>Total de {hourlyAverages.player.total}</span>
                      <span className="bg-slate-900 border border-slate-800 text-blue-400 font-mono font-bold px-2 py-0.5 rounded text-[11px]">
                        {hourlyAverages.player.percentage}%
                      </span>
                      <span>no período</span>
                    </div>
                  </div>
                </div>

                {/* Banker / Black Card */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex items-center space-x-4 transition-all hover:border-rose-500/40">
                  <div className="w-12 h-12 bg-rose-500/20 border border-rose-400/40 rounded-xl flex items-center justify-center shrink-0">
                    <div className="w-7 h-7 bg-gradient-to-br from-red-600 to-rose-700 rounded-lg flex items-center justify-center font-extrabold text-white text-sm shadow-md">
                      {isBacBo ? 'B' : 'P'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-extrabold text-slate-100 leading-snug">
                      Média de {hourlyAverages.banker.avgPerHour} {isBacBo ? 'banca' : 'preto'} por hora
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>Total de {hourlyAverages.banker.total}</span>
                      <span className="bg-slate-900 border border-slate-800 text-rose-400 font-mono font-bold px-2 py-0.5 rounded text-[11px]">
                        {hourlyAverages.banker.percentage}%
                      </span>
                      <span>no período</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Module 2: Máximas de Streaks por Cor */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-white tracking-wide">
                  Máximas de Sequências (Streaks)
                </h3>
                <button
                  onClick={() => setShowHelpModal(true)}
                  className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg transition-all"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                  <span>AJUDA</span>
                </button>
              </div>

              <div className="space-y-3">
                {/* Banker / Black Max Streak */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-rose-700 rounded-lg flex items-center justify-center font-black text-white text-base shadow-md">
                      {isBacBo ? 'B' : 'P'}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="bg-slate-900 text-rose-400 border border-slate-800 font-mono font-black text-sm px-2.5 py-1 rounded-md">
                        {maxStreaks.banker.count}
                      </span>
                      <span className="text-xs font-bold text-slate-300">
                        {isBacBo ? 'banca seguidos' : 'preto seguidos'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-1 rounded-md">
                      {formatTimeHM(maxStreaks.banker.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Tie / Green Max Streak */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-lg flex items-center justify-center font-black text-slate-950 text-base shadow-md">
                      {isBacBo ? 'E' : '0'}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="bg-slate-900 text-amber-400 border border-slate-800 font-mono font-black text-sm px-2.5 py-1 rounded-md">
                        {maxStreaks.tie.count}
                      </span>
                      <span className="text-xs font-bold text-slate-300">
                        {isBacBo ? 'empate seguidos' : 'verde seguidos'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-1 rounded-md">
                      {formatTimeHM(maxStreaks.tie.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Player / Red Max Streak */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center font-black text-white text-base shadow-md">
                      {isBacBo ? 'P' : 'V'}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="bg-slate-900 text-cyan-400 border border-slate-800 font-mono font-black text-sm px-2.5 py-1 rounded-md">
                        {maxStreaks.player.count}
                      </span>
                      <span className="text-xs font-bold text-slate-300">
                        {isBacBo ? 'jogador seguidos' : 'vermelho seguidos'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-1 rounded-md">
                      {formatTimeHM(maxStreaks.player.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Module: Sazonalidade Semanal (Padrões de Dias da Semana) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white tracking-wide uppercase flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-cyan-400" />
                <span>Sazonalidade por Dia da Semana (Dom a Sáb)</span>
              </h3>
              <span className="text-xs font-mono text-slate-400">Distribuição Semanal</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {dayOfWeekSeasonality.map((day) => (
                <div
                  key={day.dayIndex}
                  className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2 hover:border-cyan-500/40 transition-all"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-extrabold text-cyan-400 text-xs">{day.dayName}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{day.total}r</span>
                  </div>

                  <div className="space-y-1 text-[11px] font-mono">
                    <div className="flex justify-between text-blue-400">
                      <span>{isBacBo ? 'Azul:' : 'Verm:'}</span>
                      <span className="font-bold">{day.playerOrRedPct}%</span>
                    </div>
                    <div className="flex justify-between text-rose-400">
                      <span>{isBacBo ? 'Verm:' : 'Preto:'}</span>
                      <span className="font-bold">{day.bankerOrBlackPct}%</span>
                    </div>
                    <div className="flex justify-between text-amber-400">
                      <span>{isBacBo ? 'Emp:' : 'Verde:'}</span>
                      <span className="font-bold">{day.tieOrGreenPct}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Module: Relatório de Tendências de Longo Prazo & Blocos de Média Móvel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
                  Análise de Tendências de Longo Prazo & Desvio (Drift)
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Amostra total: {longTermTrends.sampleSize} rodadas
              </span>
            </div>

            {/* Insights Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-300 uppercase flex items-center justify-between">
                  <span>Média Acumulada da Mesa</span>
                  <span className="text-cyan-400 font-mono text-[11px]">Total</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="bg-blue-950/60 p-2 rounded-lg border border-blue-800/60 text-blue-300">
                    <div className="text-[10px] text-slate-400">{isBacBo ? 'Jogador' : 'Vermelho'}</div>
                    <div className="text-sm font-black mt-0.5">{longTermTrends.overallPlayerOrRedPct}%</div>
                  </div>
                  <div className="bg-rose-950/60 p-2 rounded-lg border border-rose-800/60 text-rose-300">
                    <div className="text-[10px] text-slate-400">{isBacBo ? 'Banca' : 'Preto'}</div>
                    <div className="text-sm font-black mt-0.5">{longTermTrends.overallBankerOrBlackPct}%</div>
                  </div>
                  <div className="bg-amber-950/60 p-2 rounded-lg border border-amber-800/60 text-amber-300">
                    <div className="text-[10px] text-slate-400">{isBacBo ? 'Empates' : 'Zeros (0)'}</div>
                    <div className="text-sm font-black mt-0.5">{longTermTrends.overallTieOrGreenPct}%</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-300 uppercase flex items-center justify-between">
                  <span>Tendência Recente (Últimas 50 Rodadas)</span>
                  <span className="text-emerald-400 font-mono text-[11px]">Recente</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="bg-blue-950/60 p-2 rounded-lg border border-blue-800/60 text-blue-300">
                    <div className="text-[10px] text-slate-400">{isBacBo ? 'Jogador' : 'Vermelho'}</div>
                    <div className="text-sm font-black mt-0.5">{longTermTrends.recentPlayerOrRedPct}%</div>
                  </div>
                  <div className="bg-rose-950/60 p-2 rounded-lg border border-rose-800/60 text-rose-300">
                    <div className="text-[10px] text-slate-400">{isBacBo ? 'Banca' : 'Preto'}</div>
                    <div className="text-sm font-black mt-0.5">{longTermTrends.recentBankerOrBlackPct}%</div>
                  </div>
                  <div className="bg-amber-950/60 p-2 rounded-lg border border-amber-800/60 text-amber-300">
                    <div className="text-[10px] text-slate-400">{isBacBo ? 'Empates' : 'Zeros (0)'}</div>
                    <div className="text-sm font-black mt-0.5">{longTermTrends.recentTieOrGreenPct}%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Strategic Long-Term Bullet Points */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
              <div className="font-extrabold text-cyan-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Insights Estratégicos de Longo Prazo</span>
              </div>
              <ul className="space-y-1.5 list-disc list-inside text-slate-300">
                {longTermTrends.longTermInsights.map((insight, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {insight}
                  </li>
                ))}
              </ul>
            </div>

            {/* Moving Average Chunks */}
            {longTermTrends.movingAverages.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="text-xs font-bold text-slate-400 uppercase">
                  Evolução por Blocos de Amostragem (Média Móvel)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {longTermTrends.movingAverages.map((chunk) => (
                    <div key={chunk.chunkIndex} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono">
                      <div className="text-[10px] font-bold text-slate-400 truncate">{chunk.chunkLabel}</div>
                      <div className="flex justify-between text-[11px] mt-1 text-blue-400">
                        <span>P/V:</span> <span>{chunk.playerOrRedPct}%</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-rose-400">
                        <span>B/P:</span> <span>{chunk.bankerOrBlackPct}%</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-amber-400">
                        <span>E/0:</span> <span>{chunk.tieOrGreenPct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Module 3: Specific Tie/Zero Details */}
          {isBacBo ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
                    Condições do Empate (Pontuações exatas que puxam Empate)
                  </h3>
                </div>
                <span className="text-xs text-slate-400">
                  Frequência de pontuação imediatamente anterior ao Empate
                </span>
              </div>

              {precedingTieScores.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 italic bg-slate-950 rounded-xl">
                  Nenhum empate com pontuação anterior registrado na amostragem atual.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {precedingTieScores.slice(0, 9).map((item, idx) => {
                    const isPlayer = item.winner === 'PlayerWon';
                    return (
                      <div
                        key={idx}
                        className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between transition-all hover:border-slate-700"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white shadow-md ${
                              isPlayer
                                ? 'bg-gradient-to-br from-blue-600 to-cyan-700 ring-2 ring-cyan-500/40'
                                : 'bg-gradient-to-br from-red-600 to-rose-700 ring-2 ring-rose-500/40'
                            }`}
                          >
                            {item.score}
                          </div>
                          <div className="text-xs font-extrabold text-slate-200">
                            Apareceu <span className="text-amber-400 font-mono text-sm">{item.count}x</span> antes do empate
                          </div>
                        </div>

                        <span className="text-[10px] font-mono text-slate-500">
                          {isPlayer ? '🔵 Player' : '🔴 Banker'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Placar Exato dos Empates (6-6, 5-5, 4-4, etc.) */}
              <div className="pt-2">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                  Distribuição por Placar Exato dos Dados do Empate
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  {exactTieScores.map((tieScore) => (
                    <div
                      key={tieScore.sum}
                      className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center"
                    >
                      <div className="text-xs font-extrabold text-amber-400">
                        {tieScore.eachDieScore} - {tieScore.eachDieScore} (Soma {tieScore.sum})
                      </div>
                      <div className="text-base font-mono font-black text-white mt-1">
                        {tieScore.count}x
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">{tieScore.pct}% dos empates</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            rouletteSeasonal && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-extrabold text-white tracking-wide uppercase flex items-center gap-2">
                    <Zap className="w-5 h-5 text-emerald-400" />
                    <span>Sazonalidade de Zeros (0 / Verde), Dúzias e Colunas na Roleta</span>
                  </h3>
                  <span className="text-xs font-mono text-emerald-400">
                    Zero Total: {rouletteSeasonal.greenCount}x ({rouletteSeasonal.greenPct}%)
                  </span>
                </div>

                {/* Preceding Numbers Before Zero */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-300 uppercase">
                    Puxadores de Zero (Números imediatamente anteriores ao Verde 0)
                  </div>
                  {rouletteSeasonal.precedingNumbersBeforeZero.length === 0 ? (
                    <div className="p-4 bg-slate-950 rounded-xl text-xs text-slate-500 text-center italic">
                      Aguardando ocorrência de Zero para analisar puxadores...
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                      {rouletteSeasonal.precedingNumbersBeforeZero.map((p, idx) => (
                        <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center font-mono">
                          <div className={`text-base font-black ${p.color === 'Red' ? 'text-red-400' : 'text-slate-200'}`}>
                            {p.number}
                          </div>
                          <div className="text-[10px] text-amber-400 font-bold">{p.count}x antecedeu</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dozens & Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="text-xs font-bold text-slate-300 uppercase">Distribuição por Dúzias</div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      {rouletteSeasonal.dozenSeasonality.map((d, idx) => (
                        <div key={idx} className="bg-slate-900 p-2 rounded-lg border border-slate-800 flex justify-between">
                          <span className="text-slate-400">{d.dozen}:</span>
                          <span className="font-bold text-cyan-400">{d.pct}% ({d.count}x)</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="text-xs font-bold text-slate-300 uppercase">Distribuição por Colunas</div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      {rouletteSeasonal.columnSeasonality.map((c, idx) => (
                        <div key={idx} className="bg-slate-900 p-2 rounded-lg border border-slate-800 flex justify-between">
                          <span className="text-slate-400">{c.column}:</span>
                          <span className="font-bold text-purple-400">{c.pct}% ({c.count}x)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {/* Module 4: Análise Sazonal em Intervalos de Tempo (00:00 - 23:00 e 10-10') */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tabela de Distribuição por Horário (00:00 às 23:00) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-white tracking-wide uppercase flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>Distribuição por Horário (00:00 às 23:00)</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">24 Horas</span>
              </div>

              <div className="overflow-y-auto max-h-[420px] pr-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase font-mono">
                      <th className="py-2 px-3">Horário</th>
                      <th className="py-2 px-3 text-center">{isBacBo ? '🟡 Empate' : '🟢 Verde'}</th>
                      <th className="py-2 px-3 text-center">{isBacBo ? '🔵 Jogador' : '🔴 Vermelho'}</th>
                      <th className="py-2 px-3 text-center">{isBacBo ? '🔴 Banca' : '⚫ Preto'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                    {Array.from({ length: 24 }).map((_, h) => {
                      const hourStr = `${String(h).padStart(2, '0')}:00`;
                      const data = hourlyDist[h] || { total: 0, counts: {} };
                      const tCount = isBacBo ? (data.counts['Tie'] || 0) : (data.counts['Green'] || 0);
                      const pCount = isBacBo ? (data.counts['PlayerWon'] || 0) : (data.counts['Red'] || 0);
                      const bCount = isBacBo ? (data.counts['BankerWon'] || 0) : (data.counts['Black'] || 0);

                      return (
                        <tr key={h} className="hover:bg-slate-950/60 transition-colors">
                          <td className="py-2 px-3 font-bold text-slate-300">{hourStr}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2.5 py-0.5 rounded font-black text-xs inline-block min-w-[32px]">
                              {tCount}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="bg-blue-500/20 text-blue-400 border border-blue-500/40 px-2.5 py-0.5 rounded font-black text-xs inline-block min-w-[32px]">
                              {pCount}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="bg-rose-500/20 text-rose-400 border border-rose-500/40 px-2.5 py-0.5 rounded font-black text-xs inline-block min-w-[32px]">
                              {bCount}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabela de Distribuição em Intervalos de 10 em 10 Minutos */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-white tracking-wide uppercase flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Intervalos de Minutos (10-10')</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">Percentuais P / B / T</span>
              </div>

              <div className="space-y-3">
                {tenMinIntervals.map((item, idx) => (
                  <div key={idx} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-extrabold">
                      <span className="text-cyan-400 font-mono">{item.interval}</span>
                      <span className="text-slate-500 text-[10px] font-mono">{item.total} rodadas</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono font-bold">
                      <div className="bg-blue-950/60 border border-blue-800/60 p-2 rounded-lg text-blue-400">
                        <div className="text-[10px] text-slate-400 font-normal">{isBacBo ? '🔵 Player' : '🔴 Vermelho'}</div>
                        <div className="text-sm font-black mt-0.5">{item.playerPct}%</div>
                        <div className="text-[9px] text-slate-500">{item.playerCount}x</div>
                      </div>

                      <div className="bg-rose-950/60 border border-rose-800/60 p-2 rounded-lg text-rose-400">
                        <div className="text-[10px] text-slate-400 font-normal">{isBacBo ? '🔴 Banker' : '⚫ Preto'}</div>
                        <div className="text-sm font-black mt-0.5">{item.bankerPct}%</div>
                        <div className="text-[9px] text-slate-500">{item.bankerCount}x</div>
                      </div>

                      <div className="bg-amber-950/60 border border-amber-800/60 p-2 rounded-lg text-amber-400">
                        <div className="text-[10px] text-slate-400 font-normal">{isBacBo ? '🟡 Empate' : '🟢 Verde'}</div>
                        <div className="text-sm font-black mt-0.5">{item.tiePct}%</div>
                        <div className="text-[9px] text-slate-500">{item.tieCount}x</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Melhores Horários de Apostas */}
      {activeTab === 'bettingHours' && (
        <div className="space-y-6">
          {/* Top Rankings Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top 3 High Stability Hours */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-400" />
                  <span>Top 3 Horários de Maior Estabilidade</span>
                </h3>
                <span className="text-xs text-emerald-400 font-mono font-bold">Alta Assertividade</span>
              </div>

              <div className="space-y-3">
                {optimalHours.top3Overall.map((hRank, idx) => (
                  <div key={hRank.hour} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-black text-sm flex items-center justify-center">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-200 font-mono">{hRank.hourLabel}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {hRank.totalRounds} rodadas | Dominância: {hRank.winRateDominance}%
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-lg text-xs font-mono font-black">
                        Score {hRank.stabilityScore}/100
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 3 Tie / Zero Favourable Hours */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber-400" />
                  <span>Top 3 Horários com Mais {isBacBo ? 'Empates' : 'Zeros'}</span>
                </h3>
                <span className="text-xs text-amber-400 font-mono font-bold">Payout Elevado</span>
              </div>

              <div className="space-y-3">
                {optimalHours.top3TiesOrZeros.map((hRank, idx) => (
                  <div key={hRank.hour} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-amber-950 border border-amber-800 text-amber-400 font-black text-sm flex items-center justify-center">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-200 font-mono">{hRank.hourLabel}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {hRank.tieOrGreenCount}x {isBacBo ? 'empates' : 'zeros'} na hora
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="px-2.5 py-1 bg-amber-950 text-amber-300 border border-amber-800 rounded-lg text-xs font-mono font-black">
                        {hRank.tieOrGreenPct}% Frequência
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Full 24-Hour Ranking Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>Classificação e Recomendações por Hora (00:00 às 23:59)</span>
              </h3>
              <span className="text-xs font-mono text-slate-400">Análise Completa 24 Horas</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                    <th className="py-2.5 px-3">Horário</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Amostra</th>
                    <th className="py-2.5 px-3 text-center">Dominância %</th>
                    <th className="py-2.5 px-3 text-center">{isBacBo ? 'Empate %' : 'Verde %'}</th>
                    <th className="py-2.5 px-3 text-center">Índice Estabilidade</th>
                    <th className="py-2.5 px-3">Recomendação Técnica</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {optimalHours.rankedHours.map((hr) => (
                    <tr key={hr.hour} className="hover:bg-slate-950/60 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-200">{hr.hourLabel}</td>
                      <td className="py-2.5 px-3 text-center">
                        {hr.tier === 'EXCELLENT' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                            🟢 Excelente
                          </span>
                        ) : hr.tier === 'GOOD' ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800 text-[10px] font-bold">
                            🔵 Regular
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold">
                            🔴 Risco
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">{hr.totalRounds}r</td>
                      <td className="py-2.5 px-3 text-center font-bold text-cyan-400">{hr.winRateDominance}%</td>
                      <td className="py-2.5 px-3 text-center font-bold text-amber-400">{hr.tieOrGreenPct}%</td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="w-16 bg-slate-950 h-2 rounded-full overflow-hidden mx-auto border border-slate-800">
                          <div
                            className={`h-full ${
                              hr.stabilityScore >= 70 ? 'bg-emerald-500' : hr.stabilityScore >= 45 ? 'bg-blue-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${hr.stabilityScore}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 text-[11px] font-sans">{hr.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: 7 Análises Comportamentais do BacBo */}
      {activeTab === 'behavior' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-900 border border-purple-800/60 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-purple-900/40 border border-purple-700/60 rounded-xl text-purple-400">
                <Gauge className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white tracking-wide">
                  Suite de 7 Análises Comportamentais Avançadas do {isBacBo ? 'Bac Bo' : 'Roleta'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Estude volatilidade, lacunas de empates, dominância de dados, taxas de alternância e diferenciais de pontuação.
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center space-x-2">
              <span className="px-3 py-1 bg-purple-900/60 border border-purple-700 text-purple-300 font-mono font-bold text-xs rounded-lg">
                Volatilidade: {tableVolatility.volatilityScore}/100
              </span>
            </div>
          </div>

          {/* Row 1: Volatility Gauge & Tie Gap Frequency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Behavior 1: Volatilidade e Inércia da Mesa */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-purple-400" />
                  <span>1. Volatilidade e Inércia da Mesa</span>
                </h3>
                <span className="text-xs font-mono font-bold text-purple-400">
                  {tableVolatility.status}
                </span>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-bold">Índice de Estabilidade</span>
                  <span className="text-lg font-mono font-black text-purple-400">{tableVolatility.volatilityScore}%</span>
                </div>

                <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-gradient-to-r from-cyan-500 via-purple-500 to-rose-500 h-full transition-all duration-500"
                    style={{ width: `${tableVolatility.volatilityScore}%` }}
                  />
                </div>

                <p className="text-xs text-slate-300 leading-relaxed pt-1">
                  💡 <strong>Recomendação Técnica:</strong> {tableVolatility.advice}
                </p>
              </div>
            </div>

            {/* Behavior 2: Lacunas entre Empates (Tie Gap Frequency) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-amber-400" />
                  <span>2. Lacunas e Atraso entre Empates</span>
                </h3>
                <span className="text-xs font-mono font-bold text-amber-400">
                  Atraso atual: {tieGapsData.currentGap} rodadas
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Média de Lacuna</div>
                  <div className="text-base font-black text-amber-400 mt-0.5">{tieGapsData.avgGap}</div>
                  <div className="text-[9px] text-slate-500">rodadas</div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Lacuna Mínima</div>
                  <div className="text-base font-black text-emerald-400 mt-0.5">{tieGapsData.minGap}</div>
                  <div className="text-[9px] text-slate-500">rodadas</div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Lacuna Máxima</div>
                  <div className="text-base font-black text-rose-400 mt-0.5">{tieGapsData.maxGap}</div>
                  <div className="text-[9px] text-slate-500">rodadas</div>
                </div>
              </div>

              {/* Gaps Breakdown */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between text-xs font-mono">
                <span className="text-emerald-400">Curtos (&lt;8): {tieGapsData.shortGaps}x</span>
                <span className="text-amber-400">Médios (8-18): {tieGapsData.mediumGaps}x</span>
                <span className="text-rose-400">Longos (&gt;18): {tieGapsData.longGaps}x</span>
              </div>
            </div>
          </div>

          {/* Row 2: Chop Rate & Score Dominance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Behavior 3: Taxa de Inversão vs Sequência (Chop Rate) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Compass className="w-4 h-4 text-cyan-400" />
                  <span>3. Taxa de Alternância (Chop vs Streak)</span>
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  {chopRateData.totalTransitions} transições
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950 p-4 rounded-xl border border-cyan-800/60 text-center">
                  <div className="text-xs font-bold text-cyan-400">Alternância (Quebra)</div>
                  <div className="text-2xl font-mono font-black text-cyan-300 mt-1">{chopRateData.chopPct}%</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{chopRateData.chopCount}x ocorreu</div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-purple-800/60 text-center">
                  <div className="text-xs font-bold text-purple-400">Manutenção (Sequência)</div>
                  <div className="text-2xl font-mono font-black text-purple-300 mt-1">{chopRateData.streakPct}%</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{chopRateData.streakCount}x ocorreu</div>
                </div>
              </div>
            </div>

            {/* Behavior 4: Clusters de Placares Idênticos */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>4. Clusters de Placares Mais Frequentes</span>
                </h3>
                <span className="text-xs font-mono text-slate-400">Top Placares</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {scoreClusters.map((cl, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border text-center font-mono ${
                      cl.isTie
                        ? 'bg-amber-950/40 border-amber-800/80 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-black">{cl.scorePair}</div>
                    <div className="text-sm font-bold mt-0.5">{cl.count}x</div>
                    <div className="text-[9px] text-slate-500">{cl.pct}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 3: Matriz de Dominância de Dados (Scores 2 a 12) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-cyan-400" />
                <span>5. Matriz de Dominância por Pontuação dos Dados (Soma de 2 a 12)</span>
              </h3>
              <span className="text-xs text-slate-400">Desempenho relativo por soma do dado</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {scoreDominance.map((item) => (
                <div key={item.score} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>Soma {item.score}</span>
                    <span className="text-[10px] text-slate-500">{item.total}x</span>
                  </div>

                  <div className="space-y-1 text-[11px] font-mono">
                    <div className="flex justify-between text-blue-400">
                      <span>P:</span> <span>{item.playerPct}%</span>
                    </div>
                    <div className="flex justify-between text-rose-400">
                      <span>B:</span> <span>{item.bankerPct}%</span>
                    </div>
                    <div className="flex justify-between text-amber-400">
                      <span>Emp:</span> <span>{item.tiePct}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Row 4: Score Differential Behavior & Minute Decade Seasonality */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Behavior 6: Comportamento por Diferencial de Pontuação */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>6. Propensão a Empate por Diferencial de Pontuação</span>
                </h3>
                <span className="text-xs text-slate-400">Diferença de Pontos</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                      <th className="py-2 px-2">Diferença</th>
                      <th className="py-2 px-2 text-center">Ocorrências</th>
                      <th className="py-2 px-2 text-center">Próximo Empate</th>
                      <th className="py-2 px-2 text-center">% Puxa Empate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {diffBehavior.map((df) => (
                      <tr key={df.diff} className="hover:bg-slate-950/60">
                        <td className="py-2 px-2 font-bold text-cyan-400">{df.diff} ponto(s)</td>
                        <td className="py-2 px-2 text-center text-slate-300">{df.count}x</td>
                        <td className="py-2 px-2 text-center text-amber-400">{df.nextTieCount}x</td>
                        <td className="py-2 px-2 text-center font-bold text-emerald-400">{df.nextTiePct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Behavior 7: Sazonalidade por Dezenas do Relógio */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  <span>7. Sazonalidade por Dezenas de Minutos (:00 a :59)</span>
                </h3>
                <span className="text-xs text-slate-400">Minutos do Relógio</span>
              </div>

              <div className="space-y-2.5">
                {minuteDecades.map((dec, idx) => (
                  <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                    <span className="font-extrabold text-purple-400">{dec.label}</span>
                    <div className="flex items-center space-x-3 font-bold">
                      <span className="text-blue-400">{isBacBo ? 'P' : 'V'}: {dec.playerPct}%</span>
                      <span className="text-rose-400">{isBacBo ? 'B' : 'P'}: {dec.bankerPct}%</span>
                      <span className="text-amber-400">{isBacBo ? 'E' : '0'}: {dec.tiePct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ajuda */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Info className="w-5 h-5 text-cyan-400" />
                Guia das Máximas & Estatísticas
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
              <p>
                <strong>Máximas:</strong> Indica a maior sequência consecutiva de resultados idênticos (Banca seguidos, Empate seguidos ou Jogador seguidos) registrada no dia selecionado ou histórico total.
              </p>
              <p>
                <strong>Condições do Empate:</strong> Analisa qual a pontuação (soma dos dados) da casa vencedora imediatamente anterior ao empate. Isso ajuda a identificar quais números costumam anteceder um empate na mesa.
              </p>
              <p>
                <strong>Intervalos de 10 minutos:</strong> Dividem a hora relógio em 6 blocos de 10 minutos para revelar se a mesa tende a pagar mais empates ou viradas em momentos específicos do relógio.
              </p>
            </div>

            <div className="text-right pt-2">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-cyan-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-cyan-400"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
