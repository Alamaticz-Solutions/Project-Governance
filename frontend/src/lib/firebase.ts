import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDJE3mrAnrxt8DSo2O_YiioUQBnuQ5KV_E",
  authDomain: "governance-af0a4.firebaseapp.com",
  projectId: "governance-af0a4",
  storageBucket: "governance-af0a4.firebasestorage.app",
  messagingSenderId: "1025314933315",
  appId: "1:1025314933315:web:6d8e0c5e3cf6900c08e2f6",
  measurementId: "G-YSL2Z6WD22"
};

export const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export const auth = getAuth(app);
