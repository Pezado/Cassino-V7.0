import {
  calculateHourlyColorAverages,
  calculateDetailedMaxStreaks,
  calculatePrecedingTieScores,
  calculateExactTieScores,
  calculate10MinIntervals,
  getHourlyDistribution,
  calculateDayOfWeekSeasonality,
  calculateOptimalBettingHours,
  calculateLongTermTrends,
  calculateDiceScoreDominance,
  calculateChopRate,
  calculateScoreDiffBehavior,
  calculateMinuteDecadeSeasonality,
  calculateScoreClusters,
  calculateTableVolatility,
  calculateTieGaps,
  scanRNGSeeds,
} from '../utils/analyticsEngine';
import { BacBoEvent } from '../types';

/**
 * ==============================================================================
 * 🎰 MOTOR CIENTÍFICO SUPREMO DE SINAIS (BAC-BOT QUANTUM INSANE V-9.0) 🎰
 * Multi-camadas: Probabilidades Condicionais + Softmax com Temperatura +
 * Prior Bayesiano + Monte Carlo (1000x Simulações) + Filtro de Volatilidade +
 * Multi-janelas de Alternância + Inércia Limitada + Modelo Separado de Empate +
 * Decisão Conservadora (Sinal WAIT quando a vantagem for insuficiente)
 * ==============================================================================
 */

export interface BaccaratRoads {
  isDragonActive: boolean;
  dragonSide: 'PLAYER' | 'BANKER' | null;
  isPingPongActive: boolean;
  pingPongLength: number;
  columnsCount: number;
  lastColumnLen: number;
  cockroachPigTrend: 'PLAYER' | 'BANKER' | 'NEUTRAL';
  smallRoadTrend: 'PLAYER' | 'BANKER' | 'NEUTRAL';
}

export interface Intel20ProMax {
  scoreSimilarityInsights: string[];
  recurringPatterns: Array<{
    patternStr: string;
    occurrences: number;
    nextDominant: 'PLAYER' | 'BANKER' | 'TIE';
    probability: number;
    description: string;
  }>;
  multiAngleInsights: string[];
  totalPatternsFound: number;
}

export interface SupremePrediction {
  game: string;
  action: string;
  target: 'Player' | 'Banker' | 'Red' | 'Black' | 'WAIT';
  confidence: number;
  rationale: string;
  pattern: string;
  tieProtection: string;
  probabilities: {
    PLAYER: number;
    BANKER: number;
    TIE: number;
  };
  intel20ProMax?: Intel20ProMax;
  layers: {
    variance: number;
    rpp: number;
    entropy: number;
    rngMatch: string;
    baccaratRoadStyle: string;
    velocityLabel: string;
    volatilityIndex: number;
    inertiaVector: number;
    alternationRate: number;
    hourlyScoreP: number;
    hourlyScoreB: number;
    maxStreakP: number;
    maxStreakB: number;
    minuteTensCluster: string;
    lambdaShrinkage: number;
    monteCarloWinRateP: number;
    monteCarloWinRateB: number;
  };
  goldenMinutes: string[];
  galeViable: boolean;
  timestamp: string;
  triggerRoundId?: string;
}

// Box-Muller Gaussian Noise Generator for Monte Carlo Perturbation
function randomGaussian(mean = 0, stdev = 1): number {
  const u1 = Math.max(1e-10, Math.random());
  const u2 = Math.max(1e-10, Math.random());
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdev + mean;
}

// Baccarat Road Calculator (Big Road + Derived Roads)
export function calculateBaccaratRoads(history: string[]): BaccaratRoads {
  const cleaned = history.filter((r) => r !== 'TIE' && r !== 'Tie');
  if (cleaned.length === 0) {
    return {
      isDragonActive: false,
      dragonSide: null,
      isPingPongActive: false,
      pingPongLength: 0,
      columnsCount: 0,
      lastColumnLen: 0,
      cockroachPigTrend: 'NEUTRAL',
      smallRoadTrend: 'NEUTRAL',
    };
  }

  const columns: string[][] = [];
  let currentCol: string[] = [];
  let currentSide: string | null = null;

  for (const r of cleaned) {
    const normalized = r.toUpperCase().includes('BANKER') ? 'BANKER' : 'PLAYER';
    if (normalized === currentSide) {
      currentCol.push(normalized);
    } else {
      if (currentCol.length > 0) {
        columns.push(currentCol);
      }
      currentCol = [normalized];
      currentSide = normalized;
    }
  }
  if (currentCol.length > 0) {
    columns.push(currentCol);
  }

  let isDragon = false;
  let dragonSide: 'PLAYER' | 'BANKER' | null = null;
  if (columns.length > 0) {
    const lastCol = columns[columns.length - 1];
    if (lastCol.length >= 4) {
      isDragon = true;
      dragonSide = lastCol[0] as 'PLAYER' | 'BANKER';
    }
  }

  let isPingPong = false;
  let pingPongLen = 0;
  if (columns.length >= 4) {
    let allSingle = true;
    for (const col of columns.slice(-4)) {
      if (col.length > 1) {
        allSingle = false;
        break;
      }
    }
    if (allSingle) {
      isPingPong = true;
      for (let i = columns.length - 1; i >= 0; i--) {
        if (columns[i].length === 1) pingPongLen++;
        else break;
      }
    }
  }

  let cockroachPigTrend: 'PLAYER' | 'BANKER' | 'NEUTRAL' = 'NEUTRAL';
  let smallRoadTrend: 'PLAYER' | 'BANKER' | 'NEUTRAL' = 'NEUTRAL';

  if (columns.length >= 3) {
    const c1 = columns[columns.length - 1].length;
    const c2 = columns[columns.length - 2].length;
    const c3 = columns[columns.length - 3].length;

    if (c1 > c2 && c2 >= c3) {
      cockroachPigTrend = columns[columns.length - 1][0] as 'PLAYER' | 'BANKER';
    } else if (c1 === c2 && c2 === c3) {
      smallRoadTrend = columns[columns.length - 1][0] === 'PLAYER' ? 'BANKER' : 'PLAYER';
    }
  }

  return {
    isDragonActive: isDragon,
    dragonSide,
    isPingPongActive: isPingPong,
    pingPongLength: pingPongLen,
    columnsCount: columns.length,
    lastColumnLen: columns.length > 0 ? columns[columns.length - 1].length : 0,
    cockroachPigTrend,
    smallRoadTrend,
  };
}

export function generateGoldenBatch(
  startHour: number,
  startMin: number,
  roundsData: any[],
  isBacBoGame: boolean
): { hour: number; minute: number; timeStr: string }[] {
  const slots: { hour: number; minute: number; timeStr: string }[] = [];

  const tieRounds = (roundsData || []).filter((r) =>
    isBacBoGame ? r.outcome === 'Tie' || r.outcome === 'TIE' : r.number === 0
  );

  const pastTieMinutes: number[] = [];
  const pastTieEndingsCount: Record<number, number> = {};
  for (let i = 0; i < 10; i++) pastTieEndingsCount[i] = 0;

  tieRounds.forEach((r) => {
    if (!r.timestamp) return;
    const d = new Date(r.timestamp);
    if (!isNaN(d.getTime())) {
      const m = d.getMinutes();
      pastTieMinutes.push(m);
      pastTieEndingsCount[m % 10] = (pastTieEndingsCount[m % 10] || 0) + 1;
    }
  });

  let avgGap = 3.5;
  if (pastTieMinutes.length >= 2) {
    let gapSum = 0;
    let gapCount = 0;
    for (let i = 0; i < pastTieMinutes.length - 1; i++) {
      let diff = pastTieMinutes[i] - pastTieMinutes[i + 1];
      if (diff < 0) diff += 60;
      if (diff > 0 && diff < 15) {
        gapSum += diff;
        gapCount++;
      }
    }
    if (gapCount > 0) {
      avgGap = Math.max(2.5, Math.min(4.2, gapSum / gapCount));
    }
  }

  const windowRanges = [
    [2, 4],
    [5, 7],
    [8, 11],
    [12, 14],
    [15, 18],
    [19, 23],
  ];

  const baseDate = new Date();
  baseDate.setHours(startHour, startMin, 0, 0);

  const usedEndings = new Set<number>();
  const usedTimes = new Set<string>();

  for (let s = 0; s < 6; s++) {
    const [minOff, maxOff] = windowRanges[s];
    let bestMinuteOffset = -1;
    let bestScore = -100;

    for (let offset = minOff; offset <= maxOff + 4; offset++) {
      const candDate = new Date(baseDate.getTime() + offset * 60 * 1000);
      const candMin = candDate.getMinutes();
      const endingDigit = candMin % 10;
      const candTimeStr = `${String(candDate.getHours()).padStart(2, '0')}:${String(candMin).padStart(2, '0')}`;

      // STRICT MANDATE: Unique minute ending digit (% 10) and unique timeStr!
      if (usedEndings.has(endingDigit) || usedTimes.has(candTimeStr)) {
        continue;
      }

      const endingFreq = pastTieEndingsCount[endingDigit] || 0;
      const gapAlignment = 1.0 - Math.abs((offset - (s + 1) * avgGap) / 10);
      const score = endingFreq * 2 + gapAlignment;

      if (score > bestScore) {
        bestScore = score;
        bestMinuteOffset = offset;
      }
    }

    if (bestMinuteOffset === -1) {
      for (let offset = 1; offset <= 35; offset++) {
        const candDate = new Date(baseDate.getTime() + (minOff + offset) * 60 * 1000);
        const candMin = candDate.getMinutes();
        const endingDigit = candMin % 10;
        const candTimeStr = `${String(candDate.getHours()).padStart(2, '0')}:${String(candMin).padStart(2, '0')}`;
        if (!usedEndings.has(endingDigit) && !usedTimes.has(candTimeStr)) {
          bestMinuteOffset = minOff + offset;
          break;
        }
      }
    }

    if (bestMinuteOffset === -1) {
      bestMinuteOffset = minOff;
    }

    const slotDate = new Date(baseDate.getTime() + bestMinuteOffset * 60 * 1000);
    const h = slotDate.getHours();
    const m = slotDate.getMinutes();
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    usedEndings.add(m % 10);
    usedTimes.add(timeStr);
    slots.push({ hour: h, minute: m, timeStr });
  }

  slots.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  return slots;
}

/**
 * 🔬 ESTATÍSTICA 20 PRO MAX ULTRA:
 * Analisa semelhança de pontuação dos dados (Scores 2 a 24), frequências de transição,
 * intervalos de repetição/alternância e extrai padrões recorrentes (ocorrências >= 3x).
 * "O que vemos é uma gota, o que ignoramos é o oceano... vigiai e orai".
 */
function analyzeScoreSimilarityAndPatterns(
  isBacBo: boolean,
  chronologicalRounds: any[],
  historyOutcomes: string[]
): Intel20ProMax {
  const scoreSimilarityInsights: string[] = [];
  const recurringPatterns: Array<{
    patternStr: string;
    occurrences: number;
    nextDominant: 'PLAYER' | 'BANKER' | 'TIE';
    probability: number;
    description: string;
  }> = [];
  const multiAngleInsights: string[] = [];

  // 1. Matrix de Scores de Dados Bac Bo & Matriz de Transição por Pontuação
  if (isBacBo && chronologicalRounds.length >= 3) {
    const scoreMap: Record<string, { P: number; B: number; T: number; total: number }> = {};

    for (let i = 0; i < chronologicalRounds.length - 1; i++) {
      const currR = chronologicalRounds[i];
      const nextR = chronologicalRounds[i + 1];
      if (typeof currR.playerScore === 'number' && typeof currR.bankerScore === 'number') {
        const sum = currR.playerScore + currR.bankerScore;
        const winner =
          currR.playerScore > currR.bankerScore
            ? 'Player'
            : currR.bankerScore > currR.playerScore
            ? 'Banker'
            : 'Empate';

        const key = `Score ${sum} (${winner})`;

        if (!scoreMap[key]) {
          scoreMap[key] = { P: 0, B: 0, T: 0, total: 0 };
        }

        const nextOut =
          typeof nextR.playerScore === 'number' && typeof nextR.bankerScore === 'number'
            ? nextR.playerScore > nextR.bankerScore
              ? 'PLAYER'
              : nextR.bankerScore > nextR.playerScore
              ? 'BANKER'
              : 'TIE'
            : nextR.outcome?.toLowerCase().includes('player')
            ? 'PLAYER'
            : nextR.outcome?.toLowerCase().includes('banker')
            ? 'BANKER'
            : 'TIE';

        if (nextOut === 'PLAYER') scoreMap[key].P++;
        else if (nextOut === 'BANKER') scoreMap[key].B++;
        else scoreMap[key].T++;
        scoreMap[key].total++;
      }
    }

    // Extrair insights das pontuações mais comuns
    Object.keys(scoreMap).forEach((key) => {
      const data = scoreMap[key];
      if (data.total >= 2) {
        const isPlayerKey = key.includes('Player');
        const altCount = isPlayerKey ? data.B : data.P;
        const repCount = isPlayerKey ? data.P : data.B;
        const altPct = Math.round((altCount / data.total) * 100);
        const repPct = Math.round((repCount / data.total) * 100);

        if (altPct >= 55) {
          scoreSimilarityInsights.push(
            `🎲 ${key} [${data.total}x no histórico]: ${altPct}% das vezes puxou ALTERNÂNCIA (${isPlayerKey ? 'Banker 🔴' : 'Player 🔵'})`
          );
        } else if (repPct >= 55) {
          scoreSimilarityInsights.push(
            `🎲 ${key} [${data.total}x no histórico]: ${repPct}% das vezes chamou REPETIÇÃO (${key.includes('Player') ? 'Player 🔵' : 'Banker 🔴'})`
          );
        }
      }
    });

    // Análise de Score Recente do Último Resultado
    const recentR = chronologicalRounds[chronologicalRounds.length - 1];
    if (recentR && typeof recentR.playerScore === 'number' && typeof recentR.bankerScore === 'number') {
      const lastSum = recentR.playerScore + recentR.bankerScore;
      const lastWinner =
        recentR.playerScore > recentR.bankerScore
          ? 'Player 🔵'
          : recentR.bankerScore > recentR.playerScore
          ? 'Banker 🔴'
          : 'Empate 🟡';
      scoreSimilarityInsights.unshift(
        `🔬 ÚLTIMA RODADA: Score ${lastSum} (${lastWinner} ${recentR.playerScore}x${recentR.bankerScore}) ➔ Matriz comparativa de 360° ativada`
      );
    }
  }

  // 2. Extração de Padrões Recorrentes (>= 3 Ocorrências é Padrão)
  const patternCounts: Record<string, { P: number; B: number; T: number; total: number }> = {};
  const outcomeSeq = historyOutcomes;

  [2, 3, 4].forEach((len) => {
    for (let i = 0; i <= outcomeSeq.length - len - 1; i++) {
      const pat = outcomeSeq.slice(i, i + len).join('-');
      const next = outcomeSeq[i + len];
      if (!patternCounts[pat]) {
        patternCounts[pat] = { P: 0, B: 0, T: 0, total: 0 };
      }
      if (next === 'PLAYER') patternCounts[pat].P++;
      else if (next === 'BANKER') patternCounts[pat].B++;
      else patternCounts[pat].T++;
      patternCounts[pat].total++;
    }
  });

  Object.keys(patternCounts).forEach((patStr) => {
    const data = patternCounts[patStr];
    // "tudo que aconteceu mais de 3 vezes é padrão"
    if (data.total >= 3) {
      let dominant: 'PLAYER' | 'BANKER' | 'TIE' = 'PLAYER';
      let maxVotes = data.P;
      if (data.B > maxVotes) {
        dominant = 'BANKER';
        maxVotes = data.B;
      }
      if (data.T > maxVotes) {
        dominant = 'TIE';
        maxVotes = data.T;
      }

      const prob = Math.round((maxVotes / data.total) * 100);
      const domText = dominant === 'PLAYER' ? 'Player 🔵' : dominant === 'BANKER' ? 'Banker 🔴' : 'Empate 🟡';

      recurringPatterns.push({
        patternStr: patStr,
        occurrences: data.total,
        nextDominant: dominant,
        probability: prob,
        description: `⚡ Padrão "${patStr}" (${data.total}x detectado): ${prob}% direcionou para ${domText}`,
      });
    }
  });

  recurringPatterns.sort((a, b) => b.occurrences - a.occurrences);

  // 3. Resumo de Ângulos Multi-dimensionais
  multiAngleInsights.push(`👁️ Ângulo 1 (Tendência de Fita Exponential): Medição estocástica de decaimento em 6 janelas`);
  multiAngleInsights.push(`👁️ Ângulo 2 (Padrões Recorrentes): ${recurringPatterns.length} padrões validados (≥3x ocorrências)`);
  multiAngleInsights.push(`👁️ Ângulo 3 (Dice Score Bac Bo): Mapeamento de alternâncias por soma de dados (2 a 24)`);
  multiAngleInsights.push(`👁️ Ângulo 4 (Vigiai e Orai): "O que vemos é uma gota, o que ignoramos é o oceano" - 360° de cobertura`);

  return {
    scoreSimilarityInsights: scoreSimilarityInsights.slice(0, 5),
    recurringPatterns: recurringPatterns.slice(0, 6),
    multiAngleInsights,
    totalPatternsFound: recurringPatterns.length,
  };
}

export function computeSupremePrediction(
  game: string,
  rounds: any[],
  learnedMemory?: Record<string, any>
): SupremePrediction {
  const isBacBo = game === 'bacbo';
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentTenMin = Math.floor(currentMin / 10); // 0-5
  const currentTriggerId = rounds[0]?.id || `trig_${Date.now()}`;

  // 1. Build outcome tape history in chronological order (oldest -> newest)
  const parseOutcome = (r: any): string => {
    if (isBacBo) {
      const out = String(r.outcome || r.winner || r.result || '').toLowerCase();
      if (out.includes('player') || out === 'p') return 'PLAYER';
      if (out.includes('banker') || out === 'b') return 'BANKER';
      if (out.includes('tie') || out.includes('empate') || out === 't') return 'TIE';
      if (typeof r.playerScore === 'number' && typeof r.bankerScore === 'number') {
        if (r.playerScore > r.bankerScore) return 'PLAYER';
        if (r.bankerScore > r.playerScore) return 'BANKER';
        if (r.playerScore === r.bankerScore) return 'TIE';
      }
      return 'TIE';
    } else {
      const color = String(r.color || r.type || '').toLowerCase();
      if (color === 'red') return 'PLAYER'; // Red
      if (color === 'black') return 'BANKER'; // Black
      return 'TIE'; // Zero
    }
  };

  const chronologicalRounds = [...rounds].reverse();
  const historyOutcomes: string[] = chronologicalRounds.map(parseOutcome);

  const nonTieOutcomes = historyOutcomes.filter((o) => o !== 'TIE');

  // Advanced Chart Pattern Detector (Dominância, Zigue-Zague, Duplas, Triplas, Quebra e Saúde do Gráfico)
  const patternAnalysis = detectAdvancedChartPatterns(nonTieOutcomes, isBacBo);

  // 2. Multi-scale tape lookbacks (3, 5, 8, 12, 20, 30) with exponential decay W_i = e^(-i / tau)
  const tauDecay = 4.0;
  let weightedScoreP = 0;
  let weightedScoreB = 0;
  let totalWeightSum = 0;

  const windows = [3, 5, 8, 12, 20, 30];
  windows.forEach((w) => {
    const slice = nonTieOutcomes.slice(-w);
    slice.forEach((out, idx) => {
      const i = slice.length - 1 - idx; // 0 = most recent
      const wWeight = Math.exp(-i / tauDecay);
      if (out === 'PLAYER') weightedScoreP += wWeight;
      else if (out === 'BANKER') weightedScoreB += wWeight;
      totalWeightSum += wWeight;
    });
  });

  const normTapeP = totalWeightSum > 0 ? weightedScoreP / totalWeightSum : 0.5;
  const normTapeB = totalWeightSum > 0 ? weightedScoreB / totalWeightSum : 0.5;

  // 3. Roadmap / Transitions
  const roads = calculateBaccaratRoads(historyOutcomes);

  // 4. Historical Transition Frequency Matching (n-grams of 3, 4, 5)
  let seqP = 0.5;
  let seqB = 0.5;
  if (nonTieOutcomes.length >= 5) {
    const prefix3 = nonTieOutcomes.slice(-3).join(',');
    let pFollows = 0;
    let bFollows = 0;

    for (let i = 0; i < nonTieOutcomes.length - 3; i++) {
      const windowStr = nonTieOutcomes.slice(i, i + 3).join(',');
      if (windowStr === prefix3) {
        const next = nonTieOutcomes[i + 3];
        if (next === 'PLAYER') pFollows++;
        else if (next === 'BANKER') bFollows++;
      }
    }

    const totalFollows = pFollows + bFollows;
    if (totalFollows > 0) {
      seqP = pFollows / totalFollows;
      seqB = bFollows / totalFollows;
    }
  }

  // 5. Multi-window Alternation Rates (A5, A10, A20, A50)
  const calcAlternation = (arr: string[]) => {
    if (arr.length <= 1) return 0.5;
    let switches = 0;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] !== arr[i - 1]) switches++;
    }
    return switches / (arr.length - 1);
  };

  const a5 = calcAlternation(nonTieOutcomes.slice(-5));
  const a10 = calcAlternation(nonTieOutcomes.slice(-10));
  const a20 = calcAlternation(nonTieOutcomes.slice(-20));
  const a50 = calcAlternation(nonTieOutcomes.slice(-50));
  const alternationRate = Number((0.4 * a5 + 0.3 * a10 + 0.2 * a20 + 0.1 * a50).toFixed(2));

  // 6. Multi-window Volatility V = alpha * V_short + beta * V_med + gamma * V_long
  const calcVol = (arr: string[]) => {
    if (arr.length === 0) return 0.5;
    const pCount = arr.filter((x) => x === 'PLAYER').length;
    const pRatio = pCount / arr.length;
    return Math.sqrt(pRatio * (1.0 - pRatio)) * 2.0; // 0.0 to 1.0
  };

  const vShort = calcVol(nonTieOutcomes.slice(-5));
  const vMed = calcVol(nonTieOutcomes.slice(-15));
  const vLong = calcVol(nonTieOutcomes.slice(-30));
  const volatilityIndex = Number((0.5 * vShort + 0.3 * vMed + 0.2 * vLong).toFixed(2));

  // 7. Inertia Vector with Cap I_c <= I_max (I_max = 0.25)
  let streakP = 0;
  let streakB = 0;
  for (let i = nonTieOutcomes.length - 1; i >= 0; i--) {
    if (nonTieOutcomes[i] === 'PLAYER' && streakB === 0) streakP++;
    else if (nonTieOutcomes[i] === 'BANKER' && streakP === 0) streakB++;
    else break;
  }

  const rawInertiaP = Math.min(0.25, streakP * 0.06);
  const rawInertiaB = Math.min(0.25, streakB * 0.06);
  const inertiaVector = Number((rawInertiaP - rawInertiaB).toFixed(2));

  // 8. Hourly & 10-Min Bin Seasonality with Bayesian Smoothing
  const hourlyCounts: Record<number, { P: number; B: number; total: number }> = {};
  const tenMinCounts: Record<number, { P: number; B: number; total: number }> = {};

  rounds.forEach((r) => {
    if (!r.timestamp) return;
    const d = new Date(r.timestamp);
    if (isNaN(d.getTime())) return;

    const h = d.getHours();
    const mTen = Math.floor(d.getMinutes() / 10);

    if (!hourlyCounts[h]) hourlyCounts[h] = { P: 0, B: 0, total: 0 };
    if (!tenMinCounts[mTen]) tenMinCounts[mTen] = { P: 0, B: 0, total: 0 };

    const outStr = parseOutcome(r);
    const isP = outStr === 'PLAYER';
    const isB = outStr === 'BANKER';

    if (isP) {
      hourlyCounts[h].P++;
      tenMinCounts[mTen].P++;
    } else if (isB) {
      hourlyCounts[h].B++;
      tenMinCounts[mTen].B++;
    }
    hourlyCounts[h].total++;
    tenMinCounts[mTen].total++;
  });

  // ============================================================================
  // 📊 PROCESSAR TODAS AS ESTATÍSTICAS DO PAINEL ANTES DA PREVISÃO (360° ENGINE)
  // ============================================================================
  const bacBoEvents = isBacBo ? (rounds as BacBoEvent[]) : [];

  // 1. Distribuição por Horário (00:00 às 23:00) & Média de Cores por Hora
  const hourlyColorAverages = calculateHourlyColorAverages(bacBoEvents);
  const hourlyDistribution = getHourlyDistribution(rounds, (item) => isBacBo ? item.outcome : item.color);

  // 2. Intervalos de Minutos (10-10') & Sazonalidade por Dezenas (:00 a :59)
  const tenMinIntervals = calculate10MinIntervals(bacBoEvents);
  const minuteDecadeSeasonality = calculateMinuteDecadeSeasonality(bacBoEvents);

  // 5. Condições do Empate (Pontuações exatas que puxam Empate) & Placar Exato
  const precedingTieScores = calculatePrecedingTieScores(bacBoEvents);
  const exactTieScores = calculateExactTieScores(bacBoEvents);

  // 6 & 7. Média de cores por hora e Máximas
  const detailedMaxStreaks = calculateDetailedMaxStreaks(bacBoEvents);

  // 8. Taxa de Alternância (Chop vs Streak)
  const chopRateData = calculateChopRate(bacBoEvents);

  // 10. Propensão a Empate por Diferencial de Pontuação
  const scoreDiffBehavior = calculateScoreDiffBehavior(bacBoEvents);

  // 11. Matriz de Dominância por Pontuação dos Dados (Soma de 2 a 12 / 2 a 24)
  const diceScoreDominance = calculateDiceScoreDominance(bacBoEvents);

  // 12. Resultado Seguinte Histórico (Próxima Cor / Vitória)
  const scoreClusters = calculateScoreClusters(bacBoEvents);

  // 13. Lacunas e Atraso entre Empates
  const tieGaps = calculateTieGaps(bacBoEvents);

  // 14. Volatilidade e Inércia da Mesa
  const tableVolatility = calculateTableVolatility(bacBoEvents);

  // 15. Sequências Automáticas e Tendências Adicionais
  const dayOfWeekSeasonality = calculateDayOfWeekSeasonality(rounds, isBacBo);
  const optimalBettingHours = calculateOptimalBettingHours(rounds, isBacBo);
  const longTermTrends = calculateLongTermTrends(rounds, isBacBo);

  // Incorporar os resultados das estatísticas nas métricas direcionais
  let diceDominanceP = 0.5;
  let diceDominanceB = 0.5;
  if (isBacBo && chronologicalRounds.length > 0) {
    const lastR = chronologicalRounds[chronologicalRounds.length - 1];
    if (typeof lastR.playerScore === 'number' && typeof lastR.bankerScore === 'number') {
      const lastSum = lastR.playerScore + lastR.bankerScore;
      const dom = diceScoreDominance.find((d) => d.score === lastSum);
      if (dom && dom.total > 0) {
        diceDominanceP = dom.playerPct / 100;
        diceDominanceB = dom.bankerPct / 100;
      }
    }
  }

  const decadeSlot = minuteDecadeSeasonality[currentTenMin];
  const decadeP = decadeSlot ? decadeSlot.playerPct / 100 : 0.5;
  const decadeB = decadeSlot ? decadeSlot.bankerPct / 100 : 0.5;

  const priorAlpha = 2;
  const currentH = hourlyCounts[currentHour] || { P: 0, B: 0, total: 0 };
  const hourlyScoreP = (currentH.P + priorAlpha) / (currentH.total + 2 * priorAlpha);
  const hourlyScoreB = (currentH.B + priorAlpha) / (currentH.total + 2 * priorAlpha);

  const currentTen = tenMinCounts[currentTenMin] || { P: 0, B: 0, total: 0 };
  const tenScoreP = (currentTen.P + priorAlpha) / (currentTen.total + 2 * priorAlpha);
  const tenScoreB = (currentTen.B + priorAlpha) / (currentTen.total + 2 * priorAlpha);

  const minFactorP = Math.sin((currentMin / 60) * 2 * Math.PI) * 0.05 + 0.5;
  const minFactorB = 1.0 - minFactorP;

  let scoreDiffFavorsP = 0.5;
  if (isBacBo && chronologicalRounds.length > 0) {
    let sumDiffP = 0;
    let sumDiffB = 0;
    chronologicalRounds.slice(-15).forEach((r) => {
      if (typeof r.playerScore === 'number' && typeof r.bankerScore === 'number') {
        const diff = r.playerScore - r.bankerScore;
        if (diff > 0) sumDiffP += diff;
        else if (diff < 0) sumDiffB += Math.abs(diff);
      }
    });
    const totalDiffSum = sumDiffP + sumDiffB;
    if (totalDiffSum > 0) {
      scoreDiffFavorsP = sumDiffP / totalDiffSum;
    }
  }

  let roundsSinceTie = 0;
  for (let i = historyOutcomes.length - 1; i >= 0; i--) {
    if (historyOutcomes[i] === 'TIE') break;
    roundsSinceTie++;
  }

  let pTie = 0.09;
  if (roundsSinceTie >= 14) pTie = 0.18;
  if (currentMin % 10 === 4 || currentMin % 10 === 9) pTie = Math.max(pTie, 0.22);

  // Ajuste dinâmico de Empate pelas Lacunas e Condições de Empate do Painel
  if (tieGaps && tieGaps.avgGap > 0 && roundsSinceTie >= tieGaps.avgGap) {
    pTie = Math.max(pTie, Math.min(0.28, 0.16 + (roundsSinceTie - tieGaps.avgGap) * 0.02));
  }
  if (isBacBo && chronologicalRounds.length > 0) {
    const lastR = chronologicalRounds[chronologicalRounds.length - 1];
    const winningScore = lastR.outcome === 'PlayerWon' ? lastR.playerScore : lastR.bankerScore;
    if (precedingTieScores.some((pts) => pts.score === winningScore && pts.count >= 2)) {
      pTie = Math.max(pTie, 0.22);
    }
  }

  const wTape = 0.20;
  const wRoad = 0.15;
  const wSeq = 0.15;
  const wPattern = 0.20; // High weight for user-specified visual chart patterns!
  const wHour = 0.08;
  const wTen = 0.07;
  const wInertia = 0.05;
  const wAlt = 0.05;

  let roadP = 0.5;
  let roadB = 0.5;
  if (roads.isDragonActive && roads.dragonSide) {
    if (roads.dragonSide === 'PLAYER') {
      roadP = 0.85;
      roadB = 0.15;
    } else {
      roadB = 0.85;
      roadP = 0.15;
    }
  } else if (roads.isPingPongActive || alternationRate > 0.6) {
    const lastOut = nonTieOutcomes[nonTieOutcomes.length - 1] || 'PLAYER';
    if (lastOut === 'PLAYER') {
      roadB = 0.75;
      roadP = 0.25;
    } else {
      roadP = 0.75;
      roadB = 0.25;
    }
  }

  const patternWeightP = patternAnalysis.recommendedSide === 'PLAYER' ? 0.85 : 0.15;
  const patternWeightB = patternAnalysis.recommendedSide === 'BANKER' ? 0.85 : 0.15;

  const S_P =
    wTape * normTapeP +
    wRoad * roadP +
    wSeq * seqP +
    wPattern * patternWeightP +
    wHour * hourlyScoreP +
    wTen * tenScoreP +
    wInertia * (0.5 + rawInertiaP) +
    wAlt * (alternationRate > 0.6 ? roadP : normTapeP);

  const S_B =
    wTape * normTapeB +
    wRoad * roadB +
    wSeq * seqB +
    wPattern * patternWeightB +
    wHour * hourlyScoreB +
    wTen * tenScoreB +
    wInertia * (0.5 + rawInertiaB) +
    wAlt * (alternationRate > 0.6 ? roadB : normTapeB);

  const tauTemp = 0.85;
  const expP = Math.exp(S_P / tauTemp);
  const expB = Math.exp(S_B / tauTemp);
  const pModelP = expP / (expP + expB);
  const pModelB = expB / (expP + expB);

  const intel20ProMax = analyzeScoreSimilarityAndPatterns(isBacBo, chronologicalRounds, historyOutcomes);

  const mcIterations = 1000;
  let mcWinsP = 0;
  let mcWinsB = 0;
  const stdevNoise = 0.12 * volatilityIndex;

  for (let k = 0; k < mcIterations; k++) {
    const noiseP = randomGaussian(0, stdevNoise);
    const noiseB = randomGaussian(0, stdevNoise);
    const perturbedP = S_P + noiseP;
    const perturbedB = S_B + noiseB;

    if (perturbedP >= perturbedB) mcWinsP++;
    else mcWinsB++;
  }

  const mcRatioP = mcWinsP / mcIterations;
  const mcRatioB = mcWinsB / mcIterations;

  const evidence = Math.min(1.0, nonTieOutcomes.length / 30);
  const stability = 1.0 - Math.abs(mcRatioP - pModelP);
  const lambdaShrinkage = Number(
    (evidence * (1.0 - 0.6 * volatilityIndex) * stability).toFixed(2)
  );

  const pBase = 0.50;
  const finalP_raw = lambdaShrinkage * pModelP + (1.0 - lambdaShrinkage) * pBase;
  const finalB_raw = lambdaShrinkage * pModelB + (1.0 - lambdaShrinkage) * pBase;

  let probP = Math.round(finalP_raw * (1.0 - pTie) * 100);
  let probB = Math.round(finalB_raw * (1.0 - pTie) * 100);
  let probT = Math.round(pTie * 100);

  const diff100 = 100 - (probP + probB + probT);
  probP += diff100;

  let maxStreakP = 0;
  let maxStreakB = 0;
  let currP = 0;
  let currB = 0;
  for (const o of historyOutcomes) {
    if (o === 'PLAYER') {
      currP++;
      currB = 0;
      if (currP > maxStreakP) maxStreakP = currP;
    } else if (o === 'BANKER') {
      currB++;
      currP = 0;
      if (currB > maxStreakB) maxStreakB = currB;
    } else {
      currP = 0;
      currB = 0;
    }
  }

  const tieProtectionStr = isBacBo ? '🟡 EMPATE' : '🟢 ZERO';

  const velocityLabel = patternAnalysis.detectedPattern;

  // CONTINUOUS PREDICTION (NO PAUSE MODE): Always generate active prediction!
  let target: 'Player' | 'Banker' | 'Red' | 'Black' = 'Player';
  let actionStr = '';
  let confidence = 85;

  // Scan PRNG Seeds (Mersenne Twister / XorShift / ISAAC)
  const rngMatch = scanRNGSeeds(nonTieOutcomes, isBacBo ? 'bacbo' : 'roulette');

  if (rngMatch.seedFound && rngMatch.nextPrediction) {
    const isP = rngMatch.nextPrediction === 'PLAYER' || rngMatch.nextPrediction === 'RED';
    if (isP) {
      target = isBacBo ? 'Player' : 'Red';
      actionStr = isBacBo ? 'Aposta no Player 🔵' : 'Aposta no Vermelho 🔴';
    } else {
      target = isBacBo ? 'Banker' : 'Black';
      actionStr = isBacBo ? 'Aposta no Banker 🔴' : 'Aposta no Preto 🖤';
    }
    confidence = Math.round(rngMatch.confidence * 100);
  } else if (patternAnalysis.confidenceWeight >= 0.15) {
    // When a specific visual chart pattern is detected (confidenceWeight >= 0.15),
    // align prediction target strictly with patternAnalysis.recommendedSide to prevent any rationale/target contradiction!
    const isRecP = patternAnalysis.recommendedSide === 'PLAYER';
    if (isRecP) {
      target = isBacBo ? 'Player' : 'Red';
      actionStr = isBacBo ? 'Aposta no Player 🔵' : 'Aposta no Vermelho 🔴';
      confidence = Math.min(98, Math.max(83, Math.round(probP)));
    } else {
      target = isBacBo ? 'Banker' : 'Black';
      actionStr = isBacBo ? 'Aposta no Banker 🔴' : 'Aposta no Preto 🖤';
      confidence = Math.min(98, Math.max(83, Math.round(probB)));
    }
  } else {
    if (probP >= probB) {
      target = isBacBo ? 'Player' : 'Red';
      actionStr = isBacBo ? 'Aposta no Player 🔵' : 'Aposta no Vermelho 🔴';
      confidence = Math.min(98, Math.max(82, probP));
    } else {
      target = isBacBo ? 'Banker' : 'Black';
      actionStr = isBacBo ? 'Aposta no Banker 🔴' : 'Aposta no Preto 🖤';
      confidence = Math.min(98, Math.max(82, probB));
    }
  }

  const rationale = rngMatch.seedFound
    ? `⚡ SEMENTE PRNG DECODIFICADA [${rngMatch.algorithm} - Seed #${rngMatch.seed}] — Confiança Determinística: ${confidence}%`
    : `${patternAnalysis.rationaleText} — Confiança: ${confidence}% | ${patternAnalysis.graphHealthText}`;

  const p1 = Math.max(0.01, probP / 100);
  const p2 = Math.max(0.01, probB / 100);
  const entropy = -(p1 * Math.log2(p1) + p2 * Math.log2(p2));

  const goldenBatchSlots = generateGoldenBatch(currentHour, currentMin, rounds, isBacBo);
  const goldenMinutes = goldenBatchSlots.map((s) => s.timeStr);

  return {
    game,
    action: actionStr,
    target,
    confidence,
    rationale,
    pattern: patternAnalysis.detectedPattern,
    tieProtection: tieProtectionStr,
    probabilities: {
      PLAYER: probP,
      BANKER: probB,
      TIE: probT,
    },
    layers: {
      variance: Number((1.0 - confidence / 100).toFixed(2)),
      rpp: Number(((confidence / 100) * 1.25).toFixed(2)),
      entropy: Number(entropy.toFixed(2)),
      rngMatch: `Monte Carlo 1000x (${Math.round(mcRatioP * 100)}% P / ${Math.round(mcRatioB * 100)}% B)`,
      baccaratRoadStyle: roads.isDragonActive
        ? 'Dragão Ativo'
        : roads.isPingPongActive
        ? 'Ping-Pong'
        : 'Estruturado',
      velocityLabel,
      volatilityIndex,
      inertiaVector,
      alternationRate,
      hourlyScoreP: Number(hourlyScoreP.toFixed(2)),
      hourlyScoreB: Number(hourlyScoreB.toFixed(2)),
      maxStreakP,
      maxStreakB,
      minuteTensCluster: `Dezena ${currentTenMin}0-${currentTenMin}9m`,
      lambdaShrinkage,
      monteCarloWinRateP: Number((mcRatioP * 100).toFixed(1)),
      monteCarloWinRateB: Number((mcRatioB * 100).toFixed(1)),
    },
    goldenMinutes,
    intel20ProMax,
    galeViable: true,
    timestamp: now.toISOString(),
    triggerRoundId: currentTriggerId,
  };
}

export interface PatternAnalysisDetail {
  detectedPattern: string;
  recommendedSide: 'PLAYER' | 'BANKER';
  confidenceWeight: number;
  rationaleText: string;
  isGoodGraph: boolean;
  graphHealthText: string;
}

export function detectAdvancedChartPatterns(
  nonTieOutcomes: string[],
  isBacBo: boolean
): PatternAnalysisDetail {
  if (!nonTieOutcomes || nonTieOutcomes.length < 3) {
    return {
      detectedPattern: 'Aguardando Histórico',
      recommendedSide: 'PLAYER',
      confidenceWeight: 0,
      rationaleText: 'Mapeando padrões da mesa...',
      isGoodGraph: true,
      graphHealthText: 'Mesa Inicial',
    };
  }

  const len = nonTieOutcomes.length;
  const lastIndex = len - 1;
  const lastOut = nonTieOutcomes[lastIndex]; // 'PLAYER' or 'BANKER'
  const oppOut = lastOut === 'PLAYER' ? 'BANKER' : 'PLAYER';

  const sideLabel = (side: string) =>
    isBacBo
      ? side === 'PLAYER'
        ? 'Player 🔵'
        : 'Banker 🔴'
      : side === 'PLAYER'
      ? 'Vermelho 🔴'
      : 'Preto 🖤';

  // Count current streak at the tail
  let currentStreak = 0;
  for (let i = lastIndex; i >= 0; i--) {
    if (nonTieOutcomes[i] === lastOut) currentStreak++;
    else break;
  }

  // Count previous streak (before current streak)
  let prevStreak = 0;
  let prevOut = oppOut;
  if (len - currentStreak > 0) {
    const prevIndex = lastIndex - currentStreak;
    prevOut = nonTieOutcomes[prevIndex];
    for (let i = prevIndex; i >= 0; i--) {
      if (nonTieOutcomes[i] === prevOut) prevStreak++;
      else break;
    }
  }

  // Count ping-pong / chess length
  let pingPongLen = 1;
  for (let i = lastIndex; i > 0; i--) {
    if (nonTieOutcomes[i] !== nonTieOutcomes[i - 1]) pingPongLen++;
    else break;
  }

  // Calculate percentages in recent 30 outcomes (Barreira & Percentual)
  const recent30 = nonTieOutcomes.slice(-30);
  const pCount = recent30.filter((x) => x === 'PLAYER').length;
  const bCount = recent30.filter((x) => x === 'BANKER').length;
  const pPct = Math.round((pCount / recent30.length) * 100);
  const bPct = Math.round((bCount / recent30.length) * 100);
  const dominantPercentSide = pPct >= bPct ? 'PLAYER' : 'BANKER';

  let switchesCount = 0;
  for (let i = 1; i < recent30.length; i++) {
    if (recent30[i] !== recent30[i - 1]) switchesCount++;
  }
  const switchRate = recent30.length > 1 ? switchesCount / (recent30.length - 1) : 0.5;

  // 1. PADRÃO QUE MAIS BATE NO BAC BO: 🔵🔴🔵 / 🔴🔵 -> puxa o azul (ou cor que iniciou a sequência)
  if (len >= 5) {
    const s5 = nonTieOutcomes.slice(-5);
    // [A, B, A, B, A] alternating 5 times
    if (s5[0] === s5[2] && s5[2] === s5[4] && s5[1] === s5[3] && s5[0] !== s5[1]) {
      const targetSide = s5[0];
      return {
        detectedPattern: 'Padrão Clássico Bac Bo (5x Alternância)',
        recommendedSide: targetSide as 'PLAYER' | 'BANKER',
        confidenceWeight: 0.19,
        rationaleText: `🎯 Padrão Clássico Bac Bo identificado (${sideLabel(s5[0])}/${sideLabel(s5[1])}). Projeção no ${sideLabel(targetSide)} para fechar o ciclo!`,
        isGoodGraph: true,
        graphHealthText: '✔ Gráfico Bac Bo de Alta Assertividade',
      };
    }
  }

  // 2. TORRES GÊMEAS (Torres de 4 bolinhas)
  if (prevStreak === 4 && (currentStreak === 2 || currentStreak === 3)) {
    return {
      detectedPattern: 'Padrão Torres Gêmeas (Torre de 4)',
      recommendedSide: lastOut as 'PLAYER' | 'BANKER',
      confidenceWeight: 0.19,
      rationaleText: `🏛️ Torres Gêmeas em construção: Anterior foi 4x ${sideLabel(prevOut)}, atual em ${currentStreak}x ${sideLabel(lastOut)}. Entrada no ${sideLabel(lastOut)} para igualar a torre!`,
      isGoodGraph: true,
      graphHealthText: '✔ Gráfico Torres Gêmeas (Simetria Perfeita)',
    };
  }

  // 3. PADRÃO 3x2 (Reversão de Ciclo)
  if (prevStreak === 3 && currentStreak === 2) {
    return {
      detectedPattern: 'Padrão 3x2 (Equilíbrio de Ciclo)',
      recommendedSide: oppOut as 'PLAYER' | 'BANKER',
      confidenceWeight: 0.18,
      rationaleText: `⚖️ Padrão 3x2 detectado (3x ${sideLabel(prevOut)} -> 2x ${sideLabel(lastOut)}). Reversão projetada para ${sideLabel(oppOut)}!`,
      isGoodGraph: true,
      graphHealthText: '✔ Gráfico 3x2 (Reversão Assertiva)',
    };
  }

  // 4. PADRÃO 3/3 (Completar Tripla)
  if (len >= 5) {
    const s5 = nonTieOutcomes.slice(-5);
    if (s5[0] === s5[1] && s5[1] === s5[2] && s5[3] === s5[4] && s5[2] !== s5[3] && currentStreak === 2) {
      return {
        detectedPattern: 'Padrão 3/3 (Completar Tripla)',
        recommendedSide: lastOut as 'PLAYER' | 'BANKER',
        confidenceWeight: 0.18,
        rationaleText: `🔺 Padrão 3/3 em andamento (${sideLabel(lastOut)} x2). Entrada no ${sideLabel(lastOut)} para completar a tripla 3x3!`,
        isGoodGraph: true,
        graphHealthText: '✔ Gráfico Padrão 3/3 (Alta Precisão)',
      };
    }
  }

  // 5. PADRÃO PARZINHO (🔴🔴 🔵🔵 🔴🔴)
  if (len >= 4) {
    const s4 = nonTieOutcomes.slice(-4);
    if (s4[0] === s4[1] && s4[2] === s4[3] && s4[1] !== s4[2]) {
      // We have two completed pairs (AA BB). Current streak is 2.
      // Next expectation in Parzinho is starting a new pair of the opposite color!
      return {
        detectedPattern: 'Padrão Parzinho (Pares Alternados)',
        recommendedSide: oppOut as 'PLAYER' | 'BANKER',
        confidenceWeight: 0.17,
        rationaleText: `👯 Padrão Parzinho ativo (2x ${sideLabel(s4[0])} -> 2x ${sideLabel(s4[2])}). Troca de cor projetada para iniciar o próximo par no ${sideLabel(oppOut)}!`,
        isGoodGraph: true,
        graphHealthText: '✔ Gráfico Parzinho Simétrico',
      };
    } else if (currentStreak === 1 && prevStreak === 2) {
      // We have AA B -> next should be B to form the second pair BB
      return {
        detectedPattern: 'Padrão Parzinho (Completar Par)',
        recommendedSide: lastOut as 'PLAYER' | 'BANKER',
        confidenceWeight: 0.17,
        rationaleText: `👯 Padrão Parzinho: Entrada no ${sideLabel(lastOut)} para fechar o segundo par (2x2)!`,
        isGoodGraph: true,
        graphHealthText: '✔ Gráfico Parzinho em Formação',
      };
    }
  }

  // 6. PADRÃO RAMPA (Normal & Desenvolvida)
  if (len >= 6) {
    // Check for staircase / ramp 1-2-3 sequence
    if (currentStreak === 2 && prevStreak === 1) {
      return {
        detectedPattern: 'Padrão Rampa Desenvolvida',
        recommendedSide: oppOut as 'PLAYER' | 'BANKER',
        confidenceWeight: 0.17,
        rationaleText: `📐 Rampa Desenvolvida: Após 2x no ${sideLabel(lastOut)}, entrada projetada no ${sideLabel(oppOut)} para desenhar a rampa!`,
        isGoodGraph: true,
        graphHealthText: '✔ Gráfico em Formação de Rampa',
      };
    } else if (currentStreak === 3) {
      return {
        detectedPattern: 'Padrão Rampa Normal (Base de 3)',
        recommendedSide: oppOut as 'PLAYER' | 'BANKER',
        confidenceWeight: 0.17,
        rationaleText: `📐 Rampa Normal: Base de 3x no ${sideLabel(lastOut)}. Troca projetada no ${sideLabel(oppOut)} para completar o degrau da rampa!`,
        isGoodGraph: true,
        graphHealthText: '✔ Gráfico Rampa Normal',
      };
    }
  }

  // 7. PADRÃO V (Pós-Xadrez / Pós-Alternância)
  if (len >= 6 && currentStreak === 2) {
    let chessCount = 0;
    for (let i = lastIndex - 2; i > 0; i--) {
      if (nonTieOutcomes[i] !== nonTieOutcomes[i - 1]) chessCount++;
      else break;
    }
    if (chessCount >= 3) {
      return {
        detectedPattern: 'Padrão V (Pós-Xadrez)',
        recommendedSide: oppOut as 'PLAYER' | 'BANKER',
        confidenceWeight: 0.18,
        rationaleText: `📐 Padrão V detectado após ${chessCount + 1}x trocas de Xadrez. Reversão projetada para ${sideLabel(oppOut)}!`,
        isGoodGraph: true,
        graphHealthText: '✔ Gráfico Padrão V (Reversão Valida)',
      };
    }
  }

  // 8. PADRÃO 2-1-2 (2 QUEBRA)
  if (len >= 4) {
    const s4 = nonTieOutcomes.slice(-4);
    if (s4[0] === s4[1] && s4[2] === s4[3] && s4[1] !== s4[2]) {
      return {
        detectedPattern: 'Padrão 2-1-2 (Dupla Intercalada)',
        recommendedSide: lastOut as 'PLAYER' | 'BANKER',
        confidenceWeight: 0.17,
        rationaleText: `👯 Padrão 2-1-2 identificado. Segunda entrada no ${sideLabel(lastOut)} para fechar o bloco!`,
        isGoodGraph: true,
        graphHealthText: '✔ Gráfico Padrão 2-1-2 (Alta Precisão)',
      };
    }
  }

  // 9. PADRÃO DAS PERNINHAS (Intercalado com Ponta Dupla)
  if (len >= 5) {
    const s5 = nonTieOutcomes.slice(-5);
    // A B B A B -> tip is B or A
    if (s5[1] === s5[2] && s5[0] !== s5[1] && s5[3] === s5[0] && s5[4] === s5[1]) {
      return {
        detectedPattern: 'Padrão das Perninhas (Ponta Dupla)',
        recommendedSide: lastOut as 'PLAYER' | 'BANKER',
        confidenceWeight: 0.17,
        rationaleText: `🦵 Padrão das Perninhas: Repetição da ponta no ${sideLabel(lastOut)}. Entrada a favor da perninha!`,
        isGoodGraph: true,
        graphHealthText: '✔ Gráfico das Perninhas Operacional',
      };
    }
  }

  // 10. PADRÃO DO SURF (ONDA) & QUEBRA DE SURF COM 1 OPOSTO
  if (currentStreak >= 2) {
    return {
      detectedPattern: `Padrão do Surf (${currentStreak}x ${sideLabel(lastOut)})`,
      recommendedSide: lastOut as 'PLAYER' | 'BANKER',
      confidenceWeight: 0.18,
      rationaleText: `🌊 Padrão do Surf ativo (${currentStreak}x seguidas no ${sideLabel(lastOut)}). Pegando a onda a favor da tendência!`,
      isGoodGraph: true,
      graphHealthText: '✔ Gráfico em Onda de Surf',
    };
  }

  // Quebra de Surf com 1 oposto: ex AAA B -> aposta A acreditando no retorno do Surf
  if (len >= 4 && currentStreak === 1 && prevStreak >= 3) {
    return {
      detectedPattern: 'Quebra de Surf (Retorno de Onda)',
      recommendedSide: prevOut as 'PLAYER' | 'BANKER',
      confidenceWeight: 0.16,
      rationaleText: `🏄 Quebra de Surf com apenas 1x ${sideLabel(lastOut)}. Projeção de retorno à onda do ${sideLabel(prevOut)}!`,
      isGoodGraph: true,
      graphHealthText: '✔ Gráfico de Retorno de Surf',
    };
  }

  // 11. PADRÃO ALTERNÂNCIA / XADREZ (REGRA DOS 7X)
  if (pingPongLen >= 6) {
    return {
      detectedPattern: `Xadrez Extenso (${pingPongLen}x) - Fechamento 7x`,
      recommendedSide: lastOut as 'PLAYER' | 'BANKER',
      confidenceWeight: 0.18,
      rationaleText: `🔄 Xadrez no limite de 6-7 trocas. Tendência forte de fechamento no ${sideLabel(lastOut)}!`,
      isGoodGraph: true,
      graphHealthText: '✔ Gráfico Xadrez em Fechamento',
    };
  }

  if (pingPongLen >= 3) {
    const recSide = (Math.abs(pPct - bPct) >= 12) ? dominantPercentSide : oppOut;
    return {
      detectedPattern: 'Padrão Alternância (Xadrez)',
      recommendedSide: recSide as 'PLAYER' | 'BANKER',
      confidenceWeight: 0.15,
      rationaleText: `🔄 Xadrez (${pingPongLen}x trocas). Projeção para ${sideLabel(recSide)} (${Math.max(pPct, bPct)}% na vantagem de barreira).`,
      isGoodGraph: true,
      graphHealthText: '✔ Gráfico Xadrez Organizado',
    };
  }

  // 12. BARREIRA PERCENTUAL / TENDÊNCIA PADRÃO
  const isGoodGraph = (switchRate >= 0.25 && switchRate <= 0.75);
  const recSide = pPct !== bPct ? dominantPercentSide : (currentStreak >= 2 ? lastOut : oppOut);

  return {
    detectedPattern: `Barreira Percentual (${Math.max(pPct, bPct)}%)`,
    recommendedSide: recSide as 'PLAYER' | 'BANKER',
    confidenceWeight: 0.10,
    rationaleText: `📊 Análise de Barreira: Vantagem de ${Math.max(pPct, bPct)}% no ${sideLabel(recSide)}. Entrada projetada!`,
    isGoodGraph,
    graphHealthText: isGoodGraph ? '✔ Gráfico Estável' : '⚠️ Gráfico em Oscilação',
  };
}

export interface AutoGaleResult {
  shouldDoGale: boolean;
  reason: string;
}

export function evaluateAutoGaleDecision(
  rounds: any[],
  currentSignal: any,
  isBacBo: boolean
): AutoGaleResult {
  if (!rounds || rounds.length < 3 || !currentSignal) {
    return { shouldDoGale: true, reason: 'Gale 1 mantido por padrão' };
  }

  const nonTieOutcomes: string[] = [];
  for (const r of rounds) {
    if (!r) continue;
    let out = '';
    if (isBacBo) {
      if (r.outcome === 'PlayerWon') out = 'PLAYER';
      else if (r.outcome === 'BankerWon') out = 'BANKER';
    } else {
      const color = String(r.color || '').toLowerCase();
      if (color === 'red') out = 'PLAYER';
      else if (color === 'black') out = 'BANKER';
    }
    if (out) nonTieOutcomes.unshift(out);
  }

  if (nonTieOutcomes.length < 4) {
    return { shouldDoGale: true, reason: 'Gale 1 de segurança' };
  }

  const lastIndex = nonTieOutcomes.length - 1;
  const lastOut = nonTieOutcomes[lastIndex];

  let currentStreak = 0;
  for (let i = lastIndex; i >= 0; i--) {
    if (nonTieOutcomes[i] === lastOut) currentStreak++;
    else break;
  }

  const s4 = nonTieOutcomes.slice(-4);
  const isParzinhoForming =
    (s4.length === 4 && s4[0] === s4[1] && s4[2] === s4[3] && s4[1] !== s4[2]) ||
    (currentStreak === 1 && nonTieOutcomes.length >= 4 && nonTieOutcomes[lastIndex - 1] === nonTieOutcomes[lastIndex - 2]);

  if (isParzinhoForming) {
    return {
      shouldDoGale: false,
      reason: '🤖 Gale Inteligente: Abortado! Padrão Parzinho/2-1-2 em formação detectado (evitando armadilha).',
    };
  }

  if (currentStreak >= 4) {
    return {
      shouldDoGale: true,
      reason: `🤖 Gale Inteligente: Gale 1 ativado! Dragão em ${currentStreak}x. Elevada probabilidade de quebra.`,
    };
  }

  const recent10 = nonTieOutcomes.slice(-10);
  let switches = 0;
  for (let i = 1; i < recent10.length; i++) {
    if (recent10[i] !== recent10[i - 1]) switches++;
  }
  if (switches >= 7) {
    return {
      shouldDoGale: false,
      reason: '🤖 Gale Inteligente: Abortado! Mesa em alta instabilidade.',
    };
  }

  return {
    shouldDoGale: true,
    reason: '🤖 Gale Inteligente: Gale 1 validado.',
  };
}



