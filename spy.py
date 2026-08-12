import json
import time
import urllib.request
import urllib.error
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

PRIMARY_FIREBASE_URL = "https://fermagna-9f211-default-rtdb.firebaseio.com/cassino"
SECONDARY_FIREBASE_URL = "https://fermagna-9f211-default-rtdb.firebaseio.com/cassino"
EVOLUTION_BASE_URL = "https://api-cs.casino.org/svc-evolution-game-events/api"

RED_NUMBERS = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
BLACK_NUMBERS = {2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35}
VOISINS_NUMBERS = {22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25}
TIERS_NUMBERS = {27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33}
ORPHELINS_NUMBERS = {1, 20, 14, 31, 9, 17, 34, 6}
ZERO_GAME_NUMBERS = {12, 35, 3, 26, 0, 32, 15}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

def resolve_secondary_paths(game):
    g_lower = str(game).lower()
    if "bacbo" in g_lower:
        return {
            "ultimo_path": "cassino/ultimo/bacbo/americano",
            "sinal_path": "cassino/sinais/bacbo/americano/sinal",
            "empate_path": "cassino/sinais/bacbo/americano/empate",
            "name": "BACBO (Americano)"
        }
    elif "immersiveroulette" in g_lower or "imersiva" in g_lower:
        return {
            "ultimo_path": "cassino/ultimo/roleta/imersiva",
            "sinal_path": "cassino/sinais/roleta/imersiva/sinal",
            "empate_path": "cassino/sinais/roleta/imersiva/empate",
            "name": "ROLETA IMERSIVA"
        }
    else:
        return {
            "ultimo_path": "cassino/ultimo/roleta/auto",
            "sinal_path": "cassino/sinais/roleta/auto/sinal",
            "empate_path": "cassino/sinais/roleta/auto/empate",
            "name": "ROLETA AUTO"
        }

def http_request(url, payload=None, method="GET", timeout=3):
    try:
        data_bytes = None
        headers = dict(HEADERS)
        if payload is not None:
            data_bytes = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
            if method == "GET":
                method = "POST"
                
        req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content = resp.read().decode("utf-8")
            if content:
                try:
                    return json.loads(content)
                except Exception:
                    return content
            return True
    except Exception as e:
        return None

def parse_bacbo_event(raw):
    try:
        data = raw.get("data", {})
        result = data.get("result", {})
        outcome = result.get("outcome")
        if not outcome:
            return None
        
        p_dice = result.get("playerDice") or {"first": 0, "second": 0, "score": 0}
        b_dice = result.get("bankerDice") or {"first": 0, "second": 0, "score": 0}
        
        date_str = data.get("settledAt") or data.get("startedAt") or datetime.utcnow().isoformat() + "Z"
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            minute = dt.minute
            hour = dt.hour
            time_str = f"{dt.hour:02d}:{dt.minute:02d}:{dt.second:02d}"
        except Exception:
            minute = 0
            hour = 0
            time_str = "00:00:00"
            
        p_score = p_dice.get("score") if p_dice.get("score") is not None else (p_dice.get("first", 0) + p_dice.get("second", 0))
        b_score = b_dice.get("score") if b_dice.get("score") is not None else (b_dice.get("first", 0) + b_dice.get("second", 0))
        
        return {
            "id": raw.get("id") or data.get("id"),
            "timestamp": date_str,
            "timeStr": time_str,
            "minute": minute,
            "hour": hour,
            "outcome": outcome,
            "playerScore": p_score,
            "bankerScore": b_score,
            "playerDice": {"first": p_dice.get("first", 0), "second": p_dice.get("second", 0)},
            "bankerDice": {"first": b_dice.get("first", 0), "second": b_dice.get("second", 0)},
            "scoreDiff": abs(p_score - b_score),
            "multiplier": result.get("multiplier"),
            "totalWinners": raw.get("totalWinners"),
            "totalAmount": raw.get("totalAmount"),
        }
    except Exception:
        return None

def parse_roulette_event(raw):
    try:
        data = raw.get("data", {})
        result = data.get("result", {})
        outcome = result.get("outcome")
        if not outcome or not isinstance(outcome, dict):
            return None
        
        num = outcome.get("number")
        if num is None:
            return None
            
        if outcome.get("color") == "Green":
            color = "Green"
        elif num in RED_NUMBERS:
            color = "Red"
        elif num in BLACK_NUMBERS:
            color = "Black"
        else:
            color = "Green"
            
        type_val = "Zero" if num == 0 else ("Even" if num % 2 == 0 else "Odd")
        
        date_str = data.get("settledAt") or data.get("startedAt") or datetime.utcnow().isoformat() + "Z"
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            minute = dt.minute
            hour = dt.hour
            time_str = f"{dt.hour:02d}:{dt.minute:02d}:{dt.second:02d}"
        except Exception:
            minute = 0
            hour = 0
            time_str = "00:00:00"
            
        dozen = 0
        if 1 <= num <= 12: dozen = 1
        elif 13 <= num <= 24: dozen = 2
        elif 25 <= num <= 36: dozen = 3
        
        column = 0
        if num > 0:
            if num % 3 == 1: column = 1
            elif num % 3 == 2: column = 2
            else: column = 3
            
        high_low = "Zero"
        if 1 <= num <= 18: high_low = "Low"
        elif 19 <= num <= 36: high_low = "High"
        
        sector = "Voisins"
        if num == 0 or num in ZERO_GAME_NUMBERS: sector = "Zero"
        elif num in VOISINS_NUMBERS: sector = "Voisins"
        elif num in TIERS_NUMBERS: sector = "Tiers"
        elif num in ORPHELINS_NUMBERS: sector = "Orphelins"
        
        return {
            "id": raw.get("id") or data.get("id"),
            "timestamp": date_str,
            "timeStr": time_str,
            "minute": minute,
            "hour": hour,
            "number": num,
            "color": color,
            "type": type_val,
            "dozen": dozen,
            "column": column,
            "highLow": high_low,
            "sector": sector,
            "totalWinners": raw.get("totalWinners"),
            "totalAmount": raw.get("totalAmount"),
        }
    except Exception:
        return None

def fetch_game_events(game, size=18, retries=1):
    url = f"{EVOLUTION_BASE_URL}/{game}?page=0&size={size}&sort=data%2Cdesc"
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=4) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict) and "content" in data:
                    return data["content"]
                return []
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print(f"[CASSINO SPY] ⚠️ Rate limit 429 em {game}. Aguardando 4s...", flush=True)
                time.sleep(4.0)
            elif attempt < retries:
                time.sleep(0.5)
                continue
            return []
        except Exception:
            if attempt < retries:
                time.sleep(0.5)
                continue
            return []
    return []

# Store game stats & signal state machines server-side 24/7
GAME_STATES = {
    "bacbo": {
        "processed_ids": set(),
        "stats": {"total": 0, "greens": 0, "losses": 0, "ties": 0},
        "active_signal": None,
    },
    "autoroulette": {
        "processed_ids": set(),
        "stats": {"total": 0, "greens": 0, "losses": 0, "ties": 0},
        "active_signal": None,
    },
    "immersiveroulette": {
        "processed_ids": set(),
        "stats": {"total": 0, "greens": 0, "losses": 0, "ties": 0},
        "active_signal": None,
    },
}

def hydrate_spy_state():
    """Hydrates processed_ids and active signals from Firebase on startup to prevent re-triggering old events."""
    print("[CASSINO SPY] 🔄 Hidratando estado inicial a partir do Firebase...", flush=True)
    games = ["bacbo", "autoroulette", "immersiveroulette"]
    for g in games:
        # Hydrate round IDs
        data = http_request(f"{PRIMARY_FIREBASE_URL}/{g}.json", timeout=5)
        if isinstance(data, dict):
            for r_id in data.keys():
                if r_id and "seed" not in str(r_id).lower():
                    GAME_STATES[g]["processed_ids"].add(r_id)
            print(f"[CASSINO SPY] 📌 {len(GAME_STATES[g]['processed_ids'])} IDs registrados para {g}", flush=True)

        # Hydrate signal state from clean single path
        paths = resolve_secondary_paths(g)
        sig_path = paths["sinal_path"].replace("cassino/", "")
        sig = http_request(f"{PRIMARY_FIREBASE_URL}/{sig_path}.json", timeout=5)
        if isinstance(sig, dict):
            event_type = sig.get("eventType")
            aposta = sig.get("aposta", "")
            stats = sig.get("estatisticas") or {}
            
            if stats:
                GAME_STATES[g]["stats"]["greens"] = stats.get("greens", 0)
                GAME_STATES[g]["stats"]["losses"] = stats.get("reds", 0)
                GAME_STATES[g]["stats"]["ties"] = stats.get("empates", 0)
                GAME_STATES[g]["stats"]["total"] = stats.get("total", 0)

            if event_type in ["CONFIRMED", "GALE_1"]:
                target = "Banker" if "BANKER" in aposta else ("Player" if "PLAYER" in aposta else ("Red" if "VERMELHO" in aposta else "Black"))
                GAME_STATES[g]["active_signal"] = {
                    "id": f"sig_{g}_restored",
                    "target": target,
                    "action": f"Aposta no {target}",
                    "galeStage": 1 if event_type == "GALE_1" else 0,
                    "createdAt": sig.get("timestamp", datetime.now().isoformat())
                }
                print(f"[CASSINO SPY] 🎯 Sinal ativo restaurado para {g}: {aposta} ({event_type})", flush=True)

def send_secondary_last_result(game, round_item):
    paths = resolve_secondary_paths(game)
    url = f"{SECONDARY_FIREBASE_URL}/ultimo/{paths['ultimo_path'].replace('cassino/ultimo/', '')}.json"
    
    now = datetime.now()
    hora = f"{now.hour:02d}"
    minuto = f"{now.minute:02d}"
    segundo = f"{now.second:02d}"
    horario_completo = f"{hora}:{minuto}:{segundo}"
    
    is_bacbo = "bacbo" in game.lower()
    resultado = "EMPATE"
    detalhe = ""
    numero_vencedor = None

    if is_bacbo:
        p_score = round_item.get("playerScore")
        b_score = round_item.get("bankerScore")
        if p_score is not None and b_score is not None:
            detalhe = f"{p_score}x{b_score}"
            if p_score > b_score:
                resultado = "PLAYER"
            elif b_score > p_score:
                resultado = "BANKER"
            else:
                resultado = "EMPATE"
        else:
            out = str(round_item.get("outcome") or "").lower()
            if "player" in out: resultado = "PLAYER"
            elif "banker" in out: resultado = "BANKER"
            else: resultado = "EMPATE"
    else:
        color = str(round_item.get("color") or "").lower()
        numero_vencedor = round_item.get("number")
        detalhe = str(numero_vencedor) if numero_vencedor is not None else ""
        if color == "red": resultado = "VERMELHO"
        elif color == "black": resultado = "PRETO"
        else: resultado = "VERDE"

    payload = {
        "resultado": resultado,
        "detalhe": detalhe,
        "numeroVencedor": numero_vencedor,
        "hora": hora,
        "minuto": minuto,
        "segundo": segundo,
        "horarioCompleto": horario_completo,
        "timestamp": now.isoformat(),
    }
    
    http_request(url, payload=payload, method="PUT")
    print(f"[FIREBASE SECUNDÁRIO] 💾 Resultado Atualizado ({paths['name']}): {resultado} [{detalhe}] às {horario_completo}", flush=True)

def send_secondary_clean_signal(game, event_type, target, stats):
    paths = resolve_secondary_paths(game)
    url = f"{SECONDARY_FIREBASE_URL}/sinais/{paths['sinal_path'].replace('cassino/sinais/', '')}.json"
    now = datetime.now()
    horario = now.strftime("%H:%M:%S")

    target_label = "BANKER 🔴"
    target_name = "BANKER"
    
    if target == "Player":
        target_label = "PLAYER 🔵"
        target_name = "PLAYER"
    elif target == "Banker":
        target_label = "BANKER 🔴"
        target_name = "BANKER"
    elif target == "Red":
        target_label = "VERMELHO 🔴"
        target_name = "VERMELHO"
    elif target == "Black":
        target_label = "PRETO 🖤"
        target_name = "PRETO"

    is_bacbo = "bacbo" in game.lower()
    protecao_str = "🟡 EMPATE" if is_bacbo else "🟢 ZERO"

    if event_type == "CONFIRMED":
        mensagem = f"🎯 ENTRADA CONFIRMADA\n🧠 APOSTA NO {target_label}\n⚔️ PROTEÇÃO --> {protecao_str}\n🔁 Até Gale 1"
    elif event_type == "GALE_1":
        mensagem = f"🔁 Gale 1\n{target_label}"
    elif event_type == "GREEN_DIRECT":
        mensagem = "Green de Primeira ✅🤑"
    elif event_type == "GREEN_GALE_1":
        mensagem = "Green no Gale 1 ✅🤑"
    elif event_type == "TIE":
        mensagem = "EMPATE 💰\nProteção Ativa 🟡"
    elif event_type == "RED":
        emoji = "🔴" if "🔴" in target_label else ("🔵" if "🔵" in target_label else "🖤")
        mensagem = f"Erramos\nnão veio {target_name}\n{emoji}💔"
    elif event_type == "ANALYZING":
        mensagem = "🚨.ANALISANDO O GRÁFICO.🚨"
        target_label = "ANALISANDO"
    elif event_type == "BOT_DISABLED":
        mensagem = "🔴 BOT DESLIGADO\n⚡ Geração de sinais temporariamente desativada"
    else:
        mensagem = f"STATUS: {event_type}"

    win_rate = Math_round(((stats['greens'] + stats['ties']) / stats['total']) * 100) if stats['total'] > 0 else 100

    payload = {
        "mensagem": mensagem,
        "eventType": event_type,
        "aposta": target_label,
        "horario": horario,
        "estatisticas": {
            "total": stats['total'],
            "winRate": win_rate,
            "acertos": stats['greens'] + stats['ties'],
            "greens": stats['greens'],
            "reds": stats['losses'],
            "empates": stats['ties'],
            "resumo": f"📊 Total: {stats['total']} | 🎯 WinRate: {win_rate}% | ✅ Acertos: {stats['greens'] + stats['ties']} | ❌ Red: {stats['losses']} | 🛡️ Empates: {stats['ties']}"
        },
        "timestamp": now.isoformat()
    }

    http_request(url, payload=payload, method="PUT")
    print(f"[FIREBASE SECUNDÁRIO] 📡 Sinal Enviado ({paths['name']}): {event_type} | Aposta: {target_label}", flush=True)

def send_secondary_tie_minute(game, tie_data):
    paths = resolve_secondary_paths(game)
    url = f"{SECONDARY_FIREBASE_URL}/sinais/{paths['empate_path'].replace('cassino/sinais/', '')}.json"
    
    minute_val = tie_data.get('minute', 0)
    minute_str = f"{minute_val:02d}"
    time_str = tie_data.get('timeStr', '')
    score_str = tie_data.get('score', '')

    payload = {
        "minuto": minute_val,
        "timeStr": time_str,
        "score": score_str,
        "sinalMinuto": f"Sinal no Minuto {minute_str} ({time_str})",
        "mensagem": f"🛡️ SINAL DE EMPATE NO MINUTO {minute_str} ({time_str})",
        "createdAt": datetime.now().isoformat()
    }
    http_request(url, payload=payload, method="PUT")

def Math_round(val):
    return int(round(val))

def process_game(game):
    raw_list = fetch_game_events(game, size=18)
    state = GAME_STATES.get(game)
    if not state:
        return 0

    if not raw_list:
        if state.get("active_signal"):
            c_at = state["active_signal"].get("createdAt")
            if c_at:
                try:
                    dt_sig = datetime.fromisoformat(c_at.replace("Z", "+00:00"))
                    now_tz = datetime.now(dt_sig.tzinfo) if dt_sig.tzinfo else datetime.utcnow()
                    if (now_tz - dt_sig).total_seconds() > 120:
                        state["active_signal"] = None
                        send_secondary_clean_signal(game, "ANALYZING", "ANALYZING", state["stats"])
                except Exception:
                    pass
        return 0

    parsed_items = []
    new_items = []
    primary_payload = {}

    for item in raw_list:
        parsed = parse_bacbo_event(item) if "bacbo" in game else parse_roulette_event(item)
        if parsed and parsed.get("id") and "seed" not in str(parsed.get("id")).lower():
            r_id = parsed["id"]
            parsed_items.append(parsed)
            primary_payload[r_id] = parsed
            
            if r_id not in state["processed_ids"]:
                new_items.append(parsed)

    if not parsed_items:
        return 0

    # Sort descending by timestamp
    parsed_items.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    new_items.sort(key=lambda x: x.get("timestamp") or "", reverse=True)

    # Check for stale data (> 120 seconds / 2 minutes old)
    is_stale = False
    latest_ts_str = parsed_items[0].get("timestamp")
    if latest_ts_str:
        try:
            clean_ts = latest_ts_str.replace("Z", "+00:00")
            dt_latest = datetime.fromisoformat(clean_ts)
            now_tz = datetime.now(dt_latest.tzinfo) if dt_latest.tzinfo else datetime.utcnow()
            diff_seconds = (now_tz - dt_latest).total_seconds()
            if diff_seconds > 120:  # > 2 minutes
                is_stale = True
        except Exception:
            pass

    if is_stale:
        paths = resolve_secondary_paths(game)
        print(f"[DADOS DESATUALIZADOS] [{paths['name']}] Última rodada com mais de 2 min. Enviando 🚨.ANALISANDO O GRÁFICO.🚨", flush=True)
        state["active_signal"] = None
        send_secondary_clean_signal(game, "ANALYZING", "ANALYZING", state["stats"])
        return 0

    # 1. Update Primary Firebase RTDB with patch
    if primary_payload:
        http_request(f"{PRIMARY_FIREBASE_URL}/{game}.json", payload=primary_payload, method="PATCH")

    # 2. Process NEW captured rounds sequentially (from oldest new to newest)
    for round_item in reversed(new_items):
        r_id = round_item["id"]
        state["processed_ids"].add(r_id)

        paths = resolve_secondary_paths(game)
        now_time = round_item.get("timeStr") or datetime.now().strftime("%H:%M:%S")

        if "bacbo" in game:
            p_s = round_item.get("playerScore")
            b_s = round_item.get("bankerScore")
            outcome = round_item.get("outcome") or ""
            res_str = "EMPATE 🟡" if p_s == b_s else ("PLAYER 🔵" if p_s > b_s else "BANKER 🔴")
            score_str = f"{p_s}x{b_s}" if p_s is not None and b_s is not None else outcome
            print(f"[RESULTADO CAPTURADO] [{paths['name']}] Resultado: {res_str} | Score: {score_str} | Horário: {now_time} | ID: {r_id}", flush=True)
        else:
            num = round_item.get("number")
            col = round_item.get("color")
            col_str = "VERMELHO 🔴" if col == "Red" else ("PRETO 🖤" if col == "Black" else "ZERO 🟢")
            print(f"[RESULTADO CAPTURADO] [{paths['name']}] Resultado: {col_str} | Número: {num} | Horário: {now_time} | ID: {r_id}", flush=True)

        # Send LAST RESULT to Secondary Firebase (PUT)
        send_secondary_last_result(game, round_item)

        # Check for Tie / Zero recording
        is_bacbo = "bacbo" in game
        is_tie_score = is_bacbo and round_item.get("playerScore") is not None and round_item.get("playerScore") == round_item.get("bankerScore")
        out_lower = str(round_item.get("outcome") or "").lower()
        is_tie = ("tie" in out_lower or "empate" in out_lower or is_tie_score or (not is_bacbo and round_item.get("number") == 0))

        if is_tie:
            min_val = round_item.get("minute", datetime.now().minute)
            score_val = f"{round_item.get('playerScore')}x{round_item.get('bankerScore')}" if is_bacbo and round_item.get('playerScore') is not None else None
            tie_payload = {
                "timestamp": round_item.get("timestamp") or datetime.now().isoformat(),
                "minute": min_val,
                "timeStr": now_time,
                "roundId": r_id,
                "score": score_val,
            }
            # Unified Tie Minute Record
            send_secondary_tie_minute(game, tie_payload)
            print(f"[EMPATE REGISTRADO] [{paths['name']}] 🛡️ Minuto {min_val:02d} ({now_time}) enviado ao Firebase", flush=True)

        # 3. Evaluate Active Signal Resolution
        active = state["active_signal"]
        if active:
            target = active["target"]
            gale_stage = active["galeStage"]
            
            # Did round win target?
            win = False
            if is_bacbo:
                if target == "Banker" and round_item.get("bankerScore", 0) > round_item.get("playerScore", 0): win = True
                elif target == "Player" and round_item.get("playerScore", 0) > round_item.get("bankerScore", 0): win = True
            else:
                if target == "Red" and round_item.get("color") == "Red": win = True
                elif target == "Black" and round_item.get("color") == "Black": win = True

            if win:
                event_type = "GREEN_DIRECT" if gale_stage == 0 else "GREEN_GALE_1"
                state["stats"]["greens"] += 1
                state["stats"]["total"] += 1
                send_secondary_clean_signal(game, event_type, target, state["stats"])
                print(f"[RESOLUÇÃO SINAL] [{paths['name']}] ✅ {event_type}! Total: {state['stats']['total']} | WinRate: {Math_round(((state['stats']['greens'] + state['stats']['ties'])/state['stats']['total'])*100)}%", flush=True)
                state["active_signal"] = None

            elif is_tie:
                event_type = "TIE"
                state["stats"]["ties"] += 1
                state["stats"]["total"] += 1
                send_secondary_clean_signal(game, event_type, target, state["stats"])
                print(f"[RESOLUÇÃO SINAL] [{paths['name']}] 🛡️ EMPATE PROTEGIDO! Total: {state['stats']['total']} | WinRate: {Math_round(((state['stats']['greens'] + state['stats']['ties'])/state['stats']['total'])*100)}%", flush=True)
                state["active_signal"] = None

            else:
                # Missed target
                if gale_stage == 0:
                    state["active_signal"]["galeStage"] = 1
                    send_secondary_clean_signal(game, "GALE_1", target, state["stats"])
                    print(f"[SINAL GALE 1] [{paths['name']}] 🔁 Avançando para Gale 1 na aposta {target}", flush=True)
                else:
                    event_type = "RED"
                    state["stats"]["losses"] += 1
                    state["stats"]["total"] += 1
                    send_secondary_clean_signal(game, event_type, target, state["stats"])
                    print(f"[RESOLUÇÃO SINAL] [{paths['name']}] ❌ RED! Total: {state['stats']['total']} | WinRate: {Math_round(((state['stats']['greens'] + state['stats']['ties'])/state['stats']['total'])*100)}%", flush=True)
                    state["active_signal"] = None

        # 4. If NO active signal, calculate prediction and trigger NEW signal 24/7
        if not state["active_signal"]:
            target_signal = None
            if is_bacbo:
                outcomes = []
                for p in parsed_items[:15]:
                    ps = p.get("playerScore")
                    bs = p.get("bankerScore")
                    if ps is not None and bs is not None:
                        if ps > bs: outcomes.append("Player")
                        elif bs > ps: outcomes.append("Banker")
                        else: outcomes.append("Tie")
                
                non_ties = [o for o in outcomes if o != "Tie"]
                if len(non_ties) >= 2:
                    if non_ties[0] == non_ties[1]:
                        target_signal = non_ties[0]  # Streak / Inertia
                    elif len(non_ties) >= 3 and non_ties[0] != non_ties[1] and non_ties[1] != non_ties[2]:
                        target_signal = "Banker" if non_ties[0] == "Player" else "Player"  # Chop / Alternation
                    else:
                        b_cnt = sum(1 for x in non_ties[:8] if x == "Banker")
                        p_cnt = sum(1 for x in non_ties[:8] if x == "Player")
                        target_signal = "Banker" if b_cnt >= p_cnt else "Player"
            else:
                colors = [p.get("color") for p in parsed_items[:15] if p.get("color") in ["Red", "Black"]]
                if len(colors) >= 2:
                    if colors[0] == colors[1]:
                        target_signal = colors[0]  # Color Streak
                    elif len(colors) >= 3 and colors[0] != colors[1] and colors[1] != colors[2]:
                        target_signal = "Black" if colors[0] == "Red" else "Red"  # Color Alternation
                    else:
                        r_cnt = sum(1 for x in colors[:8] if x == "Red")
                        b_cnt = sum(1 for x in colors[:8] if x == "Black")
                        target_signal = "Red" if r_cnt >= b_cnt else "Black"

            if target_signal:
                sig_id = f"sig_server_{game}_{int(time.time() * 1000)}"
                action_str = f"Aposta no {target_signal}"
                state["active_signal"] = {
                    "id": sig_id,
                    "target": target_signal,
                    "action": action_str,
                    "galeStage": 0,
                    "triggerRoundId": r_id,
                    "createdAt": datetime.now().isoformat()
                }

                # Unified Clean Signal Output
                send_secondary_clean_signal(game, "CONFIRMED", target_signal, state["stats"])
                print(f"[SINAL GERADO] [{paths['name']}] 🎯 ENTRADA CONFIRMADA -> Aposta no {target_signal}", flush=True)

    return len(new_items)

def spy_loop():
    print("===============================================================", flush=True)
    print("🚀 [CASSINO V-7.0 SERVER SPY] MOTOR AUTÔNOMO DE CAPTURA 24/7", flush=True)
    print("  -> Busca otimizada (size=18, intervalo 3.5s)", flush=True)
    print("  -> Prioridade: BacBo e Auto Roleta", flush=True)
    print("  -> Proteção de dados desatualizados (>2 min -> 🚨.ANALISANDO O GRÁFICO.🚨)", flush=True)
    print("===============================================================", flush=True)
    
    try:
        hydrate_spy_state()
    except Exception as e:
        print(f"[CASSINO SPY] ⚠️ Falha ao hidratar estado inicial: {e}", flush=True)

    priority_games = ["bacbo", "autoroulette"]
    secondary_games = ["immersiveroulette"]
    executor = ThreadPoolExecutor(max_workers=3)
    
    cycle_count = 0
    while True:
        try:
            cycle_count += 1
            # Run priority games every cycle, secondary games every 2nd cycle
            current_batch = priority_games + (secondary_games if cycle_count % 2 == 0 else [])
            futures = [executor.submit(process_game, g) for g in current_batch]
            for f in futures:
                f.result()
        except Exception as err:
            print(f"[ERRO NO MOTOR DE CAPTURA SERVER]: {err}", flush=True)
            time.sleep(2.0)
            
        time.sleep(3.5)
