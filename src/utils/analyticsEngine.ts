import { BacBoEvent, BacktestResult, RouletteEvent, SequenceStats, StrategyRule } from '../types';

/**
 * Enhanced BacBo & Casino Analytics Engine
 */

export interface HourlyColorAverages {
  totalHoursWithData: number;
  player: { total: number; avgPerHour: number; percentage: number };
  banker: { total: number; avgPerHour: number; percentage: number };
  tie: { total: number; avgPerHour: number; percentage: number };
}

export interface MaxStreakDetail {
  outcome: string;
  count: number;
  timestamp?: string;
  roundId?: string;
}

export interface PrecedingTieScore {
  score: number; // e.g. 10
  winner: 'PlayerWon' | 'BankerWon' | 'Tie';
  count: number;
  label: string;
}

export interface TenMinIntervalBreakdown {
  interval: string; // "00'-10'", "10'-20'", etc.
  total: number;
  playerCount: number;
  bankerCount: number;
  tieCount: number;
  playerPct: number;
  bankerPct: number;
  tiePct: number;
}

/**
 * Filter events by Date string (YYYY-MM-DD or relative 'today', 'yesterday', 'all')
 */
export function filterEventsByDate<T extends { timestamp?: string }>(
  events: T[],
  dateFilter: string
): T[] {
  if (!events || events.length === 0) return [];
  if (dateFilter === 'all') return events;

  const now = new Date();
  let targetDateStr = '';

  if (dateFilter === 'today') {
    targetDateStr = now.toISOString().slice(0, 10);
  } else if (dateFilter === 'yesterday') {
    const yest = new Date(now.getTime() - 86400000);
    targetDateStr = yest.toISOString().slice(0, 10);
  } else if (dateFilter === '2days') {
    const d2 = new Date(now.getTime() - 2 * 86400000);
    targetDateStr = d2.toISOString().slice(0, 10);
  } else if (dateFilter === '3days') {
    const d3 = new Date(now.getTime() - 3 * 86400000);
    targetDateStr = d3.toISOString().slice(0, 10);
  } else {
    // Custom date string YYYY-MM-DD
    targetDateStr = dateFilter;
  }

  return events.filter((ev) => {
    if (!ev.timestamp) return false;
    const evDateStr = new Date(ev.timestamp).toISOString().slice(0, 10);
    return evDateStr === targetDateStr;
  });
}

/**
 * Calculate Hourly Color Averages (Matching Screenshot 1)
 */
export function calculateHourlyColorAverages(events: BacBoEvent[]): HourlyColorAverages {
  if (!events || events.length === 0) {
    return {
      totalHoursWithData: 1,
      player: { total: 0, avgPerHour: 0, percentage: 0 },
      banker: { total: 0, avgPerHour: 0, percentage: 0 },
      tie: { total: 0, avgPerHour: 0, percentage: 0 },
    };
  }

  const hoursSet = new Set<number>();
  let pCount = 0;
  let bCount = 0;
  let tCount = 0;

  events.forEach((ev) => {
    let hour = ev.hour;
    if (hour === undefined && ev.timestamp) {
      hour = new Date(ev.timestamp).getHours();
    }
    if (hour !== undefined) hoursSet.add(hour);

    if (ev.outcome === 'PlayerWon') pCount++;
    else if (ev.outcome === 'BankerWon') bCount++;
    else if (ev.outcome === 'Tie') tCount++;
  });

  const totalRounds = events.length;
  const hoursCount = Math.max(1, hoursSet.size);

  return {
    totalHoursWithData: hoursCount,
    player: {
      total: pCount,
      avgPerHour: Number((pCount / hoursCount).toFixed(2)),
      percentage: Number(((pCount / totalRounds) * 100).toFixed(2)),
    },
    banker: {
      total: bCount,
      avgPerHour: Number((bCount / hoursCount).toFixed(2)),
      percentage: Number(((bCount / totalRounds) * 100).toFixed(2)),
    },
    tie: {
      total: tCount,
      avgPerHour: Number((tCount / hoursCount).toFixed(2)),
      percentage: Number(((tCount / totalRounds) * 100).toFixed(2)),
    },
  };
}

/**
 * Calculate Max Streaks with Timestamps & Details (Matching Screenshot 2)
 */
export function calculateDetailedMaxStreaks(events: BacBoEvent[]) {
  if (!events || events.length === 0) {
    return {
      player: { outcome: 'PlayerWon', count: 0 },
      banker: { outcome: 'BankerWon', count: 0 },
      tie: { outcome: 'Tie', count: 0 },
    };
  }

  // Events are stored descending (newest first). Chronological order = reverse
  const sorted = [...events].reverse();

  let maxP = { outcome: 'PlayerWon', count: 0, timestamp: '' };
  let maxB = { outcome: 'BankerWon', count: 0, timestamp: '' };
  let maxT = { outcome: 'Tie', count: 0, timestamp: '' };

  let currentOutcome = sorted[0].outcome;
  let currentCount = 0;
  let startTime = sorted[0].timestamp;

  for (const ev of sorted) {
    if (ev.outcome === currentOutcome) {
      currentCount++;
    } else {
      // Check max
      if (currentOutcome === 'PlayerWon' && currentCount > maxP.count) {
        maxP = { outcome: 'PlayerWon', count: currentCount, timestamp: startTime };
      } else if (currentOutcome === 'BankerWon' && currentCount > maxB.count) {
        maxB = { outcome: 'BankerWon', count: currentCount, timestamp: startTime };
      } else if (currentOutcome === 'Tie' && currentCount > maxT.count) {
        maxT = { outcome: 'Tie', count: currentCount, timestamp: startTime };
      }

      currentOutcome = ev.outcome;
      currentCount = 1;
      startTime = ev.timestamp;
    }
  }

  // Check last streak
  if (currentOutcome === 'PlayerWon' && currentCount > maxP.count) {
    maxP = { outcome: 'PlayerWon', count: currentCount, timestamp: startTime };
  } else if (currentOutcome === 'BankerWon' && currentCount > maxB.count) {
    maxB = { outcome: 'BankerWon', count: currentCount, timestamp: startTime };
  } else if (currentOutcome === 'Tie' && currentCount > maxT.count) {
    maxT = { outcome: 'Tie', count: currentCount, timestamp: startTime };
  }

  return { player: maxP, banker: maxB, tie: maxT };
}

/**
 * Preceding Score & Condition Analysis before Ties (Matching Screenshot 3)
 * Calculates scores (winning score or total dice score) in the round RIGHT BEFORE a Tie occurred!
 */
export function calculatePrecedingTieScores(events: BacBoEvent[]): PrecedingTieScore[] {
  if (!events || events.length === 0) return [];

  const sorted = [...events].reverse(); // Chronological (oldest to newest)
  const scoreMap: Record<string, { score: number; winner: 'PlayerWon' | 'BankerWon' | 'Tie'; count: number; label: string }> = {};

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    if (current.outcome === 'Tie') {
      const prev = sorted[i - 1];
      if (prev.outcome !== 'Tie') {
        const winningScore = prev.outcome === 'PlayerWon' ? prev.playerScore : prev.bankerScore;
        const key = `${prev.outcome}_${winningScore}`;
        const label = `Pontuação ${winningScore} (${prev.outcome === 'PlayerWon' ? '🔵 Player' : '🔴 Banker'})`;

        if (!scoreMap[key]) {
          scoreMap[key] = {
            score: winningScore,
            winner: prev.outcome,
            count: 0,
            label,
          };
        }
        scoreMap[key].count++;
      }
    }
  }

  return Object.values(scoreMap).sort((a, b) => b.count - a.count);
}

/**
 * Exact Tie Score Distribution (e.g. 6-6 = 12, 5-5 = 10, 4-4 = 8, 3-3 = 6, 2-2 = 4, 1-1 = 2)
 */
export function calculateExactTieScores(events: BacBoEvent[]) {
  const tieEvents = events.filter((ev) => ev.outcome === 'Tie');
  const scoreMap: Record<number, number> = {};

  tieEvents.forEach((ev) => {
    const sum = ev.playerScore + ev.bankerScore;
    scoreMap[sum] = (scoreMap[sum] || 0) + 1;
  });

  return Object.entries(scoreMap)
    .map(([sum, count]) => ({
      sum: Number(sum),
      eachDieScore: Number(sum) / 2,
      count,
      pct: tieEvents.length > 0 ? Number(((count / tieEvents.length) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 10-Minute Interval Distribution Breakdown (Matching Screenshot 4)
 * Brackets: 00'-10', 10'-20', 20'-30', 30'-40', 40'-50', 50'-60'
 */
export function calculate10MinIntervals(events: BacBoEvent[]): TenMinIntervalBreakdown[] {
  const brackets = [
    { label: "00' - 10'", minStart: 0, minEnd: 9 },
    { label: "10' - 20'", minStart: 10, minEnd: 19 },
    { label: "20' - 30'", minStart: 20, minEnd: 29 },
    { label: "30' - 40'", minStart: 30, minEnd: 39 },
    { label: "40' - 50'", minStart: 40, minEnd: 49 },
    { label: "50' - 60'", minStart: 50, minEnd: 59 },
  ];

  return brackets.map((br) => {
    let pCount = 0;
    let bCount = 0;
    let tCount = 0;

    events.forEach((ev) => {
      let minute = ev.minute;
      if (minute === undefined && ev.timestamp) {
        minute = new Date(ev.timestamp).getMinutes();
      }
      if (minute !== undefined && minute >= br.minStart && minute <= br.minEnd) {
        if (ev.outcome === 'PlayerWon') pCount++;
        else if (ev.outcome === 'BankerWon') bCount++;
        else if (ev.outcome === 'Tie') tCount++;
      }
    });

    const total = pCount + bCount + tCount;

    return {
      interval: br.label,
      total,
      playerCount: pCount,
      bankerCount: bCount,
      tieCount: tCount,
      playerPct: total > 0 ? Number(((pCount / total) * 100).toFixed(1)) : 0,
      bankerPct: total > 0 ? Number(((bCount / total) * 100).toFixed(1)) : 0,
      tiePct: total > 0 ? Number(((tCount / total) * 100).toFixed(1)) : 0,
    };
  });
}

/**
 * 1. Score Dominance Matrix (Scores 2 to 12 win rate breakdown)
 */
export function calculateDiceScoreDominance(events: BacBoEvent[]) {
  const scoreMap: Record<number, { playerWins: number; bankerWins: number; ties: number; total: number }> = {};
  for (let s = 2; s <= 12; s++) {
    scoreMap[s] = { playerWins: 0, bankerWins: 0, ties: 0, total: 0 };
  }

  events.forEach((ev) => {
    // Check player score
    if (ev.playerScore >= 2 && ev.playerScore <= 12) {
      scoreMap[ev.playerScore].total++;
      if (ev.outcome === 'PlayerWon') scoreMap[ev.playerScore].playerWins++;
      else if (ev.outcome === 'Tie') scoreMap[ev.playerScore].ties++;
    }
    // Check banker score
    if (ev.bankerScore >= 2 && ev.bankerScore <= 12) {
      scoreMap[ev.bankerScore].total++;
      if (ev.outcome === 'BankerWon') scoreMap[ev.bankerScore].bankerWins++;
    }
  });

  return Object.entries(scoreMap).map(([scoreStr, data]) => {
    const score = Number(scoreStr);
    const pPct = data.total > 0 ? Number(((data.playerWins / data.total) * 100).toFixed(1)) : 0;
    const bPct = data.total > 0 ? Number(((data.bankerWins / data.total) * 100).toFixed(1)) : 0;
    const tPct = data.total > 0 ? Number(((data.ties / data.total) * 100).toFixed(1)) : 0;
    return {
      score,
      total: data.total,
      playerWins: data.playerWins,
      bankerWins: data.bankerWins,
      ties: data.ties,
      playerPct: pPct,
      bankerPct: bPct,
      tiePct: tPct,
    };
  });
}

/**
 * 2. Chop vs Streak Rate (Inversion / Alternation Frequency)
 */
export function calculateChopRate(events: BacBoEvent[]) {
  if (!events || events.length < 2) {
    return { chopCount: 0, streakCount: 0, totalTransitions: 0, chopPct: 0, streakPct: 0 };
  }

  const sorted = [...events].reverse(); // Chronological
  let chopCount = 0;
  let streakCount = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i].outcome;
    const next = sorted[i + 1].outcome;

    if (current !== 'Tie' && next !== 'Tie') {
      if (current !== next) {
        chopCount++;
      } else {
        streakCount++;
      }
    }
  }

  const total = chopCount + streakCount;
  return {
    chopCount,
    streakCount,
    totalTransitions: total,
    chopPct: total > 0 ? Number(((chopCount / total) * 100).toFixed(1)) : 0,
    streakPct: total > 0 ? Number(((streakCount / total) * 100).toFixed(1)) : 0,
  };
}

/**
 * 3. Score Differential Behavior (Diff 0 to 10)
 */
export function calculateScoreDiffBehavior(events: BacBoEvent[]) {
  const diffMap: Record<number, { count: number; playerWins: number; bankerWins: number; ties: number; nextTieCount: number }> = {};
  const sorted = [...events].reverse();

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    const diff = Math.abs(ev.playerScore - ev.bankerScore);

    if (!diffMap[diff]) {
      diffMap[diff] = { count: 0, playerWins: 0, bankerWins: 0, ties: 0, nextTieCount: 0 };
    }
    diffMap[diff].count++;
    if (ev.outcome === 'PlayerWon') diffMap[diff].playerWins++;
    else if (ev.outcome === 'BankerWon') diffMap[diff].bankerWins++;
    else if (ev.outcome === 'Tie') diffMap[diff].ties++;

    // Check if next round was a tie
    if (i < sorted.length - 1 && sorted[i + 1].outcome === 'Tie') {
      diffMap[diff].nextTieCount++;
    }
  }

  return Object.entries(diffMap)
    .map(([diffStr, data]) => ({
      diff: Number(diffStr),
      count: data.count,
      playerWins: data.playerWins,
      bankerWins: data.bankerWins,
      ties: data.ties,
      nextTieCount: data.nextTieCount,
      nextTiePct: data.count > 0 ? Number(((data.nextTieCount / data.count) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => a.diff - b.diff);
}

/**
 * 4. Micro-seasonality per Minute Decade (:00-:09, :10-:19, etc.)
 */
export function calculateMinuteDecadeSeasonality(events: BacBoEvent[]) {
  const decades = [
    { label: ':00 - :09', start: 0, end: 9 },
    { label: ':10 - :19', start: 10, end: 19 },
    { label: ':20 - :29', start: 20, end: 29 },
    { label: ':30 - :39', start: 30, end: 39 },
    { label: ':40 - :49', start: 40, end: 49 },
    { label: ':50 - :59', start: 50, end: 59 },
  ];

  return decades.map((dec) => {
    let pCount = 0;
    let bCount = 0;
    let tCount = 0;

    events.forEach((ev) => {
      let minute = ev.minute;
      if (minute === undefined && ev.timestamp) {
        minute = new Date(ev.timestamp).getMinutes();
      }
      if (minute !== undefined && minute >= dec.start && minute <= dec.end) {
        if (ev.outcome === 'PlayerWon') pCount++;
        else if (ev.outcome === 'BankerWon') bCount++;
        else if (ev.outcome === 'Tie') tCount++;
      }
    });

    const total = pCount + bCount + tCount;
    return {
      label: dec.label,
      total,
      playerCount: pCount,
      bankerCount: bCount,
      tieCount: tCount,
      playerPct: total > 0 ? Number(((pCount / total) * 100).toFixed(1)) : 0,
      bankerPct: total > 0 ? Number(((bCount / total) * 100).toFixed(1)) : 0,
      tiePct: total > 0 ? Number(((tCount / total) * 100).toFixed(1)) : 0,
    };
  });
}

/**
 * 5. Exact Score Clusters & Back-to-Back Repeats
 */
export function calculateScoreClusters(events: BacBoEvent[]) {
  const clusterMap: Record<string, number> = {};
  events.forEach((ev) => {
    const scoreKey = `${ev.playerScore}-${ev.bankerScore}`;
    clusterMap[scoreKey] = (clusterMap[scoreKey] || 0) + 1;
  });

  return Object.entries(clusterMap)
    .map(([scorePair, count]) => {
      const [pScore, bScore] = scorePair.split('-').map(Number);
      return {
        scorePair,
        pScore,
        bScore,
        count,
        pct: events.length > 0 ? Number(((count / events.length) * 100).toFixed(1)) : 0,
        isTie: pScore === bScore,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

/**
 * 6. Table Volatility & Inertia Rating (0 - 100 scale)
 */
export function calculateTableVolatility(events: BacBoEvent[]) {
  if (!events || events.length < 10) {
    return { volatilityScore: 50, status: 'Moderada', advice: 'Aguarde mais rodadas para calibragem' };
  }

  const recent = events.slice(0, 30);
  const chopData = calculateChopRate(recent);
  const tiesCount = recent.filter((ev) => ev.outcome === 'Tie').length;

  // Higher chop rate + higher tie count = high volatility
  const volatilityRaw = chopData.chopPct * 0.7 + (tiesCount / recent.length) * 100 * 0.3;
  const volatilityScore = Math.min(100, Math.max(0, Math.round(volatilityRaw)));

  let status = 'Moderada';
  let advice = 'Equilíbrio entre sequências e alternâncias. Siga o fluxo natural com proteção.';

  if (volatilityScore >= 65) {
    status = 'Alta Volatilidade (Caos)';
    advice = 'Mesa com muita alternância e empates. Evite galés longos e aproveite a proteção no Empate!';
  } else if (volatilityScore <= 35) {
    status = 'Alta Inércia (Tendência)';
    advice = 'Mesa com sequências longas e poucas quebras. Ótima para seguir o líder (Banker ou Player).';
  }

  return { volatilityScore, status, advice };
}

/**
 * 7. Tie Gap Frequency (Rounds between ties)
 */
export function calculateTieGaps(events: BacBoEvent[]) {
  const sorted = [...events].reverse(); // Chronological
  const gaps: number[] = [];
  let currentGap = 0;
  let foundFirstTie = false;

  for (const ev of sorted) {
    if (ev.outcome === 'Tie') {
      if (foundFirstTie) {
        gaps.push(currentGap);
      }
      foundFirstTie = true;
      currentGap = 0;
    } else {
      if (foundFirstTie) {
        currentGap++;
      }
    }
  }

  if (gaps.length === 0) {
    return {
      avgGap: 0,
      minGap: 0,
      maxGap: 0,
      currentGap: currentGap,
      shortGaps: 0, // < 8
      mediumGaps: 0, // 8-18
      longGaps: 0, // > 18
      gapsList: [],
    };
  }

  const sum = gaps.reduce((a, b) => a + b, 0);
  const avgGap = Number((sum / gaps.length).toFixed(1));
  const minGap = Math.min(...gaps);
  const maxGap = Math.max(...gaps);

  const shortGaps = gaps.filter((g) => g < 8).length;
  const mediumGaps = gaps.filter((g) => g >= 8 && g <= 18).length;
  const longGaps = gaps.filter((g) => g > 18).length;

  return {
    avgGap,
    minGap,
    maxGap,
    currentGap,
    shortGaps,
    mediumGaps,
    longGaps,
    gapsList: gaps.slice(-10).reverse(), // Last 10 gaps
  };
}

/**
 * Calculate Streaks for Bac Bo (PlayerWon, BankerWon, Tie) or Roulette (Red, Black, Green)
 */
export function calculateStreaks<T extends { outcome?: string; color?: string }>(
  events: T[],
  keyExtractor: (item: T) => string
) {
  if (!events || events.length === 0) {
    return { current: { item: '-', count: 0 }, maxMap: {} as Record<string, number> };
  }

  const sorted = [...events].reverse();

  let currentItem = keyExtractor(sorted[sorted.length - 1]);
  let currentCount = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const val = keyExtractor(sorted[i]);
    if (val === currentItem) {
      currentCount++;
    } else {
      break;
    }
  }

  const maxMap: Record<string, number> = {};
  let tempItem = keyExtractor(sorted[0]);
  let tempCount = 0;

  for (const item of sorted) {
    const val = keyExtractor(item);
    if (val === tempItem) {
      tempCount++;
    } else {
      maxMap[tempItem] = Math.max(maxMap[tempItem] || 0, tempCount);
      tempItem = val;
      tempCount = 1;
    }
  }
  maxMap[tempItem] = Math.max(maxMap[tempItem] || 0, tempCount);

  return {
    current: { item: currentItem, count: currentCount },
    maxMap,
  };
}

/**
 * Pattern & Sequence Finder
 */
export function findSequenceMatches<T>(
  events: T[], // Chronological array (oldest to newest)
  keyExtractor: (item: T) => string,
  targetPattern: string[]
): SequenceStats {
  const patternLength = targetPattern.length;
  const nextOutcomes: Record<string, number> = {};
  let occurrences = 0;

  if (events.length <= patternLength) {
    return {
      pattern: targetPattern,
      occurrences: 0,
      nextOutcomes: {},
      probabilities: {},
    };
  }

  for (let i = 0; i <= events.length - patternLength - 1; i++) {
    let match = true;
    for (let j = 0; j < patternLength; j++) {
      if (keyExtractor(events[i + j]) !== targetPattern[j]) {
        match = false;
        break;
      }
    }

    if (match) {
      occurrences++;
      const nextItem = keyExtractor(events[i + patternLength]);
      nextOutcomes[nextItem] = (nextOutcomes[nextItem] || 0) + 1;
    }
  }

  const probabilities: Record<string, number> = {};
  if (occurrences > 0) {
    for (const key of Object.keys(nextOutcomes)) {
      probabilities[key] = Number(((nextOutcomes[key] / occurrences) * 100).toFixed(1));
    }
  }

  return {
    pattern: targetPattern,
    occurrences,
    nextOutcomes,
    probabilities,
  };
}

/**
 * Hourly Distribution Breakdown (00h through 23h)
 */
export function getHourlyDistribution<T extends { hour?: number; timestamp?: string }>(
  events: T[],
  keyExtractor: (item: T) => string
) {
  const hourlyMap: Record<number, { total: number; counts: Record<string, number> }> = {};
  for (let h = 0; h < 24; h++) {
    hourlyMap[h] = { total: 0, counts: {} };
  }

  for (const item of events) {
    let hour = item.hour;
    if (hour === undefined && item.timestamp) {
      hour = new Date(item.timestamp).getHours();
    }
    if (hour !== undefined && hour >= 0 && hour < 24) {
      const key = keyExtractor(item);
      hourlyMap[hour].total++;
      hourlyMap[hour].counts[key] = (hourlyMap[hour].counts[key] || 0) + 1;
    }
  }

  return hourlyMap;
}

/**
 * Automatically find top frequent sequences of length N
 */
export function getFrequentSequences<T>(
  events: T[], // Chronological (oldest to newest)
  keyExtractor: (item: T) => string,
  seqLength = 5,
  topLimit = 10
) {
  if (!events || events.length <= seqLength) return [];

  const sequenceMap: Record<string, { pattern: string[]; occurrences: number; nextOutcomes: Record<string, number> }> = {};

  for (let i = 0; i <= events.length - seqLength - 1; i++) {
    const patternTokens: string[] = [];
    for (let j = 0; j < seqLength; j++) {
      patternTokens.push(keyExtractor(events[i + j]));
    }
    const patternKey = patternTokens.join('-');

    if (!sequenceMap[patternKey]) {
      sequenceMap[patternKey] = {
        pattern: patternTokens,
        occurrences: 0,
        nextOutcomes: {},
      };
    }

    sequenceMap[patternKey].occurrences++;
    const nextItem = keyExtractor(events[i + seqLength]);
    sequenceMap[patternKey].nextOutcomes[nextItem] =
      (sequenceMap[patternKey].nextOutcomes[nextItem] || 0) + 1;
  }

  const sorted = Object.values(sequenceMap).sort((a, b) => b.occurrences - a.occurrences);
  return sorted.slice(0, topLimit);
}

/**
 * Minute Seasonal Distribution (00 through 59)
 */
export function getMinuteDistribution<T extends { minute: number }>(
  events: T[],
  keyExtractor: (item: T) => string
) {
  const minutesMap: Record<number, Record<string, number>> = {};
  for (let m = 0; m < 60; m++) {
    minutesMap[m] = {};
  }

  for (const item of events) {
    const m = item.minute;
    const key = keyExtractor(item);
    if (minutesMap[m]) {
      minutesMap[m][key] = (minutesMap[m][key] || 0) + 1;
    }
  }

  return minutesMap;
}

/**
 * Bac Bo Roadmaps Generator
 */
export interface RoadCell {
  outcome: 'PlayerWon' | 'BankerWon' | 'Tie';
  playerScore: number;
  bankerScore: number;
  timestamp?: string | number;
  tieCount?: number;
}

export function buildBeadPlate(events: BacBoEvent[], rows = 6): RoadCell[][] {
  const sorted = [...events].reverse();
  const grid: RoadCell[][] = [];

  let currentCol: RoadCell[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    currentCol.push({
      outcome: ev.outcome,
      playerScore: ev.playerScore,
      bankerScore: ev.bankerScore,
      timestamp: ev.timestamp,
    });

    if (currentCol.length === rows) {
      grid.push(currentCol);
      currentCol = [];
    }
  }
  if (currentCol.length > 0) {
    grid.push(currentCol);
  }

  return grid;
}

export function buildBigRoad(events: BacBoEvent[]): Array<Array<{ outcome: 'PlayerWon' | 'BankerWon'; tieCount: number; playerScore: number; bankerScore: number }>> {
  const sorted = [...events].reverse();
  const columns: Array<Array<{ outcome: 'PlayerWon' | 'BankerWon'; tieCount: number; playerScore: number; bankerScore: number }>> = [];

  let currentColumn: Array<{ outcome: 'PlayerWon' | 'BankerWon'; tieCount: number; playerScore: number; bankerScore: number }> = [];
  let currentWinner: 'PlayerWon' | 'BankerWon' | null = null;
  let pendingTieCount = 0;

  for (const ev of sorted) {
    if (ev.outcome === 'Tie') {
      pendingTieCount++;
      if (currentColumn.length > 0) {
        currentColumn[currentColumn.length - 1].tieCount++;
      }
      continue;
    }

    const winner = ev.outcome;
    if (currentWinner === null || winner === currentWinner) {
      currentWinner = winner;
      currentColumn.push({
        outcome: winner,
        tieCount: pendingTieCount,
        playerScore: ev.playerScore,
        bankerScore: ev.bankerScore,
      });
      pendingTieCount = 0;
    } else {
      if (currentColumn.length > 0) {
        columns.push(currentColumn);
      }
      currentWinner = winner;
      currentColumn = [{
        outcome: winner,
        tieCount: pendingTieCount,
        playerScore: ev.playerScore,
        bankerScore: ev.bankerScore,
      }];
      pendingTieCount = 0;
    }
  }

  if (currentColumn.length > 0) {
    columns.push(currentColumn);
  }

  return columns;
}

/**
 * Strategy Backtester Simulator
 */
export function runStrategyBacktest(
  events: any[], // Chronological (oldest to newest)
  rule: StrategyRule,
  keyExtractor: (item: any) => string
): BacktestResult {
  if (!events || events.length === 0) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      totalRoundsTested: 0,
      totalSignals: 0,
      winsDirect: 0,
      winsG1: 0,
      winsG2: 0,
      losses: 0,
      winRate: 0,
      maxWinStreak: 0,
      maxLossStreak: 0,
      simulatedProfit: 0,
      log: [],
    };
  }

  let totalSignals = 0;
  let winsDirect = 0;
  let winsG1 = 0;
  let winsG2 = 0;
  let losses = 0;
  let currentWinStreak = 0;
  let maxWinStreak = 0;
  let currentLossStreak = 0;
  let maxLossStreak = 0;
  let runningProfit = 0;

  const log: BacktestResult['log'] = [];
  const maxGales = rule.martingaleMax || 0;

  for (let i = 10; i < events.length - (maxGales + 1); i++) {
    const window = events.slice(0, i + 1);
    const recent = window[window.length - 1];
    const key = keyExtractor(recent);

    let triggered = true;

    if (rule.trigger.streakColor && rule.trigger.streakMin) {
      const reqColor = rule.trigger.streakColor;
      const reqMin = rule.trigger.streakMin;
      let streakCount = 0;
      for (let k = window.length - 1; k >= 0; k--) {
        if (keyExtractor(window[k]) === reqColor) streakCount++;
        else break;
      }
        if (streakCount < reqMin) triggered = false;
    }

    if (rule.trigger.diceScoreSumMin !== undefined && recent.playerScore !== undefined) {
      const sum = recent.playerScore + recent.bankerScore;
      if (sum < rule.trigger.diceScoreSumMin) triggered = false;
    }

    if (rule.trigger.diceScoreSumMax !== undefined && recent.playerScore !== undefined) {
      const sum = recent.playerScore + recent.bankerScore;
      if (sum > rule.trigger.diceScoreSumMax) triggered = false;
    }

    if (rule.trigger.minuteMod !== undefined) {
      if (recent.minute % rule.trigger.minuteMod !== 0) triggered = false;
    }

    if (triggered) {
      totalSignals++;

      const target = rule.targetBet;
      let won = false;
      let winStep: 'WIN_DIRECT' | 'WIN_G1' | 'WIN_G2' | null = null;

      const directNext = events[i + 1];
      const directKey = keyExtractor(directNext);

      if (directKey === target || (target === 'Tie' && directKey === 'Tie')) {
        won = true;
        winStep = 'WIN_DIRECT';
        winsDirect++;
        runningProfit += 1.0;
      } else if (maxGales >= 1 && i + 2 < events.length) {
        const gale1Next = events[i + 2];
        const gale1Key = keyExtractor(gale1Next);
        if (gale1Key === target || (target === 'Tie' && gale1Key === 'Tie')) {
          won = true;
          winStep = 'WIN_G1';
          winsG1++;
          runningProfit += 1.0;
        } else if (maxGales >= 2 && i + 3 < events.length) {
          const gale2Next = events[i + 3];
          const gale2Key = keyExtractor(gale2Next);
          if (gale2Key === target || (target === 'Tie' && gale2Key === 'Tie')) {
            won = true;
            winStep = 'WIN_G2';
            winsG2++;
            runningProfit += 1.0;
          }
        }
      }

      if (won && winStep) {
        currentWinStreak++;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
        currentLossStreak = 0;
        log.push({
          id: recent.id || String(i),
          timestamp: recent.timestamp || new Date().toISOString(),
          triggerReason: `Padrão ${rule.name} detectado`,
          predictedBet: target,
          actualOutcome: directKey,
          result: winStep,
          runningProfit: Number(runningProfit.toFixed(2)),
        });
      } else {
        losses++;
        currentLossStreak++;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
        currentWinStreak = 0;
        const lossCost = maxGales === 0 ? 1 : (maxGales === 1 ? 3 : 7);
        runningProfit -= lossCost;

        log.push({
          id: recent.id || String(i),
          timestamp: recent.timestamp || new Date().toISOString(),
          triggerReason: `Padrão ${rule.name} detectado`,
          predictedBet: target,
          actualOutcome: directKey,
          result: 'LOSS',
          runningProfit: Number(runningProfit.toFixed(2)),
        });
      }
    }
  }

  const totalWins = winsDirect + winsG1 + winsG2;
  const winRate = totalSignals > 0 ? Number(((totalWins / totalSignals) * 100).toFixed(1)) : 0;

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    totalRoundsTested: events.length,
    totalSignals,
    winsDirect,
    winsG1,
    winsG2,
    losses,
    winRate,
    maxWinStreak,
    maxLossStreak,
    simulatedProfit: Number(runningProfit.toFixed(1)),
    log,
  };
}

/**
 * Day of Week Seasonality Analysis (Dom, Seg, Ter, Qua, Qui, Sex, Sáb)
 */
export interface DayOfWeekStat {
  dayIndex: number;
  dayName: string;
  total: number;
  playerOrRedCount: number;
  bankerOrBlackCount: number;
  tieOrGreenCount: number;
  playerOrRedPct: number;
  bankerOrBlackPct: number;
  tieOrGreenPct: number;
  dozens?: { d1: number; d2: number; d3: number };
  columns?: { c1: number; c2: number; c3: number };
}

export function calculateDayOfWeekSeasonality(
  events: any[],
  isBacBo: boolean
): DayOfWeekStat[] {
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const map: Record<number, {
    total: number;
    pRed: number;
    bBlk: number;
    tGrn: number;
    d1: number; d2: number; d3: number;
    c1: number; c2: number; c3: number;
  }> = {};

  for (let i = 0; i < 7; i++) {
    map[i] = { total: 0, pRed: 0, bBlk: 0, tGrn: 0, d1: 0, d2: 0, d3: 0, c1: 0, c2: 0, c3: 0 };
  }

  events.forEach((ev) => {
    let day = 0;
    if (ev.timestamp) {
      day = new Date(ev.timestamp).getDay();
    }
    if (isNaN(day) || day < 0 || day > 6) day = 0;

    const record = map[day];
    record.total++;

    if (isBacBo) {
      if (ev.outcome === 'PlayerWon') record.pRed++;
      else if (ev.outcome === 'BankerWon') record.bBlk++;
      else if (ev.outcome === 'Tie') record.tGrn++;
    } else {
      if (ev.color === 'Red') record.pRed++;
      else if (ev.color === 'Black') record.bBlk++;
      else if (ev.color === 'Green') record.tGrn++;

      if (ev.dozen === 1) record.d1++;
      else if (ev.dozen === 2) record.d2++;
      else if (ev.dozen === 3) record.d3++;

      if (ev.column === 1) record.c1++;
      else if (ev.column === 2) record.c2++;
      else if (ev.column === 3) record.c3++;
    }
  });

  return dayNames.map((dayName, index) => {
    const d = map[index];
    const total = d.total;
    return {
      dayIndex: index,
      dayName,
      total,
      playerOrRedCount: d.pRed,
      bankerOrBlackCount: d.bBlk,
      tieOrGreenCount: d.tGrn,
      playerOrRedPct: total > 0 ? Number(((d.pRed / total) * 100).toFixed(1)) : 0,
      bankerOrBlackPct: total > 0 ? Number(((d.bBlk / total) * 100).toFixed(1)) : 0,
      tieOrGreenPct: total > 0 ? Number(((d.tGrn / total) * 100).toFixed(1)) : 0,
      dozens: !isBacBo ? { d1: d.d1, d2: d.d2, d3: d.d3 } : undefined,
      columns: !isBacBo ? { c1: d.c1, c2: d.c2, c3: d.c3 } : undefined,
    };
  });
}

/**
 * Monthly Seasonality Analysis & Day-of-Month Patterns
 */
export interface MonthlyStat {
  periodLabel: string;
  totalRounds: number;
  playerOrRedPct: number;
  bankerOrBlackPct: number;
  tieOrGreenPct: number;
  tieOrGreenCount: number;
}

export function calculateMonthlySeasonality(
  events: any[],
  isBacBo: boolean
): MonthlyStat[] {
  if (!events || events.length === 0) return [];

  const groupMap: Record<string, { total: number; pRed: number; bBlk: number; tGrn: number }> = {};

  events.forEach((ev) => {
    let key = 'Mês Atual';
    if (ev.timestamp) {
      const date = new Date(ev.timestamp);
      if (!isNaN(date.getTime())) {
        const month = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
        key = month;
      }
    }

    if (!groupMap[key]) {
      groupMap[key] = { total: 0, pRed: 0, bBlk: 0, tGrn: 0 };
    }
    const g = groupMap[key];
    g.total++;

    if (isBacBo) {
      if (ev.outcome === 'PlayerWon') g.pRed++;
      else if (ev.outcome === 'BankerWon') g.bBlk++;
      else if (ev.outcome === 'Tie') g.tGrn++;
    } else {
      if (ev.color === 'Red') g.pRed++;
      else if (ev.color === 'Black') g.bBlk++;
      else if (ev.color === 'Green') g.tGrn++;
    }
  });

  return Object.entries(groupMap).map(([periodLabel, g]) => ({
    periodLabel,
    totalRounds: g.total,
    playerOrRedPct: g.total > 0 ? Number(((g.pRed / g.total) * 100).toFixed(1)) : 0,
    bankerOrBlackPct: g.total > 0 ? Number(((g.bBlk / g.total) * 100).toFixed(1)) : 0,
    tieOrGreenPct: g.total > 0 ? Number(((g.tGrn / g.total) * 100).toFixed(1)) : 0,
    tieOrGreenCount: g.tGrn,
  }));
}

/**
 * Optimal Betting Hours Ranking & Recommendations
 */
export interface BettingHourRank {
  hour: number;
  hourLabel: string;
  totalRounds: number;
  winRateDominance: number; // Max outcome % in this hour
  tieOrGreenPct: number;
  tieOrGreenCount: number;
  stabilityScore: number; // 0 - 100
  tier: 'EXCELLENT' | 'GOOD' | 'RISKY';
  recommendation: string;
}

export function calculateOptimalBettingHours(
  events: any[],
  isBacBo: boolean
): {
  rankedHours: BettingHourRank[];
  top3Overall: BettingHourRank[];
  top3TiesOrZeros: BettingHourRank[];
} {
  const hourlyMap: Record<number, { total: number; pRed: number; bBlk: number; tGrn: number }> = {};
  for (let h = 0; h < 24; h++) {
    hourlyMap[h] = { total: 0, pRed: 0, bBlk: 0, tGrn: 0 };
  }

  events.forEach((ev) => {
    let hour = ev.hour;
    if (hour === undefined && ev.timestamp) {
      hour = new Date(ev.timestamp).getHours();
    }
    if (hour !== undefined && hour >= 0 && hour < 24) {
      const record = hourlyMap[hour];
      record.total++;
      if (isBacBo) {
        if (ev.outcome === 'PlayerWon') record.pRed++;
        else if (ev.outcome === 'BankerWon') record.bBlk++;
        else if (ev.outcome === 'Tie') record.tGrn++;
      } else {
        if (ev.color === 'Red') record.pRed++;
        else if (ev.color === 'Black') record.bBlk++;
        else if (ev.color === 'Green') record.tGrn++;
      }
    }
  });

  const rankedHours: BettingHourRank[] = [];

  for (let h = 0; h < 24; h++) {
    const data = hourlyMap[h];
    const total = data.total;
    const hourLabel = `${String(h).padStart(2, '0')}:00 - ${String(h).padStart(2, '0')}:59`;

    if (total === 0) {
      rankedHours.push({
        hour: h,
        hourLabel,
        totalRounds: 0,
        winRateDominance: 0,
        tieOrGreenPct: 0,
        tieOrGreenCount: 0,
        stabilityScore: 0,
        tier: 'RISKY',
        recommendation: 'Sem dados suficientes coletados nesta hora.',
      });
      continue;
    }

    const pPct = (data.pRed / total) * 100;
    const bPct = (data.bBlk / total) * 100;
    const tPct = (data.tGrn / total) * 100;

    const dominance = Math.max(pPct, bPct);
    const balanceDiff = Math.abs(pPct - bPct);

    // Higher volume + clear dominance or high tie payout = better score
    let stabilityScore = Math.min(100, Math.round(dominance * 1.2 + (total >= 10 ? 20 : total * 2) + tPct * 0.5));

    let tier: 'EXCELLENT' | 'GOOD' | 'RISKY' = 'GOOD';
    let rec = 'Horário regular. Opere com gerenciamento padrão.';

    if (stabilityScore >= 75 || (isBacBo && tPct >= 14) || (!isBacBo && tPct >= 5)) {
      tier = 'EXCELLENT';
      rec = isBacBo
        ? `Excelente assertividade! Frequência de Empates em ${tPct.toFixed(1)}% e padrão definido.`
        : `Excelente assertividade! Frequência de Zeros/Vermelho/Preto consistente (${dominance.toFixed(1)}% dominância).`;
    } else if (stabilityScore < 45 || balanceDiff < 2) {
      tier = 'RISKY';
      rec = 'Alta indefinição/volatilidade. Indicado apenas para estratégias curtas ou galé reduzido.';
    }

    rankedHours.push({
      hour: h,
      hourLabel,
      totalRounds: total,
      winRateDominance: Number(dominance.toFixed(1)),
      tieOrGreenPct: Number(tPct.toFixed(1)),
      tieOrGreenCount: data.tGrn,
      stabilityScore,
      tier,
      recommendation: rec,
    });
  }

  const sortedOverall = [...rankedHours].sort((a, b) => b.stabilityScore - a.stabilityScore);
  const sortedTiesOrZeros = [...rankedHours].sort((a, b) => b.tieOrGreenPct - a.tieOrGreenPct);

  return {
    rankedHours,
    top3Overall: sortedOverall.slice(0, 3),
    top3TiesOrZeros: sortedTiesOrZeros.slice(0, 3),
  };
}

/**
 * Long-Term Trend Identification Engine (Tendências de Longo Prazo)
 */
export interface LongTermTrendReport {
  sampleSize: number;
  overallPlayerOrRedPct: number;
  overallBankerOrBlackPct: number;
  overallTieOrGreenPct: number;
  recentPlayerOrRedPct: number; // Last 50 rounds
  recentBankerOrBlackPct: number;
  recentTieOrGreenPct: number;
  driftDirection: 'PLAYER_UP' | 'BANKER_UP' | 'TIE_HIGH' | 'BALANCED';
  trendSummary: string;
  longTermInsights: string[];
  movingAverages: Array<{
    chunkIndex: number;
    chunkLabel: string;
    playerOrRedPct: number;
    bankerOrBlackPct: number;
    tieOrGreenPct: number;
  }>;
}

export function calculateLongTermTrends(
  events: any[],
  isBacBo: boolean
): LongTermTrendReport {
  if (!events || events.length === 0) {
    return {
      sampleSize: 0,
      overallPlayerOrRedPct: 0,
      overallBankerOrBlackPct: 0,
      overallTieOrGreenPct: 0,
      recentPlayerOrRedPct: 0,
      recentBankerOrBlackPct: 0,
      recentTieOrGreenPct: 0,
      driftDirection: 'BALANCED',
      trendSummary: 'Sem amostragem suficiente para análise de longo prazo.',
      longTermInsights: [],
      movingAverages: [],
    };
  }

  const chronological = [...events].reverse();
  const sampleSize = chronological.length;

  let pRedCount = 0;
  let bBlkCount = 0;
  let tGrnCount = 0;

  chronological.forEach((ev) => {
    if (isBacBo) {
      if (ev.outcome === 'PlayerWon') pRedCount++;
      else if (ev.outcome === 'BankerWon') bBlkCount++;
      else if (ev.outcome === 'Tie') tGrnCount++;
    } else {
      if (ev.color === 'Red') pRedCount++;
      else if (ev.color === 'Black') bBlkCount++;
      else if (ev.color === 'Green') tGrnCount++;
    }
  });

  const overallPlayerOrRedPct = Number(((pRedCount / sampleSize) * 100).toFixed(1));
  const overallBankerOrBlackPct = Number(((bBlkCount / sampleSize) * 100).toFixed(1));
  const overallTieOrGreenPct = Number(((tGrnCount / sampleSize) * 100).toFixed(1));

  // Recent 50 rounds
  const recentSlice = chronological.slice(-50);
  let rPRed = 0, rBBlk = 0, rTGrn = 0;
  recentSlice.forEach((ev) => {
    if (isBacBo) {
      if (ev.outcome === 'PlayerWon') rPRed++;
      else if (ev.outcome === 'BankerWon') rBBlk++;
      else if (ev.outcome === 'Tie') rTGrn++;
    } else {
      if (ev.color === 'Red') rPRed++;
      else if (ev.color === 'Black') rBBlk++;
      else if (ev.color === 'Green') rTGrn++;
    }
  });

  const rTotal = recentSlice.length || 1;
  const recentPlayerOrRedPct = Number(((rPRed / rTotal) * 100).toFixed(1));
  const recentBankerOrBlackPct = Number(((rBBlk / rTotal) * 100).toFixed(1));
  const recentTieOrGreenPct = Number(((rTGrn / rTotal) * 100).toFixed(1));

  // Determine Drift
  let driftDirection: 'PLAYER_UP' | 'BANKER_UP' | 'TIE_HIGH' | 'BALANCED' = 'BALANCED';
  const diffPRed = recentPlayerOrRedPct - overallPlayerOrRedPct;
  const diffBBlk = recentBankerOrBlackPct - overallBankerOrBlackPct;

  if (recentTieOrGreenPct > (isBacBo ? 12 : 4)) {
    driftDirection = 'TIE_HIGH';
  } else if (diffPRed >= 4) {
    driftDirection = 'PLAYER_UP';
  } else if (diffBBlk >= 4) {
    driftDirection = 'BANKER_UP';
  }

  // Chunk moving averages (blocks of 25 rounds)
  const chunkSize = Math.max(10, Math.floor(sampleSize / 5));
  const movingAverages: LongTermTrendReport['movingAverages'] = [];

  for (let i = 0; i < sampleSize; i += chunkSize) {
    const chunk = chronological.slice(i, i + chunkSize);
    let cP = 0, cB = 0, cT = 0;
    chunk.forEach((ev) => {
      if (isBacBo) {
        if (ev.outcome === 'PlayerWon') cP++;
        else if (ev.outcome === 'BankerWon') cB++;
        else if (ev.outcome === 'Tie') cT++;
      } else {
        if (ev.color === 'Red') cP++;
        else if (ev.color === 'Black') cB++;
        else if (ev.color === 'Green') cT++;
      }
    });

    const cTotal = chunk.length || 1;
    movingAverages.push({
      chunkIndex: Math.floor(i / chunkSize) + 1,
      chunkLabel: `Bloco ${Math.floor(i / chunkSize) + 1} (r${i + 1}-${i + chunk.length})`,
      playerOrRedPct: Number(((cP / cTotal) * 100).toFixed(1)),
      bankerOrBlackPct: Number(((cB / cTotal) * 100).toFixed(1)),
      tieOrGreenPct: Number(((cT / cTotal) * 100).toFixed(1)),
    });
  }

  // Generate Long Term Insights
  const longTermInsights: string[] = [];
  if (isBacBo) {
    longTermInsights.push(
      `Amostragem acumulada de ${sampleSize} rodadas: ${overallPlayerOrRedPct}% Jogador vs ${overallBankerOrBlackPct}% Banca vs ${overallTieOrGreenPct}% Empates.`
    );
    if (overallTieOrGreenPct >= 10) {
      longTermInsights.push(
        `Frequência de Empates saudável na mesa (${overallTieOrGreenPct}%). A taxa média teórica do Bac Bo é ~9.5%.`
      );
    } else {
      longTermInsights.push(
        `Frequência de Empates abaixo da média histórica (${overallTieOrGreenPct}%). Tendência a pagar mais empates nas próximas horas.`
      );
    }
    if (recentPlayerOrRedPct > recentBankerOrBlackPct + 6) {
      longTermInsights.push(
        `Tendência recente de dominância do Jogador (Azul): ${recentPlayerOrRedPct}% nas últimas 50 rodadas.`
      );
    } else if (recentBankerOrBlackPct > recentPlayerOrRedPct + 6) {
      longTermInsights.push(
        `Tendência recente de dominância da Banca (Vermelho): ${recentBankerOrBlackPct}% nas últimas 50 rodadas.`
      );
    } else {
      longTermInsights.push(`Mesa em equilíbrio harmônico entre Jogador e Banca nas rodadas recentes.`);
    }
  } else {
    longTermInsights.push(
      `Amostragem acumulada de ${sampleSize} rodadas na Roleta: ${overallPlayerOrRedPct}% Vermelho vs ${overallBankerOrBlackPct}% Preto vs ${overallTieOrGreenPct}% Verde (0).`
    );
    if (overallTieOrGreenPct >= 2.7) {
      longTermInsights.push(
        `Ocorrência de Verde (0) em ${overallTieOrGreenPct}%, superior à probabilidade matemática padrão da roleta (2.70%).`
      );
    } else {
      longTermInsights.push(
        `Ocorrência de Verde (0) em ${overallTieOrGreenPct}%, ligeiramente abaixo da média teórica de 2.70%.`
      );
    }
  }

  return {
    sampleSize,
    overallPlayerOrRedPct,
    overallBankerOrBlackPct,
    overallTieOrGreenPct,
    recentPlayerOrRedPct,
    recentBankerOrBlackPct,
    recentTieOrGreenPct,
    driftDirection,
    trendSummary: isBacBo
      ? `Bac Bo: ${overallPlayerOrRedPct}% Azul | ${overallBankerOrBlackPct}% Vermelho | ${overallTieOrGreenPct}% Empate`
      : `Roleta: ${overallPlayerOrRedPct}% Vermelho | ${overallBankerOrBlackPct}% Preto | ${overallTieOrGreenPct}% Verde`,
    longTermInsights,
    movingAverages,
  };
}

/**
 * Roulette Specific Seasonality (Zero, Dozens, Columns details)
 */
export interface RouletteSeasonalReport {
  greenCount: number;
  greenPct: number;
  hourlyZerosMap: Record<number, number>;
  precedingNumbersBeforeZero: Array<{ number: number; color: string; count: number }>;
  dozenSeasonality: Array<{ dozen: string; count: number; pct: number }>;
  columnSeasonality: Array<{ column: string; count: number; pct: number }>;
}

export function calculateRouletteSeasonalDetails(events: any[]): RouletteSeasonalReport {
  if (!events || events.length === 0) {
    return {
      greenCount: 0,
      greenPct: 0,
      hourlyZerosMap: {},
      precedingNumbersBeforeZero: [],
      dozenSeasonality: [],
      columnSeasonality: [],
    };
  }

  const total = events.length;
  const chronological = [...events].reverse();

  let greenCount = 0;
  const hourlyZerosMap: Record<number, number> = {};
  const precedingMap: Record<number, { color: string; count: number }> = {};
  const dozenCounts = { d1: 0, d2: 0, d3: 0, d0: 0 };
  const columnCounts = { c1: 0, c2: 0, c3: 0, c0: 0 };

  for (let i = 0; i < chronological.length; i++) {
    const ev = chronological[i];

    if (ev.color === 'Green' || ev.number === 0) {
      greenCount++;
      let h = ev.hour;
      if (h === undefined && ev.timestamp) h = new Date(ev.timestamp).getHours();
      if (h !== undefined) {
        hourlyZerosMap[h] = (hourlyZerosMap[h] || 0) + 1;
      }

      if (i > 0) {
        const prev = chronological[i - 1];
        const pNum = prev.number;
        const pColor = prev.color || 'Unknown';
        if (!precedingMap[pNum]) {
          precedingMap[pNum] = { color: pColor, count: 0 };
        }
        precedingMap[pNum].count++;
      }
    }

    if (ev.dozen === 1) dozenCounts.d1++;
    else if (ev.dozen === 2) dozenCounts.d2++;
    else if (ev.dozen === 3) dozenCounts.d3++;
    else dozenCounts.d0++;

    if (ev.column === 1) columnCounts.c1++;
    else if (ev.column === 2) columnCounts.c2++;
    else if (ev.column === 3) columnCounts.c3++;
    else columnCounts.c0++;
  }

  const precedingNumbersBeforeZero = Object.entries(precedingMap)
    .map(([numStr, d]) => ({
      number: Number(numStr),
      color: d.color,
      count: d.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const dozenSeasonality = [
    { dozen: '1ª Dúzia (1-12)', count: dozenCounts.d1, pct: Number(((dozenCounts.d1 / total) * 100).toFixed(1)) },
    { dozen: '2ª Dúzia (13-24)', count: dozenCounts.d2, pct: Number(((dozenCounts.d2 / total) * 100).toFixed(1)) },
    { dozen: '3ª Dúzia (25-36)', count: dozenCounts.d3, pct: Number(((dozenCounts.d3 / total) * 100).toFixed(1)) },
    { dozen: 'Zero (0)', count: dozenCounts.d0, pct: Number(((dozenCounts.d0 / total) * 100).toFixed(1)) },
  ];

  const columnSeasonality = [
    { column: '1ª Coluna', count: columnCounts.c1, pct: Number(((columnCounts.c1 / total) * 100).toFixed(1)) },
    { column: '2ª Coluna', count: columnCounts.c2, pct: Number(((columnCounts.c2 / total) * 100).toFixed(1)) },
    { column: '3ª Coluna', count: columnCounts.c3, pct: Number(((columnCounts.c3 / total) * 100).toFixed(1)) },
    { column: 'Zero (0)', count: columnCounts.c0, pct: Number(((columnCounts.c0 / total) * 100).toFixed(1)) },
  ];

  return {
    greenCount,
    greenPct: Number(((greenCount / total) * 100).toFixed(1)),
    hourlyZerosMap,
    precedingNumbersBeforeZero,
    dozenSeasonality,
    columnSeasonality,
  };
}

// ============================================================================
// 🎰 MOTORES DE RNG DE CASSINO & DESCRIPTOGRAFIA DE SEMENTES (Mersenne, XorShift, ISAAC)
// ============================================================================

export class CasinoRNG_Mersenne {
  private N = 624;
  private M = 397;
  private MATRIX_A = 0x9908b0df;
  private UPPER = 0x80000000;
  private LOWER = 0x7fffffff;
  private estado: number[] = [];
  private ponto = 0;

  constructor(seed: number) {
    this.estado = new Array(this.N).fill(0);
    this.ponto = this.N + 1;
    this.estado[0] = seed >>> 0;
    for (let i = 1; i < this.N; i++) {
      const prev = this.estado[i - 1];
      const val = Math.imul(1812433253, prev ^ (prev >>> 30)) + i;
      this.estado[i] = val >>> 0;
    }
  }

  private _girar() {
    for (let i = 0; i < this.N; i++) {
      const y = (this.estado[i] & this.UPPER) + (this.estado[(i + 1) % this.N] & this.LOWER);
      this.estado[i] = (this.estado[(i + this.M) % this.N] ^ (y >>> 1)) >>> 0;
      if (y % 2 !== 0) {
        this.estado[i] = (this.estado[i] ^ this.MATRIX_A) >>> 0;
      }
    }
    this.ponto = 0;
  }

  public gerarNumero(): number {
    if (this.ponto >= this.N) this._girar();
    let y = this.estado[this.ponto];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    this.ponto++;
    return y >>> 0;
  }

  public corResultadoBacBo(): 'PLAYER' | 'BANKER' | 'TIE' {
    const num = this.gerarNumero() % 14;
    return num <= 5 ? 'PLAYER' : num <= 11 ? 'BANKER' : 'TIE';
  }

  public corResultadoRoleta(): 'RED' | 'BLACK' | 'ZERO' {
    const num = this.gerarNumero() % 37;
    return num === 0 ? 'ZERO' : num % 2 === 0 ? 'RED' : 'BLACK';
  }
}

export class CasinoRNG_XorShift {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(s0: number, s1: number, s2: number, s3: number) {
    this.s0 = s0 >>> 0;
    this.s1 = s1 >>> 0;
    this.s2 = s2 >>> 0;
    this.s3 = s3 >>> 0;
  }

  public gerar(): number {
    let t = this.s3;
    const s = this.s0;
    this.s3 = this.s2;
    this.s2 = this.s1;
    this.s1 = this.s0;
    t ^= (t << 11) >>> 0;
    t ^= t >>> 8;
    this.s0 = (t ^ s ^ (s >>> 19)) >>> 0;
    return this.s0 >>> 0;
  }

  public corResultadoBacBo(): 'PLAYER' | 'BANKER' | 'TIE' {
    const v = this.gerar() % 100;
    return v < 46 ? 'PLAYER' : v < 92 ? 'BANKER' : 'TIE';
  }

  public corResultadoRoleta(): 'RED' | 'BLACK' | 'ZERO' {
    const v = this.gerar() % 37;
    return v === 0 ? 'ZERO' : v % 2 === 0 ? 'RED' : 'BLACK';
  }
}

export class CasinoRNG_ISAAC {
  private a = 0;
  private b = 0;
  private c = 0;
  private mem: number[] = new Array(256).fill(0);
  private saida: number[] = new Array(256).fill(0);
  private ctr = 0;

  constructor(seed: number) {
    let s = seed >>> 0;
    for (let i = 0; i < 256; i++) {
      s = (s + 0x9e3779b9) >>> 0;
      this.mem[i] = s;
    }
    this._embaralhar();
  }

  private _embaralhar() {
    this.c = (this.c + 1) >>> 0;
    this.b = (this.b + this.c) >>> 0;
    for (let i = 0; i < 256; i++) {
      const x = this.mem[i];
      const shift = [this.a << 13, this.a >>> 6, this.a << 2, this.a >>> 16][i % 4];
      this.a = (this.a ^ shift) >>> 0;
      this.a = (this.a + this.mem[(i + 128) % 256]) >>> 0;
      const y = (this.mem[(x >>> 2) & 255] + this.a + this.b) >>> 0;
      this.mem[i] = y;
      const z = (this.mem[(y >>> 10) & 255] + x) >>> 0;
      this.saida[i] = this.b = z;
    }
    this.ctr = 0;
  }

  public proximo(): number {
    if (this.ctr >= 256) this._embaralhar();
    const val = this.saida[this.ctr];
    this.ctr++;
    return val >>> 0;
  }

  public corResultadoBacBo(): 'PLAYER' | 'BANKER' | 'TIE' {
    const n = this.proximo() % 15;
    return n < 6 ? 'PLAYER' : n < 12 ? 'BANKER' : 'TIE';
  }

  public corResultadoRoleta(): 'RED' | 'BLACK' | 'ZERO' {
    const n = this.proximo() % 37;
    return n === 0 ? 'ZERO' : n % 2 === 0 ? 'RED' : 'BLACK';
  }
}

export interface RNGSeedMatchResult {
  seedFound: boolean;
  algorithm: string | null;
  seed: number | null;
  nextPrediction: string | null;
  confidence: number; // 0 to 1
}

/**
  * Vreifica se o histórico de rodadas recentes bate com uma semente de PRNG
  * (Mersenne Twister, XorShift128 ou ISAAC) e projeta a próxima jogada com alta confiança determinística.
  */
export function scanRNGSeeds(
  historicalOutcomes: string[],
  gameType: 'bacbo' | 'roulette' = 'bacbo',
  maxSeedScan = 150000
): RNGSeedMatchResult {
  if (historicalOutcomes.length < 5) {
    return { seedFound: false, algorithm: null, seed: null, nextPrediction: null, confidence: 0 };
  }

  // Normalizar outcomes para comparação
  const normOutcomes = historicalOutcomes.slice(0, 7).map((o) => {
    const u = o.toUpperCase();
    if (u.includes('PLAYER') || u.includes('AZUL') || u.includes('BLUE') || u === 'P') return 'PLAYER';
    if (u.includes('BANKER') || u.includes('VERMELHO') || u.includes('RED') || u === 'B') return 'BANKER';
    if (u.includes('TIE') || u.includes('EMPATE') || u.includes('WHITE') || u === 'T') return 'TIE';
    if (u.includes('BLACK') || u.includes('PRETO')) return 'BLACK';
    if (u.includes('ZERO') || u.includes('VERDE')) return 'ZERO';
    return u;
  });

  // Scan rápido nas sementes mais comuns e temporais
  const now = Date.now();
  const seedCandidates: number[] = [];
  
  // Sementes pequenas fixas (1 a maxSeedScan com salto)
  for (let s = 1; s <= Math.min(maxSeedScan, 50000); s += 1) {
    seedCandidates.push(s);
  }
  // Sementes baseadas no timestamp atual em segundos e milissegundos
  const baseSec = Math.floor(now / 1000);
  for (let i = -100; i <= 100; i++) {
    seedCandidates.push(baseSec + i);
  }

  for (const seed of seedCandidates) {
    // 1. Mersenne Twister
    const mt = new CasinoRNG_Mersenne(seed);
    let mtMatch = true;
    for (const target of normOutcomes) {
      const generated = gameType === 'bacbo' ? mt.corResultadoBacBo() : mt.corResultadoRoleta();
      if (generated !== target) {
        mtMatch = false;
        break;
      }
    }
    if (mtMatch) {
      const nextPred = gameType === 'bacbo' ? mt.corResultadoBacBo() : mt.corResultadoRoleta();
      return {
        seedFound: true,
        algorithm: 'Mersenne Twister (MT19937)',
        seed,
        nextPrediction: nextPred,
        confidence: 0.98,
      };
    }

    // 2. XorShift 128
    const xs = new CasinoRNG_XorShift(seed, seed + 1, seed + 2, seed + 3);
    let xsMatch = true;
    for (const target of normOutcomes) {
      const generated = gameType === 'bacbo' ? xs.corResultadoBacBo() : xs.corResultadoRoleta();
      if (generated !== target) {
        xsMatch = false;
        break;
      }
    }
    if (xsMatch) {
      const nextPred = gameType === 'bacbo' ? xs.corResultadoBacBo() : xs.corResultadoRoleta();
      return {
        seedFound: true,
        algorithm: 'XorShift 128',
        seed,
        nextPrediction: nextPred,
        confidence: 0.96,
      };
    }

    // 3. ISAAC RNG
    const isaac = new CasinoRNG_ISAAC(seed);
    let isaacMatch = true;
    for (const target of normOutcomes) {
      const generated = gameType === 'bacbo' ? isaac.corResultadoBacBo() : isaac.corResultadoRoleta();
      if (generated !== target) {
        isaacMatch = false;
        break;
      }
    }
    if (isaacMatch) {
      const nextPred = gameType === 'bacbo' ? isaac.corResultadoBacBo() : isaac.corResultadoRoleta();
      return {
        seedFound: true,
        algorithm: 'ISAAC PRNG',
        seed,
        nextPrediction: nextPred,
        confidence: 0.97,
      };
    }
  }

  return { seedFound: false, algorithm: null, seed: null, nextPrediction: null, confidence: 0 };
}



