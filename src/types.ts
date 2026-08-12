export type GameType = 'bacbo' | 'autoroulette' | 'immersiveroulette';

export interface RawEvolutionItem {
  id: string;
  data: {
    id: string;
    startedAt: string;
    settledAt: string;
    status: string;
    gameType: string;
    currency?: string;
    table: {
      id: string;
      name: string;
    };
    result: {
      // BacBo
      outcome?: 'PlayerWon' | 'BankerWon' | 'Tie' | {
        number: number;
        type: 'Odd' | 'Even' | 'Zero';
        color: 'Black' | 'Red' | 'Green';
      };
      multiplier?: number;
      playerDice?: { first: number; second: number; score: number };
      bankerDice?: { first: number; second: number; score: number };
    };
  };
  totalWinners?: number;
  totalAmount?: number;
}

export interface BacBoEvent {
  id: string;
  timestamp: string;
  minute: number;
  hour: number;
  outcome: 'PlayerWon' | 'BankerWon' | 'Tie';
  playerScore: number;
  bankerScore: number;
  playerDice: { first: number; second: number };
  bankerDice: { first: number; second: number };
  scoreDiff: number;
  multiplier?: number;
  totalWinners?: number;
  totalAmount?: number;
}

export interface RouletteEvent {
  id: string;
  timestamp: string;
  minute: number;
  hour: number;
  number: number;
  color: 'Red' | 'Black' | 'Green';
  type: 'Odd' | 'Even' | 'Zero';
  dozen: 1 | 2 | 3 | 0;
  column: 1 | 2 | 3 | 0;
  highLow: 'High' | 'Low' | 'Zero';
  sector: 'Voisins' | 'Tiers' | 'Orphelins' | 'Zero';
  totalWinners?: number;
  totalAmount?: number;
}

export interface SequenceStats {
  pattern: string[];
  occurrences: number;
  nextOutcomes: Record<string, number>;
  probabilities: Record<string, number>;
}

export interface StrategyRule {
  id: string;
  name: string;
  game: GameType | 'all_roulette';
  enabled: boolean;
  trigger: {
    streakColor?: string;
    streakMin?: number;
    diceScoreSumMin?: number;
    diceScoreSumMax?: number;
    lastOutcome?: string;
    minuteMod?: number;
    zeroIntervalMin?: number;
    customSequence?: string[];
  };
  targetBet: string;
  martingaleMax: number; // 0 = standard, 1 = Gale 1, 2 = Gale 2
  confidence: number;
}

export interface ActiveSignal {
  id: string;
  ruleId: string;
  ruleName: string;
  game: GameType;
  targetBet: string;
  triggeredAt: string;
  confidence: number;
  martingaleStep: number; // 0: Direct, 1: Gale 1, 2: Gale 2
  status: 'PENDING' | 'WIN' | 'LOSS';
  recommendedEntryTime: string;
  rationale: string;
}

export interface BacktestResult {
  ruleId: string;
  ruleName: string;
  totalRoundsTested: number;
  totalSignals: number;
  winsDirect: number;
  winsG1: number;
  winsG2: number;
  losses: number;
  winRate: number; // e.g. 84.5%
  maxWinStreak: number;
  maxLossStreak: number;
  simulatedProfit: number;
  log: Array<{
    id: string;
    timestamp: string;
    triggerReason: string;
    predictedBet: string;
    actualOutcome: string;
    result: 'WIN_DIRECT' | 'WIN_G1' | 'WIN_G2' | 'LOSS';
    runningProfit: number;
  }>;
}

export interface AIAnalysisReport {
  timestamp: string;
  game: GameType;
  provider?: string;
  model?: string;
  roundsAnalyzed: number;
  summary: string;
  biasDetected: string;
  microSeasonalTrends: string[];
  patternClusters: string[];
  riskLevel: 'Baixo' | 'Médio' | 'Alto';
  recommendedSignal: {
    action: string;
    tieProtection?: string;
    target: string;
    confidence: number;
    probabilities?: {
      playerOrRed?: number;
      bankerOrBlack?: number;
      tieOrZero?: number;
    };
    rationale: string;
  };
}
