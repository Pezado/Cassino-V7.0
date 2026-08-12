import React, { useState, useMemo } from 'react';
import { RouletteEvent, GameType } from '../types';
import { filterEventsByDate } from '../utils/analyticsEngine';
import {
  RED_NUMBERS,
  BLACK_NUMBERS,
  VOISINS_NUMBERS,
  TIERS_NUMBERS,
  ORPHELINS_NUMBERS,
  ZERO_GAME_NUMBERS,
} from '../utils/gameParsers';
import {
  Flame,
  Snowflake,
  BarChart2,
  Repeat,
  Compass,
  TrendingUp,
  Clock,
  Zap,
  Filter,
  Grid,
  ArrowRight,
  Search,
  Layers,
  Activity,
  Target,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  BookOpen,
} from 'lucide-react';

interface RoulettePatternAnalyzerProps {
  activeGame: GameType;
  autoRouletteEvents: RouletteEvent[];
  immersiveRouletteEvents: RouletteEvent[];
  onSelectGame?: (game: GameType) => void;
}

// European Wheel sequence in clockwise physical order
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

// Helper to get distance on the wheel between two numbers (0 to 18 slots)
function getWheelDistance(numA: number, numB: number): number {
  const idxA = WHEEL_ORDER.indexOf(numA);
  const idxB = WHEEL_ORDER.indexOf(numB);
  if (idxA === -1 || idxB === -1) return 99;
  const direct = Math.abs(idxA - idxB);
  return Math.min(direct, 37 - direct);
}

// Helper to check color
function getNumColor(num: number): 'Red' | 'Black' | 'Green' {
  if (num === 0) return 'Green';
  return RED_NUMBERS.has(num) ? 'Red' : 'Black';
}

// Helper to get number sector
function getNumSector(num: number): 'Voisins' | 'Tiers' | 'Orphelins' | 'Zero' {
  if (ZERO_GAME_NUMBERS.has(num)) return 'Zero';
  if (VOISINS_NUMBERS.has(num)) return 'Voisins';
  if (TIERS_NUMBERS.has(num)) return 'Tiers';
  return 'Orphelins';
}

export const RoulettePatternAnalyzer: React.FC<RoulettePatternAnalyzerProps> = ({
  activeGame,
  autoRouletteEvents,
  immersiveRouletteEvents,
  onSelectGame,
}) => {
  // Selected sub-game for analysis (Auto or Immersive)
  const [selectedGame, setSelectedGame] = useState<'autoroulette' | 'immersiveroulette'>(
    activeGame === 'immersiveroulette' ? 'immersiveroulette' : 'autoroulette'
  );

  // Lookback window option
  const [lookbackLimit, setLookbackLimit] = useState<number>(0); // 0 = all
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'heatmap' | 'hotcold' | 'sequences' | 'transitions' | 'indomavel'>('indomavel');
  const [selectedTargetNum, setSelectedTargetNum] = useState<number>(17);
  const [gridSortBy, setGridSortBy] = useState<'number' | 'freq' | 'cold' | 'wheel'>('number');

  const eventsRaw = selectedGame === 'autoroulette' ? autoRouletteEvents : immersiveRouletteEvents;

  // Filter events based on date and lookback
  const events = useMemo(() => {
    const dateFiltered = filterEventsByDate(eventsRaw, selectedDateFilter);
    if (lookbackLimit > 0) {
      return dateFiltered.slice(0, lookbackLimit);
    }
    return dateFiltered;
  }, [eventsRaw, selectedDateFilter, lookbackLimit]);

  // Indomavel Live Signals Detector
  const indomavelSignals = useMemo(() => {
    if (events.length === 0) return [];

    const signals: {
      id: string;
      title: string;
      category: string;
      trigger: string;
      target: string;
      protection: string;
      badgeColor: string;
    }[] = [];

    const n0 = events[0]?.number; // Most recent spin
    const n1 = events[1]?.number; // 2nd most recent

    if (n0 === undefined) return signals;

    // 1. Estratégia dos Números Duplos em Repetição (Terminal Repetido)
    if (n1 !== undefined && (n0 % 10 === n1 % 10)) {
      const term = n0 % 10;
      const nextProbableTerm = (term + 8) % 10;
      signals.push({
        id: 'duplos-repeticao',
        title: 'Estratégia dos Números Duplos em Repetição',
        category: 'Terminais Repetidos',
        trigger: `Repetição do Terminal "${term}" (Últimos giros: #${n1} e #${n0})`,
        target: `Jogar em todos os Terminais "${nextProbableTerm}" e Terminais "${term}"`,
        protection: `Cobrir todos os Terminais "0" + Repetição do último (#${n0}) + Soma/Subtração`,
        badgeColor: 'bg-cyan-500 text-slate-950',
      });
    }

    // 2. Estratégia de Somas e Subtrações
    if (n1 !== undefined) {
      const d1 = n1 % 10;
      const d2 = n0 % 10;
      const sumTerm = (d1 + d2) % 10;
      const subTerm = Math.abs(d1 - d2) % 10;

      signals.push({
        id: 'soma-subtracao',
        title: 'Somas e Subtrações dos Números Passados',
        category: 'Operação Numérica',
        trigger: `Últimos números: #${n1} (dig. ${d1}) e #${n0} (dig. ${d2}). Soma=${d1}+${d2}=${d1 + d2} | Subtr.=|${d1}-${d2}|=${Math.abs(d1 - d2)}`,
        target: `Entrada principal em todos os Terminais "${sumTerm}" e Terminais "${subTerm}"`,
        protection: `1 vizinho em cada lado no cilindro + Cobrir todos os Terminais "0"`,
        badgeColor: 'bg-emerald-500 text-slate-950',
      });
    }

    // 3. Vizinhos de Zero na Troca de Croupier
    const zeroNeighborsSet = new Set([0, 26, 3, 35, 32, 15, 19, 4, 21, 2, 25, 17, 34, 1, 5, 8, 11, 14, 23]);
    if (zeroNeighborsSet.has(n0)) {
      signals.push({
        id: 'vizinhos-zero',
        title: 'Estratégia dos Vizinhos de "0" / Troca de Croupier',
        category: 'Setor Zero',
        trigger: `O último número #${n0} é Vizinho de "0" no Cilindro`,
        target: 'Jogada Forte em TODOS os Terminais "0" (0, 10, 20, 30)',
        protection: 'Cobrir o número 0 seco + 1 vizinho (26 e 32)',
        badgeColor: 'bg-amber-400 text-slate-950',
      });
    }

    // 4. Números Espelhados
    const mirrors: Record<number, number> = {
      21: 12, 12: 21,
      23: 32, 32: 23,
      31: 13, 13: 31,
      26: 29, 29: 26,
    };
    if (mirrors[n0] !== undefined) {
      signals.push({
        id: 'espelhados',
        title: 'Padrão de Números Espelhados',
        category: 'Espelhos de Mesa',
        trigger: `Saiu #${n0} que possui par espelhado com #${mirrors[n0]}`,
        target: `Entrada no número espelho #${mirrors[n0]} com 1 ou 2 vizinhos`,
        protection: 'Cobrir o próprio número recente com 1 vizinho',
        badgeColor: 'bg-purple-400 text-slate-950',
      });
    }

    // 5. Sequências Crescente / Decrescente
    if (n1 !== undefined) {
      if (n1 - n0 === 1) {
        signals.push({
          id: 'seq-decrescente',
          title: 'Sequência Decrescente Detectada',
          category: 'Puxador de Sequência',
          trigger: `Sequência em queda: #${n1} -> #${n0}`,
          target: 'Jogue o Nº 18 com 1 vizinho',
          protection: 'Cobrir Terminal 8 com aposta seca',
          badgeColor: 'bg-rose-500 text-white',
        });
      } else if (n0 - n1 === 1) {
        signals.push({
          id: 'seq-crescente',
          title: 'Sequência Crescente Detectada',
          category: 'Puxador de Sequência',
          trigger: `Sequência em alta: #${n1} -> #${n0}`,
          target: 'Jogue o Nº 3 com 1 vizinho',
          protection: 'Cobrir o Zero (0) seco',
          badgeColor: 'bg-blue-500 text-white',
        });
      }
    }

    // 6. Puxadores Específicos
    if (n0 === 13) {
      signals.push({
        id: 'puxador-13',
        title: 'Puxador Indomável: Número 13',
        category: 'Puxador Específico',
        trigger: 'O Número 13 acabou de ser sorteado',
        target: 'Jogue o Nº 31 com 2 vizinhos + Terminais 1',
        protection: 'Manter cobrindo perto do próprio 13',
        badgeColor: 'bg-indigo-500 text-white',
      });
    } else if (n0 === 26) {
      signals.push({
        id: 'puxador-26',
        title: 'Puxador Indomável: Número 26',
        category: 'Puxador Específico',
        trigger: 'O Número 26 acabou de ser sorteado',
        target: 'Jogue Nº 22 e 25 (2 vizinhos) + Nº 5 (1 vizinho) + Verde Zero na mesa',
        protection: 'Se deu gatilho p/ Terminal 9: Jogue Nº 29 com 2 vizinhos',
        badgeColor: 'bg-cyan-600 text-white',
      });
    } else if (n0 === 28) {
      signals.push({
        id: 'puxador-28',
        title: 'Puxador Indomável: Número 28',
        category: 'Puxador Específico',
        trigger: 'O Número 28 acabou de ser sorteado',
        target: 'Jogue Terminal 1 com 1 vizinho',
        protection: 'Se gatilho p/ Terminal 9: Jogue Nº 29 (2 vizinhos) + Terminal 1 seco',
        badgeColor: 'bg-amber-500 text-slate-950',
      });
    } else if (n0 === 24) {
      signals.push({
        id: 'puxador-24',
        title: 'Puxador Indomável: Número 24',
        category: 'Puxador Específico',
        trigger: 'O Número 24 acabou de ser sorteado',
        target: 'Jogue Nº 2, Nº 26 e Nº 24 com 2 vizinhos',
        protection: 'Cobrir o Zero (0) seco',
        badgeColor: 'bg-teal-500 text-slate-950',
      });
    } else if (n0 === 29) {
      signals.push({
        id: 'puxador-29',
        title: 'Puxador Indomável: Número 29',
        category: 'Puxador Específico',
        trigger: 'O Número 29 acabou de ser sorteado',
        target: 'Jogue Nº 29 (2 vizinhos) + Nº 4 + Nº 23 (2 vizinhos)',
        protection: 'Opção alternativa: Terminal 1 seco + Nº 7 (2 vizinhos) + Nº 10 (1 vizinho)',
        badgeColor: 'bg-rose-600 text-white',
      });
    } else if (n0 === 23) {
      let extraTarget = 'Jogue Nº 4, Nº 7 e Nº 20 com 1 vizinho';
      if (n1 === 2) extraTarget = 'Gatilho ativo! Jogue Nº 4 com 2 vizinhos';
      else if (n1 === 3 || n1 === 27) extraTarget = 'Gatilho ativo! Jogue Nº 7 com 2 vizinhos';
      else if (n1 === 0 || n1 === 13) extraTarget = 'Gatilho ativo! Jogue Nº 20 com 2 vizinhos';

      signals.push({
        id: 'puxador-23',
        title: 'Puxador Indomável: Número 23',
        category: 'Puxador Específico',
        trigger: 'O Número 23 acabou de ser sorteado',
        target: extraTarget,
        protection: 'Cobrir o Zero (0) na mesa',
        badgeColor: 'bg-emerald-600 text-white',
      });
    } else if (n0 === 34) {
      signals.push({
        id: 'puxador-34',
        title: 'Puxador Indomável: Número 34',
        category: 'Puxador Específico',
        trigger: 'O Número 34 acabou de ser sorteado',
        target: 'Jogue Terminal 3 com 1 vizinho OU Nº 33 com 2 vizinhos',
        protection: 'Cobrir o número 34 em repetição',
        badgeColor: 'bg-violet-600 text-white',
      });
    } else if (n0 === 31) {
      signals.push({
        id: 'puxador-31',
        title: 'Puxador Indomável: Número 31',
        category: 'Puxador Específico',
        trigger: 'O Número 31 acabou de ser sorteado',
        target: 'Jogue Nº 35 e Nº 13 com 2 vizinhos',
        protection: 'Cobrir Terminal 1 com aposta seca',
        badgeColor: 'bg-sky-500 text-slate-950',
      });
    } else if (n0 === 35) {
      signals.push({
        id: 'puxador-35',
        title: 'Puxador Indomável: Número 35',
        category: 'Puxador Específico',
        trigger: 'O Número 35 acabou de ser sorteado',
        target: 'Jogue Nº 31 e Nº 36 com 2 vizinhos',
        protection: 'Jogue o 36 (número que o 35 mais chama) com 1 vizinho',
        badgeColor: 'bg-amber-600 text-white',
      });
    } else if (n0 === 36) {
      signals.push({
        id: 'puxador-36',
        title: 'Puxador Indomável: Número 36',
        category: 'Puxador Específico',
        trigger: 'O Número 36 acabou de ser sorteado',
        target: 'Jogue Nº 21 com 2 vizinhos + Secos: #30, #11, #36, #27, #8',
        protection: 'Cobrir todos os Terminais 0',
        badgeColor: 'bg-rose-500 text-white',
      });
    }

    return signals;
  }, [events]);

  // Comprehensive Pattern Analysis Engine
  const analytics = useMemo(() => {
    const totalSpins = events.length;

    // 1. Individual Number Frequencies & Delays (Spins since last drawn)
    const numCounts: Record<number, number> = {};
    const lastSeenIndex: Record<number, number> = {}; // 0 = most recent spin in array
    const maxDelay: Record<number, number> = {}; // longest gap without drawing

    for (let i = 0; i <= 36; i++) {
      numCounts[i] = 0;
      lastSeenIndex[i] = -1;
      maxDelay[i] = 0;
    }

    // Track gaps between appearances for each number
    const lastIndexForGap: Record<number, number> = {};

    events.forEach((ev, idx) => {
      const n = ev.number;
      numCounts[n] = (numCounts[n] || 0) + 1;

      if (lastSeenIndex[n] === -1) {
        lastSeenIndex[n] = idx; // distance from current (idx 0 is newest)
      }

      if (lastIndexForGap[n] !== undefined) {
        const gap = idx - lastIndexForGap[n];
        if (gap > maxDelay[n]) maxDelay[n] = gap;
      }
      lastIndexForGap[n] = idx;
    });

    // Compute delay for numbers never drawn or since last draw
    for (let i = 0; i <= 36; i++) {
      const currentDelay = lastSeenIndex[i] === -1 ? totalSpins : lastSeenIndex[i];
      if (currentDelay > maxDelay[i]) maxDelay[i] = currentDelay;
    }

    // Theoretical probability per spin = 1/37 ≈ 2.7027%
    const expectedHits = totalSpins / 37;

    // Full list of 0-36 stats objects
    const numberStatsList = Array.from({ length: 37 }, (_, num) => {
      const count = numCounts[num];
      const pct = totalSpins > 0 ? (count / totalSpins) * 100 : 0;
      const expectedPct = 2.7027;
      const deviation = pct - expectedPct; // percentage points diff
      const currentDelay = lastSeenIndex[num] === -1 ? totalSpins : lastSeenIndex[num];

      return {
        number: num,
        color: getNumColor(num),
        sector: getNumSector(num),
        count,
        pct: Number(pct.toFixed(2)),
        deviation: Number(deviation.toFixed(2)),
        currentDelay,
        maxDelay: maxDelay[num],
        isHot: count > expectedHits * 1.25,
        isCold: count < expectedHits * 0.75 || currentDelay >= 25,
      };
    });

    // Hot & Cold rankings
    const sortedByFreq = [...numberStatsList].sort((a, b) => b.count - a.count);
    const hotNumbers = sortedByFreq.slice(0, 6);
    const coldNumbers = [...numberStatsList].sort((a, b) => b.currentDelay - a.currentDelay).slice(0, 6);

    // 2. Terminal Digits (Finals) Analysis: 0, 1, 2, ..., 9
    const terminalCounts: Record<number, number> = {};
    for (let d = 0; d <= 9; d++) terminalCounts[d] = 0;

    events.forEach((ev) => {
      const digit = ev.number % 10;
      terminalCounts[digit] = (terminalCounts[digit] || 0) + 1;
    });

    const terminalStats = Array.from({ length: 10 }, (_, digit) => {
      const count = terminalCounts[digit];
      const expectedTerminalHits = totalSpins * (digit <= 6 ? 4 / 37 : 3 / 37); // digits 0-6 have 4 numbers (e.g. 0,10,20,30), 7-9 have 3
      const pct = totalSpins > 0 ? (count / totalSpins) * 100 : 0;
      return {
        digit,
        count,
        pct: Number(pct.toFixed(1)),
        numbers: Array.from({ length: 37 }, (_, i) => i).filter((n) => n % 10 === digit),
        isHot: count > expectedTerminalHits * 1.2,
      };
    }).sort((a, b) => b.count - a.count);

    // 3. Sector Distribution Analysis (Voisins, Tiers, Orphelins, Zero Game)
    const sectorCounts = { Voisins: 0, Tiers: 0, Orphelins: 0, Zero: 0 };
    events.forEach((ev) => {
      const sec = ev.sector || getNumSector(ev.number);
      sectorCounts[sec] = (sectorCounts[sec] || 0) + 1;
    });

    const sectorStats = [
      { name: 'Voisins du Zéro', count: sectorCounts.Voisins, totalInSector: 17, expectedPct: 45.9 },
      { name: 'Tiers du Cylindre', count: sectorCounts.Tiers, totalInSector: 12, expectedPct: 32.4 },
      { name: 'Orphelins', count: sectorCounts.Orphelins, totalInSector: 8, expectedPct: 21.6 },
      { name: 'Jeu Zéro', count: sectorCounts.Zero, totalInSector: 7, expectedPct: 18.9 },
    ].map((s) => ({
      ...s,
      pct: totalSpins > 0 ? Number(((s.count / totalSpins) * 100).toFixed(1)) : 0,
    }));

    // 4. Numerical Sequence Patterns
    // a) Direct Number Repeats (e.g., 17 -> 17)
    const directRepeats: { number: number; index: number; timestamp: string }[] = [];
    // b) Wheel Neighbor Repeats (within distance <= 2 on European wheel)
    let neighborRepeatsCount = 0;
    // c) Dozen & Column Streaks
    let currentDozenStreak = { dozen: 0, count: 0 };
    let maxDozenStreak = { dozen: 0, count: 0 };
    let currentColumnStreak = { column: 0, count: 0 };
    let maxColumnStreak = { column: 0, count: 0 };
    let currentColorStreak = { color: 'None', count: 0 };
    let maxColorStreak = { color: 'None', count: 0 };
    let currentParityStreak = { parity: 'None', count: 0 };
    let maxParityStreak = { parity: 'None', count: 0 };

    // Pair Transitions (Markov Matrix): After number X, what numbers follow?
    const transitionsMatrix: Record<number, Record<number, number>> = {};
    for (let i = 0; i <= 36; i++) {
      transitionsMatrix[i] = {};
    }

    // Traverse events (chronological order is reverse of array since events[0] is newest)
    const chronoEvents = [...events].reverse();

    chronoEvents.forEach((ev, idx) => {
      if (idx > 0) {
        const prev = chronoEvents[idx - 1];
        const curr = ev;

        // Transitions
        transitionsMatrix[prev.number][curr.number] = (transitionsMatrix[prev.number][curr.number] || 0) + 1;

        // Direct repeat
        if (curr.number === prev.number) {
          directRepeats.push({
            number: curr.number,
            index: idx,
            timestamp: curr.timestamp,
          });
        }

        // Neighbor repeat (wheel distance <= 2)
        if (getWheelDistance(curr.number, prev.number) <= 2) {
          neighborRepeatsCount++;
        }
      }

      // Streaks calculation
      // Dozen
      if (ev.dozen !== 0) {
        if (ev.dozen === currentDozenStreak.dozen) {
          currentDozenStreak.count++;
        } else {
          currentDozenStreak = { dozen: ev.dozen, count: 1 };
        }
        if (currentDozenStreak.count > maxDozenStreak.count) {
          maxDozenStreak = { ...currentDozenStreak };
        }
      }

      // Column
      if (ev.column !== 0) {
        if (ev.column === currentColumnStreak.column) {
          currentColumnStreak.count++;
        } else {
          currentColumnStreak = { column: ev.column, count: 1 };
        }
        if (currentColumnStreak.count > maxColumnStreak.count) {
          maxColumnStreak = { ...currentColumnStreak };
        }
      }

      // Color
      if (ev.color !== 'Green') {
        if (ev.color === currentColorStreak.color) {
          currentColorStreak.count++;
        } else {
          currentColorStreak = { color: ev.color, count: 1 };
        }
        if (currentColorStreak.count > maxColorStreak.count) {
          maxColorStreak = { ...currentColorStreak };
        }
      }

      // Parity
      if (ev.type !== 'Zero') {
        if (ev.type === currentParityStreak.parity) {
          currentParityStreak.count++;
        } else {
          currentParityStreak = { parity: ev.type, count: 1 };
        }
        if (currentParityStreak.count > maxParityStreak.count) {
          maxParityStreak = { ...currentParityStreak };
        }
      }
    });

    // 5. Transition analysis for selectedTargetNum
    const targetTransitionsRaw = transitionsMatrix[selectedTargetNum] || {};
    const totalTargetOccurrences = Object.values(targetTransitionsRaw).reduce((a, b) => a + b, 0);

    const targetTransitions = Object.entries(targetTransitionsRaw)
      .map(([nextNumStr, count]) => {
        const nextNum = Number(nextNumStr);
        return {
          number: nextNum,
          color: getNumColor(nextNum),
          count,
          pct: totalTargetOccurrences > 0 ? Number(((count / totalTargetOccurrences) * 100).toFixed(1)) : 0,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // 6. Zero Analysis
    const zeroSpinsList: number[] = [];
    let spinsSinceZero = -1;
    events.forEach((ev, idx) => {
      if (ev.number === 0) {
        if (spinsSinceZero === -1) spinsSinceZero = idx;
        zeroSpinsList.push(idx);
      }
    });
    if (spinsSinceZero === -1) spinsSinceZero = totalSpins;

    return {
      totalSpins,
      numberStatsList,
      hotNumbers,
      coldNumbers,
      terminalStats,
      sectorStats,
      directRepeats,
      neighborRepeatsCount,
      neighborRepeatPct: totalSpins > 1 ? Number(((neighborRepeatsCount / (totalSpins - 1)) * 100).toFixed(1)) : 0,
      maxDozenStreak,
      maxColumnStreak,
      maxColorStreak,
      maxParityStreak,
      targetTransitions,
      totalTargetOccurrences,
      spinsSinceZero,
    };
  }, [events, selectedTargetNum]);

  // Sorting number grid
  const sortedGridNumbers = useMemo(() => {
    const list = [...analytics.numberStatsList];
    if (gridSortBy === 'freq') {
      return list.sort((a, b) => b.count - a.count);
    }
    if (gridSortBy === 'cold') {
      return list.sort((a, b) => b.currentDelay - a.currentDelay);
    }
    if (gridSortBy === 'wheel') {
      return WHEEL_ORDER.map((num) => list.find((item) => item.number === num)!);
    }
    return list.sort((a, b) => a.number - b.number);
  }, [analytics.numberStatsList, gridSortBy]);

  return (
    <div className="space-y-6">
      {/* Module Title Header & Game Selection Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-cyan-500 p-[2px] shadow-lg shadow-amber-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <BarChart2 className="w-6 h-6 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Módulo de Padrões Numéricos
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/80 text-[10px] font-extrabold uppercase tracking-wider">
                  Roleta IA
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Contagem de frequência (0 a 36), ranking Quente/Frio, agrupamentos de roda e transições de sequências.
              </p>
            </div>
          </div>

          {/* Controls: Game Switcher & Lookback Limit */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Sub-game Toggle */}
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center space-x-1">
              <button
                onClick={() => {
                  setSelectedGame('autoroulette');
                  if (onSelectGame) onSelectGame('autoroulette');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  selectedGame === 'autoroulette'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span>🎡 Auto Roleta</span>
              </button>
              <button
                onClick={() => {
                  setSelectedGame('immersiveroulette');
                  if (onSelectGame) onSelectGame('immersiveroulette');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  selectedGame === 'immersiveroulette'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span>💎 Roleta Imersiva</span>
              </button>
            </div>

            {/* Date Filter */}
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center space-x-1">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'today', label: 'Hoje' },
                { id: 'yesterday', label: 'Ontem' },
                { id: '3days', label: '3 Dias' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setSelectedDateFilter(btn.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedDateFilter === btn.id
                      ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Lookback window dropdown */}
            <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center space-x-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-400 font-medium">Janela:</span>
              <select
                value={lookbackLimit}
                onChange={(e) => setLookbackLimit(Number(e.target.value))}
                className="bg-slate-900 text-white text-xs font-bold rounded-lg border border-slate-700 px-2 py-1 outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value={0}>Todas as Rodadas ({eventsRaw.length})</option>
                <option value={50}>Últimas 50 Rodadas</option>
                <option value={100}>Últimas 100 Rodadas</option>
                <option value={200}>Últimas 200 Rodadas</option>
                <option value={500}>Últimas 500 Rodadas</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quick KPI Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-5 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Activity className="w-3 h-3 text-cyan-400" /> Total Analisado
            </div>
            <div className="text-lg font-black text-white mt-1 font-mono">
              {analytics.totalSpins} <span className="text-xs text-slate-500 font-normal">giros</span>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Flame className="w-3 h-3 text-rose-500" /> Mais Quente (Hot)
            </div>
            <div className="text-lg font-black text-rose-400 mt-1 font-mono flex items-center gap-2">
              {analytics.hotNumbers[0] ? (
                <>
                  <span
                    className={`inline-block w-6 h-6 rounded-full text-center leading-6 text-xs font-bold ${
                      analytics.hotNumbers[0].color === 'Red'
                        ? 'bg-rose-600 text-white'
                        : analytics.hotNumbers[0].color === 'Black'
                        ? 'bg-slate-800 text-white border border-slate-600'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {analytics.hotNumbers[0].number}
                  </span>
                  <span>{analytics.hotNumbers[0].count}x</span>
                  <span className="text-[10px] text-slate-400 font-normal">({analytics.hotNumbers[0].pct}%)</span>
                </>
              ) : (
                '--'
              )}
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Snowflake className="w-3 h-3 text-cyan-400" /> Mais Frio / Atrasado
            </div>
            <div className="text-lg font-black text-cyan-400 mt-1 font-mono flex items-center gap-2">
              {analytics.coldNumbers[0] ? (
                <>
                  <span
                    className={`inline-block w-6 h-6 rounded-full text-center leading-6 text-xs font-bold ${
                      analytics.coldNumbers[0].color === 'Red'
                        ? 'bg-rose-600 text-white'
                        : analytics.coldNumbers[0].color === 'Black'
                        ? 'bg-slate-800 text-white border border-slate-600'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {analytics.coldNumbers[0].number}
                  </span>
                  <span>{analytics.coldNumbers[0].currentDelay}s</span>
                  <span className="text-[10px] text-slate-400 font-normal">sem sair</span>
                </>
              ) : (
                '--'
              )}
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Repeat className="w-3 h-3 text-amber-400" /> Repetições Diretas
            </div>
            <div className="text-lg font-black text-amber-400 mt-1 font-mono">
              {analytics.directRepeats.length} <span className="text-xs text-slate-500 font-normal">vezes</span>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Compass className="w-3 h-3 text-emerald-400" /> Atraso do Zero (0)
            </div>
            <div className="text-lg font-black text-emerald-400 mt-1 font-mono">
              {analytics.spinsSinceZero} <span className="text-xs text-slate-500 font-normal">rodadas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs Bar */}
      <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto space-x-1 no-scrollbar">
        <button
          onClick={() => setActiveTab('indomavel')}
          className={`flex-1 min-w-[150px] px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center space-x-2 whitespace-nowrap ${
            activeTab === 'indomavel'
              ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-cyan-500 text-slate-950 shadow-lg shadow-rose-500/20 font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span>Estratégias "O Indomável"</span>
          <span className="px-1.5 py-0.2 bg-slate-950 text-emerald-400 rounded-md text-[9px] font-black border border-emerald-500/40">
            PRO
          </span>
        </button>

        <button
          onClick={() => setActiveTab('heatmap')}
          className={`flex-1 min-w-[140px] px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center space-x-2 whitespace-nowrap ${
            activeTab === 'heatmap'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>Frequência 0-36</span>
        </button>

        <button
          onClick={() => setActiveTab('hotcold')}
          className={`flex-1 min-w-[140px] px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center space-x-2 whitespace-nowrap ${
            activeTab === 'hotcold'
              ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Quentes & Frios</span>
        </button>

        <button
          onClick={() => setActiveTab('sequences')}
          className={`flex-1 min-w-[140px] px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center space-x-2 whitespace-nowrap ${
            activeTab === 'sequences'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Repeat className="w-4 h-4" />
          <span>Sequências & Vizinhos</span>
        </button>

        <button
          onClick={() => setActiveTab('transitions')}
          className={`flex-1 min-w-[140px] px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center space-x-2 whitespace-nowrap ${
            activeTab === 'transitions'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Transições por Número</span>
        </button>
      </div>

      {/* TAB 0: Estratégias "O INDOMÁVEL" e Detector de Gatilhos ao Vivo */}
      {activeTab === 'indomavel' && (
        <div className="space-y-6">
          {/* Live Signals Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
                  <h3 className="text-lg font-black text-white">Gatilhos e Sinais ao Vivo (O Indomável)</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Análise em tempo real baseada nos últimos giros coletados da mesa.
                </p>
              </div>

              {events[0] && (
                <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 font-bold">Último Sorteio:</span>
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white ${
                      getNumColor(events[0].number) === 'Red'
                        ? 'bg-rose-600'
                        : getNumColor(events[0].number) === 'Black'
                        ? 'bg-slate-800 border border-slate-600'
                        : 'bg-emerald-600'
                    }`}
                  >
                    {events[0].number}
                  </span>
                </div>
              )}
            </div>

            {indomavelSignals.length === 0 ? (
              <div className="bg-slate-950 p-6 rounded-xl border border-slate-800/80 text-center space-y-2">
                <Sparkles className="w-8 h-8 text-slate-600 mx-auto animate-pulse" />
                <div className="text-sm font-bold text-slate-300">
                  Aguardando formação de gatilho indomável...
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Os gatilhos ativos são calculados instantaneamente assim que saírem números com repetição de terminal, vizinhos do zero, espelhos ou números puxadores.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {indomavelSignals.map((sig) => (
                  <div
                    key={sig.id}
                    className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 relative overflow-hidden group hover:border-amber-500/40 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${sig.badgeColor}`}>
                        {sig.category}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                        <Activity className="w-3 h-3" /> GATILHO ATIVO
                      </span>
                    </div>

                    <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-cyan-400 shrink-0" />
                      {sig.title}
                    </h4>

                    <div className="text-xs space-y-1.5 bg-slate-900/90 p-3 rounded-lg border border-slate-800 font-mono">
                      <div className="text-slate-300">
                        <strong className="text-amber-400">Gatilho:</strong> {sig.trigger}
                      </div>
                      <div className="text-cyan-300 font-bold">
                        <strong className="text-cyan-400">Entrada:</strong> {sig.target}
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        <strong className="text-rose-400">Proteção:</strong> {sig.protection}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Catalog of Core Rules "O Indomável" */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
            <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
              <BookOpen className="w-6 h-6 text-cyan-400" />
              <div>
                <h3 className="text-lg font-black text-white">Manual Completo & Regras "O Indomável"</h3>
                <p className="text-xs text-slate-400">
                  Síntese organizada de todas as estratégias, somas, subtrações, duplos e puxadores da roleta.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Rule 1 */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center space-x-2 text-cyan-400">
                  <Repeat className="w-5 h-5 shrink-0" />
                  <h4 className="text-sm font-black text-white">1. Duplos em Repetição (Terminal Repetido)</h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Padrão:</strong> Quando vem uma repetição de terminal (ex: veio 36, 34, 16 &rarr; repetiu terminal 6), há alta probabilidade de repetir o terminal correspondente (ex: projetar para terminais 4).
                </p>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-[11px] space-y-1 font-mono text-slate-300">
                  <div><strong className="text-amber-400">Obs:</strong> Sempre jogar a favor da roleta.</div>
                  <div><strong className="text-rose-400">Proteções:</strong> Cobrir todos os Terminais "0" + repetição do último (#28) + soma/subtração dos passados (8-5=3 &rarr; terminal 3).</div>
                </div>
              </div>

              {/* Rule 2 */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center space-x-2 text-emerald-400">
                  <TrendingUp className="w-5 h-5 shrink-0" />
                  <h4 className="text-sm font-black text-white">2. Somas e Subtrações Passadas</h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Pega os últimos dígitos sorteados e faz a operação:
                  <br />
                  • <strong>Soma:</strong> (ex: 12 e 29 &rarr; 9+2=11 &rarr; jogada nos Terminais 1, ex: 31).
                  <br />
                  • <strong>Subtração:</strong> (ex: 12 e 29 &rarr; 9-2=7 &rarr; jogada nos Terminais 7).
                </p>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-[11px] space-y-1 font-mono text-slate-300">
                  <div><strong className="text-cyan-400">Ex2:</strong> (17, 23) &rarr; Soma: 7+3=10 (Terminal 0) | Subtr: 7-3=4 (Terminal 4).</div>
                  <div><strong className="text-rose-400">Proteção:</strong> 1 casa vizinha de cada lado + cobrir Terminais "0".</div>
                </div>
              </div>

              {/* Rule 3 */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center space-x-2 text-amber-400">
                  <Compass className="w-5 h-5 shrink-0" />
                  <h4 className="text-sm font-black text-white">3. Vizinhos de "0" / Troca de Croupier</h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Estratégia Forte:</strong> Na troca de croupier ou ao sair um vizinho direto de "0" (ex: 1, 5, 8, 11, 14, 23, 26, 32), o gatilho ativa a entrada em todos os Terminais ZERO.
                </p>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-[11px] space-y-1 font-mono text-slate-300">
                  <div><strong className="text-emerald-400">Alvo:</strong> Todos os Terminais "0" (0, 10, 20, 30).</div>
                  <div><strong className="text-rose-400">Gatilho:</strong> Saiu vizinho de 0 (ex: 26) &rarr; Entrada imediata nos zeros!</div>
                </div>
              </div>

              {/* Rule 4 */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center space-x-2 text-purple-400">
                  <Layers className="w-5 h-5 shrink-0" />
                  <h4 className="text-sm font-black text-white">4. Números Espelhados</h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  A roleta trabalha fortemente com espelhos:
                  <br />
                  • <strong>Pares Espelhados:</strong> (21 ↔ 12), (23 ↔ 32), (31 ↔ 13), (26 ↔ 29).
                </p>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-[11px] space-y-1 font-mono text-slate-300">
                  <div><strong className="text-amber-400">Ação:</strong> Ao sair um dos espelhos, proteja e aposte no seu par espelhado correspondente com vizinhos.</div>
                </div>
              </div>

              {/* Rule 5 */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center space-x-2 text-rose-400">
                  <Activity className="w-5 h-5 shrink-0" />
                  <h4 className="text-sm font-black text-white">5. Regras de Sequências</h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  • <strong>Sequência Decrescente</strong> (ex: 20, 19) &rarr; Jogue o 18 com 1 vizinho.
                  <br />
                  • <strong>Sequência Crescente</strong> (ex: 1, 2) &rarr; Jogue o 3 com 1 vizinho.
                  <br />
                  • <strong>Puxadores</strong> (ex: 34, 35) &rarr; Jogue o 36 (que o 35 mais chama) com 1 vizinho.
                </p>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-[11px] space-y-1 font-mono text-slate-300">
                  <div><strong className="text-cyan-400">Validade:</strong> Qualquer sequência exata de números.</div>
                </div>
              </div>

              {/* Rule 6 */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 md:col-span-2 lg:col-span-1">
                <div className="flex items-center space-x-2 text-teal-400">
                  <Zap className="w-5 h-5 shrink-0" />
                  <h4 className="text-sm font-black text-white">6. Tabela de Puxadores Famosos</h4>
                </div>
                <div className="text-[11px] space-y-1.5 font-mono text-slate-300 max-h-52 overflow-y-auto pr-1">
                  <div><strong className="text-cyan-400">Nº 13:</strong> Chama 31 com 2 vizinhos. (ex: 1,33,13 &rarr; joga 31).</div>
                  <div><strong className="text-cyan-400">Nº 26:</strong> Jogue 22 e 25 (2 vizinhos) + 5 (1 vizinho) + verde. (gatilho term. 9 &rarr; 29).</div>
                  <div><strong className="text-cyan-400">Terminal 3:</strong> Jogue Terminal 3 (1 vizinho). Se fraco &rarr; Zero Verde + 29 (2 viz) + 24 e 16.</div>
                  <div><strong className="text-cyan-400">Nº 28:</strong> Chama Terminal 1 (1 vizinho). (gatilho term 9 &rarr; 29 + Term. 1 seco).</div>
                  <div><strong className="text-cyan-400">Nº 24:</strong> Jogue 2, 26 e 24 (2 vizinhos).</div>
                  <div><strong className="text-cyan-400">Nº 29:</strong> Chama ele mesmo (2 viz) + 4 + 23 (2 viz) OU Term. 1 seco + 7 + 10.</div>
                  <div><strong className="text-cyan-400">Nº 23:</strong> Chama 4, 7, 20 (1 viz). (2,23 &rarr; 4 | 27,3,23 &rarr; 7 | 0,13,23 &rarr; 20).</div>
                  <div><strong className="text-cyan-400">Nº 34:</strong> Se deu p/ terminal 3 &rarr; Joga terminal 3 (1 viz) ou 33 (2 viz).</div>
                  <div><strong className="text-cyan-400">Nº 31:</strong> Chama 35 e 13 (2 vizinhos).</div>
                  <div><strong className="text-cyan-400">Nº 35:</strong> Chama 31 e 36 (2 vizinhos).</div>
                  <div><strong className="text-cyan-400">Nº 36:</strong> Chama 21 (2 viz) + secos: 30, 11, 36, 27, 8.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: Contagem de Frequência de Cada Número (0 a 36) */}
      {activeTab === 'heatmap' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Grid className="w-5 h-5 text-amber-400" />
                  Matriz de Frequência Numérica (0 a 36)
                </h3>
                <p className="text-xs text-slate-400">
                  Comparação da saída real de cada número contra o valor teórico médio (1/37 = 2,7%).
                </p>
              </div>

              {/* Sorting Filter */}
              <div className="flex items-center space-x-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 px-2 font-medium">Ordenar:</span>
                <button
                  onClick={() => setGridSortBy('number')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    gridSortBy === 'number'
                      ? 'bg-slate-800 text-amber-400 border border-slate-700'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  0-36
                </button>
                <button
                  onClick={() => setGridSortBy('freq')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    gridSortBy === 'freq'
                      ? 'bg-slate-800 text-rose-400 border border-slate-700'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Mais Sorteados
                </button>
                <button
                  onClick={() => setGridSortBy('cold')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    gridSortBy === 'cold'
                      ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Mais Atrasados
                </button>
                <button
                  onClick={() => setGridSortBy('wheel')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    gridSortBy === 'wheel'
                      ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Roda Europeia
                </button>
              </div>
            </div>

            {/* Grid of 37 Numbers */}
            <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-6 md:grid-cols-9 lg:grid-cols-12 gap-2.5">
              {sortedGridNumbers.map((item) => {
                const maxCount = Math.max(...analytics.numberStatsList.map((x) => x.count), 1);
                const intensityPct = (item.count / maxCount) * 100;

                return (
                  <div
                    key={item.number}
                    className={`relative p-2.5 rounded-xl border transition-all flex flex-col items-center justify-between text-center group cursor-pointer ${
                      item.isHot
                        ? 'bg-rose-950/40 border-rose-500/80 shadow-md shadow-rose-950/50 hover:border-rose-400'
                        : item.isCold
                        ? 'bg-cyan-950/30 border-cyan-800/60 shadow-md shadow-cyan-950/30 hover:border-cyan-400'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Badge header: Hot / Cold icon */}
                    <div className="w-full flex items-center justify-between text-[9px] font-bold">
                      <span className="text-slate-500">#{item.number}</span>
                      {item.isHot && <Flame className="w-3 h-3 text-rose-500 animate-pulse" />}
                      {item.isCold && <Snowflake className="w-3 h-3 text-cyan-400" />}
                    </div>

                    {/* Number Chip */}
                    <div
                      className={`w-9 h-9 rounded-full my-1.5 flex items-center justify-center font-black text-sm text-white shadow-md transition-transform group-hover:scale-110 ${
                        item.color === 'Red'
                          ? 'bg-rose-600 shadow-rose-900/50'
                          : item.color === 'Black'
                          ? 'bg-slate-900 border border-slate-700'
                          : 'bg-emerald-600 shadow-emerald-900/50'
                      }`}
                    >
                      {item.number}
                    </div>

                    {/* Hits count & Pct */}
                    <div className="text-xs font-black text-white font-mono">{item.count}x</div>
                    <div className="text-[10px] text-slate-400 font-mono">{item.pct}%</div>

                    {/* Delay indicator */}
                    <div className="mt-1 text-[9px] text-slate-500 font-mono">
                      {item.currentDelay === 0 ? (
                        <span className="text-emerald-400 font-bold">AGORA</span>
                      ) : (
                        <span>há {item.currentDelay}s</span>
                      )}
                    </div>

                    {/* Mini Intensity Bar at bottom */}
                    <div className="w-full h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          item.isHot ? 'bg-rose-500' : item.isCold ? 'bg-cyan-400' : 'bg-slate-600'
                        }`}
                        style={{ width: `${Math.max(intensityPct, 5)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Terminal / Final Digits Analysis */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
              <Layers className="w-5 h-5 text-cyan-400" />
              Análise de Terminais (Finais 0 a 9)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Identificação de dezenas e agrupamentos numéricos por último dígito.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {analytics.terminalStats.map((term) => (
                <div
                  key={term.digit}
                  className={`p-3 rounded-xl border ${
                    term.isHot
                      ? 'bg-amber-950/30 border-amber-600/70'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1">
                    <span>Final <strong className="text-white font-mono text-sm">*{term.digit}</strong></span>
                    <span className="text-emerald-400 font-mono">{term.pct}%</span>
                  </div>
                  <div className="text-base font-black text-white font-mono mb-1.5">
                    {term.count} <span className="text-xs text-slate-500 font-normal">saídas</span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {term.numbers.map((n) => (
                      <span
                        key={n}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          getNumColor(n) === 'Red'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                            : getNumColor(n) === 'Black'
                            ? 'bg-slate-900 text-slate-300 border border-slate-700'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                        }`}
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Números Quentes (Hot) e Frios (Cold) */}
      {activeTab === 'hotcold' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* HOT NUMBERS CARD */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-rose-950 border border-rose-700/80 flex items-center justify-center">
                  <Flame className="w-4 h-4 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Números Quentes (Hot Numbers)</h3>
                  <p className="text-[11px] text-slate-400">Números com maior frequência e ritmo no período</p>
                </div>
              </div>
              <span className="text-xs font-extrabold text-rose-400 bg-rose-950/80 px-2.5 py-1 rounded-lg border border-rose-800">
                TOP 6
              </span>
            </div>

            <div className="space-y-3">
              {analytics.hotNumbers.map((item, index) => (
                <div
                  key={item.number}
                  className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-black text-slate-500 font-mono w-4">#{index + 1}</span>
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white shadow-md ${
                        item.color === 'Red'
                          ? 'bg-rose-600'
                          : item.color === 'Black'
                          ? 'bg-slate-900 border border-slate-700'
                          : 'bg-emerald-600'
                      }`}
                    >
                      {item.number}
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-white flex items-center gap-2">
                        <span>Número {item.number}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({item.sector})</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Desvio: <span className="text-emerald-400 font-bold">+{item.deviation}%</span> acima da média
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-black text-rose-400 font-mono">{item.count}x</div>
                    <div className="text-[10px] text-slate-400 font-mono">{item.pct}% das rodadas</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* COLD NUMBERS CARD */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-700/80 flex items-center justify-center">
                  <Snowflake className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Números Frios / Atrasados (Cold Numbers)</h3>
                  <p className="text-[11px] text-slate-400">Números com maior intervalo sem sair</p>
                </div>
              </div>
              <span className="text-xs font-extrabold text-cyan-400 bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-800">
                TOP 6
              </span>
            </div>

            <div className="space-y-3">
              {analytics.coldNumbers.map((item, index) => (
                <div
                  key={item.number}
                  className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-black text-slate-500 font-mono w-4">#{index + 1}</span>
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white shadow-md ${
                        item.color === 'Red'
                          ? 'bg-rose-600'
                          : item.color === 'Black'
                          ? 'bg-slate-900 border border-slate-700'
                          : 'bg-emerald-600'
                      }`}
                    >
                      {item.number}
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-white flex items-center gap-2">
                        <span>Número {item.number}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({item.sector})</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Atraso atual: <strong className="text-amber-400 font-bold">{item.currentDelay} rodadas</strong>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-black text-cyan-400 font-mono">{item.count}x</div>
                    <div className="text-[10px] text-slate-400 font-mono">Máx atraso: {item.maxDelay}s</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTOR CLUSTERING OF HOT/COLD NUMBERS */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <Compass className="w-5 h-5 text-emerald-400" />
              Concentração por Setores da Roda Europeia
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Distribuição de rodadas entre os principais setores do cilindro.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {analytics.sectorStats.map((sec) => (
                <div key={sec.name} className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="text-xs font-extrabold text-slate-300 mb-1">{sec.name}</div>
                  <div className="text-xl font-black text-white font-mono mb-1">
                    {sec.pct}% <span className="text-xs text-slate-500 font-normal">({sec.count} giros)</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Teórico: {sec.expectedPct}% | {sec.totalInSector} números
                  </div>

                  <div className="w-full h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min((sec.pct / sec.expectedPct) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Sequências & Vizinhos de Roda */}
      {activeTab === 'sequences' && (
        <div className="space-y-6">
          {/* Wheel Neighbor Repeats & Streaks */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
              <div className="text-xs uppercase font-bold text-slate-400 flex items-center gap-1.5 mb-2">
                <Repeat className="w-4 h-4 text-amber-400" /> Repetição de Número Direto
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono">
                {analytics.directRepeats.length} <span className="text-xs text-slate-400 font-normal">ocorrências</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Quando o mesmo número é sorteado duas rodadas seguidas (ex: 17 → 17).
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
              <div className="text-xs uppercase font-bold text-slate-400 flex items-center gap-1.5 mb-2">
                <Compass className="w-4 h-4 text-cyan-400" /> Repetição de Vizinhos de Roda
              </div>
              <div className="text-2xl font-black text-cyan-400 font-mono">
                {analytics.neighborRepeatPct}% <span className="text-xs text-slate-400 font-normal">({analytics.neighborRepeatsCount}x)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Rodadas consecutivas que caíram no mesmo setor de vizinhos (até 2 casas na roda).
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
              <div className="text-xs uppercase font-bold text-slate-400 flex items-center gap-1.5 mb-2">
                <Clock className="w-4 h-4 text-emerald-400" /> Atraso Atual do Zero (0)
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {analytics.spinsSinceZero} <span className="text-xs text-slate-400 font-normal">rodadas</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Média teórica de saída do Zero a cada 37 rodadas.
              </p>
            </div>
          </div>

          {/* Longest Streaks Summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              Sequências Mais Longas Registradas (Streaks)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div className="text-[10px] uppercase font-bold text-slate-400">Máx Sequência de Cor</div>
                <div className="text-lg font-black text-rose-400 font-mono mt-1">
                  {analytics.maxColorStreak.count}x{' '}
                  <span className="text-xs text-slate-300 font-normal">
                    ({analytics.maxColorStreak.color === 'Red' ? 'Vermelho' : 'Preto'})
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div className="text-[10px] uppercase font-bold text-slate-400">Máx Sequência Par/Ímpar</div>
                <div className="text-lg font-black text-cyan-400 font-mono mt-1">
                  {analytics.maxParityStreak.count}x{' '}
                  <span className="text-xs text-slate-300 font-normal">
                    ({analytics.maxParityStreak.parity === 'Even' ? 'Par' : 'Ímpar'})
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div className="text-[10px] uppercase font-bold text-slate-400">Máx Sequência de Dúzia</div>
                <div className="text-lg font-black text-amber-400 font-mono mt-1">
                  {analytics.maxDozenStreak.count}x{' '}
                  <span className="text-xs text-slate-300 font-normal">
                    ({analytics.maxDozenStreak.dozen}ª Dúzia)
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div className="text-[10px] uppercase font-bold text-slate-400">Máx Sequência de Coluna</div>
                <div className="text-lg font-black text-emerald-400 font-mono mt-1">
                  {analytics.maxColumnStreak.count}x{' '}
                  <span className="text-xs text-slate-300 font-normal">
                    ({analytics.maxColumnStreak.column}ª Coluna)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Transições Frequentes por Número */}
      {activeTab === 'transitions' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Análise de Transições (O que vem depois do número?)
              </h3>
              <p className="text-xs text-slate-400">
                Selecione qualquer número de 0 a 36 para ver quais números costumam sair na rodada seguinte.
              </p>
            </div>

            {/* Target Selector */}
            <div className="flex items-center space-x-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-bold">Número Alvo:</span>
              <select
                value={selectedTargetNum}
                onChange={(e) => setSelectedTargetNum(Number(e.target.value))}
                className="bg-slate-900 text-amber-400 font-black text-sm rounded-lg border border-slate-700 px-3 py-1 outline-none"
              >
                {Array.from({ length: 37 }, (_, i) => (
                  <option key={i} value={i}>
                    #{i} ({getNumColor(i)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results for selected Target Number */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-base text-white shadow-lg ${
                    getNumColor(selectedTargetNum) === 'Red'
                      ? 'bg-rose-600'
                      : getNumColor(selectedTargetNum) === 'Black'
                      ? 'bg-slate-900 border border-slate-700'
                      : 'bg-emerald-600'
                  }`}
                >
                  {selectedTargetNum}
                </div>
                <div>
                  <div className="text-sm font-extrabold text-white">
                    Após o sorteio do Número {selectedTargetNum}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Registrado {analytics.totalTargetOccurrences} vezes na base de dados
                  </div>
                </div>
              </div>

              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800">
                Top 6 Seguintes Frequentes
              </span>
            </div>

            {analytics.targetTransitions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 font-mono">
                Poucos dados registrados para o número #{selectedTargetNum} na janela selecionada.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {analytics.targetTransitions.map((item, idx) => (
                  <div
                    key={item.number}
                    className="bg-slate-900 p-3 rounded-xl border border-slate-800/90 flex flex-col items-center text-center"
                  >
                    <span className="text-[10px] font-bold text-slate-500 mb-1">#{idx + 1} Provável</span>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white my-1 ${
                        item.color === 'Red'
                          ? 'bg-rose-600'
                          : item.color === 'Black'
                          ? 'bg-slate-800 border border-slate-600'
                          : 'bg-emerald-600'
                      }`}
                    >
                      {item.number}
                    </div>
                    <div className="text-sm font-black text-white font-mono mt-1">{item.count}x</div>
                    <div className="text-[10px] text-emerald-400 font-mono font-bold">{item.pct}% das vezes</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
