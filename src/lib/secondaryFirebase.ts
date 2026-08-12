import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

export const secondaryFirebaseConfig = {
  apiKey: "AIzaSyBY-5S1d28lSinOrDKKpYx2FchE6zTF0n0",
  databaseURL: "https://fermagna-9f211-default-rtdb.firebaseio.com",
  projectId: "fermagna-9f211",
  storageBucket: "fermagna-9f211.firebasestorage.app",
  appId: "1:504231568721:android:6995b0e4c9a41c98441f70"
};

const secondaryApp = getApps().find(app => app.name === 'secondaryApp') 
  || initializeApp(secondaryFirebaseConfig, 'secondaryApp');

export const secondaryDb = getDatabase(secondaryApp);
