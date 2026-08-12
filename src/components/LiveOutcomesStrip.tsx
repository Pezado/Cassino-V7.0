import React from 'react';
import { BacBoEvent, GameType, RouletteEvent } from '../types';
import { calculateStreaks } from '../utils/analyticsEngine';
import { Activity, Flame, ShieldAlert, Zap } from 'lucide-react';

interface LiveOutcomesStripProps {
  game: GameType;
  bacboEvents: BacBoEvent[];
  rouletteEvents: RouletteEvent[];
  showStatsSummary?: boolean;
}

export const LiveOutcomesStrip: React.FC<LiveOutcomesStripProps> = ({
  game,
  bacboEvents,
  rouletteEvents,
  showStatsSummary = false,
}) => {
  const isBacBo = game === 'bacbo';
  const events = isBacBo ? bacboEvents : rouletteEvents;

  const keyExtractor = (item: any) => {
    if (isBacBo) return item.outcome;
    return item.color;
  };

  const streaks = calculateStreaks(events, keyExtractor);

  // Overall counts & win percentages
  const stats = React.useMemo(() => {
    if (events.length === 0) return { p1: '0', p2: '0', p3: '0', label1: '', label2: '', label3: '' };

    if (isBacBo) {
      const pCount = bacboEvents.filter((e) => e.outcome === 'PlayerWon').length;
      const bCount = bacboEvents.filter((e) => e.outcome === 'BankerWon').length;
      const tCount = bacboEvents.filter((e) => e.outcome === 'Tie').length;
      const total = bacboEvents.length || 1;

      return {
        p1: ((pCount / total) * 100).toFixed(1),
        p2: ((bCount / total) * 100).toFixed(1),
        p3: ((tCount / total) * 100).toFixed(1),
        c1: pCount,
        c2: bCount,
        c3: tCount,
        label1: 'Player (Azul)',
        label2: 'Banker (Vermelho)',
        label3: 'Empate (Amarelo)',
      };
    } else {
      const rCount = rouletteEvents.filter((e) => e.color === 'Red').length;
      const bCount = rouletteEvents.filter((e) => e.color === 'Black').length;
      const gCount = rouletteEvents.filter((e) => e.color === 'Green').length;
      const total = rouletteEvents.length || 1;

      return {
        p1: ((rCount / total) * 100).toFixed(1),
        p2: ((bCount / total) * 100).toFixed(1),
        p3: ((gCount / total) * 100).toFixed(1),
        c1: rCount,
        c2: bCount,
        c3: gCount,
        label1: 'Vermelho',
        label2: 'Preto',
        label3: 'Zero (Verde)',
      };
    }
  }, [events, isBacBo]);

  let streakBadgeText = 'Nenhuma';
  if (streaks.current.count > 0) {
    let itemLabel = streaks.current.item;
    if (itemLabel === 'PlayerWon') itemLabel = 'Player';
    else if (itemLabel === 'BankerWon') itemLabel = 'Banker';
    else if (itemLabel === 'Tie') itemLabel = 'Empates';

    streakBadgeText = `${streaks.current.count}x ${itemLabel}`;
  }

  const formatTimeHM = (ts?: string | number) => {
    if (!ts) return '--:--';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '--:--';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Top Quick Metrics Bar - ONLY in Overview / Matriz & Geral */}
      {showStatsSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Metric 1 */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-slate-400 uppercase">{stats.label1}</div>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-xl font-mono font-black text-cyan-400">{stats.p1}%</span>
              <span className="text-[10px] text-slate-500 font-mono">({stats.c1}x)</span>
            </div>
          </div>

          {/* Metric 2 */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-slate-400 uppercase">{stats.label2}</div>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-xl font-mono font-black text-rose-500">{stats.p2}%</span>
              <span className="text-[10px] text-slate-500 font-mono">({stats.c2}x)</span>
            </div>
          </div>

          {/* Metric 3 */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-slate-400 uppercase">{stats.label3}</div>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-xl font-mono font-black text-amber-400">{stats.p3}%</span>
              <span className="text-[10px] text-slate-500 font-mono">({stats.c3}x)</span>
            </div>
          </div>

          {/* Current Streak */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" /> Sequência Atual
            </div>
            <div className="text-base font-mono font-extrabold text-emerald-400 mt-1 truncate">
              {streakBadgeText}
            </div>
          </div>
        </div>
      )}

      {/* Horizontal Tape of Recent Outcomes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-bold text-slate-300 uppercase flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-cyan-400" /> Fita de Resultados Recentes (Ao Vivo)
          </span>
          <span className="text-[11px] text-slate-500">Mais Novo ➔ Mais Antigo</span>
        </div>

        {events.length === 0 ? (
          <div className="bg-slate-950 p-4 rounded-xl text-center text-xs text-slate-500 italic">
            Aguardando primeiras rodadas da API...
          </div>
        ) : (
          <div className="flex space-x-2 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-slate-800">
            {events.slice(0, 35).map((ev: any, idx) => {
              const timeStr = formatTimeHM(ev.timestamp);

              if (isBacBo) {
                const bEv = ev as BacBoEvent;
                let bg = 'bg-slate-800 text-slate-300 border-slate-700';

                if (bEv.outcome === 'PlayerWon') {
                  bg = 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white border-blue-400/60 shadow-md shadow-blue-600/30';
                } else if (bEv.outcome === 'BankerWon') {
                  bg = 'bg-gradient-to-br from-red-600 to-rose-600 text-white border-rose-400/60 shadow-md shadow-rose-600/30';
                } else if (bEv.outcome === 'Tie') {
                  bg = 'bg-gradient-to-br from-amber-500 to-yellow-500 text-slate-950 border-amber-300 shadow-md shadow-amber-500/30';
                }

                return (
                  <div
                    key={bEv.id || idx}
                    className={`shrink-0 w-14 h-12 py-1 px-1 rounded-xl border flex flex-col items-center justify-center font-bold transition-transform hover:scale-110 cursor-pointer ${bg}`}
                    title={`Horário: ${timeStr} | Player: ${bEv.playerScore} vs Banker: ${bEv.bankerScore}`}
                  >
                    <span className="font-mono font-black text-xs leading-none">
                      {bEv.playerScore}-{bEv.bankerScore}
                    </span>
                    <span className="text-[9px] font-mono opacity-85 leading-none mt-1">
                      {timeStr}
                    </span>
                  </div>
                );
              } else {
                const rEv = ev as RouletteEvent;
                let bg = 'bg-slate-800 text-slate-200 border-slate-700';
                if (rEv.color === 'Red') {
                  bg = 'bg-gradient-to-br from-rose-600 to-red-700 text-white border-rose-500/60 shadow-md shadow-rose-600/30';
                } else if (rEv.color === 'Black') {
                  bg = 'bg-gradient-to-br from-slate-900 to-slate-950 text-slate-200 border-slate-700 shadow-md shadow-slate-900/40';
                } else if (rEv.color === 'Green') {
                  bg = 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-emerald-400/60 shadow-md shadow-emerald-500/30';
                }

                return (
                  <div
                    key={rEv.id || idx}
                    className={`shrink-0 w-14 h-12 py-1 px-1 rounded-xl border flex flex-col items-center justify-center font-mono font-black transition-transform hover:scale-110 cursor-pointer ${bg}`}
                    title={`Horário: ${timeStr} | Número: ${rEv.number} | Setor: ${rEv.sector}`}
                  >
                    <span className="font-mono font-black text-sm leading-none">
                      {rEv.number}
                    </span>
                    <span className="text-[9px] font-mono opacity-85 leading-none mt-1">
                      {timeStr}
                    </span>
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>
    </div>
  );
};
