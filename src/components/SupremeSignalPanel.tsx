import React, { useState, useEffect, useRef } from 'react';
import { GameType } from '../types';
import {
  saveSignalToFirebase,
  subscribeFirebaseSignals,
  saveBotStateToFirebase,
  subscribeFirebaseBotState,
  saveTieMinuteToFirebase,
  subscribeFirebaseTieMinutes,
} from '../lib/firebaseService';
import {
  sendSecondaryLastResult,
  sendSecondaryCleanSignal,
  sendSecondaryTieMinute,
} from '../lib/secondaryFirebaseService';
import { computeSupremePrediction, generateGoldenBatch, evaluateAutoGaleDecision } from '../lib/supremeEngine';
import { RefreshCw, Activity, CheckCircle2, XCircle } from 'lucide-react';

interface SupremeSignalPanelProps {
  game: GameType;
  rounds: any[];
}

// Helper to safely format time strings without producing "Invalid Date"
const safeFormatTime = (timeVal?: any, createdAtVal?: any): string => {
  if (typeof timeVal === 'string' && /^\d{1,2}:\d{2}/.test(timeVal)) {
    return timeVal;
  }
  if (timeVal) {
    const d = new Date(timeVal);
    if (!isNaN(d.getTime())) return d.toLocaleTimeString('pt-BR');
  }
  if (typeof createdAtVal === 'string' && /^\d{1,2}:\d{2}/.test(createdAtVal)) {
    return createdAtVal;
  }
  if (createdAtVal) {
    const d = new Date(createdAtVal);
    if (!isNaN(d.getTime())) return d.toLocaleTimeString('pt-BR');
  }
  return new Date().toLocaleTimeString('pt-BR');
};

export const SupremeSignalPanel: React.FC<SupremeSignalPanelProps> = ({
  game,
  rounds,
}) => {
  const [liveSignals, setLiveSignals] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem(`cassino_signals_${game}`) || localStorage.getItem('cassino_signals_all');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [stats, setStats] = useState(() => {
    try {
      const cached = localStorage.getItem(`cassino_v7_stats_${game}`);
      return cached ? JSON.parse(cached) : { total: 0, greens: 0, losses: 0, ties: 0 };
    } catch {
      return { total: 0, greens: 0, losses: 0, ties: 0 };
    }
  });

  const [currentSignal, setCurrentSignal] = useState<{
    id: string;
    target: 'Player' | 'Banker' | 'Red' | 'Black' | 'WAIT';
    action: string;
    tieProtection: string;
    galeStage: number; // 0 = direto, 1 = gale 1, 2 = gale 2
    triggerRoundId: string;
    confidence: number;
    timestamp: string;
    createdAt: string;
    rationale?: string;
  } | null>(null);

  const [maxGale, setMaxGale] = useState<number>(3); // 3 = Gale Automático (Padrão)
  const [botActive, setBotActive] = useState<boolean>(true);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingStep, setAnalyzingStep] = useState(0);

  // Persistent Refs across game switches
  const lastEvaluatedRoundId = useRef<string | null>(null);
  const initializedGameRef = useRef<string | null>(null);
  const consecutiveWinsRef = useRef(0);
  const isLoadedFromFirebaseRef = useRef(false);

  const isBacBo = game === 'bacbo';

  const [firebaseTieMinutes, setFirebaseTieMinutes] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem(`cassino_tieMinutes_${game}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const lastSavedTieRoundId = useRef<string | null>(null);

  // 1. Subscribe to real-time signals from Firebase RTDB `cassino/signals`
  useEffect(() => {
    const unsubscribe = subscribeFirebaseSignals((signals) => {
      const gameSignals = signals.filter((s) => s.game === game || !s.game);

      const uniqueSignalsMap = new Map<string, any>();
      gameSignals.forEach((sig) => {
        const sigId = sig.id || sig.createdAt || sig.timestamp;
        if (!uniqueSignalsMap.has(sigId)) {
          uniqueSignalsMap.set(sigId, sig);
        } else {
          const existing = uniqueSignalsMap.get(sigId);
          if (existing.status === 'ACTIVE' && sig.status !== 'ACTIVE') {
            uniqueSignalsMap.set(sigId, sig);
          }
        }
      });

      setLiveSignals(Array.from(uniqueSignalsMap.values()));
    });

    const unsubscribeTies = subscribeFirebaseTieMinutes(game, (list) => {
      setFirebaseTieMinutes(list);
    });

    return () => {
      unsubscribe();
      unsubscribeTies();
    };
  }, [game]);

  // Save new Tie rounds automatically to Firebase & sync last result to secondary Firebase
  useEffect(() => {
    if (!rounds || rounds.length === 0) return;
    const topRound = rounds[0];
    if (!topRound || !topRound.id) return;

    // 1. Always send LAST RESULT to secondary Firebase (overwriting cassino/ultimo/...)
    sendSecondaryLastResult(game, topRound);

    // 2. Save Tie record if tie outcome
    const outLower = String(topRound.outcome || topRound.winner || '').toLowerCase();
    const isTieScore = typeof topRound.playerScore === 'number' && typeof topRound.bankerScore === 'number' && topRound.playerScore === topRound.bankerScore;
    const isTie = outLower.includes('tie') || outLower.includes('empate') || isTieScore || (topRound.number === 0 && !isBacBo);

    if (isTie && lastSavedTieRoundId.current !== topRound.id) {
      lastSavedTieRoundId.current = topRound.id;
      const roundDate = topRound.timestamp ? new Date(topRound.timestamp) : new Date();
      const min = roundDate.getMinutes();
      const timeStr = !isNaN(roundDate.getTime())
        ? roundDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const scoreStr = typeof topRound.playerScore === 'number' && typeof topRound.bankerScore === 'number' ? `${topRound.playerScore}x${topRound.bankerScore}` : undefined;

      // Primary Firebase
      saveTieMinuteToFirebase(game, {
        timestamp: roundDate.toISOString(),
        minute: min,
        timeStr,
        roundId: topRound.id,
        score: scoreStr,
      });

      // Secondary Firebase
      sendSecondaryTieMinute(game, {
        minute: min,
        timeStr,
        score: scoreStr,
      });
    }
  }, [rounds, game, isBacBo]);

  // 2. Subscribe to persistent Bot State from Firebase RTDB `cassino/botState/${game}`
  useEffect(() => {
    isLoadedFromFirebaseRef.current = false;
    lastEvaluatedRoundId.current = null;

    try {
      const locActive = localStorage.getItem(`cassino_v7_active_${game}`);
      if (locActive !== null) setBotActive(JSON.parse(locActive));
      
      const locGale = localStorage.getItem(`cassino_v7_gale_${game}`);
      if (locGale !== null) setMaxGale(JSON.parse(locGale));
    } catch (e) {
      console.error('Error reading localStorage bot state:', e);
    }

    const unsubscribeBotState = subscribeFirebaseBotState(game, (botState) => {
      if (botState) {
        if (typeof botState.botActive === 'boolean') {
          setBotActive(botState.botActive);
          try { localStorage.setItem(`cassino_v7_active_${game}`, JSON.stringify(botState.botActive)); } catch (e) {}
        }
        if (typeof botState.maxGale === 'number') {
          setMaxGale(botState.maxGale);
          try { localStorage.setItem(`cassino_v7_gale_${game}`, JSON.stringify(botState.maxGale)); } catch (e) {}
        }
        if (typeof botState.consecutiveWins === 'number') {
          consecutiveWinsRef.current = botState.consecutiveWins;
        }
        if (botState.lastEvaluatedRoundId) {
          lastEvaluatedRoundId.current = botState.lastEvaluatedRoundId;
        }
        if (botState.currentSignal && botState.currentSignal.target) {
          setCurrentSignal(botState.currentSignal);
        } else {
          setCurrentSignal(null);
        }
      } else {
        setCurrentSignal(null);
      }
      isLoadedFromFirebaseRef.current = true;
    });

    return () => unsubscribeBotState();
  }, [game]);

  const handleToggleBotActive = () => {
    const nextActive = !botActive;
    setBotActive(nextActive);
    try { localStorage.setItem(`cassino_v7_active_${game}`, JSON.stringify(nextActive)); } catch (e) {}
    
    saveBotStateToFirebase(game, {
      botActive: nextActive,
      maxGale,
      consecutiveWins: consecutiveWinsRef.current,
      currentSignal,
      lastEvaluatedRoundId: lastEvaluatedRoundId.current,
    });

    if (!nextActive) {
      sendSecondaryCleanSignal(game, {
        eventType: 'BOT_DISABLED',
        target: 'WAIT',
        stats,
      });
    } else {
      if (rounds && rounds.length > 0) {
        triggerAnalysisAndNewPrediction(rounds[0].id);
      }
    }
  };

  const handleGaleChange = (newGale: number) => {
    setMaxGale(newGale);
    try { localStorage.setItem(`cassino_v7_gale_${game}`, JSON.stringify(newGale)); } catch (e) {}

    saveBotStateToFirebase(game, {
      botActive,
      maxGale: newGale,
      consecutiveWins: consecutiveWinsRef.current,
      currentSignal,
      lastEvaluatedRoundId: lastEvaluatedRoundId.current,
    });
  };

  // Compute stats strictly from resolved signals (GREEN, RED, TIE)
  useEffect(() => {
    let greens = 0;
    let losses = 0;
    let ties = 0;

    liveSignals.forEach((sig) => {
      if (sig.status === 'GREEN' || sig.evaluatedResult === 'GREEN') greens++;
      else if (sig.status === 'RED' || sig.evaluatedResult === 'RED') losses++;
      else if (sig.status === 'TIE' || sig.evaluatedResult === 'TIE') ties++;
    });

    const total = greens + losses + ties;
    const newStats = { total, greens, losses, ties };
    setStats(newStats);
    try {
      localStorage.setItem(`cassino_v7_stats_${game}`, JSON.stringify(newStats));
    } catch (e) {}
  }, [liveSignals, game]);

  // Initial signal generation when opening or switching game if no state existed in Firebase
  useEffect(() => {
    if (!rounds || rounds.length === 0 || !botActive) return;

    const latestRoundId = rounds[0]?.id;

    if (initializedGameRef.current !== game) {
      initializedGameRef.current = game;

      if (!currentSignal) {
        lastEvaluatedRoundId.current = latestRoundId;

        const pred = computeSupremePrediction(game, rounds);

        const validTarget: 'Player' | 'Banker' | 'Red' | 'Black' = isBacBo
          ? pred.target === 'Banker'
            ? 'Banker'
            : 'Player'
          : pred.target === 'Black'
          ? 'Black'
          : 'Red';

        const actionText = isBacBo
          ? validTarget === 'Player'
            ? 'PLAYER 🔵'
            : 'BANKER 🔴'
          : validTarget === 'Red'
          ? 'VERMELHO 🔴'
          : 'PRETO 🖤';

        const nowStr = new Date().toLocaleTimeString('pt-BR');
        const nowIso = new Date().toISOString();
        const tempId = 'sig_' + Date.now();

        const newSig = {
          id: tempId,
          target: validTarget,
          action: actionText,
          tieProtection: isBacBo ? '🟡 EMPATE' : '🟢 ZERO',
          galeStage: 0,
          triggerRoundId: latestRoundId,
          confidence: pred.confidence,
          timestamp: nowStr,
          createdAt: nowIso,
          rationale: pred.rationale,
        };

        setCurrentSignal(newSig);

        saveBotStateToFirebase(game, {
          botActive,
          maxGale,
          consecutiveWins: consecutiveWinsRef.current,
          currentSignal: newSig,
          lastEvaluatedRoundId: latestRoundId,
        });

        saveSignalToFirebase({
          ...newSig,
          game,
          status: 'ACTIVE',
          type: 'SUPREME_AUTOMATIC',
        }).then((fbId) => {
          if (fbId) {
            const updated = { ...newSig, id: fbId };
            setCurrentSignal(updated);
            saveBotStateToFirebase(game, {
              botActive,
              maxGale,
              consecutiveWins: consecutiveWinsRef.current,
              currentSignal: updated,
              lastEvaluatedRoundId: latestRoundId,
            });
          }
        }).catch(console.error);
      }
    }
  }, [game, rounds, isBacBo, currentSignal, maxGale, botActive]);

  // Real-time automatic evaluation machine triggered strictly when a NEW round arrives
  useEffect(() => {
    if (!rounds || rounds.length === 0 || isAnalyzing || !currentSignal || !botActive) return;

    const latestRound = rounds[0];
    if (!latestRound || !latestRound.id) return;

    if (currentSignal.triggerRoundId && latestRound.id === currentSignal.triggerRoundId) {
      return;
    }

    if (lastEvaluatedRoundId.current && latestRound.id !== lastEvaluatedRoundId.current) {
      const finishedRoundId = latestRound.id;
      lastEvaluatedRoundId.current = finishedRoundId;

      const target = currentSignal.target;

      let isHit = false;
      let isTieRefund = false;

      if (isBacBo) {
        const outcome = latestRound.outcome;
        if (target === 'Player' && outcome === 'PlayerWon') {
          isHit = true;
        } else if (target === 'Banker' && outcome === 'BankerWon') {
          isHit = true;
        } else if (outcome === 'Tie') {
          isTieRefund = true;
        }
      } else {
        const color = String(latestRound.color || '').toLowerCase();
        const num = latestRound.number;
        if (target === 'Red' && color === 'red') {
          isHit = true;
        } else if (target === 'Black' && color === 'black') {
          isHit = true;
        } else if (num === 0) {
          isTieRefund = true;
        }
      }

      if (isHit || isTieRefund) {
        const finalStatus = isHit ? 'GREEN' : 'TIE';

        saveSignalToFirebase({
          ...currentSignal,
          id: currentSignal.id,
          game,
          status: finalStatus,
          evaluatedResult: finalStatus,
          resolvedAt: new Date().toISOString(),
        }).catch(console.error);

        const winRate = stats.total > 0 ? Math.round(((stats.greens + stats.ties) / stats.total) * 100) : 100;
        if (finalStatus === 'TIE') {
          sendSecondaryCleanSignal(game, {
            eventType: 'TIE',
            target: currentSignal.target,
            stats: { ...stats, winRate },
          });
        } else {
          const greenType = currentSignal.galeStage > 0 ? 'GREEN_GALE_1' : 'GREEN_DIRECT';
          sendSecondaryCleanSignal(game, {
            eventType: greenType,
            target: currentSignal.target,
            stats: { ...stats, winRate },
          });
        }

        consecutiveWinsRef.current += 1;
        triggerAnalysisAndNewPrediction(finishedRoundId);
      } else {
        // Evaluate Gale execution
        let canDoGale = currentSignal.galeStage < (maxGale === 3 ? 1 : maxGale);
        let autoGaleReason = '';

        if (maxGale === 3 && currentSignal.galeStage === 0) {
          const autoEval = evaluateAutoGaleDecision(rounds, currentSignal, isBacBo);
          canDoGale = autoEval.shouldDoGale;
          autoGaleReason = autoEval.reason;
        }

        if (canDoGale) {
          const nextGaleStage = currentSignal.galeStage + 1;
          const updatedSig = {
            ...currentSignal,
            galeStage: nextGaleStage,
            rationale: autoGaleReason ? `${currentSignal.rationale} | ${autoGaleReason}` : currentSignal.rationale,
          };
          setCurrentSignal(updatedSig);

          const winRate = stats.total > 0 ? Math.round(((stats.greens + stats.ties) / stats.total) * 100) : 100;
          sendSecondaryCleanSignal(game, {
            eventType: 'GALE_1',
            target: currentSignal.target,
            stats: { ...stats, winRate },
          });

          saveSignalToFirebase({
            ...updatedSig,
            id: currentSignal.id,
            game,
            status: 'ACTIVE',
          }).catch(console.error);

          saveBotStateToFirebase(game, {
            botActive,
            maxGale,
            consecutiveWins: consecutiveWinsRef.current,
            currentSignal: updatedSig,
            lastEvaluatedRoundId: finishedRoundId,
          });
        } else {
          const redReason = maxGale === 3 ? `RED (Auto Pivot: ${autoGaleReason})` : 'RED';
          saveSignalToFirebase({
            ...currentSignal,
            id: currentSignal.id,
            game,
            status: 'RED',
            evaluatedResult: redReason,
            resolvedAt: new Date().toISOString(),
          }).catch(console.error);

          const winRate = stats.total > 0 ? Math.round(((stats.greens + stats.ties) / stats.total) * 100) : 100;
          sendSecondaryCleanSignal(game, {
            eventType: 'RED',
            target: currentSignal.target,
            stats: { ...stats, winRate },
          });

          consecutiveWinsRef.current = 0;
          triggerAnalysisAndNewPrediction(finishedRoundId);
        }
      }
    }
  }, [rounds, currentSignal, isAnalyzing, isBacBo, game, maxGale, botActive]);

  const triggerAnalysisAndNewPrediction = (latestRoundId: string) => {
    if (!botActive) return;

    const pred = computeSupremePrediction(game, rounds);

    const validTarget: 'Player' | 'Banker' | 'Red' | 'Black' = isBacBo
      ? pred.target === 'Banker'
        ? 'Banker'
        : 'Player'
      : pred.target === 'Black'
      ? 'Black'
      : 'Red';

    const actionText = isBacBo
      ? validTarget === 'Player'
        ? 'PLAYER 🔵'
        : 'BANKER 🔴'
      : validTarget === 'Red'
      ? 'VERMELHO 🔴'
      : 'PRETO 🖤';

    const nowStr = new Date().toLocaleTimeString('pt-BR');
    const nowIso = new Date().toISOString();
    const tempId = 'sig_' + Date.now();

    const newSig = {
      id: tempId,
      target: validTarget,
      action: actionText,
      tieProtection: isBacBo ? '🟡 EMPATE' : '🟢 ZERO',
      galeStage: 0,
      triggerRoundId: latestRoundId,
      confidence: pred.confidence,
      timestamp: nowStr,
      createdAt: nowIso,
      rationale: pred.rationale,
    };

    setCurrentSignal(newSig);
    setIsAnalyzing(false);

    saveBotStateToFirebase(game, {
      botActive,
      maxGale,
      consecutiveWins: consecutiveWinsRef.current,
      currentSignal: newSig,
      lastEvaluatedRoundId: latestRoundId,
    });

    const winRate = stats.total > 0 ? Math.round(((stats.greens + stats.ties) / stats.total) * 100) : 100;

    sendSecondaryCleanSignal(game, {
      eventType: 'CONFIRMED',
      target: validTarget,
      stats: { ...stats, winRate },
    });

    saveSignalToFirebase({
      ...newSig,
      game,
      status: 'ACTIVE',
      type: 'SUPREME_AUTOMATIC',
    }).then((fbId) => {
      if (fbId) {
        const updated = { ...newSig, id: fbId };
        setCurrentSignal(updated);
        saveBotStateToFirebase(game, {
          botActive,
          maxGale,
          consecutiveWins: consecutiveWinsRef.current,
          currentSignal: updated,
          lastEvaluatedRoundId: latestRoundId,
        });
      }
    }).catch(console.error);
  };

  // Calculate Win Rate % (Empates contam como acerto devido à proteção de empate!)
  const totalWins = stats.greens + stats.ties;
  const totalEvaluated = stats.total;
  const winRate = totalEvaluated > 0 ? Math.round((totalWins / totalEvaluated) * 100) : 100;

  // Golden Minutes Batch State
  interface GoldenSlot {
    hour: number;
    minute: number;
    timeStr: string;
  }

  const [goldenBatch, setGoldenBatch] = useState<GoldenSlot[]>([]);

  // Initialize or reset batch when game changes or on first mount
  useEffect(() => {
    const now = new Date();
    const initialBatch = generateGoldenBatch(now.getHours(), now.getMinutes(), rounds, isBacBo);
    setGoldenBatch(initialBatch);
  }, [game]);

  // Evaluate current batch status and auto-advance ONLY when the last minute in batch completes
  const evaluatedGoldenMinutes = React.useMemo(() => {
    if (!goldenBatch || goldenBatch.length === 0) return [];

    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    const evaluated = goldenBatch.map((slot) => {
      const isFutureSlot =
        currentHour < slot.hour ||
        (currentHour === slot.hour && currentMin < slot.minute);

      const hitTieInRound = (rounds || []).some((r) => {
        const isTieOrZero = isBacBo ? r.outcome === 'Tie' : r.number === 0;
        if (!isTieOrZero) return false;
        const d = new Date(r.timestamp);
        return d.getHours() === slot.hour && d.getMinutes() === slot.minute;
      });

      let status: 'HIT' | 'MISS' | 'UPCOMING' = 'UPCOMING';

      if (isFutureSlot) {
        status = 'UPCOMING';
      } else if (hitTieInRound) {
        status = 'HIT';
      } else if (
        currentHour > slot.hour ||
        (currentHour === slot.hour && currentMin > slot.minute)
      ) {
        status = 'MISS';
      } else {
        status = 'UPCOMING';
      }

      return { timeStr: slot.timeStr, status, hour: slot.hour, minute: slot.minute };
    });

    // Check if ALL slots in the batch have completed (HIT or MISS)
    const allCompleted = evaluated.every((e) => e.status === 'HIT' || e.status === 'MISS');

    if (allCompleted) {
      // Automatically generate the next batch ONLY when the last minute of current batch is reached!
      setTimeout(() => {
        const nextBatch = generateGoldenBatch(currentHour, currentMin, rounds, isBacBo);
        setGoldenBatch(nextBatch);
      }, 500);
    }

    return evaluated;
  }, [goldenBatch, rounds, isBacBo]);

  const analyzingPhrases = [
    'Analisando comportamento...',
    'Verificando Padrões...',
    'Varrendo dados...',
    'Confirmando...',
  ];

  return (
    <div className="space-y-4">
      {/* 0. Bot Settings Control Bar (Power Switch, Gale Select & Pause Mode Toggle) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 font-mono text-xs shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-slate-300 font-bold uppercase tracking-wider text-[11px]">⚡ Geração de Sinais:</span>
          <button
            onClick={handleToggleBotActive}
            className={`px-3 py-1 rounded-lg border font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              botActive
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700 hover:bg-emerald-900 shadow-sm shadow-emerald-900/50'
                : 'bg-rose-950/90 text-rose-300 border-rose-700 hover:bg-rose-900'
            }`}
          >
            {botActive ? 'LIGADO 🟢' : 'DESLIGADO 🔴'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-300 font-bold uppercase tracking-wider text-[11px]">⚙️ Limite de Gale:</span>
          <select
            value={maxGale}
            onChange={(e) => handleGaleChange(Number(e.target.value))}
            className="bg-slate-950 text-cyan-300 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value={3}>🤖 Gale Automático (Padrão)</option>
            <option value={1}>Até Gale 1</option>
            <option value={2}>Até Gale 2</option>
            <option value={0}>Sem Gale (0)</option>
          </select>
        </div>
      </div>

      {/* 1. Statistics Bar with Emojis */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-mono text-xs sm:text-sm font-black shadow-lg flex flex-wrap items-center justify-between gap-3">
        <span className="text-slate-300 flex items-center gap-1" title="Total de sinais resolvidos">
          📊 Total: {stats.total}
        </span>
        <span className="text-cyan-400 flex items-center gap-1" title="Assertividade considerando vitórias e proteção de empate">
          🎯 WinRate: {winRate}%
        </span>
        <span className="text-emerald-400 flex items-center gap-1" title="Acertos totais (Vitórias diretas + Empates protegidos)">
          ✅ Acertos: {stats.greens + stats.ties} ({stats.greens}🎯 + {stats.ties}🛡️)
        </span>
        <span className="text-rose-400 flex items-center gap-1" title="Red (Derrotas)">
          ❌ Red: {stats.losses}
        </span>
        <span className="text-amber-400 flex items-center gap-1" title="Empates protegidos">
          🛡️ Empates: {stats.ties}
        </span>
      </div>

      {/* 2. Minutos do Empate / Zero Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 shadow-lg">
        <div className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center justify-between">
          <span>{isBacBo ? '⚡ MINUTOS DO EMPATE 🟡' : '⚡ MINUTOS DO ZERO 🟢'}</span>
          <span className="text-[10px] text-slate-500 font-mono">Padrão Dinâmico Quantum</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {evaluatedGoldenMinutes.map((item, idx) => (
            <div
              key={idx}
              className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 ${
                item.status === 'HIT'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800 shadow-sm shadow-emerald-900/50'
                  : item.status === 'MISS'
                  ? 'bg-slate-950 text-slate-500 border-slate-800 line-through opacity-60'
                  : 'bg-amber-950/80 text-amber-300 border-amber-800/80 animate-pulse'
              }`}
            >
              <span>{item.timeStr}</span>
              {item.status === 'HIT' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              {item.status === 'MISS' && <XCircle className="w-3.5 h-3.5 text-slate-600" />}
              {item.status === 'UPCOMING' && <span className="text-[10px]">⏳</span>}
            </div>
          ))}
        </div>
      </div>

      {/* 3. Next Signal Display / Processing State */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border-2 border-cyan-500/60 rounded-2xl p-6 shadow-2xl">
        {!botActive ? (
          <div className="py-6 text-center space-y-2 font-mono">
            <div className="text-lg font-black text-rose-400 flex items-center justify-center gap-2">
              <span>🔴 BOT DESLIGADO</span>
            </div>
            <div className="text-xs text-slate-400">
              Geração de sinais temporariamente desativada. Clique no botão &quot;LIGADO 🟢&quot; acima para reativar.
            </div>
          </div>
        ) : isAnalyzing ? (
          <div className="py-10 flex flex-col items-center justify-center space-y-3 text-center">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            <div className="text-sm font-black font-mono text-cyan-300 tracking-wider animate-pulse">
              {analyzingPhrases[analyzingStep]}
            </div>
          </div>
        ) : currentSignal ? (
          <div className="space-y-3 font-mono">
            <div className="text-base sm:text-lg font-black text-emerald-400 tracking-tight flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">🎯 ENTRADA CONFIRMADA</span>
              {currentSignal.confidence && (
                <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 text-[11px] font-bold">
                  Confiança: {currentSignal.confidence}%
                </span>
              )}
            </div>

            <div className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span>🧠 APOSTA NO {currentSignal.action.toUpperCase()}</span>
            </div>

            <div className="text-sm sm:text-base font-extrabold text-amber-400 flex items-center gap-2">
              <span>⚔️ PROTEÇÃO --&gt; {currentSignal.tieProtection}</span>
            </div>

            {currentSignal.rationale && (
              <div className="text-xs text-slate-400 font-sans leading-relaxed pt-1 border-t border-slate-800/80">
                {currentSignal.rationale}
              </div>
            )}

            <div className="text-xs sm:text-sm font-bold text-cyan-400 flex items-center gap-2 pt-1 border-t border-slate-800/80">
              <span>
                🔁 {maxGale === 0 ? 'Sem Gale' : maxGale === 1 ? 'Até Gale 1' : maxGale === 2 ? 'Até Gale 2' : '🤖 Gale Inteligente (Auto)'}
              </span>
              {currentSignal.galeStage > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[11px] animate-pulse">
                  Gale {currentSignal.galeStage} {maxGale === 3 ? '(Auto Inteligente)' : ''} em andamento...
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400 font-mono">
            Aguardando sinal automático...
          </div>
        )}
      </div>

      {/* 4. Histórico Recente */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Histórico Recente
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            Sinais: {liveSignals.length}
          </span>
        </div>

        {liveSignals.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500 font-mono italic">
            Sem sinais registrados no histórico recente.
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 no-scrollbar font-mono text-xs">
            {liveSignals.slice(0, 20).map((sig, idx) => {
              const formattedTime = safeFormatTime(sig.timestamp, sig.createdAt);

              const isGreen = sig.status === 'GREEN' || sig.evaluatedResult === 'GREEN';
              const isRed = sig.status === 'RED' || sig.evaluatedResult === 'RED';
              const isTie = sig.status === 'TIE' || sig.evaluatedResult === 'TIE';

              return (
                <div
                  key={sig.id || idx}
                  className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="text-[10px] text-slate-500">{formattedTime}</span>
                    <span className="font-extrabold text-white">{sig.action}</span>
                    {sig.galeStage > 0 && (
                      <span className="text-[10px] text-amber-400 font-bold">
                        (Gale {sig.galeStage})
                      </span>
                    )}
                  </div>

                  <div>
                    {isGreen && (
                      <span className="px-2.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded text-[10px] font-black">
                        🟢 GREEN
                      </span>
                    )}
                    {isRed && (
                      <span className="px-2.5 py-0.5 bg-rose-950 text-rose-400 border border-rose-800 rounded text-[10px] font-black">
                        🔴 RED
                      </span>
                    )}
                    {isTie && (
                      <span className="px-2.5 py-0.5 bg-amber-950 text-amber-400 border border-amber-800 rounded text-[10px] font-black">
                        ⚪ REEMBOLSO
                      </span>
                    )}
                    {!isGreen && !isRed && !isTie && (
                      <span className="px-2.5 py-0.5 bg-slate-800 text-cyan-300 rounded text-[10px] font-bold animate-pulse">
                        ⏳ Ativo
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
