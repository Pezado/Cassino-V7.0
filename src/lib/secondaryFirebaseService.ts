import { ref, set, push } from 'firebase/database';
import { secondaryDb } from './secondaryFirebase';

/**
 * Helper to resolve standard path endpoints on secondary Firebase
 */
function resolveSecondaryPaths(gameKey: string) {
  const normalized = String(gameKey || '').toLowerCase();

  if (normalized.includes('bacbo') || normalized === 'bacbo') {
    return {
      ultimoPath: 'cassino/ultimo/bacbo/americano',
      sinalPath: 'cassino/sinais/bacbo/americano/sinal',
      empatePath: 'cassino/sinais/bacbo/americano/empate',
    };
  } else if (normalized.includes('imersiva')) {
    return {
      ultimoPath: 'cassino/ultimo/roleta/imersiva',
      sinalPath: 'cassino/sinais/roleta/imersiva/sinal',
      empatePath: 'cassino/sinais/roleta/imersiva/empate',
    };
  } else {
    // Default to auto roulette or generic roulette
    return {
      ultimoPath: 'cassino/ultimo/roleta/auto',
      sinalPath: 'cassino/sinais/roleta/auto/sinal',
      empatePath: 'cassino/sinais/roleta/auto/empate',
    };
  }
}

/**
 * 1. Send LAST RESULT to Secondary Firebase.
 * ALWAYS OVERWRITES (set) the node so it does not accumulate.
 */
export async function sendSecondaryLastResult(gameKey: string, round: any) {
  if (!round) return;
  try {
    const { ultimoPath } = resolveSecondaryPaths(gameKey);
    const now = new Date();
    const hora = String(now.getHours()).padStart(2, '0');
    const minuto = String(now.getMinutes()).padStart(2, '0');
    const segundo = String(now.getSeconds()).padStart(2, '0');
    const horarioCompleto = `${hora}:${minuto}:${segundo}`;

    const isBacBo = gameKey.toLowerCase().includes('bacbo');
    let resultado = 'EMPATE';
    let detalhe = '';
    let numeroVencedor: number | null = null;

    if (isBacBo) {
      const pScore = typeof round.playerScore === 'number' ? round.playerScore : null;
      const bScore = typeof round.bankerScore === 'number' ? round.bankerScore : null;

      if (pScore !== null && bScore !== null) {
        detalhe = `${pScore}x${bScore}`;
        if (pScore > bScore) resultado = 'PLAYER';
        else if (bScore > pScore) resultado = 'BANKER';
        else resultado = 'EMPATE';
      } else {
        const outLower = String(round.outcome || round.winner || '').toLowerCase();
        if (outLower.includes('player')) resultado = 'PLAYER';
        else if (outLower.includes('banker')) resultado = 'BANKER';
        else resultado = 'EMPATE';
      }
    } else {
      // Roulette
      const color = String(round.color || '').toLowerCase();
      numeroVencedor = typeof round.number === 'number' ? round.number : null;
      detalhe = numeroVencedor !== null ? String(numeroVencedor) : '';

      if (color === 'red') resultado = 'VERMELHO';
      else if (color === 'black') resultado = 'PRETO';
      else resultado = 'VERDE';
    }

    const payload = {
      resultado, // BANKER / PLAYER / EMPATE / VERMELHO / PRETO / VERDE
      detalhe,
      numeroVencedor,
      hora,
      minuto,
      segundo,
      horarioCompleto,
      timestamp: now.toISOString(),
    };

    const targetRef = ref(secondaryDb, ultimoPath);
    await set(targetRef, payload);
  } catch (err) {
    console.error('Error sending last result to secondary Firebase:', err);
  }
}

/**
 * 2. Send Clean Format Signal & Live Statistics to Secondary Firebase
 */
export async function sendSecondaryCleanSignal(
  gameKey: string,
  event: {
    eventType: 'CONFIRMED' | 'GALE_1' | 'GREEN_DIRECT' | 'GREEN_GALE_1' | 'TIE' | 'RED' | 'ANALYZING' | 'BOT_DISABLED';
    target?: string; // 'Player', 'Banker', 'Red', 'Black', 'WAIT'
    stats?: {
      total: number;
      greens: number;
      losses: number;
      ties: number;
      winRate: number;
    };
    waitRounds?: number;
  }
) {
  try {
    const { sinalPath } = resolveSecondaryPaths(gameKey);
    const now = new Date();
    const horario = now.toLocaleTimeString('pt-BR');

    let targetLabel = 'BANKER 🔴';
    let targetNameOnly = 'BANKER';

    if (event.target === 'Player') {
      targetLabel = 'PLAYER 🔵';
      targetNameOnly = 'PLAYER';
    } else if (event.target === 'Banker') {
      targetLabel = 'BANKER 🔴';
      targetNameOnly = 'BANKER';
    } else if (event.target === 'Red') {
      targetLabel = 'VERMELHO 🔴';
      targetNameOnly = 'VERMELHO';
    } else if (event.target === 'Black') {
      targetLabel = 'PRETO 🖤';
      targetNameOnly = 'PRETO';
    } else if (event.target === 'WAIT') {
      targetLabel = 'AGUARDAR 🔍';
      targetNameOnly = 'AGUARDAR';
    }

    let mensagem = '';
    const isBacBo = gameKey.toLowerCase().includes('bacbo');
    const protecaoStr = isBacBo ? '🟡 EMPATE' : '🟢 ZERO';

    switch (event.eventType) {
      case 'CONFIRMED':
        mensagem = `🎯 ENTRADA CONFIRMADA\n🧠 APOSTA NO ${targetLabel}\n⚔️ PROTEÇÃO --> ${protecaoStr}\n🔁 Até Gale 1`;
        break;
      case 'GALE_1':
        mensagem = `🔁 Gale 1\n${targetLabel}`;
        break;
      case 'GREEN_DIRECT':
        mensagem = `Green de Primeira ✅🤑`;
        break;
      case 'GREEN_GALE_1':
        mensagem = `Green no Gale 1 ✅🤑`;
        break;
      case 'TIE':
        mensagem = `EMPATE 💰\nProteção Ativa 🟡`;
        break;
      case 'RED':
        mensagem = `Erramos\nnão veio ${targetNameOnly} ${targetLabel.includes('🔴') ? '🔴' : targetLabel.includes('🔵') ? '🔵' : '🖤'}💔`;
        break;
      case 'ANALYZING': {
        const rds = event.waitRounds || 1;
        mensagem = `🔍 ANALISANDO O GRÁFICO 🚨\n🧠 Análise científica para resultados precisos...aguarde ${rds} rodada(s)`;
        break;
      }
      case 'BOT_DISABLED':
        mensagem = `🔴 BOT DESLIGADO\n⚡ Geração de sinais temporariamente desativada`;
        break;
    }

    const safeTotal = event.stats?.total ?? 0;
    const safeGreens = event.stats?.greens ?? 0;
    const safeLosses = event.stats?.losses ?? 0;
    const safeTies = event.stats?.ties ?? 0;
    const safeAcertos = safeGreens + safeTies;
    const rawWinRate = event.stats?.winRate;
    const safeWinRate = typeof rawWinRate === 'number' && !isNaN(rawWinRate)
      ? Math.round(rawWinRate)
      : safeTotal > 0
      ? Math.round((safeAcertos / safeTotal) * 100)
      : 100;

    const statsObj = event.stats
      ? {
          total: safeTotal,
          winRate: safeWinRate,
          acertos: safeAcertos,
          greens: safeGreens,
          reds: safeLosses,
          empates: safeTies,
          resumo: `📊 Total: ${safeTotal} | 🎯 WinRate: ${safeWinRate}% | ✅ Acertos: ${safeAcertos} | ❌ Red: ${safeLosses} | 🛡️ Empates: ${safeTies}`,
        }
      : null;

    const payload = {
      mensagem,
      eventType: event.eventType,
      aposta: targetLabel,
      horario,
      estatisticas: statsObj,
      timestamp: now.toISOString(),
    };

    const signalRef = ref(secondaryDb, sinalPath);
    await set(signalRef, payload);
  } catch (err) {
    console.error('Error sending clean signal to secondary Firebase:', err);
  }
}

/**
 * 3. Send Tie minute record to Secondary Firebase
 */
export async function sendSecondaryTieMinute(gameKey: string, tieData: {
  minute: number;
  timeStr: string;
  score?: string;
}) {
  try {
    const { empatePath } = resolveSecondaryPaths(gameKey);
    const tieRef = ref(secondaryDb, empatePath);

    const minStr = String(tieData.minute).padStart(2, '0');
    await set(tieRef, {
      minuto: tieData.minute,
      timeStr: tieData.timeStr,
      score: tieData.score || '',
      sinalMinuto: `Sinal no Minuto ${minStr} (${tieData.timeStr})`,
      mensagem: `🛡️ SINAL DE EMPATE NO MINUTO ${minStr} (${tieData.timeStr})`,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error sending tie minute to secondary Firebase:', err);
  }
}
