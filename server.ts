import express from 'express';
import path from 'path';
import { spawn } from 'child_process';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { parseBacBoEvent, parseRouletteEvent } from './src/utils/gameParsers.js';
import { BacBoEvent, RawEvolutionItem, RouletteEvent } from './src/types.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '5mb' }));

// In-memory persistent data accumulator store for past rounds (starts 100% clean)
const bacboStore = new Map<string, BacBoEvent>();
const autoRouletteStore = new Map<string, RouletteEvent>();
const immersiveRouletteStore = new Map<string, RouletteEvent>();

// Helper to fetch Evolution API
async function fetchEvolutionApi(endpointUrl: string): Promise<RawEvolutionItem[]> {
  try {
    const res = await fetch(endpointUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      console.warn(`[Evolution API Warning] HTTP ${res.status} for ${endpointUrl}`);
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (data && Array.isArray((data as any).content)) return (data as any).content;
    return [];
  } catch (err: any) {
    console.warn(`[Evolution API Warning] ${err.message}`);
    return [];
  }
}

// Route: Proxy BacBo
app.get('/api/proxy/bacbo', async (req, res) => {
  try {
    const size = req.query.size || '30';
    const url = `https://api-cs.casino.org/svc-evolution-game-events/api/bacbo?page=0&size=${size}&sort=data%2Cdesc`;
    const rawItems = await fetchEvolutionApi(url);

    const parsedList: BacBoEvent[] = [];
    for (const item of rawItems) {
      const parsed = parseBacBoEvent(item);
      if (parsed) {
        bacboStore.set(parsed.id, parsed);
        parsedList.push(parsed);
      }
    }

    // Sort descending by timestamp
    const allStored = Array.from(bacboStore.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    res.json({
      success: true,
      latest: parsedList,
      totalAccumulated: allStored.length,
      history: allStored.slice(0, 300),
    });
  } catch (err: any) {
    console.error('BacBo Proxy Error:', err.message);
    const fallbackHistory = Array.from(bacboStore.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    res.json({
      success: false,
      error: err.message,
      latest: [],
      totalAccumulated: fallbackHistory.length,
      history: fallbackHistory.slice(0, 300),
    });
  }
});

// Route: Proxy Auto Roulette
app.get('/api/proxy/autoroulette', async (req, res) => {
  try {
    const size = req.query.size || '30';
    const url = `https://api-cs.casino.org/svc-evolution-game-events/api/autoroulette?page=0&size=${size}&sort=data%2Cdesc`;
    const rawItems = await fetchEvolutionApi(url);

    const parsedList: RouletteEvent[] = [];
    for (const item of rawItems) {
      const parsed = parseRouletteEvent(item);
      if (parsed) {
        autoRouletteStore.set(parsed.id, parsed);
        parsedList.push(parsed);
      }
    }

    const allStored = Array.from(autoRouletteStore.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    res.json({
      success: true,
      latest: parsedList,
      totalAccumulated: allStored.length,
      history: allStored.slice(0, 300),
    });
  } catch (err: any) {
    console.error('AutoRoulette Proxy Error:', err.message);
    const fallbackHistory = Array.from(autoRouletteStore.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    res.json({
      success: false,
      error: err.message,
      latest: [],
      totalAccumulated: fallbackHistory.length,
      history: fallbackHistory.slice(0, 300),
    });
  }
});

// Route: Proxy Immersive Roulette
app.get('/api/proxy/immersiveroulette', async (req, res) => {
  try {
    const size = req.query.size || '30';
    const url = `https://api-cs.casino.org/svc-evolution-game-events/api/immersiveroulette?page=0&size=${size}&sort=data%2Cdesc`;
    const rawItems = await fetchEvolutionApi(url);

    const parsedList: RouletteEvent[] = [];
    for (const item of rawItems) {
      const parsed = parseRouletteEvent(item);
      if (parsed) {
        immersiveRouletteStore.set(parsed.id, parsed);
        parsedList.push(parsed);
      }
    }

    const allStored = Array.from(immersiveRouletteStore.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    res.json({
      success: true,
      latest: parsedList,
      totalAccumulated: allStored.length,
      history: allStored.slice(0, 300),
    });
  } catch (err: any) {
    console.error('ImmersiveRoulette Proxy Error:', err.message);
    const fallbackHistory = Array.from(immersiveRouletteStore.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    res.json({
      success: false,
      error: err.message,
      latest: [],
      totalAccumulated: fallbackHistory.length,
      history: fallbackHistory.slice(0, 300),
    });
  }
});

// Multi-Provider AI Pattern Analyst (Gemini, OpenRouter, NVIDIA NIM, OpenAI)
app.post('/api/ai-analysis', async (req, res) => {
  try {
    const { game, rounds, provider = 'gemini', model, apiKey } = req.body;
    if (!rounds || !Array.isArray(rounds) || rounds.length === 0) {
      return res.status(400).json({ error: 'Nenhum histórico fornecido para análise.' });
    }

    const recentSample = rounds.slice(0, 30);

    let prompt = '';
    if (game === 'bacbo') {
      let playerWins = 0;
      let bankerWins = 0;
      let ties = 0;
      const last5 = recentSample.slice(0, 5).map((r: any) => r.outcome || r.winner || 'PlayerWon');

      recentSample.forEach((r: any) => {
        const outcome = r.outcome || r.winner;
        if (outcome === 'PlayerWon') playerWins++;
        else if (outcome === 'BankerWon') bankerWins++;
        else if (outcome === 'Tie') ties++;
      });

      prompt = `Você é o algoritmo de inteligência artificial preditiva sênior do CASSINO V-7.0 especializado em BAC BO ao vivo.

DADOS REAIS PROCESSADOS DAS ÚLTIMAS ${recentSample.length} RODADAS DA MESA:
- Vitórias do Player (🔵): ${playerWins} (${Math.round((playerWins / recentSample.length) * 100)}%)
- Vitórias do Banker (🔴): ${bankerWins} (${Math.round((bankerWins / recentSample.length) * 100)}%)
- Empates (🟡): ${ties} (${Math.round((ties / recentSample.length) * 100)}%)
- Sequência das últimas 5 rodadas (da mais recente para a mais antiga): ${JSON.stringify(last5)}

INSTRUÇÕES ESTATÍSTICAS FUNDAMENTAIS (ATENÇÃO OBRIGATÓRIA):
1. Analise o padrão recente (ex: sequências seguidas de Banker 🔴, recuperação do Player 🔵, alternância 🔵🔴, ou iminência estatística de Empate 🟡).
2. NUNCA dê sempre a mesma resposta! Escolha DINAMICAMENTE a melhor oportunidade matemática entre "Banker", "Player" e "Tie".
3. Se o Banker 🔴 tiver tendência favorável ou a maioria recente, recomende Banker! Se o Player 🔵 estiver forte ou alternando, recomende Player! Se houver atraso ou padrão propício para Empate 🟡, recomende Empate!

RESPONDA EXCLUSIVAMENTE EM JSON VÁLIDO SEGUINDO ESTE FORMATO EXATO:
{
  "summary": "Resumo estatístico curto da tendência real da mesa (1 frase)",
  "biasDetected": "Viés estatístico observado (ex: Sequência de Banker, Alternância P/B, etc)",
  "microSeasonalTrends": ["Tendência 1", "Tendência 2"],
  "patternClusters": ["Padrão 1"],
  "riskLevel": "Baixo" | "Médio" | "Alto",
  "recommendedSignal": {
    "target": "Banker" ou "Player" ou "Tie",
    "action": "Aposta no Banker 🔴" ou "Aposta no Player 🔵" ou "Aposta no Empate 🟡",
    "tieProtection": "Proteja o empate 🟡",
    "confidence": 85,
    "probabilities": {
      "playerOrRed": 25,
      "bankerOrBlack": 65,
      "tieOrZero": 10
    },
    "rationale": "Justificativa estatística objetiva da escolha em até 15 palavras."
  }
}`;
    } else {
      let redCount = 0;
      let blackCount = 0;
      let zeroCount = 0;
      const last5 = recentSample.slice(0, 5).map((r: any) => `${r.number} (${r.color})`);

      recentSample.forEach((r: any) => {
        if (r.color === 'red') redCount++;
        else if (r.color === 'black') blackCount++;
        else if (r.number === 0 || r.color === 'green') zeroCount++;
      });

      prompt = `Você é o algoritmo de inteligência artificial preditiva sênior do CASSINO V-7.0 especializado em ROLETA AO VIVO (${game}).

DADOS REAIS PROCESSADOS DAS ÚLTIMAS ${recentSample.length} RODADAS DA ROLETA:
- Vermelho (🔴): ${redCount} (${Math.round((redCount / recentSample.length) * 100)}%)
- Preto (🖤): ${blackCount} (${Math.round((blackCount / recentSample.length) * 100)}%)
- Zero (🟢): ${zeroCount} (${Math.round((zeroCount / recentSample.length) * 100)}%)
- Sequência das últimas 5 rodadas (da mais recente para a mais antiga): ${JSON.stringify(last5)}

INSTRUÇÕES ESTATÍSTICAS FUNDAMENTAIS (ATENÇÃO OBRIGATÓRIA):
1. Analise o momento da roleta (repeticão de cor, alternância vermelho/preto, ou atraso do zero).
2. NUNCA dê sempre a mesma resposta! Escolha DINAMICAMENTE a melhor oportunidade matemática entre "Red", "Black" e "Zero".

RESPONDA EXCLUSIVAMENTE EM JSON VÁLIDO SEGUINDO ESTE FORMATO EXATO:
{
  "summary": "Resumo estatístico curto da tendência real da roleta (1 frase)",
  "biasDetected": "Viés estatístico observado",
  "microSeasonalTrends": ["Tendência 1", "Tendência 2"],
  "patternClusters": ["Padrão 1"],
  "riskLevel": "Baixo" | "Médio" | "Alto",
  "recommendedSignal": {
    "target": "Red" ou "Black" ou "Zero",
    "action": "Aposta no Vermelho 🔴" ou "Aposta no Preto 🖤" ou "Aposta no Zero 🟢",
    "tieProtection": "Proteja o Zero 🟢",
    "confidence": 85,
    "probabilities": {
      "playerOrRed": 55,
      "bankerOrBlack": 38,
      "tieOrZero": 7
    },
    "rationale": "Justificativa estatística objetiva da escolha em até 15 palavras."
  }
}`;
    }

    let textOutput = '';

    if (provider === 'gemini') {
      const aiKey = apiKey || process.env.GEMINI_API_KEY;
      if (!aiKey) {
        return res.status(400).json({ error: 'Insira sua Chave de API do Gemini no painel.' });
      }
      const aiModel = model || 'gemini-3.6-flash';

      const ai = new GoogleGenAI({
        apiKey: aiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const callGemini = async (modelToUse: string) => {
        const geminiPromise = ai.models.generateContent({
          model: modelToUse,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.35,
          },
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tempo limite da IA excedido (5s). Tente novamente.')), 5000)
        );

        const response: any = await Promise.race([geminiPromise, timeoutPromise]);
        return response.text || '';
      };

      try {
        textOutput = await callGemini(aiModel);
      } catch (gemErr: any) {
        const errMsg = gemErr.message || '';
        if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota exceeded')) {
          return res.status(400).json({
            error: `Cota gratuita excedida para a API Key do Gemini (Erro 429). Adicione faturamento à sua chave Gemini em aistudio.google.com ou selecione o provedor NVIDIA NIM (Totalmente Grátis) ou OpenRouter.`
          });
        }
        if (errMsg.includes('404') || errMsg.includes('NOT_FOUND') || errMsg.includes('no longer available')) {
          try {
            textOutput = await callGemini('gemini-1.5-flash');
          } catch (retryErr: any) {
            return res.status(400).json({ error: `Erro no Gemini: ${retryErr.message || 'Falha na resposta'}` });
          }
        } else {
          return res.status(400).json({ error: `Erro no Gemini (${aiModel}): ${errMsg || 'Falha na resposta'}` });
        }
      }
    } else if (provider === 'openrouter') {
      if (!apiKey) {
        return res.status(400).json({ error: 'Insira sua Chave de API do OpenRouter no painel de previsão.' });
      }
      const aiModel = model || 'openai/gpt-4o-mini';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://cassino-v7.app',
            'X-OpenRouter-Title': 'CASSINO V-7.0',
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const rawText = await response.text();
        let data: any;
        try {
          data = JSON.parse(rawText);
        } catch {
          return res.status(400).json({ error: `Resposta inválida da API OpenRouter (HTTP ${response.status}): ${rawText.slice(0, 150)}` });
        }

        if (!response.ok || data.error) {
          return res.status(400).json({ error: `OpenRouter Error (${response.status}): ${data.error?.message || JSON.stringify(data.error || rawText.slice(0, 150))}` });
        }
        textOutput = data.choices?.[0]?.message?.content || '';
      } catch (err: any) {
        clearTimeout(timeoutId);
        return res.status(400).json({ error: err.name === 'AbortError' ? 'Tempo limite de 5s excedido no OpenRouter.' : err.message });
      }
    } else if (provider === 'nvidia') {
      if (!apiKey) {
        return res.status(400).json({ error: 'Insira sua Chave de API da NVIDIA NIM no painel de previsão.' });
      }
      const aiModel = model || 'meta/llama-3.3-70b-instruct';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            top_p: 0.7,
            max_tokens: 512,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const rawText = await response.text();
        let data: any;
        try {
          data = JSON.parse(rawText);
        } catch {
          return res.status(400).json({ error: `Resposta inválida da API NVIDIA (HTTP ${response.status}): ${rawText.slice(0, 150)}` });
        }

        if (!response.ok || data.error || data.detail) {
          return res.status(400).json({ error: `NVIDIA API Error (${response.status}): ${data.error?.message || data.detail || rawText.slice(0, 150)}` });
        }
        textOutput = data.choices?.[0]?.message?.content || '';
      } catch (err: any) {
        clearTimeout(timeoutId);
        return res.status(400).json({ error: err.name === 'AbortError' ? 'Tempo limite de 5s excedido na NVIDIA.' : err.message });
      }
    } else {
      return res.status(400).json({ error: `Provedor de IA '${provider}' não suportado.` });
    }

    let parsedJson;
    try {
      let cleaned = textOutput.trim();
      const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        cleaned = codeBlockMatch[1].trim();
      }
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
      parsedJson = JSON.parse(cleaned);
    } catch {
      parsedJson = {
        summary: textOutput || 'Análise processada pela IA.',
        biasDetected: 'Análise estatística concluída com padrão regular.',
        microSeasonalTrends: ['Variação dentro do desvio padrão esperado.'],
        patternClusters: ['Sem clusters anômalos detectados.'],
        riskLevel: 'Médio',
        recommendedSignal: {
          action: 'Aguardar Confirmação',
          target: 'Nenhum',
          confidence: 50,
          rationale: 'Aguarde a formação do próximo ciclo estatístico.',
        },
      };
    }

    if (parsedJson && parsedJson.recommendedSignal) {
      const sig = parsedJson.recommendedSignal;
      const targetStr = String(sig.target || sig.action || '').toLowerCase();

      if (game === 'bacbo') {
        if (targetStr.includes('banker') || targetStr.includes('vermelh') || targetStr.includes('🔴')) {
          sig.target = 'Banker';
          sig.action = 'Aposta no Banker 🔴';
          sig.tieProtection = sig.tieProtection || 'Proteja o empate 🟡';
        } else if (targetStr.includes('empate') || targetStr.includes('tie') || targetStr.includes('🟡')) {
          sig.target = 'Tie';
          sig.action = 'Aposta no Empate 🟡';
          sig.tieProtection = sig.tieProtection || 'Proteção no Player / Banker';
        } else {
          sig.target = 'Player';
          sig.action = 'Aposta no Player 🔵';
          sig.tieProtection = sig.tieProtection || 'Proteja o empate 🟡';
        }
      } else {
        // Roulette
        if (targetStr.includes('pret') || targetStr.includes('black') || targetStr.includes('🖤')) {
          sig.target = 'Black';
          sig.action = 'Aposta no Preto 🖤';
          sig.tieProtection = sig.tieProtection || 'Proteja o Zero 🟢';
        } else if (targetStr.includes('zero') || targetStr.includes('verde') || targetStr.includes('🟢')) {
          sig.target = 'Zero';
          sig.action = 'Aposta no Zero 🟢';
          sig.tieProtection = sig.tieProtection || 'Proteção nas cores';
        } else {
          sig.target = 'Red';
          sig.action = 'Aposta no Vermelho 🔴';
          sig.tieProtection = sig.tieProtection || 'Proteja o Zero 🟢';
        }
      }
    }

    res.json({
      success: true,
      report: {
        timestamp: new Date().toISOString(),
        game,
        provider,
        model: model || provider,
        roundsAnalyzed: recentSample.length,
        ...parsedJson,
      },
    });
  } catch (err: any) {
    console.error('AI Analysis Endpoint Error:', err);
    res.status(500).json({ error: err.message || 'Erro ao processar análise da IA.' });
  }
});

// Reset endpoint: clears all stores and deletes Firebase RTDB records for clean restart
app.post('/api/reset', async (req, res) => {
  const { game } = req.body || {};
  try {
    if (!game || game === 'bacbo') {
      bacboStore.clear();
      await fetch(`https://fermagna-9f211-default-rtdb.firebaseio.com/cassino/bacbo.json`, { method: 'DELETE' });
    }
    if (!game || game === 'autoroulette') {
      autoRouletteStore.clear();
      await fetch(`https://fermagna-9f211-default-rtdb.firebaseio.com/cassino/autoroulette.json`, { method: 'DELETE' });
    }
    if (!game || game === 'immersiveroulette') {
      immersiveRouletteStore.clear();
      await fetch(`https://fermagna-9f211-default-rtdb.firebaseio.com/cassino/immersiveroulette.json`, { method: 'DELETE' });
    }
    res.json({ success: true, message: 'Banco de dados Firebase e memória limpos do zero.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const FIREBASE_RTDB_URL = 'https://fermagna-9f211-default-rtdb.firebaseio.com/cassino';

async function pushToFirebaseRTDB(game: string, events: any[]) {
  if (!events || events.length === 0) return;
  try {
    const payload: Record<string, any> = {};
    events.forEach((ev) => {
      if (ev && ev.id && !String(ev.id).toLowerCase().includes('seed')) payload[ev.id] = ev;
    });
    await fetch(`${FIREBASE_RTDB_URL}/${game}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Background fetch failure ignored
  }
}

function evaluateNodeBackgroundSignals(game: string, events: any[]) {
  if (!events || events.length === 0) return;
  const latest = events[0];
  if (!latest || !latest.id) return;

  const trackerKey = `node_${game}_${latest.id}`;
  if ((globalThis as any)[trackerKey]) return;
  (globalThis as any)[trackerKey] = true;

  let sigPayload: any = null;

  if (game === 'bacbo') {
    const outcomes = events.slice(0, 10).map((e) => e.outcome).filter(Boolean);
    if (outcomes.length >= 3) {
      if (outcomes[0] === 'BankerWon' && outcomes[1] === 'BankerWon' && outcomes[2] === 'BankerWon') {
        sigPayload = {
          action: 'Aposta no Banker 🔴',
          target: 'Banker',
          confidence: 88,
          pattern: 'Sequência de Banker 🔴 (3x)',
          rationale: 'Inércia forte de Banker detectada no servidor.',
          tieProtection: 'Proteja o empate 🟡',
        };
      } else if (outcomes[0] === 'PlayerWon' && outcomes[1] === 'PlayerWon' && outcomes[2] === 'PlayerWon') {
        sigPayload = {
          action: 'Aposta no Player 🔵',
          target: 'Player',
          confidence: 88,
          pattern: 'Sequência de Player 🔵 (3x)',
          rationale: 'Inércia forte de Player detectada no servidor.',
          tieProtection: 'Proteja o empate 🟡',
        };
      }
    }
  } else {
    const colors = events.slice(0, 10).map((e) => e.color).filter(Boolean);
    if (colors.length >= 3) {
      if (colors[0] === 'Red' && colors[1] === 'Red' && colors[2] === 'Red') {
        sigPayload = {
          action: 'Aposta no Vermelho 🔴',
          target: 'Red',
          confidence: 87,
          pattern: 'Sequência Vermelho 🔴 (3x)',
          rationale: 'Repetição de cor Vermelha detectada no servidor.',
          tieProtection: 'Proteja o Zero 🟢',
        };
      } else if (colors[0] === 'Black' && colors[1] === 'Black' && colors[2] === 'Black') {
        sigPayload = {
          action: 'Aposta no Preto 🖤',
          target: 'Black',
          confidence: 87,
          pattern: 'Sequência Preto 🖤 (3x)',
          rationale: 'Repetição de cor Preta detectada no servidor.',
          tieProtection: 'Proteja o Zero 🟢',
        };
      }
    }
  }

  if (sigPayload) {
    const sigId = `sig_node_${game}_${Date.now()}`;
    const nowStr = new Date().toISOString();
    const fullSig = {
      id: sigId,
      game,
      type: 'BACKGROUND_AI',
      ...sigPayload,
      timestamp: nowStr,
      createdAt: nowStr,
      triggerRoundId: latest.id,
    };

    console.log(`🚀 [BACKGROUND SINAL SERVIDOR] [${game.toUpperCase()}] ${sigPayload.action} | Confiança: ${sigPayload.confidence}% | Proteção: ${sigPayload.tieProtection}`);

    let signalSubPath = 'sinais/bacbo/americano/sinal';
    if (game === 'autoroulette') signalSubPath = 'sinais/roleta/auto/sinal';
    else if (game === 'immersiveroulette') signalSubPath = 'sinais/roleta/imersiva/sinal';

    const targetLabel = sigPayload.target === 'Player' ? 'PLAYER 🔵' : sigPayload.target === 'Banker' ? 'BANKER 🔴' : sigPayload.target === 'Red' ? 'VERMELHO 🔴' : 'PRETO 🖤';
    const isBacbo = game === 'bacbo';
    const protecaoStr = isBacbo ? '🟡 EMPATE' : '🟢 ZERO';

    const cleanSignalPayload = {
      aposta: targetLabel,
      eventType: 'CONFIRMED',
      horario: new Date().toLocaleTimeString('pt-BR'),
      mensagem: `🎯 ENTRADA CONFIRMADA\n🧠 APOSTA NO ${targetLabel}\n⚔️ PROTEÇÃO --> ${protecaoStr}\n🔁 Até Gale 1`,
      timestamp: nowStr,
      estatisticas: {
        acertos: 0,
        empates: 0,
        greens: 0,
        reds: 0,
        resumo: '📊 Total: 0 | 🎯 WinRate: 100%',
        total: 0,
        winRate: 100
      }
    };

    fetch(`https://fermagna-9f211-default-rtdb.firebaseio.com/cassino/${signalSubPath}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanSignalPayload),
    }).catch(() => {});
  }
}

async function hydrateStoreFromFirebase() {
  try {
    const games = ['bacbo', 'autoroulette', 'immersiveroulette'];
    for (const g of games) {
      const res = await fetch(`https://fermagna-9f211-default-rtdb.firebaseio.com/cassino/${g}.json`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          const store = g === 'bacbo' ? bacboStore : g === 'autoroulette' ? autoRouletteStore : immersiveRouletteStore;
          Object.values(data).forEach((ev: any) => {
            if (ev && ev.id && !String(ev.id).toLowerCase().includes('seed')) {
              store.set(ev.id, ev);
            }
          });
          console.log(`[Firebase Hydrate] Carregados ${store.size} eventos para ${g} do Firebase RTDB.`);
        }
      }
    }
  } catch (err: any) {
    console.warn('[Firebase Hydrate Warning]', err.message);
  }
}

async function pollAndSyncAllGames() {
  // BacBo
  try {
    const rawBacBo = await fetchEvolutionApi('https://api-cs.casino.org/svc-evolution-game-events/api/bacbo?page=0&size=18&sort=data%2Cdesc');
    const bacboList: BacBoEvent[] = [];
    for (const item of rawBacBo) {
      const parsed = parseBacBoEvent(item);
      if (parsed) {
        bacboStore.set(parsed.id, parsed);
        bacboList.push(parsed);
      }
    }
    const allStored = Array.from(bacboStore.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    await pushToFirebaseRTDB('bacbo', allStored);
    evaluateNodeBackgroundSignals('bacbo', allStored);
  } catch {}

  // Auto Roulette
  try {
    const rawAuto = await fetchEvolutionApi('https://api-cs.casino.org/svc-evolution-game-events/api/autoroulette?page=0&size=18&sort=data%2Cdesc');
    const autoList: RouletteEvent[] = [];
    for (const item of rawAuto) {
      const parsed = parseRouletteEvent(item);
      if (parsed) {
        autoRouletteStore.set(parsed.id, parsed);
        autoList.push(parsed);
      }
    }
    const allStored = Array.from(autoRouletteStore.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    await pushToFirebaseRTDB('autoroulette', allStored);
    evaluateNodeBackgroundSignals('autoroulette', allStored);
  } catch {}

  // Immersive Roulette
  try {
    const rawImm = await fetchEvolutionApi('https://api-cs.casino.org/svc-evolution-game-events/api/immersiveroulette?page=0&size=18&sort=data%2Cdesc');
    const immList: RouletteEvent[] = [];
    for (const item of rawImm) {
      const parsed = parseRouletteEvent(item);
      if (parsed) {
        immersiveRouletteStore.set(parsed.id, parsed);
        immList.push(parsed);
      }
    }
    const allStored = Array.from(immersiveRouletteStore.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    await pushToFirebaseRTDB('immersiveroulette', allStored);
    evaluateNodeBackgroundSignals('immersiveroulette', allStored);
  } catch {}
}

function startBackgroundFirebaseSync() {
  // Spawn ultra-fast Python spy script with unbuffered output (-u)
  const runPythonSpy = () => {
    try {
      console.log('[Server] 🚀 Iniciando processo Python Spy (spy.py -u)...');
      const spy = spawn('python3', ['-u', 'spy.py'], { stdio: 'inherit' });
      spy.on('error', (err) => {
        console.warn('[Python Spy] Erro ao executar script Python, ativando fallback em Node:', err.message);
        pollAndSyncAllGames();
        setInterval(pollAndSyncAllGames, 2000);
      });
      spy.on('exit', (code, signal) => {
        console.warn(`[Python Spy] Processo python finalizado (código ${code}, sinal ${signal}). Reiniciando em 2 segundos...`);
        setTimeout(runPythonSpy, 2000);
      });
    } catch {
      pollAndSyncAllGames();
      setInterval(pollAndSyncAllGames, 2000);
    }
  };

  runPythonSpy();
}

async function startServer() {
  // Hydrate in-memory stores from Firebase RTDB first so server memory matches Firebase 100%
  await hydrateStoreFromFirebase();

  // Start server background sync with Firebase Realtime Database
  startBackgroundFirebaseSync();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CASSINO V-7.0 Server] Executando em http://0.0.0.0:${PORT}`);
  });
}

startServer();
