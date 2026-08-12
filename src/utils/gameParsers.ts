import { BacBoEvent, RawEvolutionItem, RouletteEvent } from '../types';

export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
]);

export const BLACK_NUMBERS = new Set([
  2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35
]);

export const VOISINS_NUMBERS = new Set([
  22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25
]);

export const TIERS_NUMBERS = new Set([
  27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33
]);

export const ORPHELINS_NUMBERS = new Set([
  1, 20, 14, 31, 9, 17, 34, 6
]);

export const ZERO_GAME_NUMBERS = new Set([
  12, 35, 3, 26, 0, 32, 15
]);

export function parseBacBoEvent(raw: RawEvolutionItem): BacBoEvent | null {
  try {
    const data = raw.data;
    if (!data || !data.result || !data.result.outcome) return null;

    const id = raw.id || data.id;
    if (id && String(id).toLowerCase().includes('seed')) return null;

    const outcome = data.result.outcome as 'PlayerWon' | 'BankerWon' | 'Tie';
    const pDice = data.result.playerDice || { first: 0, second: 0, score: 0 };
    const bDice = data.result.bankerDice || { first: 0, second: 0, score: 0 };

    const dateStr = data.settledAt || data.startedAt || new Date().toISOString();
    const d = new Date(dateStr);

    return {
      id: raw.id || data.id,
      timestamp: dateStr,
      minute: d.getMinutes(),
      hour: d.getHours(),
      outcome,
      playerScore: pDice.score || (pDice.first + pDice.second),
      bankerScore: bDice.score || (bDice.first + bDice.second),
      playerDice: { first: pDice.first, second: pDice.second },
      bankerDice: { first: bDice.first, second: bDice.second },
      scoreDiff: Math.abs((pDice.score || 0) - (bDice.score || 0)),
      multiplier: data.result.multiplier,
      totalWinners: raw.totalWinners,
      totalAmount: raw.totalAmount,
    };
  } catch {
    return null;
  }
}

export function parseRouletteEvent(raw: RawEvolutionItem): RouletteEvent | null {
  try {
    const data = raw.data;
    if (!data || !data.result || !data.result.outcome) return null;

    const id = raw.id || data.id;
    if (id && String(id).toLowerCase().includes('seed')) return null;

    let num: number;
    let color: 'Red' | 'Black' | 'Green';
    let type: 'Odd' | 'Even' | 'Zero';

    if (typeof data.result.outcome === 'object') {
      const outcomeObj = data.result.outcome as { number: number; type: string; color: string };
      num = outcomeObj.number;
      color = outcomeObj.color === 'Green' ? 'Green' : (RED_NUMBERS.has(num) ? 'Red' : (BLACK_NUMBERS.has(num) ? 'Black' : 'Green'));
      type = num === 0 ? 'Zero' : (num % 2 === 0 ? 'Even' : 'Odd');
    } else {
      return null;
    }

    const dateStr = data.settledAt || data.startedAt || new Date().toISOString();
    const d = new Date(dateStr);

    // Calculate dozen
    let dozen: 1 | 2 | 3 | 0 = 0;
    if (num >= 1 && num <= 12) dozen = 1;
    else if (num >= 13 && num <= 24) dozen = 2;
    else if (num >= 25 && num <= 36) dozen = 3;

    // Calculate column
    let column: 1 | 2 | 3 | 0 = 0;
    if (num > 0) {
      if (num % 3 === 1) column = 1;
      else if (num % 3 === 2) column = 2;
      else column = 3;
    }

    // High / Low
    let highLow: 'High' | 'Low' | 'Zero' = 'Zero';
    if (num >= 1 && num <= 18) highLow = 'Low';
    else if (num >= 19 && num <= 36) highLow = 'High';

    // Sector
    let sector: 'Voisins' | 'Tiers' | 'Orphelins' | 'Zero' = 'Voisins';
    if (num === 0 || ZERO_GAME_NUMBERS.has(num)) sector = 'Zero';
    else if (VOISINS_NUMBERS.has(num)) sector = 'Voisins';
    else if (TIERS_NUMBERS.has(num)) sector = 'Tiers';
    else if (ORPHELINS_NUMBERS.has(num)) sector = 'Orphelins';

    return {
      id: raw.id || data.id,
      timestamp: dateStr,
      minute: d.getMinutes(),
      hour: d.getHours(),
      number: num,
      color,
      type,
      dozen,
      column,
      highLow,
      sector,
      totalWinners: raw.totalWinners,
      totalAmount: raw.totalAmount,
    };
  } catch {
    return null;
  }
}
