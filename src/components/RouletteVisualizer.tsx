import React, { useMemo } from 'react';
import { RouletteEvent } from '../types';
import { BLACK_NUMBERS, ORPHELINS_NUMBERS, RED_NUMBERS, TIERS_NUMBERS, VOISINS_NUMBERS, ZERO_GAME_NUMBERS } from '../utils/gameParsers';
import { Compass, Flame, Grid, PieChart, ShieldAlert, Zap } from 'lucide-react';

interface RouletteVisualizerProps {
  events: RouletteEvent[];
}

export const RouletteVisualizer: React.FC<RouletteVisualizerProps> = ({ events }) => {
  // Compute roulette statistics
  const stats = useMemo(() => {
    const numCounts: Record<number, number> = {};
    for (let i = 0; i <= 36; i++) numCounts[i] = 0;

    let redCount = 0;
    let blackCount = 0;
    let greenCount = 0;
    let evenCount = 0;
    let oddCount = 0;
    let highCount = 0; // 19-36
    let lowCount = 0; // 1-18

    const dozenMap = { 1: 0, 2: 0, 3: 0, 0: 0 };
    const columnMap = { 1: 0, 2: 0, 3: 0, 0: 0 };
    const sectorMap = { Voisins: 0, Tiers: 0, Orphelins: 0, Zero: 0 };

    let lastZeroIndex = -1;

    events.forEach((ev, idx) => {
      numCounts[ev.number] = (numCounts[ev.number] || 0) + 1;

      if (ev.color === 'Red') redCount++;
      else if (ev.color === 'Black') blackCount++;
      else greenCount++;

      if (ev.type === 'Even') evenCount++;
      else if (ev.type === 'Odd') oddCount++;

      if (ev.highLow === 'High') highCount++;
      else if (ev.highLow === 'Low') lowCount++;

      dozenMap[ev.dozen]++;
      columnMap[ev.column]++;
      sectorMap[ev.sector]++;

      if (ev.number === 0 && lastZeroIndex === -1) {
        lastZeroIndex = idx;
      }
    });

    // Hot & Cold numbers
    const sortedNums = Object.entries(numCounts)
      .map(([num, count]) => ({ num: Number(num), count }))
      .sort((a, b) => b.count - a.count);

    const hotNumbers = sortedNums.slice(0, 5);
    const coldNumbers = sortedNums.slice(-5).reverse();

    const total = events.length || 1;

    return {
      numCounts,
      redPct: ((redCount / total) * 100).toFixed(1),
      blackPct: ((blackCount / total) * 100).toFixed(1),
      greenPct: ((greenCount / total) * 100).toFixed(1),
      evenPct: ((evenCount / total) * 100).toFixed(1),
      oddPct: ((oddCount / total) * 100).toFixed(1),
      highPct: ((highCount / total) * 100).toFixed(1),
      lowPct: ((lowCount / total) * 100).toFixed(1),
      dozenMap,
      columnMap,
      sectorMap,
      hotNumbers,
      coldNumbers,
      spinsSinceZero: lastZeroIndex === -1 ? events.length : lastZeroIndex,
    };
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        Nenhum evento de Roleta carregado ainda. Aguarde a coleta ao vivo...
      </div>
    );
  }

  // European Wheel Sequence (0-36)
  const wheelSequence = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];

  return (
    <div className="space-y-6">
      {/* Overview Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Vermelho vs Preto */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400">Vermelho / Preto</div>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-lg font-extrabold text-rose-500 font-mono">{stats.redPct}%</span>
            <span className="text-xs text-slate-500">/</span>
            <span className="text-sm font-bold text-slate-300 font-mono">{stats.blackPct}%</span>
          </div>
          <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden flex">
            <div className="bg-rose-500 h-full" style={{ width: `${stats.redPct}%` }} />
            <div className="bg-slate-700 h-full" style={{ width: `${stats.blackPct}%` }} />
          </div>
        </div>

        {/* Zero Stats */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400">Zero (0 Verde)</div>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-lg font-extrabold text-emerald-400 font-mono">{stats.greenPct}%</span>
            <span className="text-[10px] text-slate-400 font-mono">({stats.spinsSinceZero} rod. atrás)</span>
          </div>
          <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-emerald-500 h-full" style={{ width: `${stats.greenPct}%` }} />
          </div>
        </div>

        {/* Par vs Ímpar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400">Par / Ímpar</div>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-lg font-extrabold text-cyan-400 font-mono">{stats.evenPct}%</span>
            <span className="text-xs text-slate-500">/</span>
            <span className="text-sm font-bold text-slate-300 font-mono">{stats.oddPct}%</span>
          </div>
          <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden flex">
            <div className="bg-cyan-500 h-full" style={{ width: `${stats.evenPct}%` }} />
            <div className="bg-indigo-500 h-full" style={{ width: `${stats.oddPct}%` }} />
          </div>
        </div>

        {/* Alto vs Baixo */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400">Alto (19-36) / Baixo (1-18)</div>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-lg font-extrabold text-amber-400 font-mono">{stats.highPct}%</span>
            <span className="text-xs text-slate-500">/</span>
            <span className="text-sm font-bold text-slate-300 font-mono">{stats.lowPct}%</span>
          </div>
          <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden flex">
            <div className="bg-amber-500 h-full" style={{ width: `${stats.highPct}%` }} />
            <div className="bg-slate-600 h-full" style={{ width: `${stats.lowPct}%` }} />
          </div>
        </div>

        {/* Hot Numbers */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg">
          <div className="text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1">
            <Flame className="w-3 h-3 text-rose-500" /> Números Quentes
          </div>
          <div className="flex items-center space-x-1.5 mt-1">
            {stats.hotNumbers.slice(0, 3).map(({ num, count }) => (
              <span
                key={num}
                className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                  RED_NUMBERS.has(num)
                    ? 'bg-rose-950 text-rose-400 border border-rose-800/60'
                    : num === 0
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                    : 'bg-slate-950 text-slate-300 border border-slate-800'
                }`}
              >
                {num} ({count}x)
              </span>
            ))}
          </div>
        </div>

        {/* Cold Numbers */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg">
          <div className="text-[10px] uppercase font-bold text-cyan-400 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-cyan-400" /> Números Frios
          </div>
          <div className="flex items-center space-x-1.5 mt-1">
            {stats.coldNumbers.slice(0, 3).map(({ num, count }) => (
              <span
                key={num}
                className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-950 text-slate-400 border border-slate-800"
              >
                {num} ({count}x)
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Number Matrix Grid (0 to 36) Heatmap */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Grid className="w-5 h-5 text-rose-500" />
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
              Matriz de Frequência dos Números (Heatmap)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Intensidade da borda indica ocorrência recente
          </span>
        </div>

        <div className="grid grid-cols-7 sm:grid-cols-12 gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
          {Array.from({ length: 37 }).map((_, i) => {
            const num = i;
            const count = stats.numCounts[num] || 0;
            const countsArray = Object.values(stats.numCounts) as number[];
            const maxCount = Math.max(...countsArray, 1);
            const intensity = count / maxCount;

            let colorStyle = 'bg-slate-900 text-slate-300 border-slate-800';
            if (num === 0) {
              colorStyle = 'bg-emerald-950 text-emerald-400 border-emerald-600';
            } else if (RED_NUMBERS.has(num)) {
              colorStyle = 'bg-rose-950/70 text-rose-300 border-rose-700/80';
            } else {
              colorStyle = 'bg-slate-900 text-slate-200 border-slate-700/80';
            }

            return (
              <div
                key={num}
                className={`p-2 rounded-lg border text-center transition-all hover:scale-105 cursor-pointer relative ${colorStyle}`}
                style={{
                  boxShadow: intensity > 0.5 ? `0 0 10px rgba(244, 63, 94, ${intensity * 0.4})` : undefined,
                }}
              >
                <div className="text-xs font-mono font-black">{num}</div>
                <div className="text-[9px] font-mono text-slate-400">{count}x</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Race Track & European Wheel Sectors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Race Track Sectors */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center space-x-2 mb-4">
            <Compass className="w-5 h-5 text-amber-400" />
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">
              Setores da Pista (Race Track Distribution)
            </h4>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Voisins */}
            <div className="bg-slate-950 p-3 rounded-xl border border-blue-500/30">
              <div className="text-[10px] text-blue-400 font-bold uppercase">Voisins du Zéro</div>
              <div className="text-lg font-mono font-black text-white mt-1">
                {((stats.sectorMap.Voisins / events.length) * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-400">{stats.sectorMap.Voisins} saídas</div>
            </div>

            {/* Tiers */}
            <div className="bg-slate-950 p-3 rounded-xl border border-amber-500/30">
              <div className="text-[10px] text-amber-400 font-bold uppercase">Tiers du Cylindre</div>
              <div className="text-lg font-mono font-black text-white mt-1">
                {((stats.sectorMap.Tiers / events.length) * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-400">{stats.sectorMap.Tiers} saídas</div>
            </div>

            {/* Orphelins */}
            <div className="bg-slate-950 p-3 rounded-xl border border-purple-500/30">
              <div className="text-[10px] text-purple-400 font-bold uppercase">Orphelins</div>
              <div className="text-lg font-mono font-black text-white mt-1">
                {((stats.sectorMap.Orphelins / events.length) * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-400">{stats.sectorMap.Orphelins} saídas</div>
            </div>

            {/* Zero Game */}
            <div className="bg-slate-950 p-3 rounded-xl border border-emerald-500/30">
              <div className="text-[10px] text-emerald-400 font-bold uppercase">Jogo do Zero</div>
              <div className="text-lg font-mono font-black text-white mt-1">
                {((stats.sectorMap.Zero / events.length) * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-400">{stats.sectorMap.Zero} saídas</div>
            </div>
          </div>
        </div>

        {/* Dozens & Columns */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center space-x-2 mb-4">
            <PieChart className="w-5 h-5 text-cyan-400" />
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">
              Dúzias & Colunas
            </h4>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-[11px] font-bold text-slate-400 mb-2 uppercase">Dúzias (1-12 | 13-24 | 25-36)</div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((d) => {
                  const cnt = stats.dozenMap[d as 1 | 2 | 3];
                  const pct = ((cnt / events.length) * 100).toFixed(1);
                  return (
                    <div key={d} className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400">{d}ª Dúzia</span>
                      <div className="text-sm font-mono font-bold text-cyan-400">{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-400 mb-2 uppercase">Colunas (1ª | 2ª | 3ª)</div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((c) => {
                  const cnt = stats.columnMap[c as 1 | 2 | 3];
                  const pct = ((cnt / events.length) * 100).toFixed(1);
                  return (
                    <div key={c} className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400">{c}ª Coluna</span>
                      <div className="text-sm font-mono font-bold text-amber-400">{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
