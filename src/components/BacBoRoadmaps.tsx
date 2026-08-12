import React, { useState, useMemo } from 'react';
import { BacBoEvent } from '../types';
import { buildBeadPlate, buildBigRoad, filterEventsByDate } from '../utils/analyticsEngine';
import { BarChart2, Dices, Grid, TrendingUp, Filter } from 'lucide-react';

interface BacBoRoadmapsProps {
  events: BacBoEvent[];
}

export const BacBoRoadmaps: React.FC<BacBoRoadmapsProps> = ({ events }) => {
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');

  const filteredEvents = useMemo(() => {
    return filterEventsByDate(events, selectedDateFilter);
  }, [events, selectedDateFilter]);

  const beadPlateData = useMemo(() => buildBeadPlate(filteredEvents, 6), [filteredEvents]);
  const bigRoadData = useMemo(() => buildBigRoad(filteredEvents), [filteredEvents]);

  // Dice score breakdown (sum 2 to 12)
  const diceStats = useMemo(() => {
    const pSumMap: Record<number, number> = {};
    const bSumMap: Record<number, number> = {};
    const tieSumMap: Record<number, number> = {};
    const scoreDiffMap: Record<number, number> = {};

    for (let i = 2; i <= 12; i++) {
      pSumMap[i] = 0;
      bSumMap[i] = 0;
      tieSumMap[i] = 0;
    }

    filteredEvents.forEach((ev) => {
      pSumMap[ev.playerScore] = (pSumMap[ev.playerScore] || 0) + 1;
      bSumMap[ev.bankerScore] = (bSumMap[ev.bankerScore] || 0) + 1;

      if (ev.outcome === 'Tie') {
        tieSumMap[ev.playerScore] = (tieSumMap[ev.playerScore] || 0) + 1;
      }

      scoreDiffMap[ev.scoreDiff] = (scoreDiffMap[ev.scoreDiff] || 0) + 1;
    });

    return { pSumMap, bSumMap, tieSumMap, scoreDiffMap };
  }, [filteredEvents]);

  const formatTimeHM = (ts?: string | number) => {
    if (!ts) return '--:--';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '--:--';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  if (events.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        Nenhum evento do Bac Bo carregado ainda. Aguarde a coleta ao vivo...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-cyan-400" />
          <span className="font-extrabold text-white uppercase tracking-wider">Filtro de Data:</span>
          <span className="text-[11px] text-slate-400">({filteredEvents.length} rodadas)</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'today', label: 'Hoje' },
            { id: 'yesterday', label: 'Ontem' },
            { id: '2days', label: '2 Dias' },
            { id: '3days', label: '3 Dias' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setSelectedDateFilter(btn.id)}
              className={`px-3 py-1 rounded-lg font-bold transition-all border cursor-pointer ${
                selectedDateFilter === btn.id
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bead Plate Matrix (Grilla de Resultados) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Grid className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Grilla Bead Plate (Bac Bo Matrix)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {events.length} Rodadas • Leitura da esquerda para a direita (linha a linha)
          </span>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="inline-flex gap-1.5 p-2 bg-slate-950 rounded-xl border border-slate-800/80 min-w-full">
            {beadPlateData.map((col, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-1.5">
                {col.map((cell, cellIdx) => {
                  let bgColor = 'bg-slate-800 text-slate-400';
                  let border = 'border-slate-700';

                  if (cell.outcome === 'PlayerWon') {
                    bgColor = 'bg-gradient-to-br from-blue-600 to-cyan-700 text-white shadow-md shadow-blue-600/30';
                    border = 'border-blue-400/50';
                  } else if (cell.outcome === 'BankerWon') {
                    bgColor = 'bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-md shadow-rose-600/30';
                    border = 'border-rose-400/50';
                  } else if (cell.outcome === 'Tie') {
                    bgColor = 'bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-950 font-black shadow-md shadow-amber-500/30';
                    border = 'border-amber-300';
                  }

                  const timeStr = formatTimeHM(cell.timestamp);

                  return (
                    <div
                      key={cellIdx}
                      className={`w-12 h-11 py-1 px-1 rounded-xl flex flex-col items-center justify-center font-mono border ${bgColor} ${border} transition-transform hover:scale-110 relative group cursor-pointer`}
                      title={`Resultado: ${cell.outcome} | Player: ${cell.playerScore} vs Banker: ${cell.bankerScore} | Horário: ${timeStr}`}
                    >
                      <span className="font-extrabold text-[11px] leading-none">
                        {cell.playerScore}-{cell.bankerScore}
                      </span>
                      <span className="text-[9px] opacity-85 leading-none mt-1">
                        {timeStr}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Big Road Matrix (Grande Estrada) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Grande Estrada (Big Road - Tendências)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Alternância de cor em colunas • Linhas amarelas indicam Empates na rodada
          </span>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="inline-flex gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800/80 min-w-full">
            {bigRoadData.map((col, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-1.5">
                {col.map((item, rowIdx) => {
                  const isPlayer = item.outcome === 'PlayerWon';
                  const circleColor = isPlayer
                    ? 'border-2 border-cyan-400 text-cyan-400 bg-cyan-950/40'
                    : 'border-2 border-rose-500 text-rose-400 bg-rose-950/40';

                  return (
                    <div
                      key={rowIdx}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${circleColor} relative transition-transform hover:scale-110`}
                      title={`${isPlayer ? 'Player' : 'Banker'} (P:${item.playerScore} vs B:${item.bankerScore})`}
                    >
                      <span>{isPlayer ? 'P' : 'B'}</span>

                      {/* Tie indicator diagonal slash or badge */}
                      {item.tieCount > 0 && (
                        <div
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 text-slate-950 rounded-full text-[8px] font-black flex items-center justify-center border border-slate-900"
                          title={`${item.tieCount} Empate(s) antes ou durante`}
                        >
                          {item.tieCount}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
