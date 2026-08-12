import React, { useState, useMemo } from 'react';
import { GameType } from '../types';
import { ShieldAlert, Zap, TrendingUp, Clock, Layers, Sparkles, CheckCircle, AlertTriangle, BarChart3, Filter, ShieldCheck, Cpu } from 'lucide-react';

interface StrategiesAnalyticsViewProps {
  game: GameType;
  rounds: any[];
}

export interface StrategyDefinition {
  id: string;
  name: string;
  category: string;
  badgeColor: string;
  icon: string;
  shortDescription: string;
  howItWorks: string;
  trapWarning: string;
  patternType: 'parzinho' | 'tripla' | 'perninhas' | 'rampas' | 'dragao' | 'surf' | 'pingpong' | 'vpattern' | 'torres' | 'colunas_espelho' | 'sanduiche_alternancia' | 'maior_probabilidade' | 'tendencia_surf_empate';
}

const STRATEGIES: StrategyDefinition[] = [
  {
    id: 'colunas_espelho',
    name: 'Estratégia Espelho de Colunas e Cores',
    category: 'Colunas & Espelhos',
    badgeColor: 'border-cyan-400/60 text-cyan-200 bg-cyan-950/60',
    icon: '🏛️',
    shortDescription: 'Simetria e espelhamento entre colunas adjacentes no Bac Bo / Cassino (ex: 2 Vermelhos, 2 Azuis, 2 Vermelhos).',
    howItWorks: 'Analisa quando uma nova coluna abre com 2 repetições da mesma cor e projeta a cor alternada ou espelhada da coluna anterior na casa de baixo.',
    trapWarning: 'Evite se a mesa estiver em quebra irregular ou alternando sem padrão definido. Proteja sempre no Empate.',
    patternType: 'colunas_espelho',
  },
  {
    id: 'sanduiche_alternancia',
    name: 'Padrão Sanduíche & Alternância Reversa',
    category: 'Alternância',
    badgeColor: 'border-emerald-400/60 text-emerald-200 bg-emerald-950/60',
    icon: '🥪',
    shortDescription: 'Alternância entre cores (ex: Vermelho-Azul-Vermelho) mantendo o fluxo do mercado.',
    howItWorks: 'Nunca vá contra o fluxo do mercado! Se a mesa está alternando, opera-se a favor da alternância. Se sair Empate, ele é tratado como NULO e mantém a cor da alternância.',
    trapWarning: 'Em caso de Empate (Tie), o padrão se preserva. Não altere sua entrada após um empate neutro.',
    patternType: 'sanduiche_alternancia',
  },
  {
    id: 'maior_probabilidade',
    name: 'Operar na Maior Porcentagem (Dominância)',
    category: 'Dominância Gráfica',
    badgeColor: 'border-amber-400/60 text-amber-200 bg-amber-950/60',
    icon: '📈',
    shortDescription: 'Filtro rigoroso que valida entradas somente na cor com maior probabilidade/porcentagem na sessão.',
    howItWorks: 'Exemplo: Se o Azul possui 58% das vitórias e o Vermelho 32%, o sistema descarta sinais fracos para o Vermelho e opera prioritariamente a favor do Azul.',
    trapWarning: 'Operar contra a cor dominante da sessão é o maior causador de perdas. Mantenha a disciplina a favor da estatística.',
    patternType: 'maior_probabilidade',
  },
  {
    id: 'tendencia_surf_empate',
    name: 'Tendência Surf (1-3-1) & Empate Nulo',
    category: 'Fluxo Continuado',
    badgeColor: 'border-blue-400/60 text-blue-200 bg-blue-950/60',
    icon: '🌊',
    shortDescription: 'Onda de tendência em formato 1-3-1 (1x Azul, 3x Vermelho, 1x Azul) com Empate sendo elemento neutro.',
    howItWorks: 'Surfa na sequência do bloco de 3 vitórias e prevê o retorno do pivot. Quando surge um Empate, continua-se surfando sem desespero.',
    trapWarning: 'O Empate não quebra o surf nem reinicia a contagem! Siga a onda da tendência gráfica.',
    patternType: 'tendencia_surf_empate',
  },
  {
    id: 'pingpong',
    name: 'Padrão Ping-Pong / Xadrez (1x1)',
    category: 'Alternância',
    badgeColor: 'border-cyan-500/50 text-cyan-300 bg-cyan-950/40',
    icon: '🏓',
    shortDescription: 'Alternância perfeita de cores sem repetição (P-B-P-B ou V-P-V-P).',
    howItWorks: 'Acontece quando a mesa entra em momento de alta oscilação. A aposta busca a cor oposta da rodada anterior.',
    trapWarning: 'Atenção com armadilhas de "quebra dupla". Se a alternância estender por mais de 5 rodadas, o risco de criar um parzinho aumenta drasticamente.',
    patternType: 'pingpong',
  },
  {
    id: 'parzinho',
    name: 'Padrão Parzinho (2x2)',
    category: 'Pares Alternados',
    badgeColor: 'border-emerald-500/50 text-emerald-300 bg-emerald-950/40',
    icon: '👥',
    shortDescription: 'Sequência de pares duplos intercalados (2 Azuis, 2 Vermelhos).',
    howItWorks: 'Após a confirmação de 2 vitórias consecutivas de uma cor e a entrada da primeira vitória da cor contrária, aposta-se na repetição da segunda cor para completar o par.',
    trapWarning: 'Armadilha comum: transformar-se em 3x3 ou esticar para Surf. Nunca faça Gale sem verificar a dominância do ciclo.',
    patternType: 'parzinho',
  },
  {
    id: 'tripla',
    name: 'Padrão 3x3 (Blocos Triplos)',
    category: 'Série Média',
    badgeColor: 'border-purple-500/50 text-purple-300 bg-purple-950/40',
    icon: '🔺',
    shortDescription: 'Formação de blocos de 3 vitórias para cada lado (3x Player, 3x Banker).',
    howItWorks: 'Quando sai a 2ª cor de um novo bloco, projeta-se a 3ª rodada para fechar a tripla perfeita.',
    trapWarning: 'Se a 3ª rodada não fechar e virar 4x, o padrão converte para Surf/Dragão. Não teime contra o fluxo!',
    patternType: 'tripla',
  },
  {
    id: 'perninhas',
    name: 'Padrão Perninhas (2-1-2 ou 2-2-1)',
    category: 'Suporte & Resistência',
    badgeColor: 'border-amber-500/50 text-amber-300 bg-amber-950/40',
    icon: '🦵',
    shortDescription: 'Dois blocos de 2 vitórias separados por 1 vitória central isolada.',
    howItWorks: 'Identifica suporte visual onde a cor isolada serve de pivot para a perna contrária de mesmo tamanho.',
    trapWarning: 'Evite se a cor central for fruto de empate técnico ou se o gráfico estiver em momento de dominância extrema de uma única cor.',
    patternType: 'perninhas',
  },
  {
    id: 'rampas',
    name: 'Padrão Rampas (Degraus Escalonados)',
    category: 'Escala Sequencial',
    badgeColor: 'border-rose-500/50 text-rose-300 bg-rose-950/40',
    icon: '📐',
    shortDescription: 'Escada crescente ou decrescente (ex: 1x -> 2x -> 3x de uma cor).',
    howItWorks: 'Compara a altura dos degraus anteriores para prever o momento exato do próximo degrau completar a simetria.',
    trapWarning: 'Rampas incompletas são as maiores armadilhas da mesa. Sempre espere o 1º sinal de confirmação antes de entrar.',
    patternType: 'rampas',
  },
  {
    id: 'dragao',
    name: 'Padrão Dragão (Dominância 4+)',
    category: 'Tendência Extrema',
    badgeColor: 'border-red-500/50 text-red-300 bg-red-950/40',
    icon: '🐉',
    shortDescription: 'Sequência longa e ininterrupta de 4 ou mais vitórias seguidas da mesma cor.',
    howItWorks: 'Projeta a continuação da tendência enquanto a força do algoritmo mantiver a dominância acima de 75%.',
    trapWarning: 'Tentar "adivinhar a quebra" do Dragão na raça é o maior motivo de REDs. Siga o fluxo ou fique de fora!',
    patternType: 'dragao',
  },
  {
    id: 'surf',
    name: 'Padrão Surf (Onda de Tendência)',
    category: 'Fluxo Continuado',
    badgeColor: 'border-blue-500/50 text-blue-300 bg-blue-950/40',
    icon: '🏄',
    shortDescription: 'Navegação em cima de ondas de 3 a 5 vitórias consecutivas.',
    howItWorks: 'Surfa na cor que ganha momento no gráfico de linhas até que o padrão mostre exaustão estatística.',
    trapWarning: 'O Surf tem armadilhas em falso breakout (apenas 1 vitória e reverte). O Gale Inteligente é vital aqui.',
    patternType: 'surf',
  },
  {
    id: 'vpattern',
    name: 'Padrão V / Pós-Xadrez',
    category: 'Reversão de Ciclo',
    badgeColor: 'border-indigo-500/50 text-indigo-300 bg-indigo-950/40',
    icon: '✌️',
    shortDescription: 'Uma quebra abrupta após uma longa sequência de Ping-Pong formando um "V" no gráfico.',
    howItWorks: 'Detecta o exato instante em que o alternado (1x1) quebra com um bloco duplo, sinalizando virada de chave.',
    trapWarning: 'Armadilha: A mesa voltar imediatamente para ping-pong (falso V).',
    patternType: 'vpattern',
  },
  {
    id: 'torres',
    name: 'Padrão Torres Gêmeas (4x4)',
    category: 'Simetria Alta',
    badgeColor: 'border-amber-400/50 text-amber-200 bg-amber-950/40',
    icon: '🏰',
    shortDescription: 'Duas colunas altas idênticas de 4 vitórias seguidas lado a lado.',
    howItWorks: 'Acontece quando uma sequência de 4x de uma cor é espelhada imediatamente por 4x da cor contrária.',
    trapWarning: 'Se a 2ª torre ultrapassar 4 e ir para 5+, transforma-se em Dragão. Fique atento no 4º degrau.',
    patternType: 'torres',
  },
];

export const StrategiesAnalyticsView: React.FC<StrategiesAnalyticsViewProps> = ({ game, rounds }) => {
  const [selectedStrategy, setSelectedStrategy] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const isBacBo = game === 'bacbo';

  // Extract non-tie color sequence from rounds
  const parsedSequence = useMemo(() => {
    if (!rounds || !Array.isArray(rounds)) return [];
    const seq: { side: 'PLAYER' | 'BANKER'; timestamp: Date; id: string }[] = [];

    // process chronologically (oldest to newest)
    const sorted = [...rounds].sort(
      (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
    );

    for (const r of sorted) {
      if (!r) continue;
      let side: 'PLAYER' | 'BANKER' | null = null;
      if (isBacBo) {
        if (r.outcome === 'PlayerWon') side = 'PLAYER';
        else if (r.outcome === 'BankerWon') side = 'BANKER';
      } else {
        const color = String(r.color || '').toLowerCase();
        if (color === 'red') side = 'PLAYER'; // Red
        else if (color === 'black') side = 'BANKER'; // Black
      }
      if (side) {
        seq.push({
          side,
          timestamp: new Date(r.timestamp || Date.now()),
          id: r.id || String(Math.random()),
        });
      }
    }
    return seq;
  }, [rounds, isBacBo]);

  // Compute real statistics for each strategy
  const strategyStats = useMemo(() => {
    const totalRounds = parsedSequence.length;
    const results: Record<
      string,
      {
        count: number;
        percentage: number;
        avgIntervalMinutes: number;
        lastTimeText: string;
        intervalRangeText: string;
        topHours: { hour: string; count: number }[];
        minuteSlots: { slot: string; count: number; percentage: number }[];
        currentStatus: 'ACTIVE' | 'FORMING' | 'TRAP' | 'INACTIVE';
        statusText: string;
      }
    > = {};

    STRATEGIES.forEach((strat) => {
      const occurrences: { index: number; timestamp: Date }[] = [];
      const hourCounts: Record<number, number> = {};
      const slotCounts: Record<string, number> = {
        '00-10m': 0,
        '10-20m': 0,
        '20-30m': 0,
        '30-40m': 0,
        '40-50m': 0,
        '50-60m': 0,
      };

      // Match patterns in parsedSequence
      const n = parsedSequence.length;
      for (let i = 0; i < n; i++) {
        let isMatch = false;

        switch (strat.patternType) {
          case 'pingpong':
            if (i >= 3) {
              const s = parsedSequence.slice(i - 3, i + 1).map((x) => x.side);
              if (s[0] !== s[1] && s[1] !== s[2] && s[2] !== s[3]) isMatch = true;
            }
            break;

          case 'parzinho':
            if (i >= 3) {
              const s = parsedSequence.slice(i - 3, i + 1).map((x) => x.side);
              if (s[0] === s[1] && s[2] === s[3] && s[1] !== s[2]) isMatch = true;
            }
            break;

          case 'tripla':
            if (i >= 5) {
              const s = parsedSequence.slice(i - 5, i + 1).map((x) => x.side);
              if (s[0] === s[1] && s[1] === s[2] && s[3] === s[4] && s[4] === s[5] && s[2] !== s[3]) isMatch = true;
            }
            break;

          case 'perninhas':
            if (i >= 4) {
              const s = parsedSequence.slice(i - 4, i + 1).map((x) => x.side);
              if (s[0] === s[1] && s[2] !== s[1] && s[3] === s[4] && s[3] === s[1]) isMatch = true;
            }
            break;

          case 'rampas':
            if (i >= 5) {
              // Staircase 1x -> 2x -> 3x
              const s = parsedSequence.slice(i - 5, i + 1).map((x) => x.side);
              if (s[0] !== s[1] && s[1] === s[2] && s[2] !== s[3] && s[3] === s[4] && s[4] === s[5]) isMatch = true;
            }
            break;

          case 'dragao':
            if (i >= 3) {
              const s = parsedSequence.slice(i - 3, i + 1).map((x) => x.side);
              if (s[0] === s[1] && s[1] === s[2] && s[2] === s[3]) isMatch = true;
            }
            break;

          case 'surf':
            if (i >= 2) {
              const s = parsedSequence.slice(i - 2, i + 1).map((x) => x.side);
              if (s[0] === s[1] && s[1] === s[2]) isMatch = true;
            }
            break;

          case 'vpattern':
            if (i >= 4) {
              const s = parsedSequence.slice(i - 4, i + 1).map((x) => x.side);
              if (s[0] !== s[1] && s[1] !== s[2] && s[2] === s[3] && s[3] === s[4]) isMatch = true;
            }
            break;

          case 'colunas_espelho':
            if (i >= 5) {
              // Coluna de 2 ou 3 casas espelhada: e.g. [P, P, B, B, P, P] or [P, B, P, B, P, B]
              const s = parsedSequence.slice(i - 5, i + 1).map((x) => x.side);
              if (s[0] === s[1] && s[2] === s[3] && s[4] === s[5] && s[0] !== s[2]) isMatch = true;
            }
            break;

          case 'sanduiche_alternancia':
            if (i >= 2) {
              const s = parsedSequence.slice(i - 2, i + 1).map((x) => x.side);
              // Sandwich (A-B-A) or (B-A-B)
              if (s[0] === s[2] && s[0] !== s[1]) isMatch = true;
            }
            break;

          case 'maior_probabilidade':
            if (i >= 3) {
              // High probability bias check
              const slice = parsedSequence.slice(Math.max(0, i - 19), i + 1).map((x) => x.side);
              const pCount = slice.filter((x) => x === 'PLAYER').length;
              const ratio = pCount / slice.length;
              if (ratio >= 0.58 || ratio <= 0.42) isMatch = true;
            }
            break;

          case 'tendencia_surf_empate':
            if (i >= 4) {
              const s = parsedSequence.slice(i - 4, i + 1).map((x) => x.side);
              // 1-3-1 pattern: A - B - B - B - A
              if (s[1] === s[2] && s[2] === s[3] && s[0] !== s[1] && s[4] !== s[1]) isMatch = true;
            }
            break;

          case 'torres':
            if (i >= 7) {
              const s = parsedSequence.slice(i - 7, i + 1).map((x) => x.side);
              if (s[0] === s[1] && s[1] === s[2] && s[2] === s[3] &&
                  s[4] === s[5] && s[5] === s[6] && s[6] === s[7] && s[3] !== s[4]) {
                isMatch = true;
              }
            }
            break;

          default:
            break;
        }

        if (isMatch) {
          const t = parsedSequence[i].timestamp;
          occurrences.push({ index: i, timestamp: t });

          const hr = t.getHours();
          hourCounts[hr] = (hourCounts[hr] || 0) + 1;

          const min = t.getMinutes();
          if (min < 10) slotCounts['00-10m']++;
          else if (min < 20) slotCounts['10-20m']++;
          else if (min < 30) slotCounts['20-30m']++;
          else if (min < 40) slotCounts['30-40m']++;
          else if (min < 50) slotCounts['40-50m']++;
          else slotCounts['50-60m']++;
        }
      }

      // Top 5 hours
      const sortedHours = Object.entries(hourCounts)
        .map(([h, c]) => ({ hour: `${String(h).padStart(2, '0')}:00h`, count: c }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Fill up if fewer than 5
      while (sortedHours.length < 5) {
        const dummyHr = `${String((sortedHours.length * 3 + 12) % 24).padStart(2, '0')}:00h`;
        sortedHours.push({ hour: dummyHr, count: 0 });
      }

      // Interval math & Last occurrence time
      let totalTimeDiffMin = 0;
      let lastTimeText = 'Sem registro';
      let intervalRangeText = '~5 min';

      if (occurrences.length > 0) {
        const lastOcc = occurrences[occurrences.length - 1].timestamp;
        const now = Date.now();
        const diffMs = Math.max(0, now - lastOcc.getTime());
        const minAgo = Math.floor(diffMs / (1000 * 60));
        const secAgo = Math.floor((diffMs % (1000 * 60)) / 1000);

        if (minAgo < 1) {
          lastTimeText = `há ${secAgo}s`;
        } else if (minAgo < 60) {
          lastTimeText = `há ${minAgo}m`;
        } else {
          const hrsAgo = Math.floor(minAgo / 60);
          lastTimeText = `há ${hrsAgo}h ${minAgo % 60}m`;
        }

        if (occurrences.length > 1) {
          const firstTime = occurrences[0].timestamp.getTime();
          const lastTime = occurrences[occurrences.length - 1].timestamp.getTime();
          totalTimeDiffMin = Math.max(1, Math.round((lastTime - firstTime) / (1000 * 60)));
          const avgInterval = Math.max(1, Math.round(totalTimeDiffMin / (occurrences.length - 1)));
          intervalRangeText = `${avgInterval}-${avgInterval} min`;
        } else {
          intervalRangeText = '~4 min';
        }
      }

      const avgIntervalMinutes =
        occurrences.length > 1 ? Math.round(totalTimeDiffMin / (occurrences.length - 1)) : 15;

      // Minute slots formatting
      const countSum = occurrences.length || 1;
      const minuteSlots = Object.entries(slotCounts).map(([slot, cnt]) => ({
        slot,
        count: cnt,
        percentage: Math.round((cnt / countSum) * 100),
      }));

      // Current Status Evaluation on latest rounds
      let currentStatus: 'ACTIVE' | 'FORMING' | 'TRAP' | 'INACTIVE' = 'INACTIVE';
      let statusText = 'Sem padrão recente no gráfico';

      if (n >= 3) {
        const last3 = parsedSequence.slice(-3).map((x) => x.side);
        const last4 = n >= 4 ? parsedSequence.slice(-4).map((x) => x.side) : [];

        if (strat.patternType === 'pingpong') {
          if (last3[0] !== last3[1] && last3[1] !== last3[2]) {
            currentStatus = 'ACTIVE';
            statusText = '🔥 Ativo Agora! Alternância 1x1 em andamento';
          } else if (last3[1] === last3[2]) {
            currentStatus = 'TRAP';
            statusText = '⚠️ Armadilha! Alternância quebrada com bloco duplo';
          }
        } else if (strat.patternType === 'parzinho') {
          if (last4.length === 4 && last4[0] === last4[1] && last4[2] === last4[3] && last4[1] !== last4[2]) {
            currentStatus = 'ACTIVE';
            statusText = '🔥 Ativo Agora! Padrão 2x2 perfeitamente formado';
          } else if (last3[0] === last3[1] && last3[1] !== last3[2]) {
            currentStatus = 'FORMING';
            statusText = '⏳ Em Formação! Aguardando o 2º da cor contrária';
          }
        } else if (strat.patternType === 'dragao') {
          if (last4.length === 4 && last4[0] === last4[1] && last4[1] === last4[2] && last4[2] === last4[3]) {
            currentStatus = 'ACTIVE';
            statusText = '🐉 Dragão em Andamento! Dominância de 4+ vitórias';
          }
        } else if (strat.patternType === 'surf') {
          if (last3[0] === last3[1] && last3[1] === last3[2]) {
            currentStatus = 'ACTIVE';
            statusText = '🏄 Surf Ativo! Onda de 3+ vitórias seguidas';
          }
        } else if (strat.patternType === 'colunas_espelho') {
          if (last3[0] === last3[1]) {
            currentStatus = 'FORMING';
            statusText = '🏛️ Coluna Formando! Abriram 2 da mesma cor';
          }
        } else if (strat.patternType === 'sanduiche_alternancia') {
          if (last3[0] === last3[2] && last3[0] !== last3[1]) {
            currentStatus = 'ACTIVE';
            statusText = '🥪 Sanduíche Ativo! Alternância em andamento';
          }
        } else if (strat.patternType === 'maior_probabilidade') {
          currentStatus = 'ACTIVE';
          statusText = '📈 Operando estritamente na cor de maior porcentagem';
        } else if (strat.patternType === 'tendencia_surf_empate') {
          if (last3[0] === last3[1] && last3[1] === last3[2]) {
            currentStatus = 'ACTIVE';
            statusText = '🌊 Tendência 3x Ativa! Lembre-se: Empate é NULO';
          }
        }
      }

      const percentage = totalRounds > 0 ? parseFloat(((occurrences.length / totalRounds) * 100).toFixed(1)) : 0;

      results[strat.id] = {
        count: occurrences.length,
        percentage,
        avgIntervalMinutes,
        lastTimeText,
        intervalRangeText,
        topHours: sortedHours,
        minuteSlots,
        currentStatus,
        statusText,
      };
    });

    return results;
  }, [parsedSequence]);

  const filteredStrategies = useMemo(() => {
    return STRATEGIES.filter((s) => {
      const matchCat = selectedStrategy === 'all' || s.category === selectedStrategy;
      const matchSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.shortDescription.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [selectedStrategy, searchTerm]);

  return (
    <div className="space-y-6">
      {/* 🌟 MANIFESTO BANNER: AUTENTICIDADE E VERDADE 🌟 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 border-2 border-cyan-500/40 p-6 shadow-2xl shadow-cyan-950/50">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-800/40 pb-3">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-amber-500 text-slate-950 shadow-lg font-black text-xl">
                🧠
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide flex items-center gap-2">
                  MANIFESTO DE INTELIGÊNCIA & AUTENTICIDADE
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 uppercase tracking-wider">
                    V-7.0 Padrões
                  </span>
                </h2>
                <p className="text-xs text-slate-300 font-medium">
                  Análise do passado para assegurar a tomada de decisão no presente.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-emerald-500/40 text-xs font-bold text-emerald-400">
              <Cpu className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Base Histórica: {parsedSequence.length} Jogadas Reais Analisadas</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs leading-relaxed text-slate-200">
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center space-x-2 text-amber-400 font-bold">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Nossa Filosofia Operacional</span>
              </div>
              <p className="text-slate-300">
                <strong className="text-white">Nós não fomos projetados para simplesmente seguir essas estratégias.</strong> Elas ajudam? <span className="text-emerald-400 font-bold">Sim!</span> Dependemos delas 100%? <span className="text-rose-400 font-bold">Não!</span>
              </p>
              <p className="text-slate-300">
                O que fazemos? <strong className="text-cyan-300">Analisamos, buscamos e comparamos os dados reais.</strong> Olhamos para o passado para assegurar o futuro... Pegamos cada estratégia e verificamos se faz sentido aplicar no momento exato ou se é uma <span className="text-amber-400 font-bold">armadilha do algoritmo</span>.
              </p>
            </div>

            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>O Que Somos?</span>
              </div>
              <p className="text-slate-300 font-medium italic border-l-2 border-emerald-500 pl-3 py-1">
                "Autênticos e verdadeiros. Alguém que não faz algo simplesmente porque todos fazem... Tomo minhas próprias decisões segundo as leis da estatística e da lógica, desde que traga benefícios reais e consistentes a todos!"
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 🔍 FILTER TOOLBAR 🔍 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-xs font-bold text-slate-300">Categorias:</span>
          <select
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-cyan-300 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Todas as Estratégias (9)</option>
            <option value="Alternância">Alternância (Ping-Pong)</option>
            <option value="Pares Alternados">Pares Alternados (2x2)</option>
            <option value="Série Média">Séries Médias (3x3)</option>
            <option value="Suporte & Resistência">Perninhas (2-1-2)</option>
            <option value="Escala Sequencial">Rampas</option>
            <option value="Tendência Extrema">Dragão (4+)</option>
            <option value="Fluxo Continuado">Surf (Ondas)</option>
            <option value="Reversão de Ciclo">Padrão V</option>
            <option value="Simetria Alta">Torres Gêmeas</option>
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Buscar padrão ou estratégia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* 📊 STRATEGY CARDS GRID 📊 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredStrategies.map((strat) => {
          const stats = strategyStats[strat.id] || {
            count: 0,
            percentage: 0,
            avgIntervalMinutes: 15,
            lastTimeText: 'Sem registro',
            intervalRangeText: '~5 min',
            topHours: [],
            minuteSlots: [],
            currentStatus: 'INACTIVE',
            statusText: 'Aguardando dados',
          };

          return (
            <div
              key={strat.id}
              className="bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-slate-700 p-5 space-y-4 shadow-xl transition-all duration-300 flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header Badge & Name */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-2xl p-1.5 rounded-xl bg-slate-950 border border-slate-800">
                      {strat.icon}
                    </span>
                    <div>
                      <h3 className="text-sm font-extrabold text-white leading-snug">
                        {strat.name}
                      </h3>
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${strat.badgeColor} mt-1`}>
                        {strat.category}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className={`p-2 rounded-xl text-xs font-bold border flex items-center space-x-2 ${
                  stats.currentStatus === 'ACTIVE'
                    ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                    : stats.currentStatus === 'FORMING'
                    ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 animate-pulse'
                    : stats.currentStatus === 'TRAP'
                    ? 'bg-rose-950/80 border-rose-500/60 text-rose-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400'
                }`}>
                  {stats.currentStatus === 'ACTIVE' && <Zap className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />}
                  {stats.currentStatus === 'FORMING' && <Clock className="w-3.5 h-3.5 text-amber-400" />}
                  {stats.currentStatus === 'TRAP' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                  {stats.currentStatus === 'INACTIVE' && <Layers className="w-3.5 h-3.5 text-slate-500" />}
                  <span className="text-[11px] truncate">{stats.statusText}</span>
                </div>

                {/* Descriptions */}
                <p className="text-xs text-slate-300 font-medium leading-relaxed bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
                  {strat.shortDescription}
                </p>

                {/* Dynamic Stats Grid (4 Metrics) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Ocorrências</span>
                    <span className="text-sm font-black text-cyan-400">{stats.count}x</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Frequência %</span>
                    <span className="text-sm font-black text-emerald-400">{stats.percentage}%</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Última Vez</span>
                    <span className="text-xs font-bold text-rose-300 mt-0.5 block">{stats.lastTimeText}</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Intervalo Médio</span>
                    <span className="text-xs font-bold text-amber-300 mt-0.5 block">{stats.intervalRangeText}</span>
                  </div>
                </div>

                {/* Top 5 Hours Section */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                    <span className="flex items-center gap-1 text-cyan-400">
                      <Clock className="w-3 h-3" /> As 5 Melhores Horas
                    </span>
                    <span className="text-[10px] text-slate-400">Top Frequência</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {stats.topHours.map((th, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-center flex flex-col items-center justify-center"
                      >
                        <span className="text-[10px] text-slate-300 font-mono font-bold">{th.hour}</span>
                        <span className="text-[10px] font-black text-cyan-300">{th.count}x</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 10-Minute Intervals Distribution */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <BarChart3 className="w-3 h-3" /> Distribuição (10 em 10 Minutos)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {stats.minuteSlots.map((slot) => (
                      <div key={slot.slot} className="bg-slate-950 p-1.5 rounded-lg border border-slate-800/80 text-[10px]">
                        <div className="flex justify-between font-mono text-slate-400 mb-0.5">
                          <span>{slot.slot}</span>
                          <span className="text-emerald-400 font-bold">{slot.count}x</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, slot.percentage * 2)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trap & Operational Explanation */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] text-slate-300 space-y-1">
                    <strong className="text-cyan-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Lógica Operacional:
                    </strong>
                    <p className="text-[11px] text-slate-400 leading-tight">{strat.howItWorks}</p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-200 space-y-1">
                    <strong className="text-amber-400 flex items-center gap-1 font-bold">
                      <AlertTriangle className="w-3 h-3" /> Alerta de Armadilha:
                    </strong>
                    <p className="leading-tight text-amber-100/90">{strat.trapWarning}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
