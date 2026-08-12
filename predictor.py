#!/usr/bin/env python3
"""
predictor.py

Simple prediction service using RandomForest for BacBo and Roulette.
Fetches historical rounds from Firebase RTDB, trains a RandomForestClassifier on recent sequences,
and outputs a JSON prediction for the next round.

Usage: python3 predictor.py --game bacbo --limit 500
"""
import os
import sys
import json
import argparse
from datetime import datetime

try:
    import requests
    import numpy as np
    import pandas as pd
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import OneHotEncoder
    from sklearn.metrics import accuracy_score
except Exception as e:
    print(json.dumps({"error": "Missing Python dependencies", "details": str(e)}))
    sys.exit(1)


def fetch_events(firebase_url: str, game: str):
    url = firebase_url.rstrip('/') + f'/{game}.json'
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        if not data:
            return []
        # data is a dict of id -> event
        events = list(data.values())
        # Ensure events have timestamp and number/outcome
        events = [e for e in events if e and e.get('timestamp')]
        # sort by timestamp ascending (oldest first)
        events.sort(key=lambda x: x.get('timestamp'))
        return events
    except Exception as e:
        return []


def prepare_bacbo_dataset(events, seq_len=5):
    # events assumed sorted oldest->newest
    rows = []
    for i in range(seq_len, len(events)):
        prev = events[i-seq_len:i]
        target = events[i]
        # build features from prev sequence
        feats = {}
        # encode last outcomes as categorical
        for j, ev in enumerate(reversed(prev), 1):
            feats[f'outcome_l{j}'] = ev.get('outcome', 'Unknown')
            feats[f'pScore_l{j}'] = ev.get('playerScore', 0) or 0
            feats[f'bScore_l{j}'] = ev.get('bankerScore', 0) or 0
        # add simple counts
        outcomes = [ev.get('outcome', 'Unknown') for ev in prev]
        feats['cnt_player'] = outcomes.count('PlayerWon')
        feats['cnt_banker'] = outcomes.count('BankerWon')
        feats['cnt_tie'] = outcomes.count('Tie')
        # time features from last event
        last_ts = prev[-1].get('timestamp')
        try:
            dt = datetime.fromisoformat(last_ts)
            feats['hour'] = dt.hour
            feats['minute'] = dt.minute
        except Exception:
            feats['hour'] = 0
            feats['minute'] = 0
        label = target.get('outcome', 'PlayerWon')
        rows.append((feats, label))

    if not rows:
        return None, None

    X = pd.DataFrame([r[0] for r in rows])
    y = pd.Series([r[1] for r in rows])

    # One-hot encode categorical outcome_l* features
    cat_cols = [c for c in X.columns if c.startswith('outcome_l')]
    ohe = OneHotEncoder(sparse=False, handle_unknown='ignore')
    if cat_cols:
        ohe_fit = ohe.fit_transform(X[cat_cols])
        ohe_names = ohe.get_feature_names_out(cat_cols)
        X_ohe = pd.DataFrame(ohe_fit, columns=ohe_names, index=X.index)
        X = pd.concat([X.drop(columns=cat_cols), X_ohe], axis=1)

    return X, y


def prepare_roulette_dataset(events, seq_len=5):
    rows = []
    for i in range(seq_len, len(events)):
        prev = events[i-seq_len:i]
        target = events[i]
        feats = {}
        for j, ev in enumerate(reversed(prev), 1):
            feats[f'num_l{j}'] = ev.get('number', 0)
            feats[f'color_l{j}'] = (ev.get('color') or 'Red')
        feats['cnt_red'] = sum(1 for ev in prev if (ev.get('color') or '').lower()=='red')
        feats['cnt_black'] = sum(1 for ev in prev if (ev.get('color') or '').lower()=='black')
        feats['cnt_zero'] = sum(1 for ev in prev if ev.get('number')==0)
        last_ts = prev[-1].get('timestamp')
        try:
            dt = datetime.fromisoformat(last_ts)
            feats['hour'] = dt.hour
        except Exception:
            feats['hour'] = 0
        label = 'Red' if (target.get('color') or 'Red') == 'Red' else ('Black' if (target.get('color') or 'Red')=='Black' else 'Zero')
        rows.append((feats, label))

    if not rows:
        return None, None

    X = pd.DataFrame([r[0] for r in rows])
    y = pd.Series([r[1] for r in rows])

    cat_cols = [c for c in X.columns if c.startswith('color_l')]
    ohe = OneHotEncoder(sparse=False, handle_unknown='ignore')
    if cat_cols:
        ohe_fit = ohe.fit_transform(X[cat_cols])
        ohe_names = ohe.get_feature_names_out(cat_cols)
        X_ohe = pd.DataFrame(ohe_fit, columns=ohe_names, index=X.index)
        X = pd.concat([X.drop(columns=cat_cols), X_ohe], axis=1)

    return X, y


def train_and_predict(X, y):
    # If too few samples, return None
    if X.shape[0] < 20:
        return None
    try:
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
        clf = RandomForestClassifier(n_estimators=100, random_state=42, class_weight='balanced')
        clf.fit(X_train, y_train)
        preds = clf.predict(X_test)
        acc = accuracy_score(y_test, preds)
        # Predict next using last row of X (most recent features)
        next_X = X.iloc[[-1]]
        probs = clf.predict_proba(next_X)[0]
        classes = clf.classes_
        prob_map = {str(c): float(p) for c, p in zip(classes, probs)}
        best_idx = probs.argmax()
        best_class = str(classes[best_idx])
        confidence = float(probs[best_idx] * 100)
        return {
            'model_accuracy': float(acc * 100),
            'probabilities': prob_map,
            'prediction': best_class,
            'confidence': confidence,
        }
    except Exception as e:
        return None


def heuristic_fallback_bacbo(events):
    # simple frequency-based heuristic on recent window
    recent = events[-30:]
    counts = {'PlayerWon':0,'BankerWon':0,'Tie':0}
    for e in recent:
        o = e.get('outcome')
        if o in counts: counts[o]+=1
    total = sum(counts.values()) or 1
    probs = {k: v/total for k,v in counts.items()}
    best = max(probs, key=probs.get)
    return {
        'model_accuracy': None,
        'probabilities': probs,
        'prediction': best,
        'confidence': float(probs[best]*100),
    }


def heuristic_fallback_roulette(events):
    recent = events[-50:]
    rc = sum(1 for e in recent if e.get('color')=='Red')
    bc = sum(1 for e in recent if e.get('color')=='Black')
    zc = sum(1 for e in recent if e.get('number')==0)
    total = rc+bc+zc or 1
    probs = {'Red': rc/total, 'Black': bc/total, 'Zero': zc/total}
    best = max(probs, key=probs.get)
    return {
        'model_accuracy': None,
        'probabilities': probs,
        'prediction': best,
        'confidence': float(probs[best]*100),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--game', required=True, choices=['bacbo','autoroulette','immersiveroulette'])
    parser.add_argument('--limit', type=int, default=1000)
    parser.add_argument('--firebase', default=os.environ.get('FIREBASE_RTDB_URL') or os.environ.get('VITE_FIREBASE_RTDB_URL'))
    args = parser.parse_args()

    firebase = args.firebase
    if not firebase:
        print(json.dumps({'error': 'FIREBASE_RTDB_URL not provided via --firebase or env FIREBASE_RTDB_URL/VITE_FIREBASE_RTDB_URL'}))
        sys.exit(1)

    events = fetch_events(firebase, args.game)
    if not events:
        print(json.dumps({'error': 'No events fetched from Firebase or empty dataset'}))
        sys.exit(0)

    # Limit to most recent N
    if args.limit and len(events) > args.limit:
        events = events[-args.limit:]

    if args.game == 'bacbo':
        X, y = prepare_bacbo_dataset(events, seq_len=5)
        if X is None:
            out = heuristic_fallback_bacbo(events)
            print(json.dumps({'method':'heuristic','result':out}))
            return
        res = train_and_predict(X, y)
        if res is None:
            out = heuristic_fallback_bacbo(events)
            print(json.dumps({'method':'heuristic','result':out}))
            return
        print(json.dumps({'method':'random_forest','result':res}))
        return
    else:
        X, y = prepare_roulette_dataset(events, seq_len=6)
        if X is None:
            out = heuristic_fallback_roulette(events)
            print(json.dumps({'method':'heuristic','result':out}))
            return
        res = train_and_predict(X, y)
        if res is None:
            out = heuristic_fallback_roulette(events)
            print(json.dumps({'method':'heuristic','result':out}))
            return
        print(json.dumps({'method':'random_forest','result':res}))


if __name__ == '__main__':
    main()
