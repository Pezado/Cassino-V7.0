import React, { useState, useMemo } from 'react';
import { BacBoEvent, GameType, RouletteEvent } from '../types';
import { filterEventsByDate, findSequenceMatches, getFrequentSequences } from '../utils/analyticsEngine';
import { saveSignalToFirebase } from '../lib/firebaseService';
import { Search, Sparkles, Filter, ChevronRight, Zap, List, Send, CheckCircle2 } from 'lucide-react';

interface SequenceMatcherProps {
  game: GameType;
  bacboEvents: BacBoEvent[];
  rouletteEvents: RouletteEvent[];
}

export const SequenceMatcher: React.FC<SequenceMatcherProps> = ({
  game,
  bacboEvents,
  rouletteEvents,
}) => {
  const isBacBo = game === 'bacbo';
  const events = isBacBo ? bacboEvents : rouletteEvents;

  // Date Filter State
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');

  const filteredEvents = useMemo(() => {
    return filterEventsByDate(events, selectedDateFilter);
  }, [events, selectedDateFilter]);

  // Pattern sequence array selected by user (5 houses exact)
  const [pattern, setPattern] = useState<string[]>(
    isBacBo
      ? ['PlayerWon', 'BankerWon', 'PlayerWon', 'BankerWon', 'BankerWon']
      : ['Red', 'Black', 'Red', 'Black', 'Black']
  );

  const [savedSignalMsg, setSavedSignalMsg] = useState<string | null>(null);

  const keyExtractor = (item: any) => {
    if (isBacBo) return item.outcome;
    return item.color;
  };

  // Run sequence matcher on chronological dataset
  const matches = useMemo(() => {
    const chronological = [...filteredEvents].reverse();
    return findSequenceMatches(chronological, keyExtractor, pattern);
  }, [filteredEvents, pattern, isBacBo]);

  // Compute frequent 5-house sequences leading into 6th position outcome
  const frequentSequences = useMemo(() => {
    const chronological = [...filteredEvents].reverse();
    return getFrequentSequences(chronological, keyExtractor, 5, 10);
  }, [filteredEvents, isBacBo]);

  // Format token into concise symbol (P, B, T, Verm, Pret, Zero)
  const formatTokenSymbol = (token: string) => {
    if (token === 'PlayerWon') return 'P';
    if (token === 'BankerWon') return 'B';
    if (token === 'Tie') return 'T';
    if (token === 'Red') return 'V';
    if (token === 'Black') return 'P';
    if (token === 'Green') return 'Z';
    return token;
  };

  // Format sequence string e.g. "PBPBB" (5 houses)
  const formattedPatternStr = useMemo(() => {
    return pattern.map(formatTokenSymbol).join('');
  }, [pattern]);

  // Format outcome distribution string e.g. "B:7x, P:3x, T:2x"
  const formattedDistributionStr = useMemo(() => {
    if (matches.occurrences === 0) return 'Sem ocorrências';

    if (isBacBo) {
      const b = matches.nextOutcomes['BankerWon'] || 0;
      const p = matches.nextOutcomes['PlayerWon'] || 0;
      const t = matches.nextOutcomes['Tie'] || 0;
      return `B:${b}x, P:${p}x, T:${t}x`;
    } else {
      const v = matches.nextOutcomes['Red'] || 0;
      const p = matches.nextOutcomes['Black'] || 0;
      const z = matches.nextOutcomes['Green'] || 0;
      return `V:${v}x, P:${p}x, Z:${z}x`;
    }
  }, [matches, isBacBo]);

  const addToken = (token: string) => {
    if (pattern.length < 5) {
      setPattern([...pattern, token]);
    }
  };

  const removeLastToken = () => {
    if (pattern.length > 0) {
      setPattern(pattern.slice(0, pattern.length - 1));
    }
  };

  const clearPattern = () => {
    setPattern([]);
  };

  const handlePublishSignalToFirebase = async () => {
    if (pattern.length === 0) return;
    const topPredictionEntry = Object.entries(matches.probabilities).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
    const topAction = topPredictionEntry ? topPredictionEntry[0] : 'N/A';
    const topConfidence = topPredictionEntry ? Number(topPredictionEntry[1]) || 0 : 0;

    await saveSignalToFirebase({
      game,
      type: 'STRATEGY',
      action: topAction,
      confidence: topConfidence,
      pattern: `${formattedPatternStr} --> ${topAction}`,
      rationale: `Sequência de 5 casas [${formattedPatternStr}] gerou histórico [${formattedDistributionStr}] na 6ª casa.`,
      timestamp: new Date().toISOString(),
    });

    setSavedSignalMsg('Sinal de 5 casas salvo com sucesso no Firebase Realtime Database!');
    setTimeout(() => setSavedSignalMsg(null), 4000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-cyan-400" />
            Buscador de Padrões Automático (Sequence Finder)
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Detecção automática de sequências recorrentes de 5 casas no histórico de rodadas reais.
          </p>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-cyan-400" />
          <span className="font-extrabold text-white uppercase tracking-wider">Filtro por Data:</span>
          <span className="text-[11px] text-slate-400">({filteredEvents.length} rodadas)</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'today', label: 'Hoje' },
            { id: 'yesterday', label: 'Ontem' },
            { id: '2days', label: '2 Dias' },
            { id: '3days', label: '3 Dias' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setSelectedDateFilter(btn.id)}
              className={`px-3 py-1 rounded-lg font-bold transition-all border cursor-pointer ${
                selectedDateFilter === btn.id
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {savedSignalMsg && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-xs text-emerald-300 flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{savedSignalMsg}</span>
        </div>
      )}

      {/* Auto-Discovered Frequent Sequences in Dataset */}
      <div className="space-y-3">
        <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
          <List className="w-4 h-4 text-emerald-400" />
          Sequências Automáticas Detectadas no Histórico ({isBacBo ? 'Bac Bo' : 'Roleta'})
        </h4>

        {frequentSequences.length === 0 ? (
          <div className="text-xs text-slate-500 italic p-3 bg-slate-950 rounded-xl">
            Acumulando mais rodadas para identificar sequências recorrentes automaticamente...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {frequentSequences.map((seq, idx) => {
              const pStr = seq.pattern.map(formatTokenSymbol).join('-');
              let distStr = '';
              if (isBacBo) {
                const b = seq.nextOutcomes['BankerWon'] || 0;
                const p = seq.nextOutcomes['PlayerWon'] || 0;
                const t = seq.nextOutcomes['Tie'] || 0;
                distStr = `B:${b}x, P:${p}x, T:${t}x`;
              } else {
                const v = seq.nextOutcomes['Red'] || 0;
                const p = seq.nextOutcomes['Black'] || 0;
                const z = seq.nextOutcomes['Green'] || 0;
                distStr = `Verm:${v}x, Pret:${p}x, Zero:${z}x`;
              }

              const isSelected = JSON.stringify(pattern) === JSON.stringify(seq.pattern);

              return (
                <div
                  key={idx}
                  onClick={() => setPattern(seq.pattern)}
                  className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between border ${
                    isSelected
                      ? 'bg-slate-800 border-cyan-500 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-950 hover:bg-slate-800/60 border-slate-800'
                  }`}
                  title="Clique para analisar esta sequência automática"
                >
                  <div className="font-mono text-xs font-bold text-slate-200">
                    <span className="text-amber-300">{pStr}</span>
                    <span className="text-slate-500 mx-1 border-b border-dotted">➔</span>
                    <span className="text-emerald-400">{distStr}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {seq.occurrences}x
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Sequence Summary & Probability Analysis */}
      <div className="bg-slate-950 p-4 rounded-xl border border-cyan-500/40 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase font-bold text-cyan-400">
            Análise de Padrão Selecionado: 5 Casas ➔ 6ª Casa Resultado
          </span>
          <div className="text-base font-mono font-black text-white mt-1 flex flex-wrap items-center gap-2">
            <span className="text-amber-300 font-extrabold">{formattedPatternStr || 'Nenhuma'}</span>
            <span className="text-slate-500">➔</span>
            <span className="text-emerald-400 font-extrabold">{formattedDistributionStr}</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs font-mono font-bold text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            {matches.occurrences}x no histórico ({events.length} rodadas)
          </span>
          <button
            onClick={handlePublishSignalToFirebase}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold rounded-lg shadow-md transition-all flex items-center space-x-1.5"
            title="Salvar este sinal no Firebase Realtime Database"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Salvar no Firebase</span>
          </button>
        </div>
      </div>

      {/* Results Output & Next Prediction */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-800">
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase">Total de Ocorrências</div>
            <div className="text-3xl font-mono font-black text-cyan-400 mt-2">
              {matches.occurrences} <span className="text-xs text-slate-500 font-normal">vezes no histórico</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">
            Base total analisada: {events.length} rodadas acumuladas.
          </p>
        </div>

        {/* Probabilities Output */}
        <div className="md:col-span-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-extrabold text-white uppercase flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Resultado Seguinte Histórico (Próxima Cor / Vitória)
            </h4>
            <span className="text-xs text-emerald-400 font-bold">Probabilidade Calculada</span>
          </div>

          {matches.occurrences === 0 ? (
            <div className="text-xs text-slate-400 italic py-4 text-center">
              Esta sequência não foi encontrada na base de dados atual. Tente uma sequência menor.
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(matches.probabilities).map(([outKey, pct]) => {
                let label = outKey;
                let barColor = 'from-slate-600 to-slate-500';

                if (outKey === 'PlayerWon') {
                  label = 'Player (P)';
                  barColor = 'from-blue-600 to-cyan-500';
                } else if (outKey === 'BankerWon') {
                  label = 'Banker (B)';
                  barColor = 'from-rose-600 to-red-500';
                } else if (outKey === 'Tie') {
                  label = 'Empate (E)';
                  barColor = 'from-amber-500 to-yellow-400';
                } else if (outKey === 'Red') {
                  label = 'Vermelho';
                  barColor = 'from-rose-600 to-red-500';
                } else if (outKey === 'Black') {
                  label = 'Preto';
                  barColor = 'from-slate-600 to-slate-400';
                } else if (outKey === 'Green') {
                  label = 'Zero (Verde)';
                  barColor = 'from-emerald-500 to-teal-400';
                }

                return (
                  <div key={outKey} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-200">{label}</span>
                      <span className="font-mono text-cyan-400">{pct}% ({matches.nextOutcomes[outKey]}x)</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
