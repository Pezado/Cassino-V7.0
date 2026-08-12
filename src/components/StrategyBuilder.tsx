import React, { useState, useMemo, useEffect } from 'react';
import { BacBoEvent, BacktestResult, GameType, RouletteEvent, StrategyRule } from '../types';
import { runStrategyBacktest } from '../utils/analyticsEngine';
import { saveStrategiesToFirebase, subscribeFirebaseStrategies, saveSignalToFirebase } from '../lib/firebaseService';
import { Bot, Play, Shield, Sliders, CheckCircle2, XCircle, TrendingUp, AlertTriangle, Layers, Send } from 'lucide-react';

interface StrategyBuilderProps {
  game: GameType;
  bacboEvents: BacBoEvent[];
  rouletteEvents: RouletteEvent[];
}

export const StrategyBuilder: React.FC<StrategyBuilderProps> = ({
  game,
  bacboEvents,
  rouletteEvents,
}) => {
  const isBacBo = game === 'bacbo';
  const events = isBacBo ? bacboEvents : rouletteEvents;

  const keyExtractor = (item: any) => {
    if (isBacBo) return item.outcome;
    return item.color;
  };

  // Preset rules list
  const initialRules: StrategyRule[] = useMemo(() => {
    if (isBacBo) {
      return [
        {
          id: 'rule-bacbo-1',
          name: 'Quebra de Sequência de 5 Casas (5x Player -> Aposta Banker)',
          game: 'bacbo',
          enabled: true,
          trigger: { streakColor: 'PlayerWon', streakMin: 5 },
          targetBet: 'BankerWon',
          martingaleMax: 1,
          confidence: 88,
        },
        {
          id: 'rule-bacbo-2',
          name: 'Surfe na Tendência de 5 Casas (5x Banker -> Aposta Banker)',
          game: 'bacbo',
          enabled: true,
          trigger: { streakColor: 'BankerWon', streakMin: 5 },
          targetBet: 'BankerWon',
          martingaleMax: 1,
          confidence: 85,
        },
        {
          id: 'rule-bacbo-3',
          name: 'Caçador de Empate (Soma Dados >= 10)',
          game: 'bacbo',
          enabled: false,
          trigger: { diceScoreSumMin: 10 },
          targetBet: 'Tie',
          martingaleMax: 2,
          confidence: 75,
        },
      ];
    } else {
      return [
        {
          id: 'rule-roulette-1',
          name: 'Quebra de 5 Vermelhos (5x Vermelho -> Aposta Preto)',
          game: 'autoroulette',
          enabled: true,
          trigger: { streakColor: 'Red', streakMin: 5 },
          targetBet: 'Black',
          martingaleMax: 1,
          confidence: 89,
        },
        {
          id: 'rule-roulette-2',
          name: 'Quebra de 5 Pretos (5x Preto -> Aposta Vermelho)',
          game: 'autoroulette',
          enabled: true,
          trigger: { streakColor: 'Black', streakMin: 5 },
          targetBet: 'Red',
          martingaleMax: 1,
          confidence: 88,
        },
      ];
    }
  }, [isBacBo]);

  const [rules, setRules] = useState<StrategyRule[]>(initialRules);
  const [selectedRuleId, setSelectedRuleId] = useState<string>(initialRules[0]?.id || '');
  const [saveStatusMsg, setSaveStatusMsg] = useState<string | null>(null);

  // Sync with Firebase Realtime Database
  useEffect(() => {
    const unsub = subscribeFirebaseStrategies((firebaseStrats) => {
      if (firebaseStrats && firebaseStrats.length > 0) {
        setRules(firebaseStrats);
      }
    });
    return () => unsub();
  }, []);

  const activeRule = rules.find((r) => r.id === selectedRuleId) || rules[0];

  // Backtest result computation
  const backtest: BacktestResult = useMemo(() => {
    if (!activeRule || events.length === 0) {
      return {
        ruleId: '',
        ruleName: '',
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
    const chronological = [...events].reverse();
    return runStrategyBacktest(chronological, activeRule, keyExtractor);
  }, [events, activeRule, isBacBo]);

  // Handle rule toggle & save to Firebase
  const toggleRule = (id: string) => {
    const updated = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    setRules(updated);
    saveStrategiesToFirebase(updated);
  };

  const handleSaveSignalToFirebase = async () => {
    if (!activeRule) return;
    await saveSignalToFirebase({
      game,
      type: 'STRATEGY',
      action: activeRule.targetBet,
      confidence: backtest.winRate,
      pattern: activeRule.name,
      rationale: `Backtest de ${backtest.totalRoundsTested} rodadas obteve taxa de acerto de ${backtest.winRate}% (Lucro Simulado +${backtest.simulatedProfit} un).`,
      timestamp: new Date().toISOString(),
    });
    setSaveStatusMsg('Sinal de Estratégia publicado com sucesso no Firebase Realtime Database!');
    setTimeout(() => setSaveStatusMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header & Rule Selection */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-emerald-400" />
              Criador de Estratégias & Bot de Sinais (Backtester Engine)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Simule robôs de análise em tempo real e teste estratégias na base de dados acumulada.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-bold">Base para Teste:</span>
            <span className="text-xs font-mono font-black text-cyan-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              {events.length} rodadas
            </span>
          </div>
        </div>

        {/* Rules Selector Pills */}
        <div className="flex flex-wrap gap-2">
          {rules.map((rule) => {
            const isSelected = rule.id === activeRule?.id;
            return (
              <button
                key={rule.id}
                onClick={() => setSelectedRuleId(rule.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 border ${
                  isSelected
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-md shadow-emerald-900/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <span>{rule.name}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleRule(rule.id);
                  }}
                  className={`w-2.5 h-2.5 rounded-full ${
                    rule.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                  }`}
                  title={rule.enabled ? 'Ativo' : 'Desativado'}
                />
              </button>
            );
          })}
        </div>
      </div>

      {saveStatusMsg && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-xs text-emerald-300 flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveStatusMsg}</span>
        </div>
      )}

      {/* Backtest Statistics Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Win Rate */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-lg">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Taxa de Assertividade</div>
          <div className="text-xl font-mono font-black text-emerald-400 mt-1">
            {backtest.winRate}%
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{backtest.totalSignals} Sinais</div>
        </div>

        {/* Direct Wins */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-lg">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Vitória Sem Gale</div>
          <div className="text-xl font-mono font-black text-cyan-400 mt-1">
            {backtest.winsDirect} <span className="text-xs text-slate-500 font-normal">x</span>
          </div>
          <div className="text-[10px] text-cyan-500/80 font-mono mt-0.5">Sem risco</div>
        </div>

        {/* Gale 1 & 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-lg">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Recuperação (Gale 1/2)</div>
          <div className="text-xl font-mono font-black text-amber-400 mt-1">
            {backtest.winsG1 + backtest.winsG2} <span className="text-xs text-slate-500 font-normal">x</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            G1: {backtest.winsG1} | G2: {backtest.winsG2}
          </div>
        </div>

        {/* Losses */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-lg">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Red / Losses</div>
          <div className="text-xl font-mono font-black text-rose-500 mt-1">
            {backtest.losses} <span className="text-xs text-slate-500 font-normal">x</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Erros do padrão</div>
        </div>

        {/* Max Consecutive Wins */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-lg">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Maior Sequência Green</div>
          <div className="text-xl font-mono font-black text-emerald-400 mt-1">
            {backtest.maxWinStreak} <span className="text-xs text-slate-500 font-normal">seguidas</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Recorde Positivo</div>
        </div>

        {/* Simulated Profit */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-lg">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Lucro Simulado</div>
          <div className={`text-xl font-mono font-black mt-1 ${backtest.simulatedProfit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
            {backtest.simulatedProfit >= 0 ? `+${backtest.simulatedProfit}` : backtest.simulatedProfit} <span className="text-xs font-normal">unid</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Unidades de aposta</div>
        </div>
      </div>

      {/* Backtest Detailed Audit Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            Histórico Auditado de Sinais Disparados pelo Robô
          </h4>
          <span className="text-xs text-slate-400 font-mono">
            {backtest.log.length} Entradas Registradas
          </span>
        </div>

        {backtest.log.length === 0 ? (
          <div className="text-xs text-slate-500 italic py-6 text-center">
            Nenhum sinal foi disparado para este padrão no histórico coletado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase font-mono">
                  <th className="py-2.5 px-3">Horário</th>
                  <th className="py-2.5 px-3">Gatilho</th>
                  <th className="py-2.5 px-3">Aposta Recomendada</th>
                  <th className="py-2.5 px-3">Resultado Obtido</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Lucro Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                {backtest.log.map((item, idx) => {
                  const isWin = item.result.startsWith('WIN');
                  return (
                    <tr key={idx} className="hover:bg-slate-950/50 transition-colors">
                      <td className="py-2 px-3 text-slate-400">{new Date(item.timestamp).toLocaleTimeString('pt-BR')}</td>
                      <td className="py-2 px-3 text-slate-300">{item.triggerReason}</td>
                      <td className="py-2 px-3 font-bold text-cyan-400">{item.predictedBet}</td>
                      <td className="py-2 px-3 text-slate-300">{item.actualOutcome}</td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.result === 'WIN_DIRECT'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : item.result.startsWith('WIN')
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {item.result === 'WIN_DIRECT'
                            ? 'GREEN (DIRETO)'
                            : item.result === 'WIN_G1'
                            ? 'GREEN (GALE 1)'
                            : item.result === 'WIN_G2'
                            ? 'GREEN (GALE 2)'
                            : 'RED / LOSS'}
                        </span>
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-bold ${
                          item.runningProfit >= 0 ? 'text-emerald-400' : 'text-rose-500'
                        }`}
                      >
                        {item.runningProfit >= 0 ? `+${item.runningProfit}` : item.runningProfit} u
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
