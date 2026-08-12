import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { parseBacBoEvent, parseRouletteEvent } from './src/utils/gameParsers';
import type { BacBoEvent, RawEvolutionItem, RouletteEvent } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '5mb' }));

// In-memory persistent data accumulator store for past rounds (starts 100% clean)
const bacboStore = new Map<string, BacBoEvent>();
const autoRouletteStore = new Map<string, RouletteEvent>();
const immersiveRouletteStore = new Map<string, RouletteEvent>();

const FIREBASE_RTDB_URL = process.env.FIREBASE_RTDB_URL || process.env.VITE_FIREBASE_RTDB_URL || 'https://fermagna-9f211-default-rtdb.firebaseio.com/cassino';

// Prediction cache to avoid calling heavy trainer every request
const predictionCache: Record<string, { ts: number; payload: any }> = {};
const PRED_CACHE_TTL_MS = 5000; // 5 seconds

// Helper to fetch Evolution API
async function fetchEvolutionApi(endpointUrl: string): Promise<RawEvolutionItem[]> {
  try {
    if (typeof fetch !== 'function') {
      throw new Error('Global fetch is not available in this Node runtime. Use Node 18+ or polyfill fetch.');
    }

    const res = await fetch(endpointUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CassinoV7/1.0)',
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
      const parsed = parseBacBoEvent(item as RawEvolutionItem);
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
      const parsed = parseRouletteEvent(item as RawEvolutionItem);
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
      const parsed = parseRouletteEvent(item as RawEvolutionItem);
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

// New: Prediction endpoint that invokes the Python predictor and optionally saves signals
app.post('/api/predict', async (req, res) => {
  try {
    const { game = 'bacbo', limit = 1000, force = false } = req.body || {};
    const cacheKey = `${game}:${limit}`;
    const now = Date.now();
    if (!force && predictionCache[cacheKey] && (now - predictionCache[cacheKey].ts) < PRED_CACHE_TTL_MS) {
      return res.json({ cached: true, ...predictionCache[cacheKey].payload });
    }

    const pythonCmds = ['python3', 'python'];
    let output = '';
    let success = false;
    for (const cmd of pythonCmds) {
      try {
        await new Promise<void>((resolve, reject) => {
          const args = ['predictor.py', '--game', String(game), '--limit', String(limit), '--firebase', FIREBASE_RTDB_URL];
          const p = spawn(cmd, args, { cwd: process.cwd() });
          p.stdout.on('data', (chunk) => { output += chunk.toString(); });
          p.stderr.on('data', (c) => { console.error('[predictor]', c.toString()); });
          p.on('error', (err) => reject(err));
          p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
        });
        success = true;
        break;
      } catch (e) {
        // try next
      }
    }

    if (!success) return res.status(500).json({ error: 'Failed to execute Python predictor. Ensure Python is installed and predictor.py exists.' });

    let parsed: any;
    try { parsed = JSON.parse(output); } catch (e) { return res.status(500).json({ error: 'Invalid JSON from predictor', raw: output }); }

    // Normalize output shape
    const result = parsed.result || parsed;
    const probs = result.probabilities || {};
    const sorted = Object.entries(probs).sort((a: any, b: any) => (b[1] as number) - (a[1] as number));
    const top = sorted[0] || [null, 0];
    const second = sorted[1] || [null, 0];
    const margin = (top[1] || 0) - (second[1] || 0);

    const meets = (result.model_accuracy || 0) >= 55 && (result.confidence || 0) >= 60 && margin >= 0.12;

    const payload = { method: parsed.method || 'predictor', result, decision: meets ? 'EMIT_SIGNAL' : 'HOLD_OR_HEURISTIC', margin };
    predictionCache[cacheKey] = { ts: now, payload };

    // If decision is to emit, save a signal to Firebase
    if (meets) {
      const sigTarget = result.prediction;
      let signalSubPath = 'sinais/bacbo/americano/sinal';
      let targetLabel = 'PLAYER 🔵';
      let protecaoStr = '🟡 EMPATE';
      if (game !== 'bacbo') {
        signalSubPath = game === 'autoroulette' ? 'sinais/roleta/auto/sinal' : 'sinais/roleta/imersiva/sinal';
        targetLabel = sigTarget === 'Red' ? 'VERMELHO 🔴' : sigTarget === 'Black' ? 'PRETO 🖤' : 'ZERO 🟢';
        protecaoStr = '🟢 ZERO';
      } else {
        if (String(sigTarget).toLowerCase().includes('bank')) targetLabel = 'BANKER 🔴';
        else if (String(sigTarget).toLowerCase().includes('tie')) targetLabel = 'EMPATE 🟡';
        else targetLabel = 'PLAYER 🔵';
      }

      const nowStr = new Date().toISOString();
      const cleanSignalPayload = {
        aposta: targetLabel,
        eventType: 'MODEL_PREDICTION',
        horario: new Date().toLocaleTimeString('pt-BR'),
        mensagem: `🧠 Modelo: ${payload.method} | Aposta: ${targetLabel} | Conf: ${Math.round(result.confidence||0)}% | Acc: ${Math.round((result.model_accuracy||0))}%`,
        timestamp: nowStr,
        model_meta: {
          model_accuracy: result.model_accuracy,
          confidence: result.confidence,
          probabilities: result.probabilities,
        },
      };

      try {
        await fetch(`${FIREBASE_RTDB_URL}/${signalSubPath}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanSignalPayload),
        });
      } catch (e) {
        console.warn('Failed to push model signal to Firebase:', e);
      }
    }

    return res.json(payload);
  } catch (err: any) {
    console.error('/api/predict error', err);
    return res.status(500).json({ error: err.message });
  }
});

// Backtest endpoint: runs the predictor and returns its reported accuracy + probabilities
app.post('/api/backtest', async (req, res) => {
  try {
    const { game = 'bacbo', limit = 1000 } = req.body || {};
    // Reuse predictor.py which reports model_accuracy on a test split
    const args = ['predictor.py', '--game', game, '--limit', String(limit), '--firebase', FIREBASE_RTDB_URL];
    const pythonCmds = ['python3', 'python'];
    let output = '';
    let ok = false;
    for (const cmd of pythonCmds) {
      try {
        await new Promise<void>((resolve, reject) => {
          const p = spawn(cmd, args, { cwd: process.cwd() });
          p.stdout.on('data', (c) => (output += c.toString()));
          p.stderr.on('data', (c) => console.error('[backtest]', c.toString()));
          p.on('error', (e) => reject(e));
          p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
        });
        ok = true;
        break;
      } catch (e) {
        // try next
      }
    }
    if (!ok) return res.status(500).json({ error: 'Failed to execute predictor for backtest' });
    let parsed: any;
    try { parsed = JSON.parse(output); } catch (e) { return res.status(500).json({ error: 'Invalid JSON from predictor', raw: output }); }
    return res.json({ success: true, raw: parsed });
  } catch (err: any) {
    console.error('backtest endpoint error', err);
    return res.status(500).json({ error: err.message });
  }
});

// ... rest of server functions unchanged (pushToFirebaseRTDB, evaluateNodeBackgroundSignals, hydrate, poll etc.)

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

    fetch(`${FIREBASE_RTDB_URL}/${signalSubPath}.json`, {
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
      const res = await fetch(`${FIREBASE_RTDB_URL}/${g}.json`);
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
      const parsed = parseBacBoEvent(item as RawEvolutionItem);
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
      const parsed = parseRouletteEvent(item as RawEvolutionItem);
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
      const parsed = parseRouletteEvent(item as RawEvolutionItem);
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
      const spyPath = path.join(process.cwd(), 'spy.py');

      const tryCommands = ['python3', 'python'];

      const attempt = (commands: string[]) => {
        if (!commands || commands.length === 0) {
          console.warn('[Python Spy] Nenhum interpretador Python disponível; ativando fallback em Node.');
          pollAndSyncAllGames();
          setInterval(pollAndSyncAllGames, 2000);
          return;
        }

        const cmd = commands[0];
        console.log(`[Server] 🚀 Tentando iniciar processo Python Spy com ${cmd} (${spyPath})...`);
        const spy = spawn(cmd, ['-u', spyPath], { stdio: 'inherit' });
        spy.on('error', (err) => {
          console.warn(`[Python Spy] Erro ao executar script com ${cmd}: ${err.message}`);
          // Try next command in the list
          attempt(commands.slice(1));
        });
        spy.on('exit', (code, signal) => {
          console.warn(`[Python Spy] Processo python finalizado (código ${code}, sinal ${signal}). Reiniciando em 2 segundos...`);
          setTimeout(() => attempt(commands), 2000);
        });
      };

      attempt(tryCommands);
    } catch (e) {
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
