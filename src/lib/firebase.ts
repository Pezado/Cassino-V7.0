import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Prefer Vite env variables (VITE_FIREBASE_*) for client-side builds.
// Fallback to process.env when running in Node contexts.
const env: any = (typeof import.meta !== 'undefined' && (import.meta as any).env) ? (import.meta as any).env : (typeof process !== 'undefined' ? process.env : {});

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY || "AIzaSyBY-5S1d28lSinOrDKKpYx2FchE6zTF0n0",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || env.FIREBASE_AUTH_DOMAIN || "fermagna-9f211.firebaseapp.com",
  databaseURL: env.VITE_FIREBASE_RTDB_URL || env.FIREBASE_RTDB_URL || "https://fermagna-9f211-default-rtdb.firebaseio.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || "fermagna-9f211",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || env.FIREBASE_STORAGE_BUCKET || "fermagna-9f211.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || env.FIREBASE_MESSAGING_SENDER_ID || "504231568721",
  appId: env.VITE_FIREBASE_APP_ID || env.FIREBASE_APP_ID || "1:504231568721:android:6995b0e4c9a41c98441f70",
};

// initialize Firebase app (safely handle multiple initializations)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getDatabase(app);
