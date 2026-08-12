import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AIAnalysisReport, GameType } from '../types';
import { saveSignalToFirebase, saveAiConfigToFirebase, subscribeFirebaseAiConfig } from '../lib/firebaseService';
import { filterEventsByDate } from '../utils/analyticsEngine';
import { Sparkles, Brain, AlertTriangle, RefreshCw, ShieldCheck, Zap, Key, Cpu, Eye, EyeOff, Save, CheckCircle2, Play, Pause, History, Award, Filter } from 'lucide-react';

interface AiAnalystPanelProps {
  game: GameType;
  rounds: any[];
}

type ProviderType = 'gemini' | 'openrouter' | 'nvidia';

interface ProviderConfig {
  id: ProviderType;
  name: string;
  badge: string;
  color: string;
  defaultModel: string;
  models: { id: string; name: string }[];
  placeholderKey: string;
  docsUrl: string;
}

export interface EvaluatedSignal {
  id: string;
  timestamp: string;
  game: GameType;
  action: string;
  target: string;
  confidence: number;
  provider: string;
  model: string;
  rationale: string;
  result?: 'GREEN' | 'RED' | 'TIE';
  triggerRoundId?: string;
}

const AI_PROVIDERS: Record<ProviderType, ProviderConfig> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'Google GenAI',
    color: 'from-cyan-500 to-blue-600',
    defaultModel: 'gemini-3.6-flash',
    models: [
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Padrão & Recomendado)' },
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (Ultrarrápido)' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview (Análise Profunda)' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite (Leve & Rápido)' },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
      { id: 'gemini-flash-latest', name: 'Gemini Flash Latest' },
      { id: 'gemini-pro-latest', name: 'Gemini Pro Latest' },
      { id: 'gemini-flash-lite-latest', name: 'Gemini Flash-Lite Latest' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Estável)' },
    ],
    placeholderKey: 'AIzaSy...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter AI',
    badge: 'Multi-LLM Hub',
    color: 'from-purple-500 to-indigo-600',
    defaultModel: 'openai/gpt-4o-mini',
    models: [
      { id: 'openai/gpt-4o-mini', name: 'OpenAI GPT-4o Mini' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (Raciocínio)' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
      { id: 'google/gemini-2.0-flash-001', name: 'Google Gemini 2.0 Flash' },
      { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B' },
    ],
    placeholderKey: 'sk-or-v1-...',
    docsUrl: 'https://openrouter.ai/keys',
  },
  nvidia: {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    badge: 'Free / Pro Tier',
    color: 'from-emerald-500 to-teal-600',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    models: [
      { id: 'meta/llama-3.3-70b-instruct', name: 'Meta Llama 3.3 70B Instruct (Grátis)' },
      { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1 (Grátis NIM)' },
      { id: 'mistralai/mistral-large-2-instruct', name: 'Mistral Large 2 (Grátis NIM)' },
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'NVIDIA Nemotron 70B' },
    ],
    placeholderKey: 'nvapi-...',
    docsUrl: 'https://build.nvidia.com',
  },
};

export const AiAnalystPanel: React.FC<AiAnalystPanelProps> = ({ game, rounds }) => {
  const [activeProvider, setActiveProvider] = useState<ProviderType>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.6-flash');
  const [apiKeys, setApiKeys] = useState<Record<ProviderType, string>>({
    gemini: '',
    openrouter: '',
    nvidia: '',
  });

  // Date Filter State
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');

  const filteredRounds = useMemo(() => {
    return filterEventsByDate(rounds, selectedDateFilter);
  }, [rounds, selectedDateFilter]);

  const [showKey, setShowKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AIAnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Automatic Signal Generation & Accuracy History
  const [autoMode, setAutoMode] = useState<boolean>(false);
  const [signalHistory, setSignalHistory] = useState<EvaluatedSignal[]>([]);
  const lastAnalyzedRoundRef = useRef<string | null>(null);

  // Load saved config & signal history on mount and game changes
  useEffect(() => {
    // 1. LocalStorage config
    try {
      const localConfig = localStorage.getItem(`cassino_v7_ai_config_${game}`) || localStorage.getItem('cassino_v7_ai_config');
      if (localConfig) {
        const parsed = JSON.parse(localConfig);
        if (parsed.provider && AI_PROVIDERS[parsed.provider as ProviderType]) {
          setActiveProvider(parsed.provider as ProviderType);
        }
        if (parsed.model) {
          setSelectedModel(parsed.model);
        }
        if (parsed.apiKeys) setApiKeys((prev) => ({ ...prev, ...parsed.apiKeys }));
      }

      const savedAuto = localStorage.getItem(`cassino_v7_ai_auto_${game}`);
      setAutoMode(savedAuto ? JSON.parse(savedAuto) : false);

      const savedHist = localStorage.getItem(`cassino_v7_ai_history_${game}`);
      setSignalHistory(savedHist ? JSON.parse(savedHist) : []);
      lastAnalyzedRoundRef.current = null;
    } catch (e) {
      console.error('Error reading localStorage AI config:', e);
    }

    // 2. Firebase RTDB Sync per game
    const unsubscribe = subscribeFirebaseAiConfig(game, (remoteConfig) => {
      if (remoteConfig) {
        if (remoteConfig.provider && AI_PROVIDERS[remoteConfig.provider as ProviderType]) {
          setActiveProvider(remoteConfig.provider as ProviderType);
        }
        if (remoteConfig.model) {
          setSelectedModel(remoteConfig.model);
        }
        if (remoteConfig.apiKeys) {
          setApiKeys((prev) => ({ ...prev, ...remoteConfig.apiKeys }));
        }
      }
    });

    return () => unsubscribe();
  }, [game]);

  // Persist signal history changes
  useEffect(() => {
    try {
      localStorage.setItem(`cassino_v7_ai_history_${game}`, JSON.stringify(signalHistory.slice(0, 100)));
    } catch (e) {
      console.error('Error saving signal history:', e);
    }
  }, [signalHistory, game]);

  // Toggle Auto-Mode
  const toggleAutoMode = () => {
    const nextVal = !autoMode;
    setAutoMode(nextVal);
    localStorage.setItem(`cassino_v7_ai_auto_${game}`, JSON.stringify(nextVal));
  };

  const handleProviderChange = (prov: ProviderType) => {
    setActiveProvider(prov);
    setSelectedModel(AI_PROVIDERS[prov].defaultModel);
  };

  const currentApiKey = apiKeys[activeProvider] || '';
  const effectiveModel = selectedModel;

  const handleSaveConfig = async () => {
    const payload = {
      provider: activeProvider,
      model: effectiveModel,
      apiKeys,
    };
    try {
      localStorage.setItem(`cassino_v7_ai_config_${game}`, JSON.stringify(payload));
      localStorage.setItem('cassino_v7_ai_config', JSON.stringify(payload));
      await saveAiConfigToFirebase(game, payload);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        setShowSettings(false);
      }, 700);
    } catch (e) {
      console.error('Error saving AI config:', e);
    }
  };

  const triggerAiAnalysis = async () => {
    if (!rounds || rounds.length === 0) return;
    setLoading(true);
    setError(null);

    const currentTriggerRoundId = rounds[0]?.id || String(Date.now());

    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game,
          rounds,
          provider: activeProvider,
          model: effectiveModel,
          apiKey: currentApiKey,
        }),
      });

      const data = await res.json();
      if (data.success && data.report) {
        setReport(data.report);

        if (data.report.recommendedSignal) {
          const recSig = data.report.recommendedSignal;

          // Save AI signal to Firebase Realtime Database
          await saveSignalToFirebase({
            game,
            type: 'AI',
            action: recSig.action,
            confidence: recSig.confidence,
            pattern: `IA (${AI_PROVIDERS[activeProvider].name} - ${effectiveModel})`,
            rationale: recSig.rationale || data.report.summary,
            timestamp: new Date().toISOString(),
          });

          // Create local signal history entry for outcome evaluation
          const newSignalEntry: EvaluatedSignal = {
            id: `sig_${Date.now()}`,
            timestamp: new Date().toISOString(),
            game,
            action: recSig.action,
            target: recSig.target || recSig.action,
            confidence: recSig.confidence,
            provider: AI_PROVIDERS[activeProvider].name,
            model: effectiveModel,
            rationale: recSig.rationale,
            triggerRoundId: currentTriggerRoundId,
          };

          setSignalHistory((prev) => [newSignalEntry, ...prev.slice(0, 99)]);
        }
      } else {
        setError(data.error || 'Não foi possível gerar a análise no momento.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro de conexão ao solicitar IA.');
    } finally {
      setLoading(false);
    }
  };

  // Evaluate previous signals and auto-trigger on new rounds
  useEffect(() => {
    if (!rounds || rounds.length === 0) return;
    const latestRound = rounds[0];
    if (!latestRound || !latestRound.id) return;

    // 1. Evaluate any pending signals in signalHistory
    setSignalHistory((prevHistory) => {
      let updated = false;
      const nextList = prevHistory.map((sig) => {
        if (sig.result !== undefined) return sig;
        if (sig.triggerRoundId === latestRound.id) return sig;

        let result: 'GREEN' | 'RED' | 'TIE' = 'RED';
        const actionText = (sig.action + ' ' + sig.target).toLowerCase();

        if (game === 'bacbo') {
          const outcome = latestRound.outcome;
          if (actionText.includes('player') || actionText.includes('azul') || actionText.includes('🔵')) {
            if (outcome === 'PlayerWon') result = 'GREEN';
            else if (outcome === 'Tie') result = 'TIE';
            else result = 'RED';
          } else if (actionText.includes('banker') || actionText.includes('vermelho') || actionText.includes('🔴')) {
            if (outcome === 'BankerWon') result = 'GREEN';
            else if (outcome === 'Tie') result = 'TIE';
            else result = 'RED';
          } else if (actionText.includes('empate') || actionText.includes('tie') || actionText.includes('🟡')) {
            if (outcome === 'Tie') result = 'GREEN';
            else result = 'RED';
          }
        } else {
          // Roulette
          const color = latestRound.color;
          const num = latestRound.number;
          if (actionText.includes('vermelh') || actionText.includes('red') || actionText.includes('🔴')) {
            if (color === 'red') result = 'GREEN';
            else if (num === 0) result = 'TIE';
            else result = 'RED';
          } else if (actionText.includes('pret') || actionText.includes('black') || actionText.includes('🖤')) {
            if (color === 'black') result = 'GREEN';
            else if (num === 0) result = 'TIE';
            else result = 'RED';
          } else if (actionText.includes('zero') || actionText.includes('verde') || actionText.includes('🟢')) {
            if (num === 0) result = 'GREEN';
            else result = 'RED';
          }
        }

        updated = true;
        return { ...sig, result };
      });

      return updated ? nextList : prevHistory;
    });

    // 2. Auto-Trigger next prediction if autoMode is enabled and it's a new round
    if (autoMode && !loading && lastAnalyzedRoundRef.current !== latestRound.id) {
      lastAnalyzedRoundRef.current = latestRound.id;
      triggerAiAnalysis();
    }
  }, [rounds, autoMode, game, loading]);

  // Assertiveness statistics
  const evaluatedSignals = signalHistory.filter((s) => s.result !== undefined);
  const greens = evaluatedSignals.filter((s) => s.result === 'GREEN').length;
  const reds = evaluatedSignals.filter((s) => s.result === 'RED').length;
  const ties = evaluatedSignals.filter((s) => s.result === 'TIE').length;
  const totalDecisive = greens + reds;
  const winRate = totalDecisive > 0 ? Math.round((greens / totalDecisive) * 100) : 100;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header & Mode Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-cyan-400" />
            Central de Inteligência Preditiva (Multi-IA)
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Provedor: <span className="text-cyan-400 font-semibold">{AI_PROVIDERS[activeProvider].name}</span> ({effectiveModel}). Resposta direta com assertividade em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Auto Mode Toggle Button */}
          <button
            onClick={toggleAutoMode}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-2 shadow-md ${
              autoMode
                ? 'bg-emerald-950 text-emerald-300 border-emerald-500 shadow-emerald-900/30'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            {autoMode ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <Pause className="w-3.5 h-3.5 text-emerald-400" />
                <span>Auto-Sinal IA: LIGADO</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-slate-400" />
                <span>Auto-Sinal IA: DESLIGADO</span>
              </>
            )}
          </button>

          {/* Config Key Button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 ${
              showSettings
                ? 'bg-slate-800 text-cyan-400 border-cyan-500'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Key className="w-4 h-4 text-amber-400" />
            <span>Configurar API Key / Modelo</span>
          </button>

          {/* Manual Trigger Button */}
          <button
            id="btn-trigger-ai"
            onClick={triggerAiAnalysis}
            disabled={loading || rounds.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 via-emerald-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-cyan-900/40 transition-all flex items-center space-x-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Processando IA (5s)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Gerar Análise IA Agora</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-cyan-400" />
          <span className="font-extrabold text-white uppercase tracking-wider">Filtro de Data (Estatísticas & Análise):</span>
          <span className="text-[11px] text-slate-400">({filteredRounds.length} rodadas)</span>
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
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accuracy Statistics Bar */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Assertividade dos Sinais IA
            </div>
            <div className="text-sm font-extrabold text-white font-mono flex items-center gap-2">
              <span className="text-emerald-400">{winRate}% de Taxa de Acerto</span>
              <span className="text-xs text-slate-500">({evaluatedSignals.length} sinais avaliados)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono font-bold">
          <span className="px-3 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 rounded-lg flex items-center gap-1">
            🟢 {greens} Greens
          </span>
          <span className="px-3 py-1 bg-rose-950/80 text-rose-400 border border-rose-800/80 rounded-lg flex items-center gap-1">
            🔴 {reds} Reds
          </span>
          <span className="px-3 py-1 bg-amber-950/80 text-amber-400 border border-amber-800/80 rounded-lg flex items-center gap-1">
            🟡 {ties} Empates
          </span>
        </div>
      </div>

      {/* AI Provider & API Key Control Drawer */}
      {showSettings && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Configuração do Provedor de IA
            </h4>
            {savedSuccess && (
              <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Salvo com Sucesso!
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Provider Dropdown Select */}
            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1.5">
                Provedor de IA:
              </label>
              <select
                value={activeProvider}
                onChange={(e) => handleProviderChange(e.target.value as ProviderType)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white outline-none cursor-pointer"
              >
                {(Object.keys(AI_PROVIDERS) as ProviderType[]).map((provKey) => {
                  const prov = AI_PROVIDERS[provKey];
                  const hasKey = Boolean(apiKeys[provKey]);
                  return (
                    <option key={provKey} value={provKey}>
                      {prov.name} ({prov.badge}) {hasKey ? '✓ Key Configurada' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 2. Model Dropdown Select */}
            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1.5">
                Modelo de IA:
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white outline-none cursor-pointer"
              >
                {AI_PROVIDERS[activeProvider].models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. API Key EditText for currently selected provider */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-white block">
                  Chave de API (API Key) para <span className="text-cyan-400 font-black">{AI_PROVIDERS[activeProvider].name}</span>:
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Obtenha em: <a href={AI_PROVIDERS[activeProvider].docsUrl} target="_blank" rel="noreferrer" className="text-cyan-400 underline">{AI_PROVIDERS[activeProvider].docsUrl}</a>
                </p>
              </div>
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeys[activeProvider] || ''}
                onChange={(e) =>
                  setApiKeys({
                    ...apiKeys,
                    [activeProvider]: e.target.value,
                  })
                }
                placeholder={
                  activeProvider === 'gemini'
                    ? 'Opcional se GEMINI_API_KEY existir no servidor, ou insira a sua'
                    : AI_PROVIDERS[activeProvider].placeholderKey
                }
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-600 outline-none pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-slate-500 font-mono">
                Modelo selecionado: <span className="text-amber-400 font-bold">{effectiveModel}</span>
              </span>
              <button
                onClick={handleSaveConfig}
                className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-extrabold rounded-xl text-xs transition-all flex items-center space-x-2 shadow-lg shadow-cyan-900/40"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Configurações</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!report && !loading && !error && (
        <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center mx-auto text-cyan-400">
            <Brain className="w-6 h-6 animate-pulse" />
          </div>
          <h4 className="text-sm font-bold text-white">Análise Preditiva Pronta para Disparo</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Provedor ativo: <span className="text-cyan-400 font-bold">{AI_PROVIDERS[activeProvider].name}</span> ({effectiveModel}). Clique acima ou ative o modo <span className="text-emerald-400 font-bold">Auto-Sinal</span> para receber previsões automáticas a cada nova rodada.
          </p>
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Recommended AI Signal Banner */}
          {report.recommendedSignal && (
            <div className="bg-gradient-to-r from-emerald-950/90 via-slate-950 to-cyan-950/90 p-5 rounded-2xl border border-emerald-500/50 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2.5">
                <span className="text-sm font-black text-emerald-400 tracking-wider flex items-center gap-2">
                  🎲 Entrada confirmada 🎯
                </span>
                <span className="text-xs font-mono font-black text-cyan-300 bg-cyan-950/90 px-3 py-1 rounded-lg border border-cyan-800">
                  Confiança: {report.recommendedSignal.confidence}%
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="text-base font-black text-white font-mono flex items-center gap-2">
                  <span>{report.recommendedSignal.action}</span>
                </div>
                <div className="text-xs font-bold text-amber-400 font-mono">
                  {report.recommendedSignal.tieProtection || 'Proteja o empate 🟡'}
                </div>
              </div>

              {/* Probabilities Bar if available */}
              {report.recommendedSignal.probabilities && (
                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1.5 font-mono text-xs">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Probabilidades Calculadas:
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-blue-950/60 border border-blue-800/60 p-1.5 rounded-lg text-blue-300">
                      <div className="text-[10px] opacity-80">{game === 'roulette' ? '🔴 Vermelho' : '🔵 Player'}</div>
                      <div className="font-black text-sm">{report.recommendedSignal.probabilities.playerOrRed ?? 50}%</div>
                    </div>
                    <div className="bg-rose-950/60 border border-rose-800/60 p-1.5 rounded-lg text-rose-300">
                      <div className="text-[10px] opacity-80">{game === 'roulette' ? '🖤 Preto' : '🔴 Banker'}</div>
                      <div className="font-black text-sm">{report.recommendedSignal.probabilities.bankerOrBlack ?? 40}%</div>
                    </div>
                    <div className="bg-amber-950/60 border border-amber-800/60 p-1.5 rounded-lg text-amber-300">
                      <div className="text-[10px] opacity-80">{game === 'roulette' ? '🟢 Zero' : '🟡 Empate'}</div>
                      <div className="font-black text-sm">{report.recommendedSignal.probabilities.tieOrZero ?? 10}%</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 text-xs text-slate-300 leading-relaxed font-sans border-t border-slate-800/80">
                <span className="font-bold text-slate-400 uppercase text-[10px] block mb-0.5">Razão Resumida:</span>
                {report.recommendedSignal.rationale}
              </div>
            </div>
          )}

          {/* Executive Overview & Risk Badge */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-cyan-400">Resumo Executivo do Comportamento</span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {report.provider || activeProvider} • {report.model || effectiveModel}
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-sans">{report.summary}</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Nível de Risco Operacional</span>
                <div className="flex items-center space-x-2 mt-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase font-mono ${
                      report.riskLevel === 'Baixo'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : report.riskLevel === 'Médio'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}
                  >
                    Risco {report.riskLevel}
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-3">
                Processado em: {new Date(report.timestamp).toLocaleTimeString('pt-BR')} ({report.roundsAnalyzed} rodadas)
              </div>
            </div>
          </div>

          {/* Micro Seasonal & Anomaly Trends */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <h5 className="text-xs font-extrabold text-amber-400 uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" /> Viés Estatístico Detectado
              </h5>
              <p className="text-xs text-slate-300 font-sans">{report.biasDetected}</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <h5 className="text-xs font-extrabold text-cyan-400 uppercase flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" /> Tendências Micro-Sazonais
              </h5>
              <ul className="space-y-1">
                {report.microSeasonalTrends?.map((trend, idx) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start space-x-2">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span>{trend}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Signal History & Result Log */}
      {signalHistory.length > 0 && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              Histórico de Sinais Gerados pela IA
            </h4>
            <span className="text-[10px] font-mono text-slate-500">
              Últimos {signalHistory.length} sinais
            </span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
            {signalHistory.map((sig) => {
              const formattedTime = new Date(sig.timestamp).toLocaleTimeString('pt-BR');

              return (
                <div
                  key={sig.id}
                  className="bg-slate-900 p-3 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-[10px] text-slate-500 font-mono">{formattedTime}</span>
                    <span className="font-bold text-white">{sig.action}</span>
                    <span className="text-[10px] text-cyan-400 font-bold">({sig.confidence}%)</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {sig.result === 'GREEN' && (
                      <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-lg text-[10px] font-black">
                        🟢 GREEN (Acertou)
                      </span>
                    )}
                    {sig.result === 'RED' && (
                      <span className="px-2.5 py-1 bg-rose-950 text-rose-400 border border-rose-800 rounded-lg text-[10px] font-black">
                        🔴 RED (Errou)
                      </span>
                    )}
                    {sig.result === 'TIE' && (
                      <span className="px-2.5 py-1 bg-amber-950 text-amber-400 border border-amber-800 rounded-lg text-[10px] font-black">
                        🟡 EMPATE PROTEGIDO
                      </span>
                    )}
                    {sig.result === undefined && (
                      <span className="px-2.5 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg text-[10px] font-bold animate-pulse">
                        ⏳ Aguardando Resultado...
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
