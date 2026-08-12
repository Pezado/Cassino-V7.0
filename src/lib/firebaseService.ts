import { ref, set, update, onValue, push, get } from 'firebase/database';
import { db } from './firebase';

const ROOT_PATH = 'cassino';
const LEGACY_ROOT_PATH = 'bacbot';

/**
 * Clear/Reset events in Realtime Database path `cassino/${game}`
 */
export async function clearFirebaseGameEvents(game: string) {
  try {
    const eventsRef = ref(db, `${ROOT_PATH}/${game}`);
    await set(eventsRef, null);
    try { localStorage.removeItem(`cassino_events_${game}`); } catch (e) {}
  } catch (err) {
    console.error('Error clearing Firebase game events:', err);
  }
}

/**
 * Save / Update live events to Realtime Database path `cassino/${game}` & LocalStorage backup
 */
export async function syncEventsToFirebase(game: string, events: any[]) {
  if (!events || events.length === 0) return;
  try {
    // 1. LocalStorage Backup
    try {
      localStorage.setItem(`cassino_events_${game}`, JSON.stringify(events.slice(0, 300)));
    } catch (e) {}

    // 2. Firebase Update
    const eventsRef = ref(db, `${ROOT_PATH}/${game}`);
    const payload: Record<string, any> = {};
    events.forEach((ev) => {
      if (ev && ev.id && !String(ev.id).toLowerCase().includes('seed')) {
        payload[ev.id] = ev;
      }
    });
    await update(eventsRef, payload);
  } catch (err) {
    console.error('Error syncing events to Firebase Realtime Database:', err);
  }
}

/**
 * Real-time Listener for Game Events with LocalStorage Fallback
 */
export function subscribeFirebaseEvents(game: string, callback: (events: any[]) => void) {
  const eventsRef = ref(db, `${ROOT_PATH}/${game}`);
  return onValue(eventsRef, async (snapshot) => {
    const val = snapshot.val();
    const nowMs = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    if (val) {
      const list = Object.values(val)
        .filter((item: any) => {
          if (!item || !item.id || String(item.id).toLowerCase().includes('seed')) return false;
          if (item.timestamp) {
            const itemMs = new Date(item.timestamp).getTime();
            if (!isNaN(itemMs) && (nowMs - itemMs) > TWENTY_FOUR_HOURS) {
              return false; // Filter out stale rounds from previous days
            }
          }
          return true;
        })
        .sort(
          (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      try { localStorage.setItem(`cassino_events_${game}`, JSON.stringify(list.slice(0, 300))); } catch (e) {}
      callback(list);
    } else {
      // Check legacy path
      try {
        const legacyRef = ref(db, `${LEGACY_ROOT_PATH}/events/${game}`);
        const legacySnap = await get(legacyRef);
        const legacyVal = legacySnap.val();
        if (legacyVal) {
          await set(eventsRef, legacyVal);
          const list = Object.values(legacyVal)
            .filter((item: any) => item && item.id && !String(item.id).toLowerCase().includes('seed'))
            .sort(
              (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          try { localStorage.setItem(`cassino_events_${game}`, JSON.stringify(list.slice(0, 300))); } catch (e) {}
          callback(list);
          return;
        }
      } catch (e) {
        console.warn('Legacy migration check failed:', e);
      }
      
      // LocalStorage Fallback
      try {
        const cached = localStorage.getItem(`cassino_events_${game}`);
        if (cached) {
          callback(JSON.parse(cached));
          return;
        }
      } catch (e) {}
      callback([]);
    }
  }, (err) => {
    console.error('Firebase events listener error, using LocalStorage fallback:', err);
    try {
      const cached = localStorage.getItem(`cassino_events_${game}`);
      if (cached) callback(JSON.parse(cached));
    } catch (e) {}
  });
}

/**
 * Save or update an AI or Bot Signal in Firebase & LocalStorage
 */
export async function saveSignalToFirebase(signal: {
  id?: string;
  game: string;
  type?: 'AI' | 'STRATEGY' | 'SUPREME_AUTOMATIC' | string;
  action: string;
  confidence: number;
  rationale?: string;
  pattern?: string;
  timestamp?: string;
  status?: string;
  [key: string]: any;
}): Promise<string | null> {
  try {
    let subPath = 'sinais/bacbo/americano/sinal';
    const g = (signal.game || 'bacbo').toLowerCase();
    if (g.includes('auto')) subPath = 'sinais/roleta/auto/sinal';
    else if (g.includes('imersiv') || g.includes('immersive')) subPath = 'sinais/roleta/imersiva/sinal';

    const targetRef = ref(db, `${ROOT_PATH}/${subPath}`);
    const finalId = signal.id || `sig_${g}_${Date.now()}`;

    const targetLabel = signal.action?.includes('Player') || signal.target === 'Player'
      ? 'PLAYER 🔵'
      : (signal.action?.includes('Banker') || signal.target === 'Banker'
      ? 'BANKER 🔴'
      : (signal.action?.includes('Red') || signal.action?.includes('Vermelho') || signal.target === 'Red'
      ? 'VERMELHO 🔴'
      : 'PRETO 🖤'));
    const isBacbo = g.includes('bacbo');
    const protecaoStr = isBacbo ? '🟡 EMPATE' : '🟢 ZERO';

    const eventType = signal.status === 'GALE_1' || signal.galeStage === 1
      ? 'GALE_1'
      : (signal.status === 'GREEN' || signal.status === 'WIN'
      ? 'GREEN_DIRECT'
      : (signal.status === 'RED'
      ? 'RED'
      : (signal.status === 'TIE'
      ? 'TIE'
      : 'CONFIRMED')));

    let mensagem = `🎯 ENTRADA CONFIRMADA\n🧠 APOSTA NO ${targetLabel}\n⚔️ PROTEÇÃO --> ${protecaoStr}\n🔁 Até Gale 1`;
    if (eventType === 'GALE_1') {
      mensagem = `🔁 Gale 1\n${targetLabel}`;
    } else if (eventType === 'GREEN_DIRECT') {
      mensagem = `Green de Primeira ✅🤑`;
    } else if (eventType === 'RED') {
      const targetNameOnly = targetLabel.replace(/ [🔴🔵🖤]/g, '');
      const emoji = targetLabel.includes('🔴') ? '🔴' : (targetLabel.includes('🔵') ? '🔵' : '🖤');
      mensagem = `Erramos\nnão veio ${targetNameOnly}\n${emoji}💔`;
    } else if (eventType === 'TIE') {
      mensagem = `EMPATE 💰\nProteção Ativa 🟡`;
    }

    const cleanPayload = {
      aposta: targetLabel,
      eventType: eventType,
      horario: signal.timestamp || new Date().toLocaleTimeString('pt-BR'),
      mensagem: mensagem,
      timestamp: signal.createdAt || new Date().toISOString(),
      estatisticas: signal.estatisticas || {
        acertos: 0,
        empates: 0,
        greens: 0,
        reds: 0,
        resumo: '📊 Total: 0 | 🎯 WinRate: 100%',
        total: 0,
        winRate: 100
      }
    };

    // Backup to LocalStorage
    try {
      const gameKey = `cassino_signals_${g}`;
      localStorage.setItem(gameKey, JSON.stringify([cleanPayload]));
    } catch (e) {}

    await set(targetRef, cleanPayload);
    return finalId;
  } catch (err) {
    console.error('Error saving signal to Firebase:', err);
    return null;
  }
}

/**
 * Real-time Listener for Signals with LocalStorage Fallback
 */
export function subscribeFirebaseSignals(callback: (signals: any[]) => void) {
  const cleanPaths = [
    { game: 'bacbo', path: `${ROOT_PATH}/sinais/bacbo/americano/sinal` },
    { game: 'autoroulette', path: `${ROOT_PATH}/sinais/roleta/auto/sinal` },
    { game: 'immersiveroulette', path: `${ROOT_PATH}/sinais/roleta/imersiva/sinal` },
  ];

  const signalsState: Record<string, any> = {};

  const notify = () => {
    const list = Object.values(signalsState).filter(Boolean);
    try { localStorage.setItem('cassino_signals_all', JSON.stringify(list)); } catch (e) {}
    callback(list);
  };

  const unsubscribes = cleanPaths.map(({ game, path }) => {
    const signalRef = ref(db, path);
    return onValue(signalRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        signalsState[game] = {
          id: `sig_${game}_clean`,
          game,
          type: 'SUPREME_AUTOMATIC',
          action: val.aposta ? `Aposta no ${val.aposta}` : 'Aguardando',
          confidence: 88,
          status: val.eventType || 'CONFIRMED',
          timestamp: val.horario || val.timestamp,
          createdAt: val.timestamp || new Date().toISOString(),
          mensagem: val.mensagem,
          eventType: val.eventType,
          aposta: val.aposta,
          estatisticas: val.estatisticas
        };
      } else {
        delete signalsState[game];
      }
      notify();
    }, (err) => {
      console.error(`Firebase signals listener error for ${game}:`, err);
    });
  });

  return () => {
    unsubscribes.forEach((unsub) => unsub());
  };
}

/**
 * Save User Strategies to Firebase & LocalStorage
 */
export async function saveStrategiesToFirebase(strategies: any[]) {
  try {
    try { localStorage.setItem('cassino_strategies', JSON.stringify(strategies)); } catch (e) {}
    const stratRef = ref(db, `${ROOT_PATH}/strategies`);
    await set(stratRef, strategies);
  } catch (err) {
    console.error('Error saving strategies to Firebase:', err);
  }
}

/**
 * Subscribe to User Strategies with LocalStorage Fallback
 */
export function subscribeFirebaseStrategies(callback: (strategies: any[]) => void) {
  const stratRef = ref(db, `${ROOT_PATH}/strategies`);
  return onValue(stratRef, (snapshot) => {
    const val = snapshot.val();
    if (val && Array.isArray(val)) {
      try { localStorage.setItem('cassino_strategies', JSON.stringify(val)); } catch (e) {}
      callback(val);
    } else {
      try {
        const cached = localStorage.getItem('cassino_strategies');
        if (cached) callback(JSON.parse(cached));
      } catch (e) {}
    }
  });
}

/**
 * Save App State Configuration to Firebase & LocalStorage
 */
export async function saveAppConfigToFirebase(config: Record<string, any>) {
  try {
    try { localStorage.setItem('cassino_config', JSON.stringify(config)); } catch (e) {}
    const configRef = ref(db, `${ROOT_PATH}/config`);
    await set(configRef, config);
  } catch (err) {
    console.error('Error saving app config to Firebase:', err);
  }
}

/**
 * Subscribe to App State Configuration with LocalStorage Fallback
 */
export function subscribeFirebaseConfig(callback: (config: any) => void) {
  const configRef = ref(db, `${ROOT_PATH}/config`);
  return onValue(configRef, (snapshot) => {
    const val = snapshot.val();
    if (val) {
      try { localStorage.setItem('cassino_config', JSON.stringify(val)); } catch (e) {}
      callback(val);
    } else {
      try {
        const cached = localStorage.getItem('cassino_config');
        if (cached) callback(JSON.parse(cached));
      } catch (e) {}
    }
  });
}

/**
 * Save Bot Pause/Wait State, Win Streaks & Gale/Pause Settings to Firebase & LocalStorage
 */
export async function saveBotStateToFirebase(game: string, state: {
  botActive?: boolean;
  consecutiveWaitCount?: number;
  targetWaitCount?: number;
  consecutiveWins: number;
  maxGale?: number;
  pauseEnabled?: boolean;
  currentSignal?: any;
  lastEvaluatedRoundId?: string;
  lastTieMinutes?: string[];
}) {
  try {
    const payload = {
      ...state,
      game,
      updatedAt: new Date().toISOString(),
    };

    // Save to LocalStorage
    try {
      localStorage.setItem(`cassino_botState_${game}`, JSON.stringify(payload));
      if (typeof state.botActive === 'boolean') {
        localStorage.setItem(`cassino_v7_active_${game}`, JSON.stringify(state.botActive));
      }
      if (typeof state.maxGale === 'number') {
        localStorage.setItem(`cassino_v7_gale_${game}`, JSON.stringify(state.maxGale));
      }
    } catch (e) {}

    const botStateRef = ref(db, `${ROOT_PATH}/botState/${game}`);
    await set(botStateRef, payload);
  } catch (err) {
    console.warn('Notice saving bot state to Firebase:', err);
  }
}

/**
 * Save exact Tie Minute record to Firebase & LocalStorage
 */
export async function saveTieMinuteToFirebase(game: string, tieRecord: {
  timestamp: string;
  minute: number;
  timeStr: string;
  roundId?: string;
  score?: string;
}) {
  try {
    let subPath = 'sinais/bacbo/americano/empate';
    const g = (game || 'bacbo').toLowerCase();
    if (g.includes('auto')) subPath = 'sinais/roleta/auto/empate';
    else if (g.includes('imersiv') || g.includes('immersive')) subPath = 'sinais/roleta/imersiva/empate';

    const minuteVal = tieRecord.minute ?? new Date().getMinutes();
    const minStr = String(minuteVal).padStart(2, '0');
    const timeStr = tieRecord.timeStr || new Date().toLocaleTimeString('pt-BR');

    const cleanTiePayload = {
      createdAt: tieRecord.timestamp || new Date().toISOString(),
      mensagem: `🛡️ SINAL DE EMPATE NO MINUTO ${minStr} (${timeStr})`,
      minuto: minuteVal,
      score: tieRecord.score || '',
      sinalMinuto: `Sinal no Minuto ${minStr} (${timeStr})`,
      timeStr: timeStr,
    };

    // Save to LocalStorage
    try {
      const key = `cassino_tieMinutes_${game}`;
      localStorage.setItem(key, JSON.stringify([cleanTiePayload]));
    } catch (e) {}

    const tiesRef = ref(db, `${ROOT_PATH}/${subPath}`);
    await set(tiesRef, cleanTiePayload);
  } catch (err) {
    console.error('Error saving tie minute to Firebase:', err);
  }
}

/**
 * Subscribe to registered Tie Minutes from Firebase with LocalStorage Fallback
 */
export function subscribeFirebaseTieMinutes(game: string, callback: (ties: any[]) => void) {
  let subPath = 'sinais/bacbo/americano/empate';
  const g = (game || 'bacbo').toLowerCase();
  if (g.includes('auto')) subPath = 'sinais/roleta/auto/empate';
  else if (g.includes('imersiv') || g.includes('immersive')) subPath = 'sinais/roleta/imersiva/empate';

  const tiesRef = ref(db, `${ROOT_PATH}/${subPath}`);
  return onValue(tiesRef, (snapshot) => {
    const val = snapshot.val();
    if (val) {
      const list = [val];
      try { localStorage.setItem(`cassino_tieMinutes_${game}`, JSON.stringify(list)); } catch (e) {}
      callback(list);
    } else {
      try {
        const cached = localStorage.getItem(`cassino_tieMinutes_${game}`);
        if (cached) {
          callback(JSON.parse(cached));
          return;
        }
      } catch (e) {}
      callback([]);
    }
  }, (err) => {
    console.error('Firebase tie minutes listener error, using LocalStorage fallback:', err);
    try {
      const cached = localStorage.getItem(`cassino_tieMinutes_${game}`);
      if (cached) callback(JSON.parse(cached));
    } catch (e) {}
  });
}

/**
 * Subscribe to Bot Pause/Wait State from Firebase with LocalStorage Fallback
 */
export function subscribeFirebaseBotState(game: string, callback: (state: any) => void) {
  const botStateRef = ref(db, `${ROOT_PATH}/botState/${game}`);
  return onValue(botStateRef, (snapshot) => {
    const val = snapshot.val();
    if (val) {
      try { localStorage.setItem(`cassino_botState_${game}`, JSON.stringify(val)); } catch (e) {}
      callback(val);
    } else {
      try {
        const cached = localStorage.getItem(`cassino_botState_${game}`);
        if (cached) {
          callback(JSON.parse(cached));
          return;
        }
      } catch (e) {}
      callback(null);
    }
  }, (err) => {
    console.error('Firebase bot state listener error, using LocalStorage fallback:', err);
    try {
      const cached = localStorage.getItem(`cassino_botState_${game}`);
      if (cached) callback(JSON.parse(cached));
    } catch (e) {}
  });
}

export async function saveAiConfigToFirebase(gameOrConfig: string | any, configIfGame?: any) {
  try {
    const game = typeof gameOrConfig === 'string' ? gameOrConfig : 'bacbo';
    const aiConfig = typeof gameOrConfig === 'string' ? configIfGame : gameOrConfig;
    try { localStorage.setItem(`cassino_aiConfig_${game}`, JSON.stringify(aiConfig)); } catch (e) {}
    const aiConfigRef = ref(db, `${ROOT_PATH}/aiConfig/${game}`);
    await set(aiConfigRef, aiConfig);
  } catch (err) {
    console.error('Error saving AI config to Firebase:', err);
  }
}

/**
 * Subscribe to AI Configuration from Firebase with LocalStorage Fallback
 */
export function subscribeFirebaseAiConfig(gameOrCallback: string | ((config: any) => void), callbackIfGame?: (config: any) => void) {
  const game = typeof gameOrCallback === 'string' ? gameOrCallback : 'bacbo';
  const callback = typeof gameOrCallback === 'function' ? gameOrCallback : callbackIfGame!;
  const aiConfigRef = ref(db, `${ROOT_PATH}/aiConfig/${game}`);
  return onValue(aiConfigRef, (snapshot) => {
    const val = snapshot.val();
    if (val) {
      try { localStorage.setItem(`cassino_aiConfig_${game}`, JSON.stringify(val)); } catch (e) {}
      callback(val);
    } else {
      try {
        const cached = localStorage.getItem(`cassino_aiConfig_${game}`);
        if (cached) {
          callback(JSON.parse(cached));
          return;
        }
      } catch (e) {}
      callback(null);
    }
  });
}

